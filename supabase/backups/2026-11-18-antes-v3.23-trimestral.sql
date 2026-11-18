-- BACKUP antes da v3.23 (relatório trimestral) — 18/11/2026 03h20 (Brasília), lido da produção.
-- Situação na produção no momento do backup:
--   * chapter_monthly_reports: 0 linhas (nenhum relatório mensal enviado ainda) — nada de dado a perder.
--   * adh_config: não existia.
-- COMO VOLTAR (rodar este arquivo inteiro no SQL Editor):
--   1) volta adh_guard_monthly_report e adh_ranking ao que eram;
--   2) volta os limites antigos (40/200) e tira a regra "só mês de fim de trimestre";
--   3) volta os valores e textos de ranking_settings;
--   4) apaga adh_config_set e a tabela adh_config (criadas pela v3.23).
begin;

-- 1a) adh_guard_monthly_report (igual a supabase/esquema/00-base.sql)
CREATE OR REPLACE FUNCTION public.adh_guard_monthly_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_deadline timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.ref_month > date_trunc('month', now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'Não é possível enviar relatório de um mês que ainda não começou.';
    end if;
    v_deadline := ((new.ref_month + interval '1 month')::date + 5)::timestamp at time zone 'America/Sao_Paulo';
    if public.is_state_admin() then
      new.submitted_at := coalesce(new.submitted_at, now());
      new.on_time := coalesce(new.on_time, now() < v_deadline);
      return new;
    end if;
    if public.adh_is_president_of(new.chapter_id) then
      new.status := 'Entregue';
      new.reviewer_notes := null; new.reviewed_by := null; new.reviewed_at := null;
      new.submitted_at := now();
      new.on_time := now() < v_deadline;
      new.created_by := auth.uid();
      return new;
    end if;
    raise exception 'Sem permissão para enviar relatório deste capítulo.';
  end if;

  -- UPDATE
  if new.chapter_id is distinct from old.chapter_id or new.ref_month is distinct from old.ref_month then
    raise exception 'Capítulo e mês de um relatório não podem ser alterados.';
  end if;
  if public.is_state_admin() then
    if new.status is distinct from old.status and new.status in ('Aprovado','Correções solicitadas') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    end if;
    return new;
  end if;

  if public.adh_is_regional_director_of(old.chapter_id) then
    if (to_jsonb(new) - 'status' - 'reviewer_notes' - 'reviewed_by' - 'reviewed_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'reviewer_notes' - 'reviewed_by' - 'reviewed_at' - 'updated_at') then
      raise exception 'Diretor regional só pode alterar o status e as orientações da revisão.';
    end if;
    if not (old.status in ('Entregue','Reenviado') and new.status in ('Aprovado','Correções solicitadas')) then
      raise exception 'Transição de status não permitida: % -> %', old.status, new.status;
    end if;
    if new.status = 'Correções solicitadas' and length(trim(coalesce(new.reviewer_notes, ''))) < 3 then
      raise exception 'Informe as orientações ao solicitar correções.';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
    return new;
  end if;

  if public.adh_is_president_of(old.chapter_id) then
    if old.status not in ('Entregue','Correções solicitadas') then
      raise exception 'Este relatório não pode mais ser editado pelo capítulo (situação: %).', old.status;
    end if;
    if not ((old.status = 'Entregue' and new.status = 'Entregue')
         or (old.status = 'Correções solicitadas' and new.status in ('Correções solicitadas','Reenviado'))) then
      raise exception 'Transição de status não permitida: % -> %', old.status, new.status;
    end if;
    new.reviewer_notes := old.reviewer_notes; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    new.on_time := old.on_time;
    new.submitted_at := case when new.status = 'Reenviado' then now() else old.submitted_at end;
    return new;
  end if;
  raise exception 'Sem permissão para alterar este relatório.';
end; $function$;

-- 1b) adh_ranking (igual a supabase/migracoes/v3.21-saude-so-sc.sql)
CREATE OR REPLACE FUNCTION public.adh_ranking(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m date := date_trunc('month', p_month)::date;
  v_start timestamptz := v_m::timestamp at time zone 'America/Sao_Paulo';
  v_end timestamptz := ((v_m + interval '1 month')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_prev timestamptz := ((v_m - interval '1 month')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_deadline timestamptz := ((v_m + interval '1 month')::date + 5)::timestamp at time zone 'America/Sao_Paulo';
  v_all boolean; v_regions bigint[]; s jsonb;
  w_ce numeric; w_se numeric; cap_e numeric; w_cm numeric; w_sm numeric; cap_m numeric;
  w_pr numeric; w_ot numeric; w_mb numeric; w_ms numeric; w_op numeric; w_re numeric; w_in numeric; w_if numeric;
  v_chapters jsonb; v_regions_out jsonb;
begin
  v_all := public.is_state_admin() or public.adh_has_role('state_director') or exists (select 1 from public.ranking_grants g where g.user_id = auth.uid() and g.scope = 'state');
  if not v_all then
    select array_agg(distinct ur.region_id) into v_regions from public.user_roles ur
     where ur.user_id = auth.uid() and ur.is_active and ur.role::text = 'regional_director' and ur.region_id is not null;
    select coalesce(v_regions, '{}'::bigint[]) || coalesce((select array_agg(g.region_id) from public.ranking_grants g where g.user_id = auth.uid() and g.scope = 'region' and g.region_id is not null), '{}'::bigint[]) into v_regions; if coalesce(array_length(v_regions, 1), 0) = 0 then raise exception 'Sem permissão para consultar o ranking.'; end if;
  end if;

  select jsonb_object_agg(key, value) into s from public.ranking_settings;
  w_ce := (s->>'w_chapter_event')::numeric;  w_se := (s->>'w_support_event')::numeric; cap_e := (s->>'cap_events')::numeric;
  w_cm := (s->>'w_chapter_meeting')::numeric; w_sm := (s->>'w_support_meeting')::numeric; cap_m := (s->>'cap_meetings')::numeric;
  w_pr := (s->>'w_prison')::numeric; w_ot := (s->>'w_ontime')::numeric; w_mb := (s->>'w_member')::numeric; w_ms := (s->>'w_missing')::numeric;
  w_op := (s->>'w_open')::numeric; w_re := (s->>'w_react')::numeric; w_in := (s->>'w_inact')::numeric; w_if := (s->>'w_inact_follow')::numeric;

  with base as (
    select c.id, c.name, c.region_id,
      coalesce(
        (select h.new_status from public.chapter_status_history h where h.chapter_id = c.id and h.changed_at < v_end order by h.changed_at desc, h.id desc limit 1),
        (select h.old_status from public.chapter_status_history h where h.chapter_id = c.id and h.changed_at >= v_end and h.old_status is not null order by h.changed_at asc, h.id asc limit 1),
        coalesce(to_jsonb(c)->>'status', to_jsonb(c)->>'situation', to_jsonb(c)->>'situacao', 'inactive')
      ) as st
    from public.chapters c
    where c.state_code = 'SC' and (v_all or c.region_id = any(v_regions))
  ), act as (
    select * from base where st = 'active'
  ), calc as (
    select a.id, a.name, a.region_id, r.id as rep_id, r.status as rep_status, r.on_time,
      case when r.status = 'Aprovado' then
        least(r.chapter_events, cap_e) * w_ce + least(r.women_events + r.youth_events, cap_e) * w_se
      else 0 end as p_events,
      case when r.status = 'Aprovado' then
        least(r.chapter_meetings, cap_m) * w_cm + (least(r.women_meetings, cap_m) + least(r.youth_meetings, cap_m)) * w_sm
      else 0 end as p_meetings,
      case when r.status = 'Aprovado' and r.prison_ministry_active then w_pr else 0 end as p_prison,
      case when r.status = 'Aprovado' and coalesce(r.on_time, false) then w_ot else 0 end as p_ontime,
      (select count(*) from public.user_roles ur
        where ur.chapter_id = a.id and ur.role::text = 'member'
          and (to_jsonb(ur)->>'created_at')::timestamptz >= v_start and (to_jsonb(ur)->>'created_at')::timestamptz < v_end) * w_mb as p_members,
      case when r.id is null and now() >= v_deadline then -w_ms else 0 end as p_missing
    from act a
    left join public.chapter_monthly_reports r on r.chapter_id = a.id and r.ref_month = v_m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'chapter_id', c.id, 'name', c.name, 'region_id', c.region_id, 'region_name', rg.name,
      'report_status', c.rep_status, 'on_time', c.on_time,
      'p_events', c.p_events, 'p_meetings', c.p_meetings, 'p_prison', c.p_prison, 'p_ontime', c.p_ontime,
      'p_members', c.p_members, 'p_missing', c.p_missing,
      'points', c.p_events + c.p_meetings + c.p_prison + c.p_ontime + c.p_members + c.p_missing
    ) order by (c.p_events + c.p_meetings + c.p_prison + c.p_ontime + c.p_members + c.p_missing) desc, c.name), '[]'::jsonb)
  into v_chapters
  from calc c left join public.regions rg on rg.id = c.region_id;

  with mv as (
    select h.chapter_id, h.changed_at, h.old_status, h.new_status, c.region_id
    from public.chapter_status_history h join public.chapters c on c.id = h.chapter_id
    where h.changed_at >= v_prev and h.changed_at < v_end and c.state_code = 'SC'
  ), reg_mv as (
    select region_id,
      sum(case when changed_at >= v_start and old_status is null and new_status in ('active','in_activation') then w_op else 0 end) as opened,
      sum(case when changed_at >= v_start and new_status = 'active' and old_status in ('inactive','reactivation') then w_re else 0 end) as reactivated,
      sum(case when new_status = 'inactive' and old_status in ('active','in_activation','reactivation') then
            case when changed_at >= v_start then -w_in else -w_if end
          else 0 end) as inactivated
    from mv group by region_id
  ), avg_ch as (
    select (x->>'region_id')::bigint as region_id, avg((x->>'points')::numeric) as avg_pts, count(*) as n
    from jsonb_array_elements(v_chapters) x group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'region_id', rg.id, 'name', rg.name, 'active_chapters', coalesce(a.n, 0),
      'avg_points', round(coalesce(a.avg_pts, 0), 1),
      'opened', coalesce(m.opened, 0), 'reactivated', coalesce(m.reactivated, 0), 'inactivated', coalesce(m.inactivated, 0),
      'points', round(coalesce(a.avg_pts, 0) + coalesce(m.opened, 0) + coalesce(m.reactivated, 0) + coalesce(m.inactivated, 0), 1)
    ) order by (coalesce(a.avg_pts, 0) + coalesce(m.opened, 0) + coalesce(m.reactivated, 0) + coalesce(m.inactivated, 0)) desc, rg.name), '[]'::jsonb)
  into v_regions_out
  from public.regions rg
  left join avg_ch a on a.region_id = rg.id
  left join reg_mv m on m.region_id = rg.id
  where rg.state_code = 'SC' and (v_all or rg.id = any(v_regions));

  return jsonb_build_object('month', v_m, 'chapters', v_chapters, 'regions', v_regions_out, 'settings', s);
