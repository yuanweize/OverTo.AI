CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id integer PRIMARY KEY CHECK(id=1),
  version integer NOT NULL DEFAULT 0,
  config jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ai_provider_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
