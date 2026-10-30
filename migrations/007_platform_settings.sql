CREATE TABLE IF NOT EXISTS platform_admins (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('ROOT')),
  root_slot boolean NOT NULL DEFAULT true UNIQUE CHECK (root_slot),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_site_settings (
  id integer PRIMARY KEY CHECK (id=1),
  version integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_site_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS platform_settings_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  version integer NOT NULL UNIQUE,
  before_config jsonb NOT NULL,
  after_config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
