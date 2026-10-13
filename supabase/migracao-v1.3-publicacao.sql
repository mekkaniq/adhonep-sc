-- ADHONEP-SC claude v1.3 — preparação para publicação (anti-spam, auditoria no banco, leitura de capítulos por perfil)
-- Idempotente. Rode primeiro em homologação e FAÇA BACKUP antes.
-- Pressupõe: migrações 3v.6 e 3v.8 já aplicadas; tabelas public.access_requests, chapters, user_roles existentes.

begin;

-- =========================================================
-- 1) Anti-spam do formulário público (valida no BANCO, não só no navegador)
-- =========================================================
alter table public.access_requests add column if not exists created_at timestamptz not null default now();

create or replace function public.adh_guard_access_request()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(new.email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Informe um e-mail válido.';
  end if;
  if length(trim(coalesce(new.full_name, ''))) < 3 or length(new.full_name) > 160 then
    raise exception 'Informe o nome completo.';
  end if;
  if length(trim(coalesce(new.justification, ''))) < 10 or length(new.justification) > 2000 then
    raise exception 'Descreva a justificativa (mínimo de 10 caracteres).';
  end if;
  if length(coalesce(new.city, '')) > 120 or length(coalesce(new.phone, '')) > 40 then
    raise exception 'Dados muito longos.';
  end if;
  new.email := v_email;
  new.status := 'pending';
  if exists (select 1 from public.access_requests r
             where lower(r.email) = v_email and r.status = 'pending'
               and r.created_at > now() - interval '24 hours') then
    raise exception 'Já existe uma solicitação recente para este e-mail. Aguarde a análise da diretoria.';
  end if;
  if (select count(*) from public.access_requests r where r.created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Muitas solicitações no momento. Tente novamente mais tarde.';
  end if;
  return new;
end; $$;
revoke all on function public.adh_guard_access_request() from public, anon, authenticated;

drop trigger if exists access_requests_guard on public.access_requests;
create trigger access_requests_guard before insert on public.access_requests
  for each row execute function public.adh_guard_access_request();

-- =========================================================
-- 2) Presidente/diretor regional enxergam o nome dos capítulos do seu escopo (mesmo não públicos)
-- =========================================================
drop policy if exists chapters_scoped_read on public.chapters;
create policy chapters_scoped_read on public.chapters for select to authenticated
  using (public.adh_is_president_of(id) or public.adh_is_regional_director_of(id)
         or public.adh_has_role('state_director'));

-- =========================================================
-- 3) Auditoria AUTOMÁTICA no banco (não depende do navegador e não pode ser contornada)
--    Registra quem fez o quê; guarda só os NOMES das colunas alteradas, sem dados pessoais.
-- =========================================================
create or replace function public.adh_audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb; o jsonb; v_changed text[]; v_id text; v_sum text;
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  o := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_id := r->>'id';
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

do $$
declare t text;
begin
  foreach t in array array['chapters','regions','events','speakers','statewide_announcements','user_roles'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.adh_audit_row()', t || '_audit', t);
    end if;
  end loop;
  -- solicitações de acesso: só decisões (UPDATE); o INSERT público é anônimo
  drop trigger if exists access_requests_audit on public.access_requests;
  create trigger access_requests_audit after update on public.access_requests
    for each row execute function public.adh_audit_row();
end $$;

-- o log de auditoria é só de leitura/inserção: ninguém edita nem apaga pela API
revoke update, delete, truncate on public.admin_audit_log from anon, authenticated;

commit;

-- Conferência (deve listar os triggers *_audit e access_requests_guard):
select tgname, tgrelid::regclass as tabela from pg_trigger
where not tgisinternal and (tgname like '%\_audit' or tgname = 'access_requests_guard') order by 2, 1;
