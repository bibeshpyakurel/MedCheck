-- Store-brand packages print the store as the brand ("Walgreens Allergy Relief") while the FDA
-- label's brand is just "Allergy Relief" and the store is the labeler. Search the labeler too.
-- The brand-only tie-break stays on brand_name.

create or replace function public.formulation_search_text(
  brand_name text, generic_name text, dosage_form text, labeler_name text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(
      lower(brand_name || ' ' || generic_name || ' ' || dosage_form || ' ' || coalesce(labeler_name, '')),
      '[''’]', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

drop index if exists public.formulations_search_idx;
create index formulations_search_idx on public.formulations
  using gin (public.formulation_search_text(brand_name, generic_name, dosage_form, labeler_name) extensions.gin_trgm_ops);

create or replace function public.search_formulations(query text, max_results int default 8)
returns setof public.formulations
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select public.formulation_search_text(query, '', '', null) as t)
  select f.*
  from public.formulations f, q
  where q.t <> ''
    and (q.t operator(extensions.<%) public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form, f.labeler_name)
      or public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form, f.labeler_name) like '%' || q.t || '%')
  order by
    extensions.word_similarity(q.t, public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form, f.labeler_name)) desc,
    extensions.similarity(q.t, public.formulation_search_text(f.brand_name, '', '', null)) desc,
    (f.reviewed_at is not null) desc,
    f.label_effective_date desc nulls last
  limit least(greatest(max_results, 1), 50);
$$;

drop function if exists public.formulation_search_text(text, text, text);

grant execute on function public.search_formulations(text, int) to anon, authenticated;
