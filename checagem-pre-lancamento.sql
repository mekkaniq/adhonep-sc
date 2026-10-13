-- ADHONEP-SC · checagem pré-lançamento (SOMENTE LEITURA). Rode no SQL Editor e confira cada bloco.

-- 1) Tabelas do schema public SEM RLS ligado (deve voltar VAZIO)
select c.relname as tabela_sem_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 2) O que o visitante anônimo (anon) consegue LER/ESCREVER (deve ser só leitura pública + insert em access_requests)
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as privilegios_anon
from information_schema.role_table_grants
where table_schema='public' and grantee='anon' group by table_name order by 1;

-- 3) Políticas de leitura para anon: confira que nada privado aparece (relatórios, preletores, usuários, solicitações)
select tablename, policyname, cmd from pg_policies
where schemaname='public' and 'anon' = any(roles) order by 1,2;

-- 4) Administradores ativos (deve ser só quem você espera)
select ur.user_id, p.full_name, ur.role from public.user_roles ur left join public.profiles p on p.id=ur.user_id
where ur.is_active and ur.role::text in ('state_admin','state_director') order by 3;
