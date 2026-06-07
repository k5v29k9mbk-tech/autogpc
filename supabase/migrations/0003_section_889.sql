-- Saved Section 889 determination: a point-in-time snapshot of the vendor's
-- SAM.gov representation (entity + compliance verdict) attached to a record,
-- so the verdict and the downloadable record survive without re-querying
-- SAM.gov. Nullable — a record may not have a determination yet.

alter table public.records
  add column if not exists section_889 jsonb;
