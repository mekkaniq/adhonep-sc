-- Avisos automáticos (evento novo, pendência de cadastro, lembrete da véspera).
-- Bloqueado na criação automática: rodar no SQL Editor do Supabase (projeto adhonep-sc) quando quiser ativar.
create or replace function public.adh_trg_event_notify() returns trigger language plpgsql security definer set search_path='' as $$
declare reg bigint; cn text;
begin
  if new.is_published and new.status='scheduled' and (tg_op='INSERT' or coalesce(old.is_published,false)=false) then
    select c.region_id,c.name into reg,cn from public.chapters c where c.id=new.chapter_id and c.state_code='SC';
    if cn is not null then
      insert into public.notifications(kind,title,body,audience,region_id,chapter_id,event_id,link_section,dedupe_key)
      values('event_new','Novo evento: '||left(new.title,90),
        to_char(new.starts_at at time zone 'America/Sao_Paulo','DD/MM "às" HH24:MI')||' · '||cn,
        case when reg is null then 'state' else 'region' end,reg,new.chapter_id,new.id,'eventsSection','ev-new-'||new.id)
      on conflict (dedupe_key) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists adh_event_notify on public.events;
create trigger adh_event_notify after insert or update of is_published on public.events for each row execute function public.adh_trg_event_notify();

create or replace function public.adh_trg_request_notify() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(kind,title,body,audience,dedupe_key)
  values('pending','Nova solicitação de cadastro','Há uma solicitação aguardando análise no painel.','managers','ar-'||new.id) on conflict (dedupe_key) do nothing;
  return new;
end $$;
drop trigger if exists adh_request_notify on public.access_requests;
create trigger adh_request_notify after insert on public.access_requests for each row execute function public.adh_trg_request_notify();

create or replace function public.adh_make_event_reminders() returns int language plpgsql security definer set search_path='' as $$
declare n int;
begin
  insert into public.notifications(kind,title,body,audience,region_id,chapter_id,event_id,link_section,dedupe_key)
  select 'event_reminder','Amanhã: '||left(e.title,90), to_char(e.starts_at at time zone 'America/Sao_Paulo','HH24:MI')||' · '||c.name,
         case when c.region_id is null then 'state' else 'region' end, c.region_id, e.chapter_id, e.id,'eventsSection','ev-rem-'||e.id
  from public.events e join public.chapters c on c.id=e.chapter_id
  where e.notify_reminder and e.is_published and e.status='scheduled' and c.state_code='SC'
    and (e.starts_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date + 1
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.adh_make_event_reminders() from public, anon, authenticated;
-- agenda diária 08:00 (Brasília)
select cron.schedule('adh-event-reminders','0 11 * * *','select public.adh_make_event_reminders()');
