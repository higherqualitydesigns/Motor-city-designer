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
const CHECKOUT_RECEIVER_EMAIL = process.env.PAYPAL_RECEIVER_EMAIL || 'higherqualitydesigns@gmail.com';

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

const publicOrderSchema = z.object({
  cart: z.array(
    z.object({
      id: z.string().min(2),
      quantity: z.number().int().positive().max(20)
    })
  ).min(1),
  customer: z.object({
    name: z.string().min(2),
    email: z.string().email()
  }),
  notes: z.string().max(600).optional()
});

const storefrontCatalog = {
  'brand-starter-kit': { name: 'Brand starter kit', unitAmount: 850 },
  'signature-brand-system': { name: 'Signature brand system', unitAmount: 1600 },
  'web-launch-system': { name: 'Web launch system', unitAmount: 2400 },
  'storefront-refresh': { name: 'Storefront refresh', unitAmount: 3200 },
  'launch-creative-pack': { name: 'Launch creative pack', unitAmount: 700 },
  'monthly-design-pit-pass': { name: 'Monthly design pit pass', unitAmount: 1200 }
};

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

app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/public/paypal/config', (_, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID || null;

  return res.json({
    clientId,
    currency: 'USD',
    receiverEmail: CHECKOUT_RECEIVER_EMAIL,
    ready: Boolean(clientId)
  });
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
  const user = {
    id: randomUUID(),
    email,
    name,
    passwordHash: hash,
    role: 'customer',
    createdAt: new Date().toISOString()
  };

  updateData((data) => {
    data.users.push(user);
    return data;
  });

  return res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name },
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
    user: { id: user.id, email: user.email, name: user.name },
    token: createToken(user)
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

app.post('/api/public/paypal/order', async (req, res) => {
  const parsed = publicOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return res.status(503).json({ error: 'PayPal is not configured on the server.' });
  }

  const { cart, customer, notes } = parsed.data;
  const lineItems = cart.map((item) => {
    const catalogItem = storefrontCatalog[item.id];
    if (!catalogItem) {
      return null;
    }

    return {
      id: item.id,
      name: catalogItem.name,
      quantity: item.quantity,
      unitAmount: catalogItem.unitAmount
    };
  });

  if (lineItems.some((item) => item === null)) {
    return res.status(400).json({ error: 'Cart includes an unknown package id.' });
  }

  const normalizedItems = lineItems;
  const subtotal = normalizedItems.reduce((sum, item) => sum + (item.unitAmount * item.quantity), 0);
  const total = Number(subtotal.toFixed(2));
  const invoiceId = `MCD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const order = await createOrder({
      amount: total,
      currency: 'USD',
      customId: customer.email,
      returnUrl: `${req.protocol}://${req.get('host')}/?checkout=success&invoice=${invoiceId}`,
      cancelUrl: `${req.protocol}://${req.get('host')}/?checkout=cancelled&invoice=${invoiceId}`,
      invoiceId,
      description: notes || `Creative services invoice for ${customer.name}`,
      items: normalizedItems.map((item) => ({
        name: item.name,
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: 'USD',
          value: item.unitAmount.toFixed(2)
        }
      })),
      payeeEmail: CHECKOUT_RECEIVER_EMAIL,
      requestId: invoiceId,
      customerEmail: customer.email
    });

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: null,
        eventType: 'PUBLIC_ORDER_CREATED',
        provider: 'paypal',
        providerId: order.id,
        payload: {
          order,
          invoiceId,
          customer
        },
        createdAt: new Date().toISOString()
      });
      return data;
    });

    return res.status(201).json({
      ...order,
      invoiceId,
      receiverEmail: CHECKOUT_RECEIVER_EMAIL
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/public/paypal/order/:orderId/capture', async (req, res) => {
  try {
    const order = await captureOrder(req.params.orderId);

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: null,
        eventType: 'PUBLIC_ORDER_CAPTURED',
        provider: 'paypal',
        providerId: order.id,
        payload: order,
        createdAt: new Date().toISOString()
      });
      return data;
    });

    return res.json(order);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
});

app.post('/api/billing/checkout/order/:orderId/capture', requireAuth, async (req, res) => {
  try {
    const order = await captureOrder(req.params.orderId);

    updateData((data) => {
      data.paymentEvents.push({
        id: randomUUID(),
        userId: req.auth.sub,
        eventType: 'ORDER_CAPTURED',
        provider: 'paypal',
        providerId: order.id,
        payload: order,
        createdAt: new Date().toISOString()
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

app.use((_, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
