-- ADHONEP-SC · v3.18 — hardening: funções de gatilho fora da API e limite no token de dispositivo (claude v1.14)
-- STATUS: APLICADA em 16/11/2026 (ok do Eduardo). Já entra no teste do banco.
--
-- Origem: varredura de segurança do Supabase (advisor) de 16/11/2026.
--
-- 1) adh_trg_event_notify e adh_trg_request_notify são funções de GATILHO (avisam a diretoria quando entra
--    um evento ou um pedido de cadastro). Estavam com EXECUTE liberado para todos (PUBLIC), por isso o advisor
--    as lista como "chamáveis sem login". Na prática ninguém consegue chamá-las pela API (função de gatilho só
--    roda como gatilho), mas a permissão não precisa existir. O gatilho continua disparando normalmente:
--    o Postgres só confere o EXECUTE quando o gatilho é CRIADO, não quando ele dispara (o teste do banco confere).
--
-- 2) adh_register_device é chamada pelo app (também antes do login) para guardar o token de notificação.
--    O token não tinha limite de tamanho: um robô podia gravar textos enormes. Tokens reais têm 64 (Apple)
--    a ~200 (Google) caracteres. Limite: 20 a 1024. "not valid" = vale para gravações novas sem reprovar
--    linhas antigas (se houver alguma fora do padrão, ela fica onde está).

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as fn from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;

alter table public.device_tokens drop constraint if exists device_tokens_token_len;
alter table public.device_tokens
  add constraint device_tokens_token_len check (length(token) between 20 and 1024) not valid;
