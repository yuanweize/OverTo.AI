-- Commercial records are partitioned by Stripe mode. Workspace identifiers in
-- financial history are opaque snapshots so an account may later be erased
-- without rewriting payment or invoice evidence.
CREATE TABLE IF NOT EXISTS billing_customers (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  workspace_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,workspace_id),
  UNIQUE (mode,stripe_customer_id)
);

CREATE TABLE IF NOT EXISTS billing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('test','live')),
  workspace_id text NOT NULL,
  plan_version_id uuid NOT NULL REFERENCES billing_plan_versions(id),
  request_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('MONTHLY','CREDIT_PACK')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency IN ('CZK','EUR','USD')),
  credits integer NOT NULL CHECK (credits > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','PAID','FAILED','EXPIRED','PARTIAL_REFUND','REFUNDED','DISPUTED')),
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  tax_amount_minor bigint CHECK (tax_amount_minor >= 0),
  amount_refunded_minor bigint NOT NULL DEFAULT 0 CHECK (amount_refunded_minor >= 0),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mode,workspace_id,request_id),
  UNIQUE (mode,stripe_checkout_session_id),
  UNIQUE (mode,stripe_payment_intent_id)
);
CREATE INDEX IF NOT EXISTS billing_orders_workspace_idx ON billing_orders(mode,workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_subscription_idx ON billing_orders(mode,stripe_subscription_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  workspace_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  plan_version_id uuid NOT NULL REFERENCES billing_plan_versions(id),
  status text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,workspace_id),
  UNIQUE (mode,stripe_subscription_id)
);

CREATE TABLE IF NOT EXISTS billing_invoices (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  stripe_invoice_id text NOT NULL,
  workspace_id text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_payment_intent_id text,
  plan_version_id uuid NOT NULL REFERENCES billing_plan_versions(id),
  status text NOT NULL,
  currency text NOT NULL CHECK (currency IN ('CZK','EUR','USD')),
  amount_due_minor bigint NOT NULL CHECK (amount_due_minor >= 0),
  amount_paid_minor bigint NOT NULL CHECK (amount_paid_minor >= 0),
  tax_amount_minor bigint CHECK (tax_amount_minor >= 0),
  hosted_invoice_url text,
  invoice_pdf_url text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,stripe_invoice_id)
);
CREATE INDEX IF NOT EXISTS billing_invoices_workspace_idx ON billing_invoices(mode,workspace_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_intent_idx ON billing_invoices(mode,stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,stripe_event_id)
);

CREATE TABLE IF NOT EXISTS billing_refund_tracking (
  mode text NOT NULL CHECK (mode IN ('test','live')),
  stripe_charge_id text NOT NULL,
  workspace_id text NOT NULL,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor > 0),
  cumulative_refunded_minor bigint NOT NULL DEFAULT 0 CHECK (cumulative_refunded_minor >= 0),
  credits_reversed integer NOT NULL DEFAULT 0 CHECK (credits_reversed >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mode,stripe_charge_id),
  CHECK (cumulative_refunded_minor <= total_amount_minor)
);
