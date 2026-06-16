-- Add explicit deal economics to inquiries so revenue dashboards do not rely
-- only on property price or budget fallback once a lead is booked/won.
ALTER TABLE "inquiries"
  ADD COLUMN IF NOT EXISTS "booking_amount" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "expected_commission" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "received_commission" DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "commission_status" TEXT;

