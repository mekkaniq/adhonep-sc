-- v3.24 · secretário e representante de campo (delegação com as mesmas permissões de quem designou)
insert into auth.users (id, email) select teste.uid(x), x || '@teste.invalid' from unnest(array['secretario','representante','secretario_adm']) x on conflict do nothing;
insert into public.profiles (id, full_name) select teste.uid(x), 'TESTE ' || x from unnest(array['secretario','representante','secretario_adm']) x on conflict do nothing;

do $$ begin
  perform teste.confere('secretário: visitante não designa', teste.tenta(null, 'select public.adh_delegation_create(''secretario@teste.invalid'', ''secretario'')') like 'erro:%');
  perform teste.confere('secretário: sócio (sem cargo) não designa', teste.bloqueou(teste.tenta(teste.uid('socio'), 'select public.adh_delegation_create(''secretario@teste.invalid'', ''secretario'')')));
  perform teste.confere('secretário: ninguém grava direto na tabela de designações', teste.tenta(teste.uid('admin'), format('insert into public.adh_delegations (delegator_id, delegate_id, kind) values (%L, %L, ''secretario'')', teste.uid('presidente'), teste.uid('secretario'))) like 'erro:%');
  perform teste.confere('secretário: ninguém cria papel "delegado" direto', teste.tenta(teste.uid('admin'), format('insert into public.user_roles (user_id, role, chapter_id, delegated_from) values (%L, ''chapter_president'', 801, 1)', teste.uid('secretario'))) like 'erro:%');
  perform teste.confere('secretário: e-mail sem conta é recusado', teste.tenta(teste.uid('presidente'), 'select public.adh_delegation_create(''ninguem@teste.invalid'', ''secretario'')') like 'erro:%');
  perform teste.confere('secretário: antes de designado, não edita evento do capítulo',
    teste.bloqueou(teste.tenta(teste.uid('secretario'), 'update public.events set title = ''x'' where id = 7002')));
end $$;

-- presidente do 801 designa o secretário; diretor regional designa o representante de campo; administrador designa um secretário
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('presidente'), 'role', 'authenticated')::text, false);
set role authenticated;
select public.adh_delegation_create('secretario@teste.invalid', 'secretario');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('dir_regional'), 'role', 'authenticated')::text, false);
set role authenticated;
select public.adh_delegation_create('representante@teste.invalid', 'representante_campo');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('admin'), 'role', 'authenticated')::text, false);
set role authenticated;
select public.adh_delegation_create('secretario_adm@teste.invalid', 'secretario');
reset role;
select set_config('request.jwt.claims', '', false);

do $$ begin
  perform teste.confere('secretário: recebe o papel de presidente do mesmo capítulo',
    exists (select 1 from public.user_roles where user_id = teste.uid('secretario') and role = 'chapter_president' and chapter_id = 801 and delegated_from is not null));
  perform teste.confere('secretário: edita evento do capítulo como o presidente',
    teste.linhas(teste.tenta(teste.uid('secretario'), 'update public.events set title = ''TESTE Jantar Vale (sec)'' where id = 7002')) = 1);
  perform teste.confere('secretário: NÃO mexe em evento de outro capítulo',
    teste.bloqueou(teste.tenta(teste.uid('secretario'), 'update public.events set title = ''x'' where id = 7001')));
  null;
  perform teste.confere('secretário: não designa outro secretário',
    teste.bloqueou(teste.tenta(teste.uid('secretario'), 'select public.adh_delegation_create(''socio@teste.invalid'', ''secretario'')')));
  perform teste.confere('representante: recebe o papel de diretor regional da região',
    exists (select 1 from public.user_roles where user_id = teste.uid('representante') and role = 'regional_director' and region_id = 901 and delegated_from is not null));
  perform teste.confere('secretário do administrador: é administrador (exclui como ele)',
    exists (select 1 from public.user_roles where user_id = teste.uid('secretario_adm') and role = 'state_admin'));
  perform teste.confere('secretário: vê a própria designação', teste.linhas(teste.tenta(teste.uid('secretario'), 'select * from public.adh_delegation_list()')) = 1);
  perform teste.confere('secretário: outro presidente não vê a designação', teste.linhas(teste.tenta(teste.uid('presidente2'), 'select * from public.adh_delegation_list()')) = 0);
  perform teste.confere('secretário: outro presidente não encerra a designação',
    teste.bloqueou(teste.tenta(teste.uid('presidente2'), format('select public.adh_delegation_end(%s)', (select id from public.adh_delegations where delegate_id = teste.uid('secretario'))))));
end $$;

-- o secretário edita um evento → o registro guarda "em nome de"
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('secretario'), 'role', 'authenticated')::text, false);
set role authenticated;
update public.events set title = 'TESTE Jantar Vale (editado pelo secretário)' where id = 7002;
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform teste.confere('secretário: o que ele faz fica registrado com o nome dele e "em nome de" quem designou',
    exists (select 1 from public.admin_audit_log where actor_id = teste.uid('secretario') and entity_type = 'events'
            and metadata->'em_nome_de'->0->>'delegator' = teste.uid('presidente')::text));
end $$;

-- quem designou muda de capítulo → a cópia acompanha
update public.user_roles set chapter_id = 803 where user_id = teste.uid('presidente') and role = 'chapter_president';
do $$ begin
  perform teste.confere('secretário: acompanha quando o papel de quem designou muda',
    exists (select 1 from public.user_roles where user_id = teste.uid('secretario') and role = 'chapter_president' and chapter_id = 803)
    and not exists (select 1 from public.user_roles where user_id = teste.uid('secretario') and chapter_id = 801));
end $$;
update public.user_roles set chapter_id = 801 where user_id = teste.uid('presidente') and role = 'chapter_president';

-- presidente encerra → o secretário perde o acesso
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('presidente'), 'role', 'authenticated')::text, false);
set role authenticated;
select public.adh_delegation_end((select id from public.adh_delegations where delegate_id = '00000000-0000-0000-0000-000000000011' and is_active));
reset role;
select set_config('request.jwt.claims', '', false);
do $$ begin
  perform teste.confere('secretário: designação encerrada tira todos os papéis copiados',
    not exists (select 1 from public.user_roles where user_id = teste.uid('secretario')));
  perform teste.confere('secretário: depois de encerrado não edita mais',
    teste.linhas(teste.tenta(teste.uid('secretario'), 'update public.events set title = ''x'' where id = 7002')) = 0);
  perform teste.confere('secretário: papel próprio de quem designou continua intacto',
    exists (select 1 from public.user_roles where user_id = teste.uid('presidente') and role = 'chapter_president' and chapter_id = 801));
end $$;
-- limpa as outras designações para não afetar os testes seguintes
delete from public.adh_delegations;
