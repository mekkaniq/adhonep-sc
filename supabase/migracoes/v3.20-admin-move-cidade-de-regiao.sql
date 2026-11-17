-- ADHONEP-SC · v3.20 — administrador muda a cidade de região e cria região pelo painel (claude v1.15)
-- STATUS: APLICADA em 17/11/2026 (migração v3_20_admin_move_cidade_de_regiao; autorização geral do Eduardo para SQL não destrutivo).
--
-- Tela: Regiões e municípios → busca a cidade → escolhe a região nova. Os capítulos da cidade vão junto e o
-- histórico fica (vínculo antigo encerrado ontem, novo começa hoje). Usa a adh_mover_municipios da v3.19.
-- Só o administrador (is_state_admin). Diretores, presidentes, sócios e visitante: recusado.

create or replace function public.adh_admin_mover_municipio(p_municipio bigint, p_regiao bigint)
returns text language plpgsql security definer set search_path = public as $$
declare v_nome text; v_uf text; v_reg text;
begin
  if not public.is_state_admin() then
    raise exception 'Somente o administrador pode mudar a região de uma cidade' using errcode = '42501';
  end if;
  select name, state_code into v_nome, v_uf from public.municipalities where id = p_municipio;
  if v_nome is null then raise exception 'Município não encontrado'; end if;
  select name into v_reg from public.regions where id = p_regiao and state_code = v_uf;
  if v_reg is null then raise exception 'Região não encontrada no estado do município'; end if;
  return public.adh_mover_municipios(v_reg, array[v_nome], null, v_uf);
end $$;

create or replace function public.adh_admin_criar_regiao(p_nome text, p_diretor text default null, p_uf text default 'SC')
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_state_admin() then
    raise exception 'Somente o administrador pode criar região' using errcode = '42501';
  end if;
  if length(coalesce(trim(p_nome), '')) < 2 then raise exception 'Informe o nome da região'; end if;
  if exists (select 1 from public.regions where state_code = p_uf and lower(name) = lower(trim(p_nome))) then
    raise exception 'Já existe uma região com esse nome';
  end if;
  insert into public.regions (name, is_active, state_code, director_name)
  values (trim(p_nome), true, p_uf, nullif(trim(p_diretor), '')) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.adh_admin_mover_municipio(bigint, bigint) from public, anon;
revoke all on function public.adh_admin_criar_regiao(text, text, text) from public, anon;
grant execute on function public.adh_admin_mover_municipio(bigint, bigint) to authenticated;
grant execute on function public.adh_admin_criar_regiao(text, text, text) to authenticated;
