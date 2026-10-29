ALTER TABLE ai_traces DROP CONSTRAINT IF EXISTS ai_traces_provider_check;
ALTER TABLE ai_traces ADD CONSTRAINT ai_traces_provider_check CHECK (length(provider) BETWEEN 1 AND 80);
