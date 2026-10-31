-- Migration 017: AI Budget Accounting - Separate Actual Cost & Overage Tracking
ALTER TABLE ai_budget_reservations
  ADD COLUMN IF NOT EXISTS actual_amount_usd numeric CHECK (actual_amount_usd >= 0),
  ADD COLUMN IF NOT EXISTS is_overage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overage_amount_usd numeric NOT NULL DEFAULT 0 CHECK (overage_amount_usd >= 0),
  ADD COLUMN IF NOT EXISTS overage_reason text;
