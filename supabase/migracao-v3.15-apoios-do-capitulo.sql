-- ADHONEP-SC · O capítulo informa se tem Apoio Jovem e/ou Apoio Feminino (para não ficar relatório "pendente" de apoio que não existe)
-- Quem informa: presidente do capítulo, diretor regional do capítulo ou administrador. Padrão: tem os dois.
-- Seguro para rodar mais de uma vez.
create table if not exists public.chapter_supports (
  chapter_id bigint primary key references public.chapters(id) on delete cascade,
  has_youth boolean not null default true,
  has_women boolean not null default true,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.chapter_supports enable row level security;
drop policy if exists csp_select on public.chapter_supports;
create policy csp_select on public.chapter_supports for select to authenticated
  using (public.adh_can_see_report_chapter(chapter_id) or public.adh_is_coordinator_of(chapter_id));
revoke all on public.chapter_supports from anon, authenticated;
grant select on public.chapter_supports to authenticated;

create or replace function public.adh_set_chapter_support(p_chapter bigint, p_kind text, p_value boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Faça login.'; end if;
  if p_kind not in ('youth','women') then raise exception 'Apoio inválido.'; end if;
  if not (public.is_state_admin() or public.adh_is_president_of(p_chapter) or public.adh_is_regional_director_of(p_chapter)) then
    raise exception 'Sem permissão para alterar os apoios deste capítulo.'; end if;
  insert into public.chapter_supports(chapter_id, has_youth, has_women, updated_by)
  values (p_chapter, case when p_kind = 'youth' then p_value else true end, case when p_kind = 'women' then p_value else true end, auth.uid())
  on conflict (chapter_id) do update set
    has_youth = case when p_kind = 'youth' then p_value else public.chapter_supports.has_youth end,
    has_women = case when p_kind = 'women' then p_value else public.chapter_supports.has_women end,
    updated_by = auth.uid(), updated_at = now();
  return true;
end $$;
revoke all on function public.adh_set_chapter_support(bigint, text, boolean) from public, anon;
grant execute on function public.adh_set_chapter_support(bigint, text, boolean) to authenticated;
