CREATE TABLE IF NOT EXISTS ai_model_pricing (
  model text PRIMARY KEY,
  input_per_million_usd numeric NOT NULL CHECK (input_per_million_usd >= 0),
  output_per_million_usd numeric NOT NULL CHECK (output_per_million_usd >= 0),
  max_request_cost_usd numeric NOT NULL DEFAULT 0.10 CHECK (max_request_cost_usd > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_model_pricing (model, input_per_million_usd, output_per_million_usd, max_request_cost_usd)
VALUES
  ('gpt-4o', 2.50, 10.00, 0.20),
  ('gpt-4o-mini', 0.15, 0.60, 0.05),
  ('gpt-6.1-sol', 2.50, 10.00, 0.20),
  ('gpt-6.1-mock', 2.50, 10.00, 0.20),
  ('claude-3-5-sonnet', 3.00, 15.00, 0.25),
  ('claude-3-5-haiku', 0.80, 4.00, 0.08),
  ('deepseek-chat', 0.14, 0.28, 0.03)
ON CONFLICT (model) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_budget_reservations (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL,
  reserved_amount_usd numeric NOT NULL CHECK (reserved_amount_usd > 0),
  settled_amount_usd numeric CHECK (settled_amount_usd >= 0),
  status text NOT NULL CHECK (status IN ('RESERVED', 'SETTLED', 'RELEASED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_budget_reservations_status_idx ON ai_budget_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS ai_budget_reservations_created_idx ON ai_budget_reservations(created_at DESC);
