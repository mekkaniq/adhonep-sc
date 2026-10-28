-- ADHONEP-SC · app v2
-- 1) Avisos com imagem  2) Regras de envio (reunião só para capítulo)  3) Ranking com acesso liberado manualmente
-- Seguro para rodar mais de uma vez.

-- ---------- 1) Imagem nos avisos ----------
alter table public.notifications add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notification-images', 'notification-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists notif_img_write on storage.objects;
create policy notif_img_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'notification-images'
  and (
    public.adh_is_state_manager_of('SC')
    or exists (select 1 from public.user_roles ur
               where ur.user_id = auth.uid() and ur.is_active
                 and ur.role::text in ('regional_director','chapter_president'))
  )
);

drop function if exists public.adh_my_notifications(integer);
create function public.adh_my_notifications(p_limit integer default 50)
returns table(id bigint, kind text, title text, body text, link_section text, created_at timestamptz, is_read boolean, image_url text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.title, n.body, n.link_section, n.created_at,
         (r.notification_id is not null) as is_read, n.image_url
  from public.notifications n
  left join public.notification_reads r on r.notification_id = n.id and r.user_id = auth.uid()
  where n.state_code = 'SC' and public.adh_notif_visible(n, auth.uid())
  order by n.created_at desc limit least(coalesce(p_limit, 50), 100)
$$;
revoke all on function public.adh_my_notifications(integer) from public, anon;
grant execute on function public.adh_my_notifications(integer) to authenticated;

-- ---------- 2) Envio: regras por perfil ----------
drop function if exists public.adh_send_notification(text, text, text, text, bigint, bigint, timestamptz);
create function public.adh_send_notification(
  p_kind text, p_title text, p_body text, p_audience text,
  p_region bigint default null, p_chapter bigint default null,
  p_send_at timestamptz default now(), p_image text default null)
returns bigint language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ok boolean := false; reg bigint; nid bigint;
begin
  if u is null then raise exception 'Faça login.'; end if;
  if p_kind not in ('meeting','message') then raise exception 'Tipo inválido.'; end if;
  if p_audience not in ('state','region','chapter') then raise exception 'Público inválido.'; end if;
  if p_kind = 'meeting' and p_audience <> 'chapter' then raise exception 'Reunião é enviada somente para um capítulo.'; end if;
  if p_audience = 'region' and p_region is null then raise exception 'Informe a região.'; end if;
  if p_audience = 'chapter' and p_chapter is null then raise exception 'Informe o capítulo.'; end if;
  if p_image is not null and p_image !~ '^https://ayrdfetnscrfrlcssiua\.supabase\.co/storage/v1/object/public/notification-images/' then
    raise exception 'Imagem inválida.'; end if;

  if public.adh_is_state_manager_of('SC') then ok := true;
  elsif p_audience = 'region' then
    ok := exists (select 1 from public.user_roles where user_id = u and is_active and role = 'regional_director' and region_id = p_region);
  elsif p_audience = 'chapter' then
    select region_id into reg from public.chapters where id = p_chapter and state_code = 'SC';
    ok := exists (select 1 from public.user_roles where user_id = u and is_active and role = 'chapter_president' and chapter_id = p_chapter)
       or exists (select 1 from public.user_roles where user_id = u and is_active and role = 'regional_director' and region_id = reg and reg is not null);
  end if;
  if not ok then raise exception 'Você não tem permissão para enviar a este público.'; end if;

  insert into public.notifications(kind, title, body, audience, region_id, chapter_id, created_by, send_at, link_section, image_url)
  values (p_kind, btrim(p_title), coalesce(btrim(p_body), ''), p_audience, p_region, p_chapter, u,
          coalesce(p_send_at, now()), case when p_kind = 'meeting' then 'eventsSection' else null end, p_image)
  returning id into nid;
  return nid;
end $$;
revoke all on function public.adh_send_notification(text, text, text, text, bigint, bigint, timestamptz, text) from public, anon;
grant execute on function public.adh_send_notification(text, text, text, text, bigint, bigint, timestamptz, text) to authenticated;

