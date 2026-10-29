CREATE TABLE IF NOT EXISTS ai_evaluation_runs (
  id uuid PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id),
  mode text NOT NULL CHECK(mode IN ('RULES_ONLY','LLM_ONLY','HYBRID_AI')),
  model text,
  prompt_version text NOT NULL,
  dataset_version text NOT NULL,
  status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED')),
  requested_cases integer NOT NULL CHECK(requested_cases BETWEEN 1 AND 100),
  rows jsonb NOT NULL DEFAULT '[]',
  summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_evaluation_runs_date ON ai_evaluation_runs(created_at DESC);
