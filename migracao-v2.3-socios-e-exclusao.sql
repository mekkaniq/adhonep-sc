-- ADHONEP-SC claude v2.8 — perfil "Sócio" + exclusão pelo administrador
-- Pressupõe: migrações até v1.5 aplicadas. Idempotente. Rode UMA vez no SQL Editor do Supabase.
begin;

-- 1) Aceitar o papel 'member' (Sócio) em user_roles (serve para enum OU check constraint)
do $$
declare t text; c record; nd text;
begin
  select udt_name || ':' || data_type into t from information_schema.columns
   where table_schema='public' and table_name='user_roles' and column_name='role';
  if t like '%:USER-DEFINED' then
    execute format('alter type public.%I add value if not exists %L', split_part(t, ':', 1), 'member');
  else
    for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
              where conrelid='public.user_roles'::regclass and contype='c'
                and pg_get_constraintdef(oid) like '%state_admin%' and pg_get_constraintdef(oid) not like '%member%' loop
      nd := replace(c.def, '''state_admin''', '''state_admin'', ''member''');
      execute format('alter table public.user_roles drop constraint %I', c.conname);
      execute format('alter table public.user_roles add constraint %I %s', c.conname, nd);
    end loop;
  end if;
end $$;

-- 2) Funções auxiliares (plpgsql + comparação por texto: seguras na mesma transação)
create or replace function public.adh_president_chapters()
returns setof bigint language plpgsql stable security definer set search_path = '' as $$
begin
  return query select ur.chapter_id from public.user_roles ur
    where ur.user_id = auth.uid() and ur.is_active and ur.role::text = 'chapter_president' and ur.chapter_id is not null;
end; $$;

create or replace function public.adh_member_region()
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare r bigint;
begin
  select c.region_id into r from public.user_roles ur join public.chapters c on c.id = ur.chapter_id
   where ur.user_id = auth.uid() and ur.is_active and ur.role::text = 'member' limit 1;
  return r;
end; $$;

create or replace function public.adh_is_member()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.is_active and ur.role::text = 'member');
end; $$;

revoke all on function public.adh_president_chapters(), public.adh_member_region(), public.adh_is_member() from public, anon;
grant execute on function public.adh_president_chapters(), public.adh_member_region(), public.adh_is_member() to authenticated;

-- 3) Presidente enxerga os sócios do próprio capítulo
grant select on public.user_roles to authenticated;
drop policy if exists user_roles_president_sees_members on public.user_roles;
create policy user_roles_president_sees_members on public.user_roles for select to authenticated
  using (role::text = 'member' and chapter_id in (select public.adh_president_chapters()));

grant select on public.profiles to authenticated;
drop policy if exists profiles_president_sees_members on public.profiles;
create policy profiles_president_sees_members on public.profiles for select to authenticated
  using (exists (select 1 from public.user_roles ur where ur.user_id = profiles.id and ur.role::text = 'member'
                 and ur.chapter_id in (select public.adh_president_chapters())));

-- 4) Qualquer usuário lê e edita (só nome e telefone) o PRÓPRIO perfil
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant update (full_name, phone) on public.profiles to authenticated;

-- 5) Sócio lê: eventos publicados e comunicados publicados (estaduais + da própria região)
drop policy if exists events_member_read on public.events;
create policy events_member_read on public.events for select to authenticated using (is_published = true);

drop policy if exists announcements_member_select on public.statewide_announcements;
create policy announcements_member_select on public.statewide_announcements for select to authenticated
  using (status = 'published' and public.adh_is_member()
         and (scope = 'state' or region_id = public.adh_member_region()));
grant select on public.statewide_announcements to authenticated;

-- 6) Exclusão: SOMENTE administrador (state_admin)
grant delete on public.chapters, public.speakers, public.statewide_announcements, public.events to authenticated;
drop policy if exists chapters_admin_delete on public.chapters;
create policy chapters_admin_delete on public.chapters for delete to authenticated using (public.is_state_admin());
-- (events, speakers e statewide_announcements já têm política de delete só para administrador desde a v1.4)

commit;

-- Conferência
select tablename, policyname, cmd from pg_policies
 where schemaname='public' and policyname in ('user_roles_president_sees_members','profiles_president_sees_members','profiles_self_update',
   'events_member_read','announcements_member_select','chapters_admin_delete') order by 1,2;
