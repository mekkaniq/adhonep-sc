-- ADHONEP-SC claude v1.9 — telefone do diretor regional na tabela de regiões
-- Rode UMA vez no SQL Editor (pode rodar de novo). Pressupõe adh_is_state_manager().
begin;
alter table public.regions add column if not exists director_phone text
  check (director_phone is null or char_length(director_phone) <= 30);

-- Só a gestão estadual edita nome/telefone do diretor e representantes de campo (nada mais da região).
revoke update on public.regions from authenticated;
grant update (director_name, director_phone, field_representatives) on public.regions to authenticated;
drop policy if exists regions_update_contacts on public.regions;
create policy regions_update_contacts on public.regions for update to authenticated
  using (public.adh_is_state_manager()) with check (public.adh_is_state_manager());
commit;
