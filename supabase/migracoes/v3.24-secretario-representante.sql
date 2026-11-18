-- ADHONEP-SC · v3.24 — Secretário e Representante de campo (delegação) (claude v1.17)
-- STATUS: PENDENTE
--
-- Decisão do Eduardo (17 e 18/11/2026): secretário é cargo de confiança. Qualquer pessoa com perfil (presidente,
-- diretor regional, diretor estadual, administrador, coordenador de apoio) pode designar alguém como "secretário"
-- ou "representante de campo". A pessoa designada recebe EXATAMENTE as permissões de quem a designou (inclusive
-- excluir, se quem designou exclui). Tudo o que ela faz fica registrado com o nome dela e "em nome de" quem.
-- Representante de campo = mesma coisa do secretário, com outro nome.
--
-- Como funciona: as designações ficam em adh_delegations; o banco copia os papéis de quem designou para a pessoa
-- designada em user_roles (coluna delegated_from). Assim todas as regras de acesso que já existem valem sem mudar.
-- Quando o papel de quem designou muda/sai, a cópia acompanha. Encerrar a designação apaga só as cópias.
-- Secretário não cria secretário (só papéis próprios podem ser delegados).

-- 1) designações
create table if not exists public.adh_delegations (
  id bigint generated always as identity primary key,
  delegator_id uuid not null references auth.users(id) on delete cascade,
  delegate_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('secretario', 'representante_campo')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  ended_at timestamptz,
  ended_by uuid,
  constraint adh_delegations_self check (delegator_id <> delegate_id)
);
create unique index if not exists adh_delegations_ativa on public.adh_delegations (delegator_id, delegate_id) where is_active;
alter table public.adh_delegations enable row level security;
drop policy if exists deleg_select on public.adh_delegations;
create policy deleg_select on public.adh_delegations for select to authenticated
  using (delegator_id = (select auth.uid()) or delegate_id = (select auth.uid()) or public.is_state_admin());
revoke all on table public.adh_delegations from public, anon, authenticated;
grant select on table public.adh_delegations to authenticated;

-- 2) cópia dos papéis
alter table public.user_roles add column if not exists delegated_from bigint references public.adh_delegations(id) on delete cascade;
create index if not exists user_roles_delegated_from on public.user_roles (delegated_from) where delegated_from is not null;

-- refaz as cópias de uma designação
create or replace function public.adh_delegation_sync(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.adh_delegations;
begin
  perform set_config('adh.deleg_sync', '1', true);
  delete from public.user_roles where delegated_from = p_id;
  select * into d from public.adh_delegations where id = p_id;
  if found and d.is_active then
    insert into public.user_roles (user_id, role, region_id, chapter_id, is_active, granted_by, delegated_from)
    select d.delegate_id, ur.role, ur.region_id, ur.chapter_id, true, d.delegator_id, d.id
      from public.user_roles ur
     where ur.user_id = d.delegator_id and ur.delegated_from is null and ur.is_active and ur.role <> 'member'
    on conflict do nothing;
  end if;
  perform set_config('adh.deleg_sync', '0', true);
end $$;
revoke all on function public.adh_delegation_sync(bigint) from public, anon, authenticated;

-- cópias só mudam pela sincronização (exceto desativar a conta, que vale também para as cópias)
create or replace function public.adh_guard_delegated_roles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('adh.deleg_sync', true), '0') = '1' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    if new.delegated_from is not null then raise exception 'Papel de secretário/representante só é criado pela designação.'; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.delegated_from is not null then
    if (to_jsonb(new) - 'is_active') is distinct from (to_jsonb(old) - 'is_active') then
      return null;  -- ignora: a cópia segue a designação
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.delegated_from is not null then
    raise exception 'Papel de secretário/representante só é criado pela designação.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.adh_guard_delegated_roles() from public, anon, authenticated;
drop trigger if exists user_roles_deleg_guard on public.user_roles;
create trigger user_roles_deleg_guard before insert or update or delete on public.user_roles
  for each row execute function public.adh_guard_delegated_roles();

-- quando um papel próprio muda, as designações dessa pessoa acompanham
create or replace function public.adh_roles_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid := coalesce(new.user_id, old.user_id); x bigint;
begin
  if coalesce(current_setting('adh.deleg_sync', true), '0') = '1' then return null; end if;
  if coalesce(new.delegated_from, old.delegated_from) is not null then return null; end if;
  for x in select id from public.adh_delegations where delegator_id = v_user and is_active loop
    perform public.adh_delegation_sync(x);
  end loop;
  return null;
end $$;
revoke all on function public.adh_roles_follow() from public, anon, authenticated;
drop trigger if exists user_roles_deleg_follow on public.user_roles;
create trigger user_roles_deleg_follow after insert or update or delete on public.user_roles
  for each row execute function public.adh_roles_follow();

