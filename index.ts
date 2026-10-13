// Edge Function: admin-create-user  (ADHONEP-SC · claude v3.1)
// Ações: create (padrão) · delete · set_active
//  - Administrador (state_admin): tudo.
//  - Presidente de capítulo: cria/desativa/reativa SÓCIOS (role 'member') do PRÓPRIO capítulo. Nunca exclui.
// A chave service_role fica APENAS aqui (variável de ambiente do Supabase).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const ROLES = ["state_admin","state_director","regional_director","field_representative","chapter_president","youth_coordinator","women_coordinator","member"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: caller, error: ce } = await admin.auth.getUser(token);
    if (ce || !caller?.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const me = caller.user.id;

    const { data: myRoles } = await admin.from("user_roles").select("role,chapter_id").eq("user_id", me).eq("is_active", true);
    const isAdmin = !!myRoles?.some((r) => String(r.role) === "state_admin");
    const myChapters = (myRoles || []).filter((r) => String(r.role) === "chapter_president" && r.chapter_id != null).map((r) => Number(r.chapter_id));
    if (!isAdmin && !myChapters.length) return json({ error: "Sem permissão." }, 403);

    const b = await req.json();
    const action = String(b.action || "create");

    // ---------- excluir (somente administrador)
    if (action === "delete") {
      if (!isAdmin) return json({ error: "Somente o administrador pode excluir usuários." }, 403);
      const uid = String(b.user_id || "");
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (uid === me) return json({ error: "Você não pode excluir a sua própria conta." }, 400);
      await admin.from("user_roles").delete().eq("user_id", uid);
      await admin.from("profiles").delete().eq("id", uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- ativar / desativar
    if (action === "set_active") {
      const uid = String(b.user_id || "");
      const active = !!b.active;
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (uid === me) return json({ error: "Você não pode alterar a sua própria conta." }, 400);
      if (!isAdmin) {
        const { data: t } = await admin.from("user_roles").select("role,chapter_id").eq("user_id", uid);
        const ok = !!t?.length && t.every((r) => String(r.role) === "member" && myChapters.includes(Number(r.chapter_id)));
        if (!ok) return json({ error: "Você só pode alterar sócios do seu capítulo." }, 403);
      }
      const { error } = await admin.from("user_roles").update({ is_active: active }).eq("user_id", uid);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- criar
    const email = String(b.email || "").trim().toLowerCase();
    const full_name = String(b.full_name || "").trim();
    const role = String(b.role || "");
    const phone = String(b.phone || "").replace(/\D/g, "") || null;
    const password = String(b.password || "");
    const region_id = b.region_id ? Number(b.region_id) : null;
    const chapter_id = b.chapter_id ? Number(b.chapter_id) : null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
    if (full_name.length < 3) return json({ error: "Informe o nome completo." }, 400);
    if (!ROLES.includes(role)) return json({ error: "Perfil inválido." }, 400);
    if (role === "regional_director" && !region_id) return json({ error: "Diretor regional exige uma região." }, 400);
    if ((role === "chapter_president" || role === "member") && !chapter_id) return json({ error: "Este perfil exige um capítulo." }, 400);
    if (password && password.length < 8) return json({ error: "A senha provisória deve ter ao menos 8 caracteres." }, 400);
    if (!isAdmin) {
      if (role !== "member") return json({ error: "Presidentes só podem cadastrar sócios." }, 403);
      if (!chapter_id || !myChapters.includes(chapter_id)) return json({ error: "Você só pode cadastrar sócios do seu capítulo." }, 403);
    }

    let uid: string | undefined;
    if (password) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
      if (error) return json({ error: error.message }, 400);
      uid = data.user?.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: b.redirect_to || undefined });
      if (error) return json({ error: error.message }, 400);
      uid = data.user?.id;
    }
    if (!uid) return json({ error: "Conta não retornou ID." }, 500);

    const { error: pe } = await admin.from("profiles").upsert({ id: uid, full_name, phone });
    if (pe) return json({ error: "Conta criada, mas falhou o perfil: " + pe.message, user_id: uid }, 500);
    const { error: re } = await admin.from("user_roles").insert({ user_id: uid, role, is_active: true, region_id, chapter_id });
    if (re) return json({ error: "Conta criada, mas falhou a designação: " + re.message, user_id: uid }, 500);
    return json({ ok: true, user_id: uid, mode: password ? "senha" : "convite" });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