end; $function$;

-- 2) limites e regra do trimestre
alter table public.chapter_monthly_reports
  drop constraint if exists chapter_monthly_reports_trimestre_check,
  drop constraint if exists chapter_monthly_reports_chapter_meetings_check,
  drop constraint if exists chapter_monthly_reports_women_meetings_check,
  drop constraint if exists chapter_monthly_reports_youth_meetings_check,
  drop constraint if exists chapter_monthly_reports_chapter_events_check,
  drop constraint if exists chapter_monthly_reports_women_events_check,
  drop constraint if exists chapter_monthly_reports_youth_events_check,
  drop constraint if exists chapter_monthly_reports_prison_activities_check;
alter table public.chapter_monthly_reports
  add constraint chapter_monthly_reports_chapter_meetings_check CHECK (((chapter_meetings >= 0) AND (chapter_meetings <= 40))),
  add constraint chapter_monthly_reports_women_meetings_check CHECK (((women_meetings >= 0) AND (women_meetings <= 40))),
  add constraint chapter_monthly_reports_youth_meetings_check CHECK (((youth_meetings >= 0) AND (youth_meetings <= 40))),
  add constraint chapter_monthly_reports_chapter_events_check CHECK (((chapter_events >= 0) AND (chapter_events <= 40))),
  add constraint chapter_monthly_reports_women_events_check CHECK (((women_events >= 0) AND (women_events <= 40))),
  add constraint chapter_monthly_reports_youth_events_check CHECK (((youth_events >= 0) AND (youth_events <= 40))),
  add constraint chapter_monthly_reports_prison_activities_check CHECK (((prison_activities >= 0) AND (prison_activities <= 200)));

