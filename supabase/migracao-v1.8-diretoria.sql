-- ADHONEP-SC claude v1.8 — o presidente do capítulo pode cadastrar a própria diretoria
-- Rode UMA vez no SQL Editor (pode rodar de novo). Pressupõe migracao-v1.1-gestao.sql.
-- Regra: o presidente grava/edita/apaga cargos do SEU capítulo, exceto o cargo "Presidente..."
-- (esse continua sendo definido pela diretoria da região ou do estado).
begin;

drop policy if exists lm_insert on public.leader_mandates;
drop policy if exists lm_update on public.leader_mandates;
drop policy if exists lm_delete on public.leader_mandates;

create policy lm_insert on public.leader_mandates for insert to authenticated with check (
  public.adh_is_state_manager()
  or (chapter_id is not null and public.adh_is_regional_director_of(chapter_id))
  or (chapter_id is not null and public.adh_is_president_of(chapter_id) and role_label !~* '^presidente'));

create policy lm_update on public.leader_mandates for update to authenticated
  using (
    public.adh_is_state_manager()
    or (chapter_id is not null and public.adh_is_regional_director_of(chapter_id))
    or (chapter_id is not null and public.adh_is_president_of(chapter_id) and role_label !~* '^presidente'))
  with check (
    public.adh_is_state_manager()
    or (chapter_id is not null and public.adh_is_regional_director_of(chapter_id))
    or (chapter_id is not null and public.adh_is_president_of(chapter_id) and role_label !~* '^presidente'));

create policy lm_delete on public.leader_mandates for delete to authenticated using (
  public.adh_is_state_manager()
  or (chapter_id is not null and public.adh_is_regional_director_of(chapter_id))
  or (chapter_id is not null and public.adh_is_president_of(chapter_id) and role_label !~* '^presidente'));

commit;
