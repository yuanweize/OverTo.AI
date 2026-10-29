ALTER TABLE local_api_keys ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['analysis:rules','analysis:ai'];
ALTER TABLE local_api_keys ADD COLUMN IF NOT EXISTS daily_request_limit integer NOT NULL DEFAULT 1000 CHECK(daily_request_limit BETWEEN 1 AND 100000);
ALTER TABLE local_api_keys ADD COLUMN IF NOT EXISTS quota_id text;
UPDATE local_api_keys SET quota_id=id WHERE quota_id IS NULL;
ALTER TABLE local_api_keys ALTER COLUMN quota_id SET NOT NULL;
