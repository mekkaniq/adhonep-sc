-- ADHONEP-SC · claude v1.9 · move o município de Timbó da região Araranguá para a região Blumenau.
-- Rode no SQL Editor do Supabase. Primeiro o DIAGNÓSTICO (só consulta), depois a CORREÇÃO.

-- 1) DIAGNÓSTICO: como Timbó está vinculado hoje
select m.id as municipio_id, m.name as municipio, r.id as regiao_id, r.name as regiao, rm.valid_from, rm.valid_until
from public.municipalities m
join public.region_municipalities rm on rm.municipality_id = m.id
join public.regions r on r.id = rm.region_id
where m.name ilike 'Timb_'
order by rm.valid_from;

select id, name, region_id, municipality_id from public.chapters
where municipality_id in (select id from public.municipalities where name ilike 'Timb_');

-- 2) CORREÇÃO (confira que existe UMA região chamada Blumenau antes)
do $$
declare v_m bigint; v_r bigint; v_n int;
begin
  select count(*) into v_n from public.regions where name ilike 'Blumenau';
  if v_n <> 1 then raise exception 'Esperava 1 região "Blumenau", encontrei %', v_n; end if;
  select id into v_r from public.regions where name ilike 'Blumenau';
  select count(*) into v_n from public.municipalities where name ilike 'Timb_';
  if v_n <> 1 then raise exception 'Esperava 1 município "Timbó", encontrei %', v_n; end if;
  select id into v_m from public.municipalities where name ilike 'Timb_';
  update public.region_municipalities set region_id = v_r
   where municipality_id = v_m and valid_until is null;
  update public.chapters set region_id = v_r where municipality_id = v_m;
  raise notice 'Timbó (id %) agora está na região Blumenau (id %).', v_m, v_r;
end $$;

-- 3) CONFERÊNCIA
select m.name as municipio, r.name as regiao
from public.region_municipalities rm
join public.municipalities m on m.id = rm.municipality_id
join public.regions r on r.id = rm.region_id
where m.name ilike 'Timb_' and rm.valid_until is null;
