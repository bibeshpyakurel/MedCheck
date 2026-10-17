-- MedCheck initial schema.
-- Ownership model: auth user (anonymous by default) = caregiver; a caregiver owns patients;
-- every other patient-scoped row is reachable only through a patient the caregiver owns.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.caregivers (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid() references public.caregivers (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  relationship text check (char_length(relationship) <= 120),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_caregiver_id_idx on public.patients (caregiver_id);

-- Catalog of supported products. Public read, written only by the server seed (secret key).
create table public.formulations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand_name text not null,
  generic_name text not null,
  dosage_form text not null,
  is_fictional boolean not null default false,
  ndc_packages text[] not null default '{}',
  active_ingredients jsonb not null default '[]',
  directions_text text,
  max_24h_text text,
  warnings_quotes text[] not null default '{}',
  dosage_table_html text,
  source text not null check (source in ('openfda', 'fictional')),
  openfda_set_id text,
  label_effective_date date,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index formulations_ndc_packages_idx on public.formulations using gin (ndc_packages);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  kind text not null check (kind in ('otc_package', 'drug_facts_photo', 'prescription_label', 'discharge_list', 'description')),
  photo_path text,
  transcript_text text,
  document_date date,
  facility text,
  prescriber text,
  pharmacy text,
  created_at timestamptz not null default now()
);
create index source_documents_patient_id_idx on public.source_documents (patient_id);

create table public.medication_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  source_document_id uuid references public.source_documents (id) on delete set null,
  formulation_id uuid references public.formulations (id) on delete set null,
  input_method text not null check (input_method in ('barcode', 'photo', 'voice', 'typed', 'picker')),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  fields jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index medication_entries_patient_id_idx on public.medication_entries (patient_id);
create index medication_entries_source_document_id_idx on public.medication_entries (source_document_id);
create index medication_entries_formulation_id_idx on public.medication_entries (formulation_id);

-- Append-only change log, written only by triggers.
create table public.history (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  entity text not null,
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);
create index history_patient_id_at_idx on public.history (patient_id, at desc);

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  findings_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index exports_patient_id_idx on public.exports (patient_id);

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid() references public.caregivers (id) on delete cascade,
  export_id uuid references public.exports (id) on delete set null,
  to_address text not null,
  sent_at timestamptz not null default now()
);
create index email_sends_caregiver_id_sent_at_idx on public.email_sends (caregiver_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.caregivers enable row level security;
alter table public.patients enable row level security;
alter table public.formulations enable row level security;
alter table public.source_documents enable row level security;
alter table public.medication_entries enable row level security;
alter table public.history enable row level security;
alter table public.exports enable row level security;
alter table public.email_sends enable row level security;

create policy "caregiver reads self" on public.caregivers for select to authenticated
  using ((select auth.uid()) = id);
create policy "caregiver inserts self" on public.caregivers for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "caregiver updates self" on public.caregivers for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "owner reads patients" on public.patients for select to authenticated
  using ((select auth.uid()) = caregiver_id);
create policy "owner inserts patients" on public.patients for insert to authenticated
  with check ((select auth.uid()) = caregiver_id);
create policy "owner updates patients" on public.patients for update to authenticated
  using ((select auth.uid()) = caregiver_id) with check ((select auth.uid()) = caregiver_id);
create policy "owner deletes patients" on public.patients for delete to authenticated
  using ((select auth.uid()) = caregiver_id);

create policy "anyone reads catalog" on public.formulations for select to anon, authenticated
  using (true);

-- Patient-scoped tables: ownership via the patients table (which is itself RLS-filtered).
create policy "owner reads documents" on public.source_documents for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner inserts documents" on public.source_documents for insert to authenticated
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner updates documents" on public.source_documents for update to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())))
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner deletes documents" on public.source_documents for delete to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));

create policy "owner reads entries" on public.medication_entries for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner inserts entries" on public.medication_entries for insert to authenticated
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner updates entries" on public.medication_entries for update to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())))
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner deletes entries" on public.medication_entries for delete to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));

create policy "owner reads history" on public.history for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));

create policy "owner reads exports" on public.exports for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner inserts exports" on public.exports for insert to authenticated
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));

create policy "owner reads email sends" on public.email_sends for select to authenticated
  using ((select auth.uid()) = caregiver_id);
create policy "owner inserts email sends" on public.email_sends for insert to authenticated
  with check ((select auth.uid()) = caregiver_id);

-- Data API grants (RLS above decides which rows).
grant usage on schema public to anon, authenticated;
grant select on public.formulations to anon, authenticated;
grant select, insert, update on public.caregivers to authenticated;
grant select, insert, update, delete on public.patients, public.source_documents, public.medication_entries to authenticated;
grant select on public.history to authenticated;
grant select, insert on public.exports, public.email_sends to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at and change history
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger patients_touch before update on public.patients
  for each row execute function private.touch_updated_at();
create trigger medication_entries_touch before update on public.medication_entries
  for each row execute function private.touch_updated_at();

-- SECURITY DEFINER so it can write history, which has no user insert policy.
-- Lives in the unexposed `private` schema and only runs as a trigger.
create or replace function private.record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
  pid uuid;
begin
  if tg_table_name = 'patients' then
    pid := (row_data ->> 'id')::uuid;
  else
    pid := (row_data ->> 'patient_id')::uuid;
  end if;

  -- A cascading patient delete removes its history too; don't write orphans.
  if tg_op = 'DELETE' and not exists (select 1 from public.patients where id = pid) then
    return old;
  end if;

  insert into public.history (patient_id, entity, entity_id, action, before, after, actor)
  values (
    pid,
    tg_table_name,
    (row_data ->> 'id')::uuid,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.record_history() from public;
revoke all on function private.touch_updated_at() from public;

create trigger patients_history after insert or update on public.patients
  for each row execute function private.record_history();
create trigger source_documents_history after insert or update or delete on public.source_documents
  for each row execute function private.record_history();
create trigger medication_entries_history after insert or update or delete on public.medication_entries
  for each row execute function private.record_history();

-- ---------------------------------------------------------------------------
-- Storage: private label photos, one folder per user (<uid>/<file>)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('label-photos', 'label-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "owner reads label photos" on storage.objects for select to authenticated
  using (bucket_id = 'label-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner uploads label photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'label-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner updates label photos" on storage.objects for update to authenticated
  using (bucket_id = 'label-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'label-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner deletes label photos" on storage.objects for delete to authenticated
  using (bucket_id = 'label-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
