-- ADHONEP-SC · v3.16 — desempenho das regras de acesso (RLS) — claude v1.12
-- Motivo: no teste de carga, a consulta de municípios levava ~1,3 s e a de capítulos ~0,5 s,
-- porque as funções de permissão eram chamadas UMA VEZ POR LINHA (5.573 municípios, 351 capítulos).
-- JÁ APLICADA no Supabase em 02/11/2026 (testada antes: mesma visibilidade para anon, coordenadora, diretor estadual,
-- diretor regional e administrador; tempo por tela de ~130–330 ms para ~2 ms).
-- Aqui as mesmas regras passam a ser calculadas UMA VEZ POR CONSULTA. Quem vê o quê não muda.

-- 1) Índice para o filtro por estado
create index if not exists municipalities_state_code_idx on public.municipalities (state_code);

-- 2) Ajudantes: devolvem de uma vez o que o usuário logado administra
create or replace function public.adh_my_president_chapter_ids() returns bigint[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(ur.chapter_id), '{}') from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.is_active and ur.role = 'chapter_president' and ur.chapter_id is not null
$$;

create or replace function public.adh_my_rd_region_ids() returns bigint[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(ur.region_id), '{}') from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.is_active and ur.role = 'regional_director' and ur.region_id is not null
$$;

-- Estados que o usuário gerencia (mesma regra de adh_is_state_manager_of, sem o caso "administrador/diretoria global",
-- que é testado à parte com adh_is_global_board()).
create or replace function public.adh_my_managed_ufs() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct uf), '{}') from (
    select 'SC'::text as uf where public.adh_has_role('state_director')
    union all
    select s.state_code::text from public.scope_roles s
      where s.user_id = (select auth.uid()) and s.role = 'state_director' and s.is_active and s.state_code is not null
    union all
    select st.code::text from public.scope_roles s join public.states st on st.country_iso3 = s.country_iso3
      where s.user_id = (select auth.uid()) and s.role = 'country_director' and s.is_active
  ) x
$$;

create or replace function public.adh_my_country_dirs() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct s.country_iso3::text), '{}') from public.scope_roles s
  where s.user_id = (select auth.uid()) and s.role = 'country_director' and s.is_active and s.country_iso3 is not null
$$;

revoke execute on function public.adh_my_president_chapter_ids(), public.adh_my_rd_region_ids(),
  public.adh_my_managed_ufs(), public.adh_my_country_dirs() from public, anon;
grant execute on function public.adh_my_president_chapter_ids(), public.adh_my_rd_region_ids(),
  public.adh_my_managed_ufs(), public.adh_my_country_dirs() to authenticated;

-- 3) Regras reescritas (mesmo resultado; o "(select ...)" faz o Postgres calcular uma vez só)
drop policy if exists municipalities_scoped_read on public.municipalities;
create policy municipalities_scoped_read on public.municipalities for select to authenticated
  using ( (select public.adh_is_global_board()) or state_code::text = any ((select public.adh_my_managed_ufs())::text[]) );

drop policy if exists regions_scoped_read on public.regions;
create policy regions_scoped_read on public.regions for select to authenticated
  using ( (select public.adh_is_global_board()) or state_code::text = any ((select public.adh_my_managed_ufs())::text[]) );

drop policy if exists chapters_global_read on public.chapters;
create policy chapters_global_read on public.chapters for select to authenticated
  using ( (select public.adh_is_global_board()) );

drop policy if exists chapters_scoped_read on public.chapters;
create policy chapters_scoped_read on public.chapters for select to authenticated
  using (
    id = any ((select public.adh_my_president_chapter_ids())::bigint[])
    or region_id = any ((select public.adh_my_rd_region_ids())::bigint[])
    or state_code::text = any ((select public.adh_my_managed_ufs())::text[])
    or country_iso3::text = any ((select public.adh_my_country_dirs())::text[])
  );
