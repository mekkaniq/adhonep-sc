-- ADHONEP-SC · v3.25 — cobrança de relatório só a partir de 2027 e só de capítulo com presidente com acesso (claude v1.17)
-- STATUS: PENDENTE
--
-- Decisão do Eduardo (18/11/2026): "Não dá para cobrar um presidente que não existe. Não dá para cobrar um presidente
-- que não tem acesso ao login." Até dezembro de 2026 é o período de preencher as informações básicas; a partir de 2027
-- os prazos contam.
-- 1) lançamento = 01/01/2027: o primeiro trimestre cobrado é o 1º de 2027 (jan–mar), prazo 05/04/2027.
-- 2) adh_ranking: só perde ponto por relatório o capítulo que tem presidente com login ativo (papel próprio, não secretário).
--    Devolve por capítulo report_due (cobrado ou não) e has_president.
-- 3) adh_capitulos_com_presidente(): lista dos capítulos que têm presidente com login (para as telas não cobrarem os outros).

insert into public.adh_config (key, value, updated_at) values ('lancamento', '"2027-01-01"'::jsonb, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.admin_audit_log (action, entity_type, entity_id, summary, metadata)
  values ('Configuração alterada', 'config', 'lancamento', 'lancamento = 2027-01-01 (decisão do Eduardo, 18/11/2026)', '{}'::jsonb);

create or replace function public.adh_capitulos_com_presidente()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select distinct ur.chapter_id from public.user_roles ur
   where ur.role = 'chapter_president' and ur.is_active and ur.delegated_from is null and ur.chapter_id is not null
     and auth.uid() is not null
$$;
revoke all on function public.adh_capitulos_com_presidente() from public, anon;
grant execute on function public.adh_capitulos_com_presidente() to authenticated;

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
      exists (select 1 from public.user_roles up where up.chapter_id = a.id and up.role = 'chapter_president' and up.is_active and up.delegated_from is null) as has_pres,
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
      case when r.id is null and v_due and now() >= v_deadline
        and exists (select 1 from public.user_roles up where up.chapter_id = a.id and up.role = 'chapter_president' and up.is_active and up.delegated_from is null)
        then -w_ms else 0 end as p_missing
    from act a
    left join public.chapter_monthly_reports r on r.chapter_id = a.id and r.ref_month = v_m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'chapter_id', c.id, 'name', c.name, 'region_id', c.region_id, 'region_name', rg.name,
      'report_status', c.rep_status, 'on_time', c.on_time,
      'p_events', c.p_events, 'p_meetings', c.p_meetings, 'p_prison', c.p_prison, 'p_ontime', c.p_ontime,
      'p_members', c.p_members, 'p_missing', c.p_missing, 'report_due', v_due and c.has_pres, 'has_president', c.has_pres,
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
