-- ADHONEP-SC claude v3.12 — Biblioteca de documentos (rode UMA vez no SQL Editor)
-- Visibilidade: 'members' = todo usuário ativo logado; 'directors' = admin estadual, diretor estadual e diretores regionais.
-- Quem publica: members → admin, diretor estadual, diretor regional, presidente. directors → admin, diretor estadual, diretor regional.
-- Registro: quem publicou e quando (preenchido pelo banco, não pelo navegador). Sem fluxo de aprovação.
-- Excluir: admin estadual (qualquer) ou o próprio autor.

create or replace function public.adh_lib_has(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur
                 where ur.user_id = auth.uid() and ur.is_active = true and ur.role = any(roles))
$$;
revoke all on function public.adh_lib_has(text[]) from public;
grant execute on function public.adh_lib_has(text[]) to authenticated, service_role;

create table if not exists public.library_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  description text check (description is null or char_length(description) <= 600),
  category text not null default 'Outros',
  audience text not null default 'members' check (audience in ('members','directors')),
  file_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_name text,
  uploaded_by_role text,
  created_at timestamptz not null default now()
);
create index if not exists library_docs_created_idx on public.library_docs (created_at desc);

create or replace function public.adh_lib_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uploaded_by := auth.uid();
  new.uploaded_by_name := coalesce((select full_name from public.profiles where id = auth.uid()), 'Usuário');
  new.uploaded_by_role := (select ur.role from public.user_roles ur where ur.user_id = auth.uid() and ur.is_active = true
      order by array_position(array['state_admin','state_director','regional_director','chapter_president'], ur.role) nulls last limit 1);
  new.created_at := now();
  return new;
end $$;
drop trigger if exists adh_lib_stamp_t on public.library_docs;
create trigger adh_lib_stamp_t before insert on public.library_docs for each row execute function public.adh_lib_stamp();

alter table public.library_docs enable row level security;
drop policy if exists lib_select on public.library_docs;
drop policy if exists lib_insert on public.library_docs;
drop policy if exists lib_update on public.library_docs;
drop policy if exists lib_delete on public.library_docs;

create policy lib_select on public.library_docs for select to authenticated using (
  (audience = 'members' and public.adh_lib_has(array['state_admin','state_director','regional_director','field_representative','chapter_president','youth_coordinator','women_coordinator','member']))
  or (audience = 'directors' and public.adh_lib_has(array['state_admin','state_director','regional_director']))
);
create policy lib_insert on public.library_docs for insert to authenticated with check (
  (audience = 'members' and public.adh_lib_has(array['state_admin','state_director','regional_director','chapter_president']))
  or (audience = 'directors' and public.adh_lib_has(array['state_admin','state_director','regional_director']))
);
create policy lib_update on public.library_docs for update to authenticated
  using (public.adh_lib_has(array['state_admin']) or uploaded_by = auth.uid())
  with check (
    (audience = 'members' and public.adh_lib_has(array['state_admin','state_director','regional_director','chapter_president']))
    or (audience = 'directors' and public.adh_lib_has(array['state_admin','state_director','regional_director']))
  );
create policy lib_delete on public.library_docs for delete to authenticated using (
  public.adh_lib_has(array['state_admin']) or uploaded_by = auth.uid()
);

grant select, insert, update, delete on public.library_docs to authenticated;
grant all on public.library_docs to service_role;

-- Bucket privado (50 MB por arquivo; só formatos de documento)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library','library', false, 52428800, array[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png','image/jpeg','text/plain'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists lib_obj_select on storage.objects;
drop policy if exists lib_obj_insert on storage.objects;
drop policy if exists lib_obj_delete on storage.objects;
create policy lib_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'library' and exists (select 1 from public.library_docs d where d.file_path = storage.objects.name)
);
create policy lib_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'library' and public.adh_lib_has(array['state_admin','state_director','regional_director','chapter_president'])
);
create policy lib_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'library' and (public.adh_lib_has(array['state_admin']) or owner = auth.uid())
);
