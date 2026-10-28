CREATE TABLE IF NOT EXISTS local_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES credit_accounts(id),
  reservation_id bigint NOT NULL UNIQUE REFERENCES credit_reservations(id),
  project_id text NOT NULL REFERENCES local_projects(id),
  mode text NOT NULL CHECK (mode IN ('RULES','AI')),
  provider_status text NOT NULL,
  model text,
  duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  credits integer NOT NULL CHECK (credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
