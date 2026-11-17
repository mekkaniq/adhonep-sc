-- ADHONEP-SC · v3.17 — tira permissões que sobraram para os papéis da API (claude v1.13)
-- STATUS: APLICADA em 12/11/2026 (migração v3_17_sem_truncate_para_api; conferido em 17/11: nenhum TRUNCATE/TRIGGER/REFERENCES para anon/authenticated).
--
-- O que é: o visitante (anon) e o usuário logado (authenticated) tinham TRUNCATE, TRIGGER e REFERENCES
-- em algumas tabelas. TRUNCATE apaga a tabela inteira passando por cima da RLS. O site e o app nunca usam
-- essas permissões e a API do Supabase não oferece TRUNCATE, então nada muda para quem usa o sistema.
-- Quem lê e grava o quê continua igual (SELECT/INSERT/UPDATE/DELETE não são tocados).

do $$
declare r record;
begin
  for r in select c.oid::regclass as tabela from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m') loop
    execute format('revoke truncate, trigger, references on %s from anon, authenticated', r.tabela);
  end loop;
end $$;
