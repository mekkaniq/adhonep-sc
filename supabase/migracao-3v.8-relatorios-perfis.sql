-- ADHONEP-SC 3v.8 — fluxo de relatórios por perfil + endurecimento de segurança
-- Idempotente. NÃO foi executada por mim: rode primeiro em homologação.
-- Pressupõe: public.is_state_admin(), public.user_roles(user_id, role, is_active, region_id, chapter_id)
--            e public.chapters(id, region_id) já existentes, e a migração 3v.6 aplicada.
--
-- Regra de negócio implementada:
--   * Presidente de capítulo ENVIA relatórios do(s) seu(s) capítulo(s).
--   * Diretor regional APROVA (ou pede correções) dos capítulos da sua região,
--     sem passar pelo administrador estadual.
--   * Tudo fica gravado em public.chapter_reports, visível aos diretores da região.
--   * Administrador estadual e diretor estadual enxergam todos os relatórios;
--     só o administrador estadual altera/exclui livremente.

begin;

alter table public.chapter_reports add column if not exists event_date date;

-- ---------- Funções auxiliares (security definer: leem user_roles sem depender do RLS dela)
create or replace function public.adh_has_role(p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.is_active and ur.role = p_role);
$$;

create or replace function public.adh_is_president_of(p_chapter bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.is_active
                   and ur.role = 'chapter_president' and ur.chapter_id = p_chapter);
$$;

create or replace function public.adh_is_regional_director_of(p_chapter bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles ur
                 join public.chapters c on c.region_id = ur.region_id
                 where ur.user_id = auth.uid() and ur.is_active
                   and ur.role = 'regional_director' and ur.region_id is not null
                   and c.id = p_chapter);
$$;

