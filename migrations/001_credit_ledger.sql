-- Experimental ledger foundation. Apply only to a dedicated test database.
CREATE TABLE IF NOT EXISTS credit_accounts (
  id text PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS credit_grants (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES credit_accounts(id),
  idempotency_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('PROMOTIONAL', 'SUBSCRIPTION', 'PURCHASED')),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS credit_reservations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES credit_accounts(id),
  idempotency_key text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  ttl_seconds integer NOT NULL CHECK (ttl_seconds BETWEEN 1 AND 3600),
  expires_at timestamptz NOT NULL,
  settled_amount integer CHECK (settled_amount >= 0 AND settled_amount <= amount),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS credit_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES credit_accounts(id),
  reservation_id bigint NOT NULL UNIQUE REFERENCES credit_reservations(id),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_reservations_account_status ON credit_reservations (account_id, status);
