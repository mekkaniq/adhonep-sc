-- ADHONEP-SC 3v.4 — migração de eventos e convites
-- Revisada para a tabela events já existente. Idempotente; não cria tabela duplicada.
-- Execute no SQL Editor do projeto adhonesp-sc somente após confirmar a existência da função public.is_state_admin() e revisar as políticas existentes.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url text;

-- A coluna events.id já é IDENTITY no banco existente.
-- Não criamos sequência nem alteramos o DEFAULT: o PostgreSQL gera o ID automaticamente.

-- Bucket público apenas para leitura dos convites já publicados no Storage.
-- A escrita exige sessão autenticada e a função administrativa existente.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('adhonep-event-invitations', 'adhonep-event-invitations', true, 8388608,
        ARRAY['image/jpeg','image/png','image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies de Storage restritas a administradores estaduais autenticados.
DROP POLICY IF EXISTS "ADHONEP public can view event invitations" ON storage.objects;
CREATE POLICY "ADHONEP public can view event invitations"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'adhonep-event-invitations');

DROP POLICY IF EXISTS "ADHONEP state admins upload event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins upload event invitations"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin());

DROP POLICY IF EXISTS "ADHONEP state admins update event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins update event invitations"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin())
WITH CHECK (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin());

DROP POLICY IF EXISTS "ADHONEP state admins delete event invitations" ON storage.objects;
CREATE POLICY "ADHONEP state admins delete event invitations"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'adhonep-event-invitations' AND public.is_state_admin());

-- Eventos: escrita apenas por administrador estadual. Mantém a política de leitura pública
-- existente (eventos publicados, futuros, vinculados a capítulo ativo e público).
DROP POLICY IF EXISTS "ADHONEP state admins insert events" ON public.events;
CREATE POLICY "ADHONEP state admins insert events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (public.is_state_admin());

DROP POLICY IF EXISTS "ADHONEP state admins update events" ON public.events;
CREATE POLICY "ADHONEP state admins update events"
ON public.events FOR UPDATE TO authenticated
USING (public.is_state_admin())
WITH CHECK (public.is_state_admin());

DROP POLICY IF EXISTS "ADHONEP state admins delete events" ON public.events;
CREATE POLICY "ADHONEP state admins delete events"
ON public.events FOR DELETE TO authenticated
USING (public.is_state_admin());