-- 3) ranking_settings como estava (14 linhas)
update public.ranking_settings s set value = v.value, label = v.label from (values
  ('cap_events', 2, 'Máximo de eventos contados por tipo no mês'),
  ('cap_meetings', 4, 'Máximo de reuniões contadas por tipo no mês'),
  ('w_chapter_event', 20, 'Evento do capítulo (inclui seminário e workshop), por evento'),
  ('w_chapter_meeting', 5, 'Reunião do capítulo, por reunião'),
  ('w_inact', 50, 'Região: capítulo inativado (penalidade no mês)'),
  ('w_inact_follow', 25, 'Região: capítulo inativado (penalidade no mês seguinte)'),
  ('w_member', 3, 'Sócio novo cadastrado no mês, por sócio'),
  ('w_missing', 10, 'Penalidade: relatório mensal não enviado no prazo'),
  ('w_ontime', 5, 'Relatório mensal entregue no prazo (até o dia 5)'),
  ('w_open', 50, 'Região: capítulo aberto'),
  ('w_prison', 10, 'Ministério de Prisões ativo no mês'),
  ('w_react', 80, 'Região: capítulo reativado'),
  ('w_support_event', 10, 'Evento de Apoio Feminino ou Apoio Jovem, por evento'),
  ('w_support_meeting', 2, 'Reunião de Apoio Feminino ou Apoio Jovem, por reunião')
) v(key, value, label) where s.key = v.key;

-- 4) objetos novos da v3.23
drop function if exists public.adh_config_set(text, jsonb);
drop table if exists public.adh_config;
commit;
