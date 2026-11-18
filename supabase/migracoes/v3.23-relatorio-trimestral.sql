-- ADHONEP-SC · v3.23 — relatório de andamento TRIMESTRAL + configurações (lançamento, alerta de mandato) (claude v1.16)
-- STATUS: APLICADA em 18/11/2026 (backup antes: supabase/backups/2026-11-18-antes-v3.23-trimestral.sql)
--
-- Decisões do Eduardo (17/11/2026): trimestre de calendário; relatórios de março, junho, setembro e dezembro;
-- prazo dia 5 do mês seguinte; a Saúde soma os 3 meses; nada fica pendente antes do lançamento; o diretor define
-- quantos dias antes do fim do mandato o sistema avisa. Não havia relatório mensal gravado (0 linhas em 17/11).
--
-- 1) adh_config: 'lancamento' (data; vazio = nada é cobrado) e 'alerta_mandato_dias' ([60,30]).
--    Lê: qualquer usuário logado. Muda: só pela função adh_config_set (lançamento: administrador;
--    alerta de mandato: administrador ou diretor estadual).
-- 2) chapter_monthly_reports passa a guardar 1 relatório por trimestre (ref_month = mar/jun/set/dez) e os limites
--    de quantidade sobem ×3 (um trimestre tem 3 meses).
-- 3) adh_ranking (Saúde) calcula o trimestre; sem lançamento, ninguém perde ponto por relatório.
-- 4) ranking_settings: tetos ×3 e textos "no trimestre".

