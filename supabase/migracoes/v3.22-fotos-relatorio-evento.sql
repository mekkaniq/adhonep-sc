-- ADHONEP-SC · v3.22 — relatório de evento com até 3 fotos (claude v1.15)
-- STATUS: APLICADA em 17/11/2026 (migração v3_22_fotos_relatorio_evento; bucket privado + 3 políticas conferidos).
--
-- Pedido do diretor estadual (reunião 12/11, item 3). Fotos ficam num bucket PRIVADO (relatório é interno):
-- caminho "<capítulo>/<arquivo>". Quem vê as fotos = quem vê o relatório (adh_can_see_report_chapter:
-- administrador, diretor estadual, diretor regional da região e presidente do capítulo). Envia: administrador e
-- presidente do capítulo (quem cria relatório). Apaga foto: administrador e presidente do capítulo.
-- Limite de 3 fotos garantido no banco (check) e na tela. Nada existente muda.

alter table public.chapter_reports add column if not exists photo_paths text[] not null default '{}';
create or replace function public.adh_fotos_relatorio_ok(p_paths text[], p_chapter bigint)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p_paths), 0) <= 3
     and not exists (select 1 from unnest(p_paths) x where x !~ ('^' || p_chapter::text || '/[A-Za-z0-9._-]+$'));
$$;
revoke all on function public.adh_fotos_relatorio_ok(text[], bigint) from public, anon;
grant execute on function public.adh_fotos_relatorio_ok(text[], bigint) to authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chapter_reports_max_3_fotos') then
    alter table public.chapter_reports add constraint chapter_reports_max_3_fotos
      check (public.adh_fotos_relatorio_ok(photo_paths, chapter_id));
  end if;
end $$;

-- Storage (só existe no Supabase de verdade; no banco de teste este bloco não roda)
do $$ begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-report-photos', 'event-report-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

  execute $p$drop policy if exists erphoto_select on storage.objects$p$;
  execute $p$drop policy if exists erphoto_insert on storage.objects$p$;
  execute $p$drop policy if exists erphoto_delete on storage.objects$p$;
  execute $p$create policy erphoto_select on storage.objects for select to authenticated using (
    bucket_id = 'event-report-photos' and name ~ '^[0-9]+/[A-Za-z0-9._-]+$'
    and public.adh_can_see_report_chapter(split_part(name, '/', 1)::bigint))$p$;
  execute $p$create policy erphoto_insert on storage.objects for insert to authenticated with check (
    bucket_id = 'event-report-photos' and name ~ '^[0-9]+/[A-Za-z0-9._-]+$'
    and lower(storage.extension(name)) = any (array['jpg','jpeg','png','webp'])
    and (public.is_state_admin() or public.adh_is_president_of(split_part(name, '/', 1)::bigint)))$p$;
  execute $p$create policy erphoto_delete on storage.objects for delete to authenticated using (
    bucket_id = 'event-report-photos' and name ~ '^[0-9]+/[A-Za-z0-9._-]+$'
    and (public.is_state_admin() or public.adh_is_president_of(split_part(name, '/', 1)::bigint)))$p$;
end $$;
