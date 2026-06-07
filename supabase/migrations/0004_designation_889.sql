-- US Bank "889 Designation" classification picked by the reviewer on the order
-- form (e.g. "889 Government", "889 Merchant Rep", "889 Rebate"). Distinct from
-- section_889, which is the saved SAM.gov representation snapshot. Nullable —
-- a record may not have a designation chosen yet.

alter table public.records
  add column if not exists designation_889 text;
