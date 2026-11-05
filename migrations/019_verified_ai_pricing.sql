-- Historical example prices are untrusted. Only an operator-confirmed price can admit a paid request.
ALTER TABLE ai_model_pricing ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE ai_budget_reservations ADD COLUMN IF NOT EXISTS workspace_id text;
ALTER TABLE ai_budget_reservations ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE ai_budget_reservations ADD COLUMN IF NOT EXISTS input_per_million_usd numeric;
ALTER TABLE ai_budget_reservations ADD COLUMN IF NOT EXISTS output_per_million_usd numeric;
