-- Vitals from a VitalLens face scan: the numbers only, never the video or any frame.
-- A value is null when VitalLens couldn't read it clearly; its confidence is kept either way.
create table public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  heart_rate_bpm smallint check (heart_rate_bpm between 20 and 250),
  heart_rate_confidence real not null check (heart_rate_confidence between 0 and 1),
  respiratory_rate_bpm smallint check (respiratory_rate_bpm between 2 and 60),
  respiratory_rate_confidence real not null check (respiratory_rate_confidence between 0 and 1),
  method text not null default 'vitallens' check (method in ('vitallens')),
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index vital_readings_patient_id_measured_at_idx on public.vital_readings (patient_id, measured_at desc);

alter table public.vital_readings enable row level security;

create policy "owner reads vital readings" on public.vital_readings for select to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner inserts vital readings" on public.vital_readings for insert to authenticated
  with check (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));
create policy "owner deletes vital readings" on public.vital_readings for delete to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_id and p.caregiver_id = (select auth.uid())));

grant select, insert, delete on public.vital_readings to authenticated;

create trigger vital_readings_history after insert or delete on public.vital_readings
  for each row execute function private.record_history();
