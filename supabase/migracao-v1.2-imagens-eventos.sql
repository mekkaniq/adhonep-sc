-- ADHONEP-SC v1.2 — reparo idempotente do Storage de imagens de eventos.
-- Antes de executar: faça backup e confirme que public.is_state_admin() existe.
-- Este script NÃO altera eventos existentes nem apaga arquivos.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'adhonep-event-invitations',
  'adhonep-event-invitations',
  true,
  8388608,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- URLs públicas continuam funcionando, mas a API não pode listar todo o bucket.
DROP POLICY IF EXISTS "ADHONEP public can view event invitations" ON storage.objects;

DROP POLICY IF EXISTS "ADHONEP state admins upload event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins upload event invitations"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'adhonep-event-invitations'
  AND public.is_state_admin()
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);

DROP POLICY IF EXISTS "ADHONEP state admins update event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins update event invitations"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin())
WITH CHECK (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin());

DROP POLICY IF EXISTS "ADHONEP state admins delete event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins delete event invitations"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin());

-- Verificação pós-execução: deve retornar o bucket e as três policies de escrita.
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'adhonep-event-invitations';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'ADHONEP state admins % event invitations'
ORDER BY policyname;
