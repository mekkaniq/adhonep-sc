-- ADHONEP-SC claude v1.4 — regras de perfis definidas pela diretoria
-- Idempotente e em transação (se algo falhar, nada é aplicado). FAÇA BACKUP e teste primeiro em homologação.
-- Pressupõe aplicadas: 3v.4, 3v.6, 3v.8, v1.2-imagens e v1.3-publicacao.
--
-- REGRAS IMPLEMENTADAS
--  Administrador (state_admin): tudo, inclusive apagar.
--  Diretor estadual (state_director): vê e publica/edita eventos, comunicados, preletores e capítulos;
--     NÃO apaga nada (apagar é só do administrador), NÃO altera regiões, municípios nem papéis de usuário.
--  Presidente de capítulo: publica eventos do PRÓPRIO capítulo sem revisão; envia relatórios; baixa a lista de preletores.
--  Preletores: todos os líderes (admin, diretor estadual, diretor regional, presidente) LEEM; só administrador,
--     diretor estadual e "responsáveis por preletores" (designados por eles) ALTERAM.
--  Comunicados: ESTADUAIS são publicados pelo administrador ou diretor estadual; REGIONAIS são publicados
--     pelo diretor da região e identificados com a região (o site público mostra por região).
begin;

-- ---------- Funções auxiliares
create or replace function public.adh_is_state_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_state_admin() or public.adh_has_role('state_director');
$$;

create table if not exists public.speaker_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.speaker_editors enable row level security;
revoke all on public.speaker_editors from anon, authenticated;
grant select on public.speaker_editors to authenticated;
drop policy if exists speaker_editors_read on public.speaker_editors;
create policy speaker_editors_read on public.speaker_editors for select to authenticated
  using (user_id = auth.uid() or public.adh_is_state_manager());

create or replace function public.adh_can_manage_speakers()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.adh_is_state_manager()
      or exists (select 1 from public.speaker_editors e where e.user_id = auth.uid());
$$;

create or replace function public.adh_is_leader()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.is_active
                   and ur.role in ('state_admin','state_director','regional_director','chapter_president'))
      or exists (select 1 from public.speaker_editors e where e.user_id = auth.uid());
$$;