create or replace function public.adh_can_see_report_chapter(p_chapter bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_state_admin()
      or public.adh_has_role('state_director')
      or public.adh_is_president_of(p_chapter)
      or public.adh_is_regional_director_of(p_chapter);
$$;

revoke all on function public.adh_has_role(text), public.adh_is_president_of(bigint),
  public.adh_is_regional_director_of(bigint), public.adh_can_see_report_chapter(bigint) from public, anon;
grant execute on function public.adh_has_role(text), public.adh_is_president_of(bigint),
  public.adh_is_regional_director_of(bigint), public.adh_can_see_report_chapter(bigint) to authenticated;

-- ---------- Guarda de fluxo: valida quem pode mudar o quê e qual transição de status
create or replace function public.adh_guard_chapter_report()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_state_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if public.adh_is_president_of(new.chapter_id) then
      if new.status not in ('Rascunho', 'Entregue') then
        raise exception 'Presidente só pode criar relatório como Rascunho ou Entregue.';
      end if;
      new.reviewer_notes := null;
      new.submitted_at := case when new.status = 'Entregue' then now() else null end;
      new.created_by := auth.uid();
      return new;
    end if;
    raise exception 'Sem permissão para criar relatório neste capítulo.';
  end if;

  -- UPDATE
  if new.chapter_id is distinct from old.chapter_id then
    raise exception 'O capítulo de um relatório não pode ser alterado.';
  end if;

  if public.adh_is_regional_director_of(old.chapter_id) then
    if (to_jsonb(new) - 'status' - 'reviewer_notes' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'reviewer_notes' - 'updated_at') then
      raise exception 'Diretor regional só pode alterar status e orientações da revisão.';
    end if;
    if not ((old.status = 'Entregue' and new.status = 'Em revisão')
         or (old.status in ('Em revisão', 'Reenviado') and new.status in ('Correções solicitadas', 'Aprovado'))
         or (old.status = 'Aprovado' and new.status = 'Encaminhado à sede')) then
      raise exception 'Transição de status não permitida: % -> %', old.status, new.status;
    end if;
    if new.status = 'Correções solicitadas' and length(trim(coalesce(new.reviewer_notes, ''))) < 3 then
      raise exception 'Informe as orientações ao solicitar correções.';
    end if;
    return new;
  end if;

  if public.adh_is_president_of(old.chapter_id) then
    if old.status not in ('Rascunho', 'Correções solicitadas') then
      raise exception 'Este relatório não pode mais ser editado pelo capítulo (status: %).', old.status;
    end if;
    if not ((old.status = 'Rascunho' and new.status in ('Rascunho', 'Entregue'))
         or (old.status = 'Correções solicitadas' and new.status in ('Correções solicitadas', 'Reenviado'))) then
      raise exception 'Transição de status não permitida: % -> %', old.status, new.status;
    end if;
    new.reviewer_notes := old.reviewer_notes;
    new.submitted_at := case when new.status in ('Entregue', 'Reenviado') then now() else old.submitted_at end;
    return new;
  end if;

  raise exception 'Sem permissão para alterar este relatório.';
end;
$$;
revoke all on function public.adh_guard_chapter_report() from public, anon, authenticated;

drop trigger if exists chapter_reports_guard on public.chapter_reports;
create trigger chapter_reports_guard before insert or update on public.chapter_reports
  for each row execute function public.adh_guard_chapter_report();

-- ---------- Políticas de chapter_reports (substitui a política só-administrador da 3v.6)
drop policy if exists chapter_reports_admin_all on public.chapter_reports;
drop policy if exists chapter_reports_select on public.chapter_reports;
drop policy if exists chapter_reports_insert on public.chapter_reports;
drop policy if exists chapter_reports_update on public.chapter_reports;
drop policy if exists chapter_reports_delete on public.chapter_reports;

create policy chapter_reports_select on public.chapter_reports for select to authenticated
  using (public.adh_can_see_report_chapter(chapter_id));
create policy chapter_reports_insert on public.chapter_reports for insert to authenticated
  with check (public.is_state_admin() or public.adh_is_president_of(chapter_id));
create policy chapter_reports_update on public.chapter_reports for update to authenticated
  using (public.is_state_admin() or public.adh_is_president_of(chapter_id) or public.adh_is_regional_director_of(chapter_id))
  with check (public.is_state_admin() or public.adh_is_president_of(chapter_id) or public.adh_is_regional_director_of(chapter_id));
create policy chapter_reports_delete on public.chapter_reports for delete to authenticated
  using (public.is_state_admin());

-- ---------- Auditoria: presidentes e diretores regionais também registram suas ações
drop policy if exists audit_admin_insert on public.admin_audit_log;
create policy audit_admin_insert on public.admin_audit_log for insert to authenticated
  with check ((public.is_state_admin() or public.adh_has_role('regional_director') or public.adh_has_role('chapter_president'))
              and (actor_id is null or actor_id = auth.uid()));

-- ---------- Comunicados: o público lê apenas uma view com colunas seguras
-- (antes, anon tinha SELECT na tabela inteira e enxergava created_by, decision_by, feedback...)
create or replace view public.public_announcements as
  select id, title, category, priority, summary, body, starts_at, ends_at,
         action_label, action_url, show_popup, published_at
  from public.statewide_announcements
  where status = 'published' and starts_at <= now() and (ends_at is null or ends_at >= now());
revoke all on public.public_announcements from public, anon, authenticated;
grant select on public.public_announcements to anon, authenticated;
drop policy if exists announcements_public_read on public.statewide_announcements;
revoke select on public.statewide_announcements from anon;

-- ---------- Storage: o bucket é público (URL direta funciona); remover a policy evita listar todos os arquivos
drop policy if exists "ADHONEP public can view event invitations" on storage.objects;

commit;

-- Conferência pós-execução (todas devem retornar linhas):
select policyname, cmd from pg_policies where schemaname='public' and tablename='chapter_reports' order by policyname;
select tgname from pg_trigger where tgrelid='public.chapter_reports'::regclass and not tgisinternal;
