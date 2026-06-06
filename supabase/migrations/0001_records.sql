-- Nexus — per-user record persistence.
--
-- Run this in the Supabase dashboard (SQL Editor) once. It creates the records
-- table with Row-Level Security so each signed-in user can only see and touch
-- their own rows, plus a private Storage bucket for receipt images with the
-- same owner-only rules. The app's supabaseStore adapter targets these.
--
-- Column types mirror PurchaseRecord (src/core/types.ts). Timestamps are stored
-- as text so the app's ISO strings round-trip exactly (and still sort/order
-- chronologically, since ISO-8601 is lexicographic).

-- ── records table ───────────────────────────────────────────────────────────
create table if not exists public.records (
  id                 text primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vendor             text not null default '',
  transaction_date   text not null default '',
  total_amount       text not null default '',
  currency           text not null default '',
  tax_amount         text,
  card_last4         text,
  receipt_number     text,
  invoice_number     text,
  line_items         jsonb not null default '[]'::jsonb,
  notes              text not null default '',
  raw_ocr_text       text not null default '',
  image_uri          text not null default '',
  status             text not null default 'needs_review',
  document_checklist jsonb not null default '{}'::jsonb,
  capture_seconds    integer,
  source             text not null default 'tesseract',
  doc_type           text not null default 'receipt',
  created_at         text not null,
  updated_at         text not null
);

create index if not exists records_user_created_idx
  on public.records (user_id, created_at desc);

alter table public.records enable row level security;

-- Owner-only access. auth.uid() comes from the caller's JWT (the publishable
-- key alone grants nothing without a session).
drop policy if exists "records_select_own" on public.records;
create policy "records_select_own" on public.records
  for select using (auth.uid() = user_id);

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own" on public.records
  for insert with check (auth.uid() = user_id);

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own" on public.records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own" on public.records
  for delete using (auth.uid() = user_id);

-- ── receipts storage bucket ─────────────────────────────────────────────────
-- Private bucket; objects live at "<user_id>/<record_id>". The first path
-- segment must equal the caller's uid, so users only reach their own images.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_update_own" on storage.objects;
create policy "receipts_update_own" on storage.objects
  for update using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );
