require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');

const { readData, updateData } = require('./src/store');
const { createToken, requireAuth } = require('./src/auth');
const {
  createOrder,
  captureOrder,
  createProduct,
  createPlan,
  createSubscription
} = require('./src/paypal');

const app = express();
const PORT = Number(process.env.PORT || 3000);

if (!process.env.JWT_SECRET) {
  throw new Error('Missing JWT_SECRET environment variable.');
}

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(process.cwd()));

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(120)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const orderSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url()
});

const planSchema = z.object({
  productName: z.string().min(2),
  planName: z.string().min(2),
  price: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  intervalUnit: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']).default('MONTH'),
  intervalCount: z.number().int().positive().max(365).default(1)
});

const subscriptionSchema = z.object({
  planId: z.string().min(2),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url()
});

const localCheckoutSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive()
      })
    )
    .min(1)
    .max(50),
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(2).max(120)
  })
});

const adminStatusSchema = z.object({
  stage: z.enum(['PAYMENT_CONFIRMED', 'PROCESSING', 'DESIGNING', 'REVIEW', 'COMPLETED']),
  note: z.string().max(300).optional()
});

const adminUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  downloadUrl: z.string().url(),
  note: z.string().max(300).optional()
});

const publicOrderSchema = orderSchema.extend({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive()
      })
    )
    .max(50)
    .optional()
});

function activeSubscriptionFor(userId) {
  const data = readData();
  return data.subscriptions.find((sub) => sub.userId === userId && sub.status === 'ACTIVE');
}

function requireActiveSubscription(req, res, next) {
  const subscription = activeSubscriptionFor(req.auth.sub);

  if (!subscription) {
    return res.status(403).json({
      error: 'Active subscription required.',
      code: 'SUBSCRIPTION_REQUIRED'
    });
  }

  req.subscription = subscription;
  return next();
}

function requireAdmin(req, res, next) {
  if (req.auth.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }

  return next();
}

function createInboxMessage({ data, userId, orderId, type, title, body, metadata = {} }) {
  const message = {
    id: randomUUID(),
    userId,
    orderId: orderId || null,
    type,
    title,
    body,
    metadata,
    read: false,
    createdAt: new Date().toISOString()
  };
  data.inboxMessages.push(message);
  return message;
}

function createReceipt(order) {
  const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return {
    receiptNumber: `MCD-${order.id.slice(0, 8).toUpperCase()}`,
    orderId: order.id,
    issuedAt: order.updatedAt || order.createdAt,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    status: order.stage,
    items: order.items,
    subtotal,
    total: subtotal,
    currency: 'USD'
  };
}

function appendQueryParam(url, key, value) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password, name } = parsed.data;

  const existing = readData().users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const shouldBootstrapAdmin = !readData().users.some((entry) => (entry.role || 'customer') === 'admin');
  const user = {
    id: randomUUID(),
    email,
    name,
    passwordHash: hash,
    role: shouldBootstrapAdmin ? 'admin' : 'customer',
    createdAt: new Date().toISOString()
  };

  updateData((data) => {
    data.users.push(user);
    return data;
  });

  return res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token: createToken(user)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = readData().users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' },
    token: createToken(user)
  });
});

app.get('/api/session', requireAuth, (req, res) => {
  const user = readData().users.find((entry) => entry.id === req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role || 'customer' }
  });
});

app.get('/api/account', requireAuth, (req, res) => {
  const data = readData();
  const user = data.users.find((entry) => entry.id === req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const subscription = data.subscriptions.find((sub) => sub.userId === user.id) || null;

  return res.json({
    account: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'customer',
      createdAt: user.createdAt,
      subscription
    }
  });
});

app.get('/api/content/premium', requireAuth, requireActiveSubscription, (req, res) => {
  return res.json({
    message: 'Premium access granted.',
    subscription: req.subscription
  });
});


