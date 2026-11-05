-- Preserve original grants; refunds and corrections are append-only compensating entries.
CREATE TABLE IF NOT EXISTS credit_reversals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES credit_accounts(id),
  grant_id bigint NOT NULL REFERENCES credit_grants(id),
  idempotency_key text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS credit_reversals_grant_id_idx ON credit_reversals(grant_id);
