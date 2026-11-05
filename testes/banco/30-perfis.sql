-- ADHONEP-SC · regras de perfil, testadas como cada pessoa (tudo é desfeito no fim de cada tentativa).
-- Regras: administrador mexe em tudo; diretor estadual publica, mas não exclui; diretor regional aprova
-- relatórios e publica comunicados só da região dele; presidente publica eventos e envia relatórios só do
-- capítulo dele; sócio só vê. Só o administrador exclui (exceções combinadas: veja EXCLUSOES_PERMITIDAS).

do $$
declare res text; rel bigint; t text;
  novo_evento text := 'insert into public.events (chapter_id, title, event_type, starts_at, is_published) values (%s, ''TESTE novo'', ''dinner'', now() + interval ''5 days'', true)';
  novo_relatorio text := 'insert into public.chapter_monthly_reports (chapter_id, ref_month, chapter_meetings, status) values (%s, date_trunc(''month'', now())::date, 1, ''Entregue'')';
  aviso_regional text := 'insert into public.statewide_announcements (title, summary, body, scope, state_code, region_id, status) values (''TESTE aviso'', ''r'', ''t'', ''regional'', ''SC'', %s, ''published'')';
  aviso_estadual text := 'insert into public.statewide_announcements (title, summary, body, scope, state_code, status) values (''TESTE aviso estadual'', ''r'', ''t'', ''state'', ''SC'', ''published'')';
