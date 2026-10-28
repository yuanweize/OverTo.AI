CREATE TABLE IF NOT EXISTS local_api_keys (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES local_workspaces(id),
  project_id text NOT NULL REFERENCES local_projects(id),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS local_api_keys_workspace ON local_api_keys(workspace_id);
