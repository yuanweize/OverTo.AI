-- Migration 018: Stripe Partial Refund Tracking
CREATE TABLE IF NOT EXISTS local_stripe_refund_tracking (
  workspace_id text NOT NULL REFERENCES local_workspaces(id),
  invoice_id text NOT NULL,
  charge_id text NOT NULL,
  total_amount integer NOT NULL CHECK (total_amount > 0),
  cumulative_amount_refunded integer NOT NULL DEFAULT 0 CHECK (cumulative_amount_refunded >= 0),
  cumulative_retracted_credits integer NOT NULL DEFAULT 0 CHECK (cumulative_retracted_credits >= 0),
  last_event_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, invoice_id)
);
