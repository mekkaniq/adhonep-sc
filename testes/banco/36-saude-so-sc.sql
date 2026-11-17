-- v3.21 · "Saúde dos capítulos" (adh_ranking) traz só Santa Catarina
insert into public.municipalities (id, ibge_code, name, state_code) overriding system value values (9004, '9990004', 'TESTE Cidade PR 2', 'PR');
insert into public.chapters (id, name, chapter_number, municipality_id, region_id, status, is_public, state_code, country_iso3) overriding system value values
  (804, 'TESTE Capítulo PR', 9804, 9003, 903, 'active', true, 'PR', 'BRA');

do $$
declare r jsonb; quem text;
begin
  foreach quem in array array['admin', 'dir_estadual'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', teste.uid(quem), 'role', 'authenticated')::text, true);
    r := public.adh_ranking(current_date);
    perform teste.confere('saúde (' || quem || '): não traz capítulo de outro estado',
      not exists (select 1 from jsonb_array_elements(r->'chapters') x where (x->>'chapter_id')::bigint = 804));
    perform teste.confere('saúde (' || quem || '): não traz região de outro estado',
      not exists (select 1 from jsonb_array_elements(r->'regions') x where (x->>'region_id')::bigint = 903));
    perform teste.confere('saúde (' || quem || '): continua trazendo os capítulos ativos de SC',
      (select count(*) from jsonb_array_elements(r->'chapters') x where (x->>'chapter_id')::bigint in (801, 802)) = 2);
    perform teste.confere('saúde (' || quem || '): continua trazendo as regiões de SC',
      (select count(*) from jsonb_array_elements(r->'regions') x where (x->>'region_id')::bigint in (901, 902)) = 2);
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', teste.uid('dir_regional'), 'role', 'authenticated')::text, true);
  r := public.adh_ranking(current_date);
  perform teste.confere('saúde (dir_regional): só a região dele',
    (select coalesce(bool_and((x->>'region_id')::bigint = 901), false) from jsonb_array_elements(r->'regions') x)
    and (select coalesce(bool_and((x->>'region_id')::bigint = 901), true) from jsonb_array_elements(r->'chapters') x));
  perform set_config('request.jwt.claims', '', true);
end $$;

select teste.confere('saúde: sócio continua sem acesso', teste.bloqueou(teste.tenta(teste.uid('socio'), 'select public.adh_ranking(current_date)')) or teste.tenta(teste.uid('socio'), 'select public.adh_ranking(current_date)') like 'erro:%');
select teste.confere('saúde: visitante continua sem acesso', teste.tenta(null, 'select public.adh_ranking(current_date)') like 'erro:%');

delete from public.chapters where id = 804;
delete from public.municipalities where id = 9004;
