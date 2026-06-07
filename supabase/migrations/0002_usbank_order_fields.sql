-- US Bank order fields set during review and reused when creating the order.
-- Both are NOT NULL with defaults so existing rows backfill cleanly and inserts
-- that omit them still succeed.
--
-- requestor_name:            the cardholder / account name (US Bank "Requestor").
-- emergency_type_operation:  the ETO designation; the standard answer is the
--                            default, switched to "In Support of ETO" per order.

alter table public.records
  add column if not exists requestor_name text not null default '',
  add column if not exists emergency_type_operation text not null
    default 'Not in support of ETO';
