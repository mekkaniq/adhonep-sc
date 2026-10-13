-- ADHONEP-SC claude v3.2 — garante que o formulário público GRAVA e o administrador LÊ/DECIDE as solicitações de cadastro
-- Idempotente. Rode uma vez no SQL Editor.
begin;
grant usage on schema public to anon, authenticated;
grant insert on public.access_requests to anon, authenticated;
grant select, update on public.access_requests to authenticated;

alter table public.access_requests enable row level security;

drop policy if exists access_requests_public_insert on public.access_requests;
create policy access_requests_public_insert on public.access_requests for insert to anon, authenticated
  with check (status = 'pending');

drop policy if exists access_requests_admin_select on public.access_requests;
create policy access_requests_admin_select on public.access_requests for select to authenticated
  using (public.is_state_admin());

drop policy if exists access_requests_admin_update on public.access_requests;
create policy access_requests_admin_update on public.access_requests for update to authenticated
  using (public.is_state_admin()) with check (public.is_state_admin());
commit;

-- Conferência 1: quantos pedidos existem (rode logado no painel do Supabase, enxerga tudo)
select count(*) as total_pedidos, count(*) filter (where status='pending') as pendentes from public.access_requests;
-- Conferência 2: políticas
select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='access_requests' order by 1;