app.post('/api/billing/checkout/public-order', async (req, res) => {
  const parsed = publicOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const now = new Date().toISOString();
    const hasPayPalCredentials = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    if (!hasPayPalCredentials) {
      const localOrderId = randomUUID();
      const localOrder = {
        id: localOrderId,
        userId: null,
        guestEmail: null,
        customer: { email: 'guest@checkout.local', name: 'Guest customer' },
        items: parsed.data.items || [],
        amount: parsed.data.amount,
        stage: 'PAYMENT_CONFIRMED',
        timeline: [{ stage: 'PAYMENT_CONFIRMED', at: now, note: 'Local checkout fallback payment approved.' }],
        downloads: [],
        createdAt: now,
        updatedAt: now
      };
      updateData((data) => {
        data.orders.push(localOrder);
        data.paymentEvents.push({
          id: randomUUID(),
          userId: null,
          eventType: 'PUBLIC_ORDER_CREATED_LOCAL',
          provider: 'local',
          providerId: localOrder.id,
          payload: localOrder,
          createdAt: now
        });
        return data;
      });

      return res.status(201).json({
        id: `LOCAL-${localOrder.id}`,
        status: 'APPROVED',
        links: [
          {
            href: appendQueryParam(parsed.data.returnUrl, 'localOrderId', localOrder.id),
            rel: 'approve',
            method: 'GET'
          }
        ]
      });
    }

    const merchantEmail = process.env.PAYPAL_MERCHANT_EMAIL?.trim();

    const order = await createOrder({
      ...parsed.data,
      customId: `guest-${randomUUID()}`,
      payeeEmail: merchantEmail || undefined
    });

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: null,
        eventType: 'PUBLIC_ORDER_CREATED',
        provider: 'paypal',
        providerId: order.id,
        payload: {
          ...order,
          cart: parsed.data.items || []
        },
        createdAt: now
      });
      return data;
    });

    return res.status(201).json(order);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/checkout/local', (req, res) => {
  const parsed = localCheckoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const amount = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const orderId = randomUUID();
  const now = new Date().toISOString();

  const order = {
    id: orderId,
    userId: null,
    guestEmail: parsed.data.customer.email,
    customer: parsed.data.customer,
    items: parsed.data.items,
    amount,
    stage: 'PAYMENT_CONFIRMED',
    timeline: [{ stage: 'PAYMENT_CONFIRMED', at: now, note: 'Checkout payment approved.' }],
    downloads: [],
    createdAt: now,
    updatedAt: now
  };

  updateData((data) => {
    data.orders.push(order);
    data.paymentEvents.push({
      id: randomUUID(),
      userId: null,
      eventType: 'LOCAL_ORDER_CAPTURED',
      provider: 'local',
      providerId: orderId,
      payload: order,
      createdAt: now
    });
    return data;
  });

  return res.status(201).json({
    order,
    receipt: createReceipt(order),
    message: 'Order checkout complete. Receipt generated.'
  });
});

