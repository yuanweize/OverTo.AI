ALTER TABLE ai_prompt_tests ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE ai_prompt_tests ADD COLUMN IF NOT EXISTS grounded_signals integer CHECK(grounded_signals>=0);
ALTER TABLE ai_prompt_tests ADD COLUMN IF NOT EXISTS rejected_evidence integer CHECK(rejected_evidence>=0);
