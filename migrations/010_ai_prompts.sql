CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
  instructions text NOT NULL CHECK(length(instructions) BETWEEN 20 AND 4000),
  content_hash text NOT NULL,
  actor_id text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_prompt_tests (
  id uuid PRIMARY KEY,
  prompt_id uuid NOT NULL REFERENCES ai_prompt_versions(id),
  actor_id text NOT NULL REFERENCES "user"(id),
  model text NOT NULL,
  status text NOT NULL CHECK(status IN ('SUCCESS','UNAVAILABLE','FAILED','BLOCKED')),
  duration_ms integer NOT NULL CHECK(duration_ms>=0),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_prompt_activation (
  id integer PRIMARY KEY CHECK(id=1),
  version integer NOT NULL DEFAULT 0,
  prompt_id uuid REFERENCES ai_prompt_versions(id),
  test_id uuid REFERENCES ai_prompt_tests(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_prompt_activation(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS ai_operations_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id),
  action text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_prompt_tests_prompt_idx ON ai_prompt_tests(prompt_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_operations_audit_date_idx ON ai_operations_audit(created_at DESC);
CREATE OR REPLACE FUNCTION prevent_prompt_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_PROMPT_VERSION'; END;
$$;
DROP TRIGGER IF EXISTS immutable_prompt_version ON ai_prompt_versions;
CREATE TRIGGER immutable_prompt_version BEFORE UPDATE OR DELETE ON ai_prompt_versions FOR EACH ROW EXECUTE FUNCTION prevent_prompt_version_mutation();