app.post('/api/orders/checkout', requireAuth, (req, res) => {
  const parsed = localCheckoutSchema.pick({ items: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  const next = updateData((data) => {
    const user = data.users.find((entry) => entry.id === req.auth.sub);
    if (!user) {
      return data;
    }
    const amount = parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const order = {
      id: randomUUID(),
      userId: user.id,
      customer: { email: user.email, name: user.name },
      items: parsed.data.items,
      amount,
      stage: 'PAYMENT_CONFIRMED',
      timeline: [{ stage: 'PAYMENT_CONFIRMED', at: now, note: 'Order payment confirmed.' }],
      downloads: [],
      createdAt: now,
      updatedAt: now
    };
    data.orders.push(order);
    createInboxMessage({
      data,
      userId: user.id,
      orderId: order.id,
      type: 'ORDER_UPDATE',
      title: 'Order is processing',
      body: 'Payment confirmed. We have started your graphics order.',
      metadata: { stage: 'PAYMENT_CONFIRMED' }
    });
    return data;
  });

  const userOrders = next.orders.filter((entry) => entry.userId === req.auth.sub);
  const order = userOrders[userOrders.length - 1];
  if (!order) {
    return res.status(404).json({ error: 'Unable to create order for user.' });
  }

  return res.status(201).json({ order, receipt: createReceipt(order) });
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = readData().orders.filter((order) => order.userId === req.auth.sub);
  return res.json({ orders });
});

app.get('/api/orders/:orderId/receipt', requireAuth, (req, res) => {
  const order = readData().orders.find((entry) => entry.id === req.params.orderId && entry.userId === req.auth.sub);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.json({ receipt: createReceipt(order) });
});

app.get('/api/inbox', requireAuth, (req, res) => {
  const messages = readData().inboxMessages
    .filter((message) => message.userId === req.auth.sub)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json({ messages });
});

app.post('/api/inbox/:messageId/read', requireAuth, (req, res) => {
  const next = updateData((data) => {
    const message = data.inboxMessages.find(
      (entry) => entry.id === req.params.messageId && entry.userId === req.auth.sub
    );
    if (message) {
      message.read = true;
    }
    return data;
  });

  const message = next.inboxMessages.find((entry) => entry.id === req.params.messageId && entry.userId === req.auth.sub);
  if (!message) {
    return res.status(404).json({ error: 'Message not found.' });
  }

  return res.json({ message });
});

app.post('/api/billing/checkout/order', requireAuth, async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const order = await createOrder({
      ...parsed.data,
      customId: req.auth.sub
    });

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: req.auth.sub,
        eventType: 'ORDER_CREATED',
        provider: 'paypal',
        providerId: order.id,
        payload: order,
        createdAt: new Date().toISOString()
      });
      return data;
    });

    return res.status(201).json(order);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/billing/checkout/order/:orderId/capture', requireAuth, async (req, res) => {
  try {
    const order = await captureOrder(req.params.orderId);
    const now = new Date().toISOString();
    const purchasedItems = order.purchase_units?.[0]?.items || [];
    const total = Number(order.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || 0);

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: req.auth.sub,
        eventType: 'ORDER_CAPTURED',
        provider: 'paypal',
        providerId: order.id,
        payload: order,
        createdAt: now
      });

      const customer = data.users.find((entry) => entry.id === req.auth.sub);
      const orderRecord = {
        id: randomUUID(),
        userId: req.auth.sub,
        paypalOrderId: order.id,
        customer: {
          email: customer?.email || req.auth.email,
          name: customer?.name || 'Customer'
        },
        items: purchasedItems.map((item, index) => ({
          id: item.sku || `paypal-item-${index + 1}`,
          name: item.name || 'Creative package',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_amount?.value || 0)
        })),
        amount: total,
        stage: 'PAYMENT_CONFIRMED',
        timeline: [{ stage: 'PAYMENT_CONFIRMED', at: now, note: 'PayPal payment captured.' }],
        downloads: [],
        createdAt: now,
        updatedAt: now
      };
      data.orders.push(orderRecord);
      createInboxMessage({
        data,
        userId: req.auth.sub,
        orderId: orderRecord.id,
        type: 'ORDER_UPDATE',
        title: 'Order received',
        body: `Your order ${orderRecord.id.slice(0, 8)} is now in payment confirmed status.`,
        metadata: { stage: 'PAYMENT_CONFIRMED' }
      });
      return data;
    });

    return res.json(order);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/billing/subscriptions/plan', requireAuth, async (req, res) => {
  const parsed = planSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const product = await createProduct(parsed.data.productName);
    const plan = await createPlan({
      productId: product.id,
      planName: parsed.data.planName,
      price: parsed.data.price,
      currency: parsed.data.currency,
      intervalUnit: parsed.data.intervalUnit,
      intervalCount: parsed.data.intervalCount
    });

    return res.status(201).json({ product, plan });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/billing/subscriptions', requireAuth, async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const user = readData().users.find((entry) => entry.id === req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  try {
    const subscription = await createSubscription({
      ...parsed.data,
      subscriber: {
        email_address: user.email,
        name: {
          given_name: user.name.split(' ')[0] || user.name,
          surname: user.name.split(' ').slice(1).join(' ') || 'Customer'
        }
      },
      customId: user.id
    });

    updateData((data) => {
      const existing = data.subscriptions.find((item) => item.userId === user.id);
      const record = {
        id: randomUUID(),
        userId: user.id,
        provider: 'paypal',
        subscriptionId: subscription.id,
        status: subscription.status || 'APPROVAL_PENDING',
        planId: parsed.data.planId,
        approvalLink: subscription.links?.find((link) => link.rel === 'approve')?.href || null,
        updatedAt: new Date().toISOString()
      };

      if (existing) {
        Object.assign(existing, record);
      } else {
        data.subscriptions.push(record);
      }

      data.paymentEvents.push({
        id: randomUUID(),
        userId: user.id,
        eventType: 'SUBSCRIPTION_CREATED',
        provider: 'paypal',
        providerId: subscription.id,
        payload: subscription,
        createdAt: new Date().toISOString()
      });

      return data;
    });

    return res.status(201).json(subscription);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/billing/subscriptions/:subscriptionId/activate', requireAuth, (req, res) => {
  const { subscriptionId } = req.params;

  const result = updateData((data) => {
    const subscription = data.subscriptions.find(
      (item) => item.subscriptionId === subscriptionId && item.userId === req.auth.sub
    );

    if (!subscription) {
      return data;
    }

    subscription.status = 'ACTIVE';
    subscription.updatedAt = new Date().toISOString();
    return data;
  });

  const subscription = result.subscriptions.find(
    (item) => item.subscriptionId === subscriptionId && item.userId === req.auth.sub
  );

  if (!subscription) {
    return res.status(404).json({ error: 'Subscription not found.' });
  }

  return res.json({ subscription });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (_, res) => {
  const users = readData().users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'customer',
    createdAt: user.createdAt
  }));

  return res.json({ users });
});

