-- ADHONEP-SC · claude v1.5 · corrige "permission denied for table events" (erro 42501)
-- Causa: a política RLS de leitura pública existe, mas faltava o GRANT de SELECT ao papel anon.
-- Seguro para rodar mais de uma vez. Execute no SQL Editor do Supabase.

grant usage on schema public to anon, authenticated;

-- Leitura pública (site aberto): só o que a política RLS já libera.
grant select on public.events          to anon, authenticated;
grant select on public.municipalities  to anon, authenticated;
grant select on public.regions         to anon, authenticated;
grant select on public.region_municipalities to anon, authenticated;
grant select on public.chapters        to anon, authenticated;
grant select on public.public_announcements to anon, authenticated;

-- Usuários logados: as políticas RLS continuam decidindo quem pode gravar.
grant insert, update, delete on public.events to authenticated;

-- Diagnóstico: devem aparecer SELECT para anon em events.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('events','chapters','municipalities','regions','region_municipalities')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;
