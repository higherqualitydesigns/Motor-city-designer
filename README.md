# Motor city designer backend

This repository now includes a Node.js backend that provides:

- User sign up and login with JWT authentication
- Account endpoint with subscription details
- Subscription-gated premium access endpoint
- PayPal checkout order create + capture endpoints
- PayPal subscription product/plan creation + subscription checkout flow

## 1) Install

```bash
npm install
```

## 2) Configure environment variables

Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
```

Required PayPal variables for live storefront checkout:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV` (`sandbox` or `live`)
- Optional: `PAYPAL_RECEIVER_EMAIL` (defaults to `higherqualitydesigns@gmail.com`)

## 3) Start server

```bash
npm start
```

Server runs on `http://localhost:3000` by default.

## API quickstart

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/account` (requires Bearer token)

### Subscription access

- `GET /api/content/premium` (requires active subscription)

### PayPal one-time checkout

- `POST /api/billing/checkout/order`
- `POST /api/billing/checkout/order/:orderId/capture`

### Public storefront PayPal checkout (no auth)

- `GET /api/public/paypal/config`
- `POST /api/public/paypal/order`
- `POST /api/public/paypal/order/:orderId/capture`

The public order endpoint validates package IDs against the server-side storefront catalog and calculates totals on the server to prevent client-side price tampering.

### PayPal subscriptions

- `POST /api/billing/subscriptions/plan`
- `POST /api/billing/subscriptions`
- `POST /api/billing/subscriptions/:subscriptionId/activate`

> Note: `:subscriptionId/activate` is a local helper endpoint to mark subscriptions active after approval in sandbox workflows.

## Data storage

A local JSON store is used for portability at `data/database.json`.