app.get('/api/admin/orders', requireAuth, requireAdmin, (_, res) => {
  const orders = readData().orders;
  return res.json({ orders });
});

app.post('/api/admin/orders/:orderId/status', requireAuth, requireAdmin, (req, res) => {
  const parsed = adminStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  const next = updateData((data) => {
    const order = data.orders.find((entry) => entry.id === req.params.orderId);
    if (!order) {
      return data;
    }
    order.stage = parsed.data.stage;
    order.timeline.push({ stage: parsed.data.stage, at: now, note: parsed.data.note || null });
    order.updatedAt = now;

    if (order.userId) {
      createInboxMessage({
        data,
        userId: order.userId,
        orderId: order.id,
        type: 'ORDER_UPDATE',
        title: `Order moved to ${parsed.data.stage}`,
        body: parsed.data.note || `Your order is now in ${parsed.data.stage} stage.`,
        metadata: { stage: parsed.data.stage }
      });
    }
    return data;
  });

  const order = next.orders.find((entry) => entry.id === req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.json({ order });
});

app.post('/api/admin/orders/:orderId/upload', requireAuth, requireAdmin, (req, res) => {
  const parsed = adminUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const now = new Date().toISOString();
  const next = updateData((data) => {
    const order = data.orders.find((entry) => entry.id === req.params.orderId);
    if (!order) {
      return data;
    }

    const upload = { id: randomUUID(), ...parsed.data, createdAt: now };
    order.downloads.push(upload);
    order.stage = 'COMPLETED';
    order.timeline.push({ stage: 'COMPLETED', at: now, note: parsed.data.note || 'Final files uploaded.' });
    order.updatedAt = now;

    if (order.userId) {
      createInboxMessage({
        data,
        userId: order.userId,
        orderId: order.id,
        type: 'DELIVERY',
        title: 'Order files are ready',
        body: `Your file "${parsed.data.fileName}" is now available for download.`,
        metadata: { downloadUrl: parsed.data.downloadUrl }
      });
    }
    return data;
  });

  const order = next.orders.find((entry) => entry.id === req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.json({ order });
});

app.use((_, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
