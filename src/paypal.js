const PAYPAL_BASE_URL = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error('PayPal credentials are not configured.');
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal auth failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

async function paypalRequest(path, method = 'GET', body) {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = json.message || json.error_description || 'PayPal API call failed.';
    throw new Error(`${message} (${response.status})`);
  }

  return json;
}

async function createOrder({ amount, currency = 'USD', customId, returnUrl, cancelUrl }) {
  return paypalRequest('/v2/checkout/orders', 'POST', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        custom_id: customId,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        }
      }
    ],
    application_context: {
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  });
}

async function captureOrder(orderId) {
  return paypalRequest(`/v2/checkout/orders/${orderId}/capture`, 'POST', {});
}

async function createProduct(name) {
  return paypalRequest('/v1/catalogs/products', 'POST', {
    name,
    type: 'SERVICE'
  });
}

async function createPlan({ productId, planName, price, currency = 'USD', intervalUnit = 'MONTH', intervalCount = 1 }) {
  return paypalRequest('/v1/billing/plans', 'POST', {
    product_id: productId,
    name: planName,
    billing_cycles: [
      {
        frequency: {
          interval_unit: intervalUnit,
          interval_count: intervalCount
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            value: price.toFixed(2),
            currency_code: currency
          }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    }
  });
}

async function createSubscription({ planId, subscriber, customId, returnUrl, cancelUrl }) {
  return paypalRequest('/v1/billing/subscriptions', 'POST', {
    plan_id: planId,
    custom_id: customId,
    subscriber,
    application_context: {
      brand_name: 'Motor city designer',
      user_action: 'SUBSCRIBE_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  });
}

module.exports = {
  createOrder,
  captureOrder,
  createProduct,
  createPlan,
  createSubscription
};
