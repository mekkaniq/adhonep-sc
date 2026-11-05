-- ADHONEP-SC · checagens de estrutura: RLS e o que o visitante (anon) pode fazer.
-- Listas "permitido" abaixo são decisões do projeto; mudou alguma? atualize aqui E no docs/BACKLOG.md.

do $$
declare r record; v text;
  -- o visitante só LÊ estas tabelas/visões (conteúdo do site público). A RLS filtra as linhas.
  anon_le text[] := array['chapters','events','municipalities','region_municipalities',
                          'public_announcements','public_chapter_contacts','public_chapter_info'];
  -- tabelas lidas pelo visitante só em algumas colunas (GRANT por coluna)
  anon_le_colunas text[] := array['regions','statewide_announcements'];
  -- o visitante só GRAVA aqui: formulário "Solicitar cadastro"
  anon_grava text[] := array['access_requests'];
  -- funções que o visitante pode chamar
  anon_funcoes text[] := array['adh_notif_visible','adh_public_chapters_br','adh_public_foreign_chapters',
                               'adh_register_device','adh_trg_event_notify','adh_trg_request_notify'];
begin
  -- 1) RLS ligada em todas as tabelas
  for r in select c.relname, c.relrowsecurity from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') order by 1 loop
    perform teste.confere('RLS ligada: ' || r.relname, r.relrowsecurity);
  end loop;

  -- 2) visitante: nenhuma permissão de escrita/estrutura, fora a lista
  for r in select c.relname, a.privilege_type from pg_class c, aclexplode(c.relacl) a
           where c.relnamespace = 'public'::regnamespace and a.grantee in (0, 'anon'::regrole)
             and a.privilege_type not in ('SELECT', 'MAINTAIN') order by 1, 2 loop
    perform teste.confere('Visitante sem ' || r.privilege_type || ' em ' || r.relname,
      r.privilege_type = 'INSERT' and r.relname = any(anon_grava), 'permissão liberada para o papel anônimo');
  end loop;
  perform teste.confere('Visitante: só o formulário de cadastro aceita gravação',
    (select count(*) = 0 from pg_class c, aclexplode(c.relacl) a
      where c.relnamespace = 'public'::regnamespace and a.grantee in (0, 'anon'::regrole)
        and a.privilege_type in ('INSERT','UPDATE','DELETE') and not (c.relname = any(anon_grava))));

  -- 3) visitante: leitura só do que é público
  for r in select distinct c.relname from pg_class c, aclexplode(c.relacl) a
           where c.relnamespace = 'public'::regnamespace and a.grantee in (0, 'anon'::regrole) and a.privilege_type = 'SELECT' order by 1 loop
    perform teste.confere('Visitante pode ler ' || r.relname || ' (está na lista pública)', r.relname = any(anon_le));
  end loop;
  for r in select distinct c.relname from pg_class c join pg_attribute at on at.attrelid = c.oid, aclexplode(at.attacl) a
           where c.relnamespace = 'public'::regnamespace and a.grantee in (0, 'anon'::regrole) order by 1 loop
    perform teste.confere('Visitante lê colunas de ' || r.relname || ' (está na lista pública)', r.relname = any(anon_le_colunas));
  end loop;
  perform teste.confere('Visitante não lê telefone de diretor regional',
    not has_column_privilege('anon', 'public.regions', 'director_phone', 'SELECT'));

  -- 4) visitante: só chama as funções da lista
  for r in select p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1 loop
    perform teste.confere('Visitante pode chamar ' || r.proname || ' (está na lista)', r.proname = any(anon_funcoes));
  end loop;

  -- 5) ninguém da API pode TRUNCATE (apaga a tabela inteira passando por cima da RLS)
  for r in select c.relname, a.grantee::regrole::text papel from pg_class c, aclexplode(c.relacl) a
           where c.relnamespace = 'public'::regnamespace and a.privilege_type = 'TRUNCATE'
             and a.grantee in ('anon'::regrole, 'authenticated'::regrole) order by 1, 2 loop
    perform teste.confere('Sem TRUNCATE para ' || r.papel || ' em ' || r.relname, false, 'TRUNCATE ignora a RLS');
  end loop;
  perform teste.confere('Nenhum TRUNCATE liberado para visitante ou logado',
    not exists (select 1 from pg_class c, aclexplode(c.relacl) a where c.relnamespace = 'public'::regnamespace
                 and a.privilege_type = 'TRUNCATE' and a.grantee in ('anon'::regrole, 'authenticated'::regrole)));

  -- 6) funções que rodam com poder de dono têm search_path fixo
  for r in select p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%') order by 1 loop
    perform teste.confere('search_path fixo em ' || r.proname, false);
  end loop;
end $$;
