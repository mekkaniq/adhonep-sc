-- ADHONEP-SC · checagens da divisão de regiões (v3.19): função adh_mover_municipios.
-- Roda depois do 30-perfis.sql porque mexe nos dados de teste.

do $$
declare v text; n int;
begin
  -- quem pode chamar: só o dono do banco (SQL Editor / migração)
  perform teste.confere('Regiões: visitante NÃO chama adh_mover_municipios',
    not has_function_privilege('anon', 'public.adh_mover_municipios(text,text[],text,text)', 'execute'));
  perform teste.confere('Regiões: usuário logado NÃO chama adh_mover_municipios',
    not has_function_privilege('authenticated', 'public.adh_mover_municipios(text,text[],text,text)', 'execute'));

  -- cria a região nova e leva o município e os capítulos dele
  v := public.adh_mover_municipios('TESTE Região Nova', array['TESTE Cidade Vale'], 'Diretor Teste');
  select count(*) into n from public.regions where name = 'TESTE Região Nova' and director_name = 'Diretor Teste' and state_code = 'SC';
  perform teste.confere('Regiões: cria a região nova com o diretor', n = 1, v);
  select count(*) into n from public.region_municipalities rm join public.regions r on r.id = rm.region_id
   where rm.municipality_id = 9001 and rm.valid_until is null and r.name = 'TESTE Região Nova';
  perform teste.confere('Regiões: município passa para a região nova', n = 1, v);
  select count(*) into n from public.region_municipalities where municipality_id = 9001 and valid_until is null;
  perform teste.confere('Regiões: município fica com um único vínculo atual', n = 1);
  select count(*) into n from public.chapters c join public.regions r on r.id = c.region_id
   where c.id in (801, 803) and r.name = 'TESTE Região Nova';
  perform teste.confere('Regiões: capítulos do município vão junto (ativo e inativo)', n = 2);
  select count(*) into n from public.chapters where id = 802 and region_id = 902;
  perform teste.confere('Regiões: capítulo de outro município não muda', n = 1);

  -- ajustar de novo no mesmo dia (devolver) funciona e não duplica
  v := public.adh_mover_municipios('TESTE Região Vale', array['TESTE Cidade Vale']);
  select count(*) into n from public.region_municipalities where municipality_id = 9001 and valid_until is null and region_id = 901;
  perform teste.confere('Regiões: ajuste no mesmo dia devolve o município', n = 1, v);
  select count(*) into n from public.chapters where id in (801, 803) and region_id = 901;
  perform teste.confere('Regiões: ajuste no mesmo dia devolve os capítulos', n = 2);

  -- não mexe em outro estado e recusa nome errado
  begin
    perform public.adh_mover_municipios('TESTE Região Nova', array['TESTE Cidade PR']);
    perform teste.confere('Regiões: recusa município de outro estado', false);
  exception when others then
    perform teste.confere('Regiões: recusa município de outro estado', true, sqlerrm);
  end;
end $$;

-- v3.20: pela tela, só o administrador muda cidade de região e cria região
do $$
declare res text; u text;
begin
  res := teste.tenta(teste.uid('admin'), 'select public.adh_admin_mover_municipio(9002, 901)');
  perform teste.confere('Regiões (tela): administrador muda a cidade de região', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('admin'), 'select public.adh_admin_criar_regiao(''TESTE Região Criada'', ''Fulano'')');
  perform teste.confere('Regiões (tela): administrador cria região', teste.linhas(res) = 1, res);
  res := teste.tenta(teste.uid('admin'), 'select public.adh_admin_mover_municipio(9003, 901)');
  perform teste.confere('Regiões (tela): recusa região de outro estado', res like 'erro:%', res);
  foreach u in array array['dir_estadual','dir_regional','presidente','socio'] loop
    res := teste.tenta(teste.uid(u), 'select public.adh_admin_mover_municipio(9002, 901)');
    perform teste.confere('Regiões (tela): ' || u || ' NÃO muda cidade de região', teste.bloqueou(res), res);
    res := teste.tenta(teste.uid(u), 'select public.adh_admin_criar_regiao(''X'' || ''Y'')');
    perform teste.confere('Regiões (tela): ' || u || ' NÃO cria região', teste.bloqueou(res), res);
  end loop;
  res := teste.tenta(null, 'select public.adh_admin_mover_municipio(9002, 901)');
  perform teste.confere('Regiões (tela): visitante NÃO muda cidade de região', teste.bloqueou(res), res);
  perform teste.confere('Regiões (tela): nada mudou depois das tentativas',
    (select region_id from public.region_municipalities where municipality_id = 9002 and valid_until is null) = 902);
end $$;
