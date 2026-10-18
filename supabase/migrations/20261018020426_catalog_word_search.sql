-- Photo-match search that finds brands the way a package prints them. Matching the whole query
-- against the whole name let short generic names ("Extra Strength Pain Relief") outrank
-- "Excedrin Extra Strength", and "Goody's" missed "Goodys". Now: apostrophes dropped, other
-- punctuation → spaces, the dosage form included ("BC powder"), ranked by how well the query's
-- words appear in the name (word_similarity) rather than whole-string similarity.

create or replace function public.formulation_search_text(brand_name text, generic_name text, dosage_form text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(lower(brand_name || ' ' || generic_name || ' ' || dosage_form), '[''’]', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

drop index if exists public.formulations_search_idx;
create index formulations_search_idx on public.formulations
  using gin (public.formulation_search_text(brand_name, generic_name, dosage_form) extensions.gin_trgm_ops);

create or replace function public.search_formulations(query text, max_results int default 8)
returns setof public.formulations
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select public.formulation_search_text(query, '', '') as t)
  select f.*
  from public.formulations f, q
  where q.t <> ''
    and (q.t operator(extensions.<%) public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form)
      or public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form) like '%' || q.t || '%')
  order by
    extensions.word_similarity(q.t, public.formulation_search_text(f.brand_name, f.generic_name, f.dosage_form)) desc,
    extensions.similarity(q.t, public.formulation_search_text(f.brand_name, '', '')) desc,
    (f.reviewed_at is not null) desc,
    f.label_effective_date desc nulls last
  limit least(greatest(max_results, 1), 50);
$$;

grant execute on function public.search_formulations(text, int) to anon, authenticated;
