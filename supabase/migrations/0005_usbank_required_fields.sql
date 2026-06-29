-- The required US Bank "Create Order" dropdowns (red-asterisk fields) confirmed
-- on review: Special Pre-Approval, Delegated Procurement Authority, A/BO-RM/FM
-- Pre-Purch Approvals, Section 508 Consideration, Request to Purchase Received,
-- Spend Analysis, Required Source Screened, Final Delivery Outside US, and the
-- order-level Line Item Tax. Stored as one jsonb blob (like line_items /
-- section_889) rather than a column per field. Nullable — records saved before
-- these fields existed read back as null and are backfilled on next save.

alter table public.records
  add column if not exists us_bank_fields jsonb;
