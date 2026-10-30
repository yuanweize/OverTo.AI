CREATE TABLE IF NOT EXISTS ai_traces (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 80),
  model text,
  prompt_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('SUCCESS','UNAVAILABLE','FAILED','BLOCKED')),
  failure_reason text CHECK (failure_reason IN ('not_configured','deployment_gate','timeout','rate_limit','provider','invalid_response')),
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  rejected_evidence integer CHECK (rejected_evidence >= 0),
  estimated_cost_usd numeric CHECK (estimated_cost_usd >= 0)
);
CREATE INDEX IF NOT EXISTS ai_traces_created_idx ON ai_traces(created_at DESC);
