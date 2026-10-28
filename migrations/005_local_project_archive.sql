ALTER TABLE local_projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
