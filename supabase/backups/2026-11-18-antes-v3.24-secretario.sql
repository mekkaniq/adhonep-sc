-- BACKUP antes da v3.24 (secretário e representante de campo) — 18/11/2026 (Brasília).
-- A v3.24 não muda nenhum dado existente: cria a tabela adh_delegations, uma coluna nova (vazia) em user_roles,
-- 2 gatilhos em user_roles, 4 funções novas e troca adh_audit_row (registro) para anotar "em nome de".
-- Situação na produção no momento do backup: 7 papéis em user_roles, nenhuma designação.
-- COMO VOLTAR (rodar este arquivo inteiro no SQL Editor): apaga as cópias de papéis por designação, os gatilhos,
-- as funções e a tabela novas, e volta adh_audit_row ao que era.
begin;
delete from public.user_roles where delegated_from is not null;
drop trigger if exists user_roles_deleg_follow on public.user_roles;
drop trigger if exists user_roles_deleg_guard on public.user_roles;
drop function if exists public.adh_roles_follow();
drop function if exists public.adh_guard_delegated_roles();
drop function if exists public.adh_delegation_create(text, text, uuid);
drop function if exists public.adh_delegation_end(bigint);
drop function if exists public.adh_delegation_list();
drop function if exists public.adh_delegation_sync(bigint);
alter table public.user_roles drop column if exists delegated_from;
drop table if exists public.adh_delegations;

-- adh_audit_row como estava (igual a supabase/esquema/00-base.sql)
CREATE OR REPLACE FUNCTION public.adh_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end; $function$;
commit;