-- 3) designar e encerrar
create or replace function public.adh_delegation_create(p_email text, p_kind text, p_delegator uuid default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); v_from uuid := coalesce(p_delegator, auth.uid()); v_to uuid; v_id bigint; v_nome text;
begin
  if v_me is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if p_kind not in ('secretario', 'representante_campo') then raise exception 'Tipo de designação inválido.'; end if;
  if v_from <> v_me and not public.is_state_admin() then raise exception 'Só o administrador designa em nome de outra pessoa.' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_roles where user_id = v_from and delegated_from is null and is_active and role <> 'member') then
    raise exception 'Só quem tem cargo próprio (presidente, diretor, coordenador ou administrador) pode designar. Secretário não designa secretário.' using errcode = '42501';
  end if;
  select id into v_to from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_to is null then raise exception 'Não existe conta com esse e-mail. Peça para a pessoa se cadastrar primeiro.'; end if;
  if v_to = v_from then raise exception 'A pessoa não pode ser secretária de si mesma.'; end if;
  if exists (select 1 from public.adh_delegations where delegator_id = v_from and delegate_id = v_to and is_active) then
    raise exception 'Essa pessoa já está designada.';
  end if;
  insert into public.adh_delegations (delegator_id, delegate_id, kind, created_by) values (v_from, v_to, p_kind, v_me) returning id into v_id;
  perform public.adh_delegation_sync(v_id);
  select full_name into v_nome from public.profiles where id = v_to;
  insert into public.admin_audit_log (action, entity_type, entity_id, summary, metadata)
    values ('Designação criada', 'delegation', v_id::text,
            (case p_kind when 'secretario' then 'Secretário: ' else 'Representante de campo: ' end) || coalesce(v_nome, p_email),
            jsonb_build_object('delegator', v_from, 'delegate', v_to, 'kind', p_kind));
  return v_id;
end $$;
revoke all on function public.adh_delegation_create(text, text, uuid) from public, anon;
grant execute on function public.adh_delegation_create(text, text, uuid) to authenticated;

create or replace function public.adh_delegation_end(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.adh_delegations;
begin
  select * into d from public.adh_delegations where id = p_id and is_active;
  if not found then raise exception 'Designação não encontrada ou já encerrada.'; end if;
  if not (auth.uid() in (d.delegator_id, d.delegate_id) or public.is_state_admin()) then
    raise exception 'Sem permissão para encerrar esta designação.' using errcode = '42501';
  end if;
  update public.adh_delegations set is_active = false, ended_at = now(), ended_by = auth.uid() where id = p_id;
  perform public.adh_delegation_sync(p_id);
  insert into public.admin_audit_log (action, entity_type, entity_id, summary, metadata)
    values ('Designação encerrada', 'delegation', p_id::text, d.kind, jsonb_build_object('delegator', d.delegator_id, 'delegate', d.delegate_id));
end $$;
revoke all on function public.adh_delegation_end(bigint) from public, anon;
grant execute on function public.adh_delegation_end(bigint) to authenticated;

-- lista com nomes (quem designei / de quem sou secretário; administrador vê todas)
create or replace function public.adh_delegation_list()
returns table (id bigint, kind text, delegator_id uuid, delegator_name text, delegate_id uuid, delegate_name text, delegate_email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.kind, d.delegator_id, pa.full_name, d.delegate_id, pb.full_name,
         case when d.delegator_id = auth.uid() or public.is_state_admin() then u.email::text end, d.created_at
    from public.adh_delegations d
    left join public.profiles pa on pa.id = d.delegator_id
    left join public.profiles pb on pb.id = d.delegate_id
    left join auth.users u on u.id = d.delegate_id
   where d.is_active and (d.delegator_id = auth.uid() or d.delegate_id = auth.uid() or public.is_state_admin())
   order by d.created_at desc
$$;
revoke all on function public.adh_delegation_list() from public, anon;
grant execute on function public.adh_delegation_list() to authenticated;

-- 4) registro: o que o secretário faz fica com o nome dele e "em nome de" quem o designou
CREATE OR REPLACE FUNCTION public.adh_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; o jsonb; v_changed text[]; v_id text; v_sum text; v_em jsonb;
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
  select jsonb_agg(jsonb_build_object('delegator', d.delegator_id, 'kind', d.kind)) into v_em
    from public.adh_delegations d where d.delegate_id = auth.uid() and d.is_active;
  insert into public.admin_audit_log(actor_id, action, entity_type, entity_id, summary, metadata)
  values (auth.uid(), 'db_' || lower(tg_op), tg_table_name, v_id, left(v_sum, 200),
          jsonb_build_object('changed', to_jsonb(coalesce(v_changed, array[]::text[])), 'status', r->>'status')
          || case when v_em is not null then jsonb_build_object('em_nome_de', v_em) else '{}'::jsonb end);
  return case when tg_op = 'DELETE' then old else new end;
end; $function$
;