begin
  select id into rel from public.chapter_monthly_reports where chapter_id = 801;

  -- ===== VISITANTE (sem login) =====
  res := teste.tenta(null, 'select 1 from public.chapters');
  perform teste.confere('Visitante vê só capítulos ativos e públicos (2 de 3)', teste.linhas(res) = 2, res);
  res := teste.tenta(null, 'select 1 from public.user_roles');
  perform teste.confere('Visitante não vê perfis de acesso', teste.bloqueou(res), res);
  res := teste.tenta(null, 'select 1 from public.profiles');
  perform teste.confere('Visitante não vê cadastros de pessoas', teste.bloqueou(res), res);
  res := teste.tenta(null, format(novo_evento, 801));
  perform teste.confere('Visitante não publica evento', teste.bloqueou(res), res);
  res := teste.tenta(null, 'insert into public.access_requests (full_name, email, phone, city, requested_role, status, justification, consent_version) values (''TESTE Pessoa Nova'', ''p@teste.invalid'', ''47999990000'', ''Brusque'', ''member'', ''pending'', ''Quero participar do capítulo.'', ''v1'')');
  perform teste.confere('Visitante envia pedido de cadastro', teste.linhas(res) = 1, res);
  res := teste.tenta(null, 'insert into public.access_requests (full_name, email, phone, city, requested_role, status) values (''TESTE Pessoa'', ''p@teste.invalid'', ''47999990000'', ''Brusque'', ''member'', ''approved'')');
  perform teste.confere('Visitante não envia pedido já aprovado', teste.bloqueou(res), res);
  res := teste.tenta(null, 'insert into public.access_requests (full_name, email, phone, city, requested_role, status, justification) values (''TESTE Pessoa Nova'', ''q@teste.invalid'', ''47999990000'', ''Brusque'', ''member'', ''pending'', ''Quero participar do capítulo.'')');
  perform teste.confere('Pedido de cadastro exige aceite da Política de Privacidade', teste.bloqueou(res), res);
  res := teste.tenta(null, 'select 1 from public.access_requests');
  perform teste.confere('Visitante não lê pedidos de cadastro', teste.bloqueou(res), res);
  res := teste.tenta(null, 'select 1 from public.chapter_monthly_reports');
  perform teste.confere('Visitante não vê relatórios mensais', teste.bloqueou(res), res);

  -- ===== SÓCIO (capítulo Vale) =====
  res := teste.tenta(teste.uid('socio'), format(novo_evento, 801));
  perform teste.confere('Sócio não publica evento', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('socio'), format(novo_relatorio, 801));
  perform teste.confere('Sócio não envia relatório mensal', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('socio'), 'update public.chapter_monthly_reports set status = ''Aprovado'' where id = ' || rel);
  perform teste.confere('Sócio não aprova relatório', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('socio'), 'select 1 from public.statewide_announcements where id in (5001, 5002)');
  perform teste.confere('Sócio vê o aviso estadual e o da própria região', teste.linhas(res) = 2, res);
  res := teste.tenta(teste.uid('socio'), 'select 1 from public.statewide_announcements where id = 5003');
  perform teste.confere('Sócio não vê aviso de outra região', teste.linhas(res) = 0, res);
  res := teste.tenta(teste.uid('socio'), 'select 1 from public.user_roles');
  perform teste.confere('Sócio vê só o próprio perfil de acesso', teste.linhas(res) = 1, res);

  -- ===== PRESIDENTE (capítulo Vale) =====
  res := teste.tenta(teste.uid('presidente'), format(novo_evento, 801));
  perform teste.confere('Presidente publica evento do próprio capítulo (sem revisão)', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('presidente'), format(novo_evento, 802));
  perform teste.confere('Presidente não publica evento de outro capítulo', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('presidente'), format(novo_relatorio, 801));
  perform teste.confere('Presidente envia relatório do próprio capítulo', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('presidente'), format(novo_relatorio, 802));
  perform teste.confere('Presidente não envia relatório de outro capítulo', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('presidente'), 'update public.chapter_monthly_reports set status = ''Aprovado'' where id = ' || rel);
  perform teste.confere('Presidente não aprova o próprio relatório', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('presidente'), 'select 1 from public.chapter_monthly_reports where chapter_id = 802');
  perform teste.confere('Presidente não vê relatório de outro capítulo', teste.linhas(res) = 0, res);
  res := teste.tenta(teste.uid('presidente'), format(aviso_estadual));
  perform teste.confere('Presidente não publica comunicado estadual', teste.bloqueou(res), res);

  -- ===== DIRETOR REGIONAL (Região Vale) =====
  res := teste.tenta(teste.uid('dir_regional'), 'update public.chapter_monthly_reports set status = ''Aprovado'' where id = ' || rel);
  perform teste.confere('Diretor regional aprova relatório da própria região', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('dir_regional'), 'update public.chapter_monthly_reports set status = ''Aprovado'' where chapter_id = 802');
  perform teste.confere('Diretor regional não aprova relatório de outra região', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('dir_regional'), format(aviso_regional, 901));
  perform teste.confere('Diretor regional publica comunicado da própria região', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('dir_regional'), format(aviso_regional, 902));
  perform teste.confere('Diretor regional não publica comunicado de outra região', teste.bloqueou(res), res);
  res := teste.tenta(teste.uid('dir_regional'), format(aviso_estadual));
  perform teste.confere('Diretor regional não publica comunicado estadual', teste.bloqueou(res), res);

  -- ===== DIRETOR ESTADUAL =====
  res := teste.tenta(teste.uid('dir_estadual'), format(aviso_estadual));
  perform teste.confere('Diretor estadual publica comunicado estadual', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('dir_estadual'), format(novo_evento, 802));
  perform teste.confere('Diretor estadual publica evento em qualquer capítulo de SC', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('dir_estadual'), 'update public.user_roles set role = ''state_admin'' where user_id = ''' || teste.uid('dir_estadual') || '''');
  perform teste.confere('Diretor estadual não se promove a administrador', teste.bloqueou(res), res);

  -- ===== SÓ O ADMINISTRADOR EXCLUI =====
  foreach t in array array['dir_estadual','dir_regional','presidente','socio','coord_jovem'] loop
    res := teste.tenta(teste.uid(t), 'delete from public.events');
    perform teste.confere(t || ' não exclui eventos', teste.bloqueou(res), res);
    res := teste.tenta(teste.uid(t), 'delete from public.chapters');
    perform teste.confere(t || ' não exclui capítulos', teste.bloqueou(res), res);
    res := teste.tenta(teste.uid(t), 'delete from public.chapter_monthly_reports');
    perform teste.confere(t || ' não exclui relatórios', teste.bloqueou(res), res);
    res := teste.tenta(teste.uid(t), 'delete from public.statewide_announcements');
    perform teste.confere(t || ' não exclui comunicados', teste.bloqueou(res), res);
    res := teste.tenta(teste.uid(t), 'delete from public.user_roles');
    perform teste.confere(t || ' não exclui perfis de acesso', teste.bloqueou(res), res);
  end loop;
  res := teste.tenta(teste.uid('admin'), 'delete from public.events where id = 7001');
  perform teste.confere('Administrador exclui evento', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('admin'), 'delete from public.statewide_announcements where id = 5003');
  perform teste.confere('Administrador exclui comunicado', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('admin'), 'update public.user_roles set is_active = false where user_id = ''' || teste.uid('socio') || '''');
  perform teste.confere('Administrador altera perfis de acesso', teste.linhas(res) = 1, res);
end $$;

-- Regras de exclusão no banco: toda regra de DELETE que não seja "só administrador" precisa estar nesta lista.
do $$
declare r record;
  -- exceções combinadas (corrigir o próprio registro): confirmar com o Eduardo se continuam valendo
  EXCLUSOES_PERMITIDAS text[] := array['chapter_meeting_log', 'leader_mandates', 'library_docs'];
begin
  for r in select tablename, policyname, coalesce(qual, '') q from pg_policies
           where schemaname = 'public' and cmd in ('DELETE', 'ALL') order by 1 loop
    perform teste.confere('Exclusão em ' || r.tablename || ' (' || r.policyname || ') é só do administrador ou exceção combinada',
      r.q ~ '^\(?\s*(\(\s*SELECT\s+)?is_state_admin\(\)' or r.q in ('is_state_admin()') or r.tablename = any(EXCLUSOES_PERMITIDAS)
      or r.tablename in ('countries', 'states', 'scope_roles'),  -- escrita só da diretoria global/administrador
      r.q);
  end loop;
end $$;
