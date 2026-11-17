-- ADHONEP-SC · v3.19 — divide regiões: Brusque (sai de Blumenau) e Jaraguá do Sul (sai de Joinville) (claude v1.15)
-- STATUS: APLICADA em 17/11/2026 (migração v3_19_regioes_brusque_jaragua; ok do Eduardo). Brusque = região 557, Jaraguá do Sul = 558.
--
-- O que faz:
-- 1) Cria a função public.adh_mover_municipios(região, municípios[], diretor): cria a região se não existir,
--    passa os municípios para ela (o vínculo antigo é encerrado ontem e o novo começa hoje, o histórico fica)
--    e leva junto os capítulos desses municípios. Serve para os ajustes seguintes ("ir fazendo e ajustando"):
--       select public.adh_mover_municipios('Brusque', array['Itajaí... etc']);
--    Só roda pelo SQL Editor / migração (dono do banco). Visitante e usuário logado NÃO podem chamar.
-- 2) Primeira divisão (pedido do Eduardo em 17/11/2026):
--    Brusque (diretor Norberto Bruns): Brusque, Gaspar, Guabiruba, Botuverá (eram de Blumenau) e Nova Trento (era de Tijucas).
--    Jaraguá do Sul (diretor Jean Dias): Jaraguá do Sul, Corupá, Guaramirim, Massaranduba, Schroeder (eram de Joinville).
--    Capítulos que mudam: Brusque, Gaspar (inativo) → Brusque; Jaraguá do Sul → Jaraguá do Sul.
--    Num banco sem esses municípios (o banco de teste), o passo 2 não faz nada.

create or replace function public.adh_mover_municipios(p_regiao text, p_municipios text[], p_diretor text default null, p_uf text default 'SC')
returns text language plpgsql set search_path = public as $$
declare v_reg bigint; v_mun bigint; v_atual record; v_nome text; v_n int; v_movidos int := 0; v_caps int := 0; v_cap int;
begin
  if coalesce(trim(p_regiao), '') = '' then raise exception 'Informe o nome da região'; end if;
  select count(*) into v_n from public.regions where state_code = p_uf and lower(name) = lower(trim(p_regiao));
  if v_n > 1 then raise exception 'Há % regiões chamadas "%" em %', v_n, p_regiao, p_uf; end if;
  select id into v_reg from public.regions where state_code = p_uf and lower(name) = lower(trim(p_regiao));
  if v_reg is null then
    insert into public.regions (name, is_active, state_code, director_name)
    values (trim(p_regiao), true, p_uf, nullif(trim(p_diretor), '')) returning id into v_reg;
  elsif nullif(trim(p_diretor), '') is not null then
    update public.regions set director_name = trim(p_diretor), updated_at = now() where id = v_reg;
  end if;

  foreach v_nome in array coalesce(p_municipios, '{}') loop
    select count(*) into v_n from public.municipalities where state_code = p_uf and lower(name) = lower(trim(v_nome));
    if v_n <> 1 then raise exception 'Município "%" em %: esperava 1, encontrei %', v_nome, p_uf, v_n; end if;
    select id into v_mun from public.municipalities where state_code = p_uf and lower(name) = lower(trim(v_nome));
    select * into v_atual from public.region_municipalities where municipality_id = v_mun and valid_until is null;
    if v_atual.id is null or v_atual.region_id <> v_reg then
      if v_atual.id is not null then
        if v_atual.valid_from >= current_date then
          delete from public.region_municipalities where id = v_atual.id;         -- vínculo criado hoje: troca sem histórico
        else
          update public.region_municipalities set valid_until = current_date - 1 where id = v_atual.id;
        end if;
      end if;
      insert into public.region_municipalities (region_id, municipality_id, valid_from, state_code)
      values (v_reg, v_mun, current_date, p_uf);
      v_movidos := v_movidos + 1;
    end if;
    update public.chapters set region_id = v_reg where municipality_id = v_mun and region_id is distinct from v_reg;
    get diagnostics v_cap = row_count; v_caps := v_caps + v_cap;
  end loop;
  return format('Região %s (id %s): %s município(s) movido(s), %s capítulo(s) atualizado(s)', p_regiao, v_reg, v_movidos, v_caps);
end $$;

revoke all on function public.adh_mover_municipios(text, text[], text, text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.municipalities where state_code = 'SC' and name = 'Brusque') then
    raise notice '%', public.adh_mover_municipios('Brusque',
      array['Brusque','Gaspar','Guabiruba','Botuverá','Nova Trento'], 'Norberto Bruns');
    raise notice '%', public.adh_mover_municipios('Jaraguá do Sul',
      array['Jaraguá do Sul','Corupá','Guaramirim','Massaranduba','Schroeder'], 'Jean Dias');
  end if;
end $$;
