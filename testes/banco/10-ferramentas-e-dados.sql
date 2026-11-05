-- ADHONEP-SC · ferramentas de teste + dados fictícios (só existem no banco de teste).
-- Nada aqui toca a produção. Pessoas, e-mails e capítulos são inventados.

create schema if not exists teste;
create table if not exists teste.resultado (n serial primary key, nome text not null, ok boolean not null, detalhe text);

-- registra um resultado e imprime OK/FAIL
create or replace function teste.confere(p_nome text, p_ok boolean, p_detalhe text default null) returns void
language plpgsql as $$
begin
  insert into teste.resultado (nome, ok, detalhe) values (p_nome, coalesce(p_ok, false), p_detalhe);
  raise notice '%', (case when coalesce(p_ok, false) then 'OK   ' else 'FAIL ' end) || p_nome
                     || case when not coalesce(p_ok, false) and p_detalhe is not null then '  →  ' || p_detalhe else '' end;
end $$;

-- executa um comando COMO um papel/usuário e desfaz tudo no fim.
-- devolve 'linhas:N' (deu certo, N linhas afetadas/lidas) ou 'erro:CÓDIGO' (ex.: 42501 = sem permissão / bloqueado pela RLS)
create or replace function teste.tenta(p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare n bigint; r text;
begin
  begin
    if p_uid is null then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      execute 'set local role anon';
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'P0099', message = 'linhas:' || n;   -- desfaz o que o comando fez
  exception
    when sqlstate 'P0099' then r := sqlerrm;
    when others then r := 'erro:' || sqlstate;
  end;
  return r;
end $$;

create or replace function teste.linhas(p_res text) returns bigint language sql immutable as $$
  select case when p_res like 'linhas:%' then substr(p_res, 8)::bigint else -1 end
$$;
create or replace function teste.bloqueou(p_res text) returns boolean language sql immutable as $$
  -- bloqueado = erro de permissão/RLS/regra, ou nenhuma linha afetada
  select p_res like 'erro:%' or p_res = 'linhas:0'
$$;

-- usuários fictícios (ids fixos para ficar fácil de ler)
create or replace function teste.uid(p text) returns uuid language sql immutable as $$
  select (case p
    when 'admin'        then '00000000-0000-0000-0000-00000000000a'
    when 'dir_estadual' then '00000000-0000-0000-0000-00000000000b'
    when 'dir_regional' then '00000000-0000-0000-0000-00000000000c'
    when 'presidente'   then '00000000-0000-0000-0000-00000000000d'
    when 'presidente2'  then '00000000-0000-0000-0000-00000000000e'
    when 'socio'        then '00000000-0000-0000-0000-00000000000f'
    when 'coord_jovem'  then '00000000-0000-0000-0000-000000000010'
  end)::uuid
$$;

-- ===== dados =====
insert into public.countries (iso3, name) values ('BRA', 'Brasil') on conflict do nothing;
insert into public.states (code, country_iso3, name) values ('SC', 'BRA', 'Santa Catarina'), ('PR', 'BRA', 'Paraná') on conflict do nothing;

insert into public.regions (id, name, is_active, state_code) overriding system value values
  (901, 'TESTE Região Vale', true, 'SC'), (902, 'TESTE Região Oeste', true, 'SC'), (903, 'TESTE Região PR', true, 'PR');
insert into public.municipalities (id, ibge_code, name, state_code) overriding system value values
  (9001, '9990001', 'TESTE Cidade Vale', 'SC'), (9002, '9990002', 'TESTE Cidade Oeste', 'SC'), (9003, '9990003', 'TESTE Cidade PR', 'PR');
insert into public.region_municipalities (region_id, municipality_id, state_code) values (901, 9001, 'SC'), (902, 9002, 'SC'), (903, 9003, 'PR');
insert into public.chapters (id, name, chapter_number, municipality_id, region_id, status, is_public, state_code, country_iso3) overriding system value values
  (801, 'TESTE Capítulo Vale', 9801, 9001, 901, 'active', true, 'SC', 'BRA'),
  (802, 'TESTE Capítulo Oeste', 9802, 9002, 902, 'active', true, 'SC', 'BRA'),
  (803, 'TESTE Capítulo Inativo', 9803, 9001, 901, 'inactive', false, 'SC', 'BRA');

insert into auth.users (id, email) select teste.uid(x), x || '@teste.invalid'
  from unnest(array['admin','dir_estadual','dir_regional','presidente','presidente2','socio','coord_jovem']) x;
insert into public.profiles (id, full_name) select teste.uid(x), 'TESTE ' || x
  from unnest(array['admin','dir_estadual','dir_regional','presidente','presidente2','socio','coord_jovem']) x;
insert into public.user_roles (user_id, role, is_active, region_id, chapter_id) values
  (teste.uid('admin'),        'state_admin',       true, null, null),
  (teste.uid('dir_estadual'), 'state_director',    true, null, null),
  (teste.uid('dir_regional'), 'regional_director', true, 901,  null),
  (teste.uid('presidente'),   'chapter_president', true, null, 801),
  (teste.uid('presidente2'),  'chapter_president', true, null, 802),
  (teste.uid('socio'),        'member',            true, null, 801),
  (teste.uid('coord_jovem'),  'youth_coordinator', true, null, 801);

-- conteúdo já existente
insert into public.events (id, chapter_id, title, event_type, starts_at, status, is_published) overriding system value values
  (7001, 802, 'TESTE Jantar Oeste', 'dinner', now() + interval '10 days', 'scheduled', true),
  (7002, 801, 'TESTE Jantar Vale',  'dinner', now() + interval '20 days', 'scheduled', true);
-- relatórios mensais entregues pelos presidentes (o gatilho só aceita quem pode enviar)
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('presidente'), 'role', 'authenticated')::text, false);
set role authenticated;
insert into public.chapter_monthly_reports (chapter_id, ref_month, chapter_meetings, status) values (801, date_trunc('month', now() - interval '1 month')::date, 3, 'Entregue');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', teste.uid('presidente2'), 'role', 'authenticated')::text, false);
set role authenticated;
insert into public.chapter_monthly_reports (chapter_id, ref_month, chapter_meetings, status) values (802, date_trunc('month', now() - interval '1 month')::date, 2, 'Entregue');
reset role;
select set_config('request.jwt.claims', '', false);
insert into public.statewide_announcements (id, title, summary, body, status, scope, state_code, region_id, starts_at, published_at, is_public) overriding system value values
  (5001, 'TESTE Aviso estadual', 'resumo', 'texto', 'published', 'state', 'SC', null, now() - interval '1 day', now(), false),
  (5002, 'TESTE Aviso da Região Vale', 'resumo', 'texto', 'published', 'regional', 'SC', 901, now() - interval '1 day', now(), false),
  (5003, 'TESTE Aviso da Região Oeste', 'resumo', 'texto', 'published', 'regional', 'SC', 902, now() - interval '1 day', now(), false);
