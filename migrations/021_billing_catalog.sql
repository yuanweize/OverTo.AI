-- Plan versions are immutable. New prices and terms create a new version;
-- existing subscriptions retain the version they originally purchased.
CREATE TABLE IF NOT EXISTS billing_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  version integer NOT NULL CHECK (version > 0),
  kind text NOT NULL CHECK (kind IN ('FREE','MONTHLY','CREDIT_PACK')),
  name_cs text NOT NULL CHECK (length(name_cs) BETWEEN 1 AND 100),
  name_en text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 100),
  description_cs text NOT NULL CHECK (length(description_cs) <= 500),
  description_en text NOT NULL CHECK (length(description_en) <= 500),
  currency text NOT NULL CHECK (currency IN ('CZK','EUR','USD')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0 AND amount_minor <= 1000000000),
  monthly_credits integer NOT NULL DEFAULT 0 CHECK (monthly_credits >= 0),
  pack_credits integer NOT NULL DEFAULT 0 CHECK (pack_credits >= 0),
  is_visible boolean NOT NULL DEFAULT false,
  is_purchasable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  stripe_test_product_id text,
  stripe_test_price_id text,
  stripe_live_product_id text,
  stripe_live_price_id text,
  effective_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  created_by text REFERENCES "user"(id),
  request_id uuid,
  request_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code, version),
  UNIQUE(created_by, request_id),
  CHECK (
    (kind='FREE' AND amount_minor=0 AND monthly_credits=0 AND pack_credits=0 AND NOT is_purchasable) OR
    (kind='MONTHLY' AND amount_minor>0 AND monthly_credits>0 AND pack_credits=0) OR
    (kind='CREDIT_PACK' AND amount_minor>0 AND pack_credits>0 AND monthly_credits=0)
  ),
  CHECK (retired_at IS NULL OR retired_at >= effective_at)
);
CREATE INDEX IF NOT EXISTS billing_plan_versions_catalog_idx ON billing_plan_versions(code,effective_at DESC,version DESC);
INSERT INTO billing_plan_versions(code,version,kind,name_cs,name_en,description_cs,description_en,currency,amount_minor,is_visible,is_purchasable,sort_order)
VALUES ('free',1,'FREE','Zdarma','Free','Základní analýza pravidly.','Rules-based analysis.','CZK',0,true,false,0)
ON CONFLICT(code,version) DO NOTHING;
CREATE OR REPLACE FUNCTION prevent_billing_plan_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_BILLING_PLAN_VERSION'; END;
$$;
DROP TRIGGER IF EXISTS immutable_billing_plan_version ON billing_plan_versions;
CREATE TRIGGER immutable_billing_plan_version BEFORE UPDATE OR DELETE ON billing_plan_versions
FOR EACH ROW EXECUTE FUNCTION prevent_billing_plan_version_mutation();
