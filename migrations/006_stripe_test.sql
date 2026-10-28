-- Local Test Mode only. No live Stripe records or real payments.
CREATE TABLE IF NOT EXISTS local_stripe_customers (
  workspace_id text PRIMARY KEY REFERENCES local_workspaces(id),
  stripe_customer_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS local_stripe_subscriptions (
  workspace_id text PRIMARY KEY REFERENCES local_workspaces(id),
  stripe_subscription_id text NOT NULL UNIQUE,
  status text NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS local_stripe_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS local_stripe_checkout_attempts (
  workspace_id text PRIMARY KEY REFERENCES local_workspaces(id),
  request_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  stripe_session_id text
);
