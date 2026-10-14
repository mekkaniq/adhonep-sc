-- ADHONEP-SC claude v3.9 — escopo dos cargos em user_roles (rode UMA vez no SQL Editor)
-- Regra nova: sócio, coordenador jovem/feminino e presidente pertencem a um CAPÍTULO;
-- diretor regional e representante de campo pertencem a uma REGIÃO; admin e diretor estadual, a nenhum.
alter table public.user_roles drop constraint if exists user_roles_scope_check;
alter table public.user_roles add constraint user_roles_scope_check check (
  (role in ('state_admin','state_director') and region_id is null and chapter_id is null)
  or (role in ('regional_director','field_representative') and region_id is not null and chapter_id is null)
  or (role in ('chapter_president','youth_coordinator','women_coordinator') and chapter_id is not null and region_id is null)
  or (role = 'member' and region_id is null)
);