create or replace function public.adh_is_regional_director_of_region(p_region bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_region is not null and exists (select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.is_active and ur.role = 'regional_director' and ur.region_id = p_region);
$$;

-- designação de responsáveis por preletores (só administrador/diretor estadual; sem escrita direta na tabela)
create or replace function public.adh_list_speaker_editors()
returns table(user_id uuid, email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.user_id, u.email::text, e.created_at from public.speaker_editors e
  join auth.users u on u.id = e.user_id where public.adh_is_state_manager() order by e.created_at;
$$;
create or replace function public.adh_grant_speaker_editor(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.adh_is_state_manager() then raise exception 'Sem permissão.'; end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v is null then raise exception 'Não existe conta com este e-mail. Peça ao administrador para criar a conta antes.'; end if;
  insert into public.speaker_editors(user_id, granted_by) values (v, auth.uid()) on conflict do nothing;
end; $$;
create or replace function public.adh_revoke_speaker_editor(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.adh_is_state_manager() then raise exception 'Sem permissão.'; end if;
  delete from public.speaker_editors where user_id = p_user;
end; $$;

revoke all on function public.adh_is_state_manager(), public.adh_can_manage_speakers(), public.adh_is_leader(),
  public.adh_is_regional_director_of_region(bigint), public.adh_list_speaker_editors(),
  public.adh_grant_speaker_editor(text), public.adh_revoke_speaker_editor(uuid) from public, anon;
grant execute on function public.adh_is_state_manager(), public.adh_can_manage_speakers(), public.adh_is_leader(),
  public.adh_is_regional_director_of_region(bigint), public.adh_list_speaker_editors(),
  public.adh_grant_speaker_editor(text), public.adh_revoke_speaker_editor(uuid) to authenticated;

-- ---------- Eventos: presidente publica no próprio capítulo; apagar só administrador
drop policy if exists "ADHONEP state admins insert events" on public.events;
drop policy if exists "ADHONEP state admins update events" on public.events;
drop policy if exists "ADHONEP state admins delete events" on public.events;
drop policy if exists events_insert_managers on public.events;
drop policy if exists events_update_managers on public.events;
drop policy if exists events_delete_admin on public.events;
drop policy if exists events_scoped_read on public.events;
create policy events_insert_managers on public.events for insert to authenticated
  with check (public.adh_is_state_manager() or public.adh_is_president_of(chapter_id));
create policy events_update_managers on public.events for update to authenticated
  using (public.adh_is_state_manager() or public.adh_is_president_of(chapter_id))
  with check (public.adh_is_state_manager() or public.adh_is_president_of(chapter_id));
create policy events_delete_admin on public.events for delete to authenticated using (public.is_state_admin());
create policy events_scoped_read on public.events for select to authenticated
  using (public.adh_is_state_manager() or public.adh_is_president_of(chapter_id) or public.adh_is_regional_director_of(chapter_id));

-- convites (imagens): presidente e diretoria enviam; alterar/apagar arquivo continua só do administrador
drop policy if exists "ADHONEP state admins upload event invitations" on storage.objects;
drop policy if exists "ADHONEP leaders upload event invitations" on storage.objects;
create policy "ADHONEP leaders upload event invitations" on storage.objects for insert to authenticated
  with check (bucket_id = 'adhonep-event-invitations'
              and (public.adh_is_state_manager() or public.adh_has_role('chapter_president'))
              and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));

-- ---------- Preletores: líderes leem; administrador, diretor estadual e responsáveis designados alteram; apagar só administrador
drop policy if exists speakers_admin_all on public.speakers;
drop policy if exists speakers_leaders_read on public.speakers;
drop policy if exists speakers_managers_insert on public.speakers;
drop policy if exists speakers_managers_update on public.speakers;
drop policy if exists speakers_admin_delete on public.speakers;
create policy speakers_leaders_read on public.speakers for select to authenticated using (public.adh_is_leader());
create policy speakers_managers_insert on public.speakers for insert to authenticated
  with check (public.adh_can_manage_speakers() and (created_by is null or created_by = auth.uid()));
create policy speakers_managers_update on public.speakers for update to authenticated
  using (public.adh_can_manage_speakers()) with check (public.adh_can_manage_speakers());
create policy speakers_admin_delete on public.speakers for delete to authenticated using (public.is_state_admin());

-- ---------- Comunicados: estadual (admin/diretor estadual) e regional (diretor da região)
alter table public.statewide_announcements add column if not exists scope text not null default 'state';
alter table public.statewide_announcements add column if not exists region_id bigint;
alter table public.statewide_announcements drop constraint if exists announcements_scope_chk;
alter table public.statewide_announcements add constraint announcements_scope_chk
  check (scope in ('state','regional') and ((scope = 'state' and region_id is null) or (scope = 'regional' and region_id is not null)));

create or replace function public.adh_announcement_defaults()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now(); new.decision_by := auth.uid(); new.decided_at := now();
  end if;
  return new;
end; $$;
revoke all on function public.adh_announcement_defaults() from public, anon, authenticated;
drop trigger if exists announcements_defaults on public.statewide_announcements;
create trigger announcements_defaults before insert or update on public.statewide_announcements
  for each row execute function public.adh_announcement_defaults();

drop policy if exists announcements_admin_all on public.statewide_announcements;
drop policy if exists announcements_managers_select on public.statewide_announcements;
drop policy if exists announcements_managers_insert on public.statewide_announcements;
drop policy if exists announcements_managers_update on public.statewide_announcements;
drop policy if exists announcements_admin_delete on public.statewide_announcements;
drop policy if exists announcements_regional_select on public.statewide_announcements;
drop policy if exists announcements_regional_insert on public.statewide_announcements;
drop policy if exists announcements_regional_update on public.statewide_announcements;
create policy announcements_managers_select on public.statewide_announcements for select to authenticated using (public.adh_is_state_manager());
create policy announcements_managers_insert on public.statewide_announcements for insert to authenticated with check (public.adh_is_state_manager());
create policy announcements_managers_update on public.statewide_announcements for update to authenticated
  using (public.adh_is_state_manager()) with check (public.adh_is_state_manager());
create policy announcements_admin_delete on public.statewide_announcements for delete to authenticated using (public.is_state_admin());
create policy announcements_regional_select on public.statewide_announcements for select to authenticated
  using (scope = 'regional' and public.adh_is_regional_director_of_region(region_id));
create policy announcements_regional_insert on public.statewide_announcements for insert to authenticated
  with check (scope = 'regional' and public.adh_is_regional_director_of_region(region_id));
create policy announcements_regional_update on public.statewide_announcements for update to authenticated
  using (scope = 'regional' and public.adh_is_regional_director_of_region(region_id))
  with check (scope = 'regional' and public.adh_is_regional_director_of_region(region_id));

create or replace view public.public_announcements as
  select id, title, category, priority, summary, body, starts_at, ends_at,
         action_label, action_url, show_popup, published_at, scope, region_id
  from public.statewide_announcements
  where status = 'published' and starts_at <= now() and (ends_at is null or ends_at >= now());
revoke all on public.public_announcements from public, anon, authenticated;
grant select on public.public_announcements to anon, authenticated;

-- ---------- Capítulos: diretor estadual edita/publica (sem apagar)
drop policy if exists chapters_state_manager_update on public.chapters;
create policy chapters_state_manager_update on public.chapters for update to authenticated
  using (public.adh_is_state_manager()) with check (public.adh_is_state_manager());

-- ---------- Auditoria: diretor estadual lê; todos os líderes registram suas ações
drop policy if exists audit_admin_select on public.admin_audit_log;
create policy audit_admin_select on public.admin_audit_log for select to authenticated using (public.adh_is_state_manager());
drop policy if exists audit_admin_insert on public.admin_audit_log;
create policy audit_admin_insert on public.admin_audit_log for insert to authenticated
  with check (public.adh_is_leader() and (actor_id is null or actor_id = auth.uid()));

create or replace function public.adh_audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; o jsonb; v_changed text[]; v_id text; v_sum text;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_id := coalesce(r->>'id', r->>'user_id');
  v_sum := coalesce(r->>'name', r->>'title', r->>'full_name', r->>'role', v_id);
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(r) k
      where k <> 'updated_at' and (r->k) is distinct from (o->k);
    if v_changed is null then return new; end if;
  end if;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, summary, metadata)
  values (auth.uid(), 'db_' || lower(tg_op), tg_table_name, v_id, left(v_sum, 200),
          jsonb_build_object('changed', to_jsonb(coalesce(v_changed, array[]::text[])), 'status', r->>'status'));
  return case when tg_op = 'DELETE' then old else new end;
end; $$;
revoke all on function public.adh_audit_row() from public, anon, authenticated;
drop trigger if exists speaker_editors_audit on public.speaker_editors;
create trigger speaker_editors_audit after insert or delete on public.speaker_editors
  for each row execute function public.adh_audit_row();

commit;

-- Conferência: devem listar as políticas novas de events, speakers e statewide_announcements
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('events','speakers','statewide_announcements','speaker_editors')
order by tablename, policyname;