create table if not exists public.adh_config (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.adh_config enable row level security;
drop policy if exists cfg_select on public.adh_config;
create policy cfg_select on public.adh_config for select to authenticated using (true);
revoke all on table public.adh_config from public, anon, authenticated;
grant select on table public.adh_config to authenticated;
insert into public.adh_config (key, value) values ('lancamento', null), ('alerta_mandato_dias', '[60,30]'::jsonb)
  on conflict (key) do nothing;

create or replace function public.adh_config_set(p_key text, p_value jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb := p_value;
begin
  if p_key = 'lancamento' then
    if not public.is_state_admin() then raise exception 'Somente o administrador define a data de lançamento' using errcode = '42501'; end if;
    if v is not null and jsonb_typeof(v) <> 'null' then perform (v #>> '{}')::date; end if;
  elsif p_key = 'alerta_mandato_dias' then
    if not (public.is_state_admin() or public.adh_has_role('state_director')) then
      raise exception 'Somente o administrador ou o diretor estadual define o alerta de mandato' using errcode = '42501';
    end if;
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) not between 1 and 4
       or exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric not between 1 and 365) then
      raise exception 'Informe de 1 a 4 prazos, entre 1 e 365 dias';
    end if;
    select jsonb_agg(d order by d desc) into v from (select distinct (x #>> '{}')::int d from jsonb_array_elements(v) x) s;
  else
    raise exception 'Configuração desconhecida: %', p_key;
  end if;
  insert into public.adh_config (key, value, updated_at, updated_by) values (p_key, v, now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  insert into public.admin_audit_log (action, entity_type, entity_id, summary, metadata)
    values ('Configuração alterada', 'config', p_key, p_key || ' = ' || coalesce(v::text, 'vazio'), jsonb_build_object('value', v));
  return v;
end $$;
revoke all on function public.adh_config_set(text, jsonb) from public, anon;
grant execute on function public.adh_config_set(text, jsonb) to authenticated;

-- 2) um relatório por trimestre
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chapter_monthly_reports_trimestre_check') then
    alter table public.chapter_monthly_reports add constraint chapter_monthly_reports_trimestre_check
      check (extract(month from ref_month)::int % 3 = 0);
  end if;
end $$;
alter table public.chapter_monthly_reports
  drop constraint if exists chapter_monthly_reports_chapter_meetings_check,
  drop constraint if exists chapter_monthly_reports_women_meetings_check,
  drop constraint if exists chapter_monthly_reports_youth_meetings_check,
  drop constraint if exists chapter_monthly_reports_chapter_events_check,
  drop constraint if exists chapter_monthly_reports_women_events_check,
  drop constraint if exists chapter_monthly_reports_youth_events_check,
  drop constraint if exists chapter_monthly_reports_prison_activities_check;
alter table public.chapter_monthly_reports
  add constraint chapter_monthly_reports_chapter_meetings_check check (chapter_meetings between 0 and 120),
  add constraint chapter_monthly_reports_women_meetings_check check (women_meetings between 0 and 120),
  add constraint chapter_monthly_reports_youth_meetings_check check (youth_meetings between 0 and 120),
  add constraint chapter_monthly_reports_chapter_events_check check (chapter_events between 0 and 120),
  add constraint chapter_monthly_reports_women_events_check check (women_events between 0 and 120),
  add constraint chapter_monthly_reports_youth_events_check check (youth_events between 0 and 120),
  add constraint chapter_monthly_reports_prison_activities_check check (prison_activities between 0 and 600);

-- 2b) mensagem do envio antes da hora
CREATE OR REPLACE FUNCTION public.adh_guard_monthly_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_deadline timestamptz;
begin
  if tg_op = 'INSERT' then
    if new.ref_month > date_trunc('month', now() at time zone 'America/Sao_Paulo')::date then
      raise exception 'O envio do relatório do trimestre abre no último mês do trimestre (março, junho, setembro ou dezembro).';
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
end; $function$
;

-- 3) Saúde por trimestre
CREATE OR REPLACE FUNCTION public.adh_ranking(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- trimestre: v_q = 1º dia do trimestre, v_m = último mês (é a chave do relatório: mar/jun/set/dez)
  v_q date := date_trunc('quarter', p_month)::date;
  v_m date := (date_trunc('quarter', p_month) + interval '2 months')::date;
  v_start timestamptz := v_q::timestamp at time zone 'America/Sao_Paulo';
  v_end timestamptz := ((v_m + interval '1 month')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_prev timestamptz := ((v_q - interval '3 months')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_launch date := (select nullif(c.value #>> '{}', '')::date from public.adh_config c where c.key = 'lancamento');
  v_due boolean;
  v_deadline timestamptz := ((v_m + interval '1 month')::date + 5)::timestamp at time zone 'America/Sao_Paulo';
  v_all boolean; v_regions bigint[]; s jsonb;
  w_ce numeric; w_se numeric; cap_e numeric; w_cm numeric; w_sm numeric; cap_m numeric;
  w_pr numeric; w_ot numeric; w_mb numeric; w_ms numeric; w_op numeric; w_re numeric; w_in numeric; w_if numeric;
  v_chapters jsonb; v_regions_out jsonb;
begin
  -- antes do lançamento nada fica pendente: só cobra trimestre que começa no lançamento ou depois
  v_due := v_launch is not null and v_q >= v_launch;
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
      case when r.id is null and v_due and now() >= v_deadline then -w_ms else 0 end as p_missing
    from act a
    left join public.chapter_monthly_reports r on r.chapter_id = a.id and r.ref_month = v_m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'chapter_id', c.id, 'name', c.name, 'region_id', c.region_id, 'region_name', rg.name,
      'report_status', c.rep_status, 'on_time', c.on_time,
      'p_events', c.p_events, 'p_meetings', c.p_meetings, 'p_prison', c.p_prison, 'p_ontime', c.p_ontime,
      'p_members', c.p_members, 'p_missing', c.p_missing, 'report_due', v_due,
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

  return jsonb_build_object('month', v_m, 'quarter_start', v_q, 'deadline', (v_m + interval '1 month')::date + 4, 'launch', v_launch, 'due', v_due, 'chapters', v_chapters, 'regions', v_regions_out, 'settings', s);
end; $function$
;


-- 4) pontuação por trimestre (tetos ×3) e textos
update public.ranking_settings set value = value * 3 where key in ('cap_events', 'cap_meetings') and not exists (select 1 from public.adh_config where key = 'ranking_trimestral');
update public.ranking_settings set label = v.label from (values
  ('cap_events', 'Máximo de eventos contados por tipo no trimestre'),
  ('cap_meetings', 'Máximo de reuniões contadas por tipo no trimestre'),
  ('w_prison', 'Ministério de Prisões ativo no trimestre'),
  ('w_ontime', 'Relatório trimestral entregue no prazo (até o dia 5 do mês seguinte)'),
  ('w_member', 'Sócio novo cadastrado no trimestre, por sócio'),
  ('w_missing', 'Penalidade: relatório trimestral não enviado no prazo'),
  ('w_inact', 'Região: capítulo inativado (penalidade no trimestre)'),
  ('w_inact_follow', 'Região: capítulo inativado (penalidade no trimestre seguinte)')
) v(key, label) where ranking_settings.key = v.key;
insert into public.adh_config (key, value) values ('ranking_trimestral', 'true'::jsonb) on conflict (key) do nothing;