-- ---------- 3) Ranking: administrador e diretor estadual + liberações manuais ----------
create table if not exists public.ranking_grants (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('state','region')),
  region_id bigint,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (user_id, scope, region_id)
);
alter table public.ranking_grants enable row level security;
revoke all on public.ranking_grants from anon, authenticated;

create or replace function public.adh_ranking_access_list()
returns table(id bigint, email text, scope text, region_id bigint, region_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_state_admin() then raise exception 'Somente o administrador estadual.'; end if;
  return query
    select g.id, u.email::text, g.scope, g.region_id, r.name::text
    from public.ranking_grants g
    join auth.users u on u.id = g.user_id
    left join public.regions r on r.id = g.region_id
    order by u.email;
end $$;

create or replace function public.adh_ranking_access_set(p_email text, p_scope text, p_region bigint default null, p_on boolean default true)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.is_state_admin() then raise exception 'Somente o administrador estadual.'; end if;
  if p_scope not in ('state','region') then raise exception 'Nível inválido.'; end if;
  if p_scope = 'region' and p_region is null then raise exception 'Informe a região.'; end if;
  select id into v from auth.users where lower(email) = lower(btrim(p_email));
  if v is null then raise exception 'Nenhuma conta com este e-mail.'; end if;
  if p_on then
    insert into public.ranking_grants(user_id, scope, region_id, created_by)
    select v, p_scope, case when p_scope = 'region' then p_region end, auth.uid()
    where not exists (select 1 from public.ranking_grants g
                      where g.user_id = v and g.scope = p_scope and g.region_id is not distinct from (case when p_scope = 'region' then p_region end));
  else
    delete from public.ranking_grants g
     where g.user_id = v and g.scope = p_scope and g.region_id is not distinct from (case when p_scope = 'region' then p_region end);
  end if;
  return true;
end $$;
revoke all on function public.adh_ranking_access_list() from public, anon;
revoke all on function public.adh_ranking_access_set(text, text, bigint, boolean) from public, anon;
grant execute on function public.adh_ranking_access_list() to authenticated;
grant execute on function public.adh_ranking_access_set(text, text, bigint, boolean) to authenticated;

-- indica à tela se esta conta pode ver o ranking (e em que nível), sem expor nada
create or replace function public.adh_my_ranking_access()
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_state_admin() or public.adh_has_role('state_director')
     or exists (select 1 from public.ranking_grants g where g.user_id = auth.uid() and g.scope = 'state') then return 'state'; end if;
  if exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.is_active and ur.role::text = 'regional_director' and ur.region_id is not null)
     or exists (select 1 from public.ranking_grants g where g.user_id = auth.uid() and g.scope = 'region') then return 'region'; end if;
  return 'none';
end $$;
revoke all on function public.adh_my_ranking_access() from public, anon;
grant execute on function public.adh_my_ranking_access() to authenticated;

-- ajusta adh_ranking para considerar as liberações (mantém todo o cálculo existente)
do $$
declare d text; o text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'adh_ranking' and pg_get_function_arguments(p.oid) = 'p_month date';
  if d is null then raise exception 'adh_ranking não encontrada'; end if;
  o := d;
  d := replace(d, 'v_all := public.is_state_admin() or public.adh_has_role(''state_director'');',
    'v_all := public.is_state_admin() or public.adh_has_role(''state_director'') or exists (select 1 from public.ranking_grants g where g.user_id = auth.uid() and g.scope = ''state'');');
  d := replace(d, 'if v_regions is null then raise exception ''Sem permissão para consultar o ranking.''; end if;',
    'select coalesce(v_regions, ''{}''::bigint[]) || coalesce((select array_agg(g.region_id) from public.ranking_grants g where g.user_id = auth.uid() and g.scope = ''region'' and g.region_id is not null), ''{}''::bigint[]) into v_regions; if coalesce(array_length(v_regions, 1), 0) = 0 then raise exception ''Sem permissão para consultar o ranking.''; end if;');
  if (length(d) - length(replace(d, 'ranking_grants', ''))) / length('ranking_grants') < 2 then
    raise exception 'Trechos da adh_ranking não encontrados; ajuste manual necessário.';
  end if;
  if d <> o then execute d; end if;
end $$;
