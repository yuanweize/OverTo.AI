CREATE TABLE IF NOT EXISTS shared_rate_limits (
  bucket text NOT NULL,
  window_start bigint NOT NULL,
  requests integer NOT NULL CHECK (requests > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(bucket, window_start)
);
CREATE INDEX IF NOT EXISTS shared_rate_limits_expiry_idx ON shared_rate_limits(expires_at);
