-- Mandatory-authorization detection + supporting documents.
--   mandatory_auth : { categories[], germanVendor, delivered } — the detected
--                    GPC authorization categories (reviewer-editable) plus the
--                    VAT/non-receipt-memo drivers. One jsonb blob like us_bank_fields.
--   attachments    : Attachment[] metadata (the blobs live in the `receipts`
--                    bucket at "<user_id>/<record_id>/<attachment_id>", covered
--                    by the existing owner-only storage policies). Nullable —
--                    older records read back as null.

alter table public.records
  add column if not exists mandatory_auth jsonb,
  add column if not exists attachments jsonb;
