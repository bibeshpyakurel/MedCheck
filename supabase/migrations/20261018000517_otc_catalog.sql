-- Full US OTC catalog: one row per FDA label, with every Drug Facts section the medicine card shows,
-- the source links it cites, and a name search for matching a photo to a label.
-- Spec: docs/superpowers/specs/2026-10-17-otc-catalog-design.md

alter table public.formulations
  add column labeler_name text,
  -- { "<LabelSectionKey>": ["bullet", …] } — the label's own text split into short bullets.
  add column label_sections jsonb not null default '{}',
  -- [{ "label": "FDA label (DailyMed)", "url": "https://…" }, …]
  add column source_links jsonb not null default '[]';

create extension if not exists pg_trgm with schema extensions;

create index formulations_search_idx on public.formulations
  using gin ((lower(brand_name || ' ' || generic_name)) extensions.gin_trgm_ops);

-- Catalog rows whose brand or generic name resembles `query`, best first. Hand-checked rows win ties.
create or replace function public.search_formulations(query text, max_results int default 8)
returns setof public.formulations
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.formulations f
  where lower(f.brand_name || ' ' || f.generic_name) operator(extensions.%) lower(query)
     or lower(f.brand_name || ' ' || f.generic_name) like '%' || lower(query) || '%'
  order by
    extensions.similarity(lower(f.brand_name || ' ' || f.generic_name), lower(query)) desc,
    (f.reviewed_at is not null) desc,
    f.label_effective_date desc nulls last
  limit least(greatest(max_results, 1), 50);
$$;

grant execute on function public.search_formulations(text, int) to anon, authenticated;
