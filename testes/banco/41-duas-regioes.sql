-- Diretor regional com 2 regiões (pedido do Eduardo, 19/11/2026): vale nas duas, e só nelas
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000014', 'dir_duas@teste.invalid') on conflict do nothing;
insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-000000000014', 'TESTE diretor de duas regiões') on conflict do nothing;
insert into public.user_roles (user_id, role, is_active, region_id) values
  ('00000000-0000-0000-0000-000000000014', 'regional_director', true, 901),
  ('00000000-0000-0000-0000-000000000014', 'regional_director', true, 902);
do $$ declare u uuid := '00000000-0000-0000-0000-000000000014'; begin
  perform teste.confere('2 regiões: a mesma pessoa tem as duas designações', (select count(*) from public.user_roles where user_id = u and role = 'regional_director') = 2);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform teste.confere('2 regiões: vale no capítulo da 1ª região (801)', public.adh_is_regional_director_of(801));
  perform teste.confere('2 regiões: vale no capítulo da 2ª região (802)', public.adh_is_regional_director_of(802));
  perform teste.confere('2 regiões: Saúde mostra as duas regiões', (select count(*) from jsonb_array_elements(public.adh_ranking(current_date)->'regions')) = 2);
  perform set_config('request.jwt.claims', '', true);
end $$;
delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000014';
