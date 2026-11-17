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
