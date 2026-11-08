// Edge Function: admin-create-user  (ADHONEP-SC · claude v1.14) — publicada no Supabase com o endereço "rapid-responder"
// Ações: create (padrão) · get · update · delete · set_active · deletion_requests
//  - Administrador (state_admin): tudo.
//  - Presidente de capítulo: cria, edita, desativa e reativa SÓCIOS (role 'member') do PRÓPRIO capítulo. Nunca exclui.
// Cadastro sem passar pelo painel do Supabase:
//  - E-mail que já tem login mas ficou sem perfil/designação (sobra de exclusão) é reaproveitado automaticamente.
//  - E-mail já em uso por alguém ativo: devolve quem é (só para o administrador) para abrir e corrigir o cadastro.
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
const REGION_ROLES = ["regional_director", "field_representative"];
const CHAPTER_ROLES = ["chapter_president", "youth_coordinator", "women_coordinator", "member"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

    // presidente só mexe em quem é apenas sócio dos capítulos dele
    const isMyMember = async (uid: string) => {
      const { data: t } = await admin.from("user_roles").select("role,chapter_id").eq("user_id", uid);
      return !!t?.length && t.every((r) => String(r.role) === "member" && myChapters.includes(Number(r.chapter_id)));
    };
    const findByEmail = async (email: string) => {
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const u = data.users.find((x) => String(x.email || "").toLowerCase() === email);
        if (u) return u;
        if (data.users.length < 1000) return null;
      }
      return null;
    };

    // ---------- pedidos de exclusão de conta pendentes (somente administrador)
    if (action === "deletion_requests") {
      if (!isAdmin) return json({ error: "Somente o administrador vê os pedidos de exclusão." }, 403);
      const { data: reqs, error } = await admin.from("account_deletion_requests").select("id,user_id,email,created_at").eq("status", "pending").order("created_at");
      if (error) return json({ error: error.message }, 400);
      const ids = [...new Set((reqs || []).map((r) => r.user_id))];
      const { data: profs } = ids.length ? await admin.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      const nome = new Map((profs || []).map((p) => [p.id, p.full_name]));
      return json({ ok: true, requests: (reqs || []).map((r) => ({ ...r, full_name: nome.get(r.user_id) || null })) });
    }

    // ---------- excluir (somente administrador) — apaga de verdade (exigência LGPD / App Store / Google Play)
    if (action === "delete") {
      if (!isAdmin) return json({ error: "Somente o administrador pode excluir usuários." }, 403);
      const uid = String(b.user_id || "");
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (uid === me) return json({ error: "Você não pode excluir a sua própria conta." }, 400);
      const { data: alvo } = await admin.auth.admin.getUserById(uid);
      const email = String(alvo?.user?.email || "").toLowerCase();
      // solta os registros que apontam para a pessoa sem apagar junto (ficam sem vínculo)
      await admin.from("access_requests").update({ reviewed_by: null }).eq("reviewed_by", uid);
      await admin.from("approval_delegations").update({ granted_by: null }).eq("granted_by", uid);
      await admin.from("scope_roles").update({ granted_by: null }).eq("granted_by", uid);
      // o pedido de cadastro da própria pessoa tem dados pessoais: sai junto
      if (email) await admin.from("access_requests").delete().ilike("email", email);
      // apaga o login; perfil, designações, aparelhos e leituras saem em cascata
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) {
        // não deveria acontecer; se acontecer, tira o acesso e os dados pessoais e deixa registrado
        await admin.from("user_roles").delete().eq("user_id", uid);
        await admin.from("profiles").delete().eq("id", uid);
        await admin.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
        await admin.from("account_deletion_requests").update({ status: "done", done_at: new Date().toISOString() }).eq("user_id", uid).eq("status", "pending");
        return json({ ok: true, mode: "bloqueado", note: error.message });
      }
      await admin.from("account_deletion_requests").update({ status: "done", done_at: new Date().toISOString(), email: null }).eq("user_id", uid).eq("status", "pending");
      return json({ ok: true });
    }

    // ---------- ativar / desativar
    if (action === "set_active") {
      const uid = String(b.user_id || "");
      const active = !!b.active;
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (uid === me) return json({ error: "Você não pode alterar a sua própria conta." }, 400);
      if (!isAdmin && !(await isMyMember(uid))) return json({ error: "Você só pode alterar sócios do seu capítulo." }, 403);
      const { error } = await admin.from("user_roles").update({ is_active: active }).eq("user_id", uid);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- ler um cadastro (para editar)
    if (action === "get") {
      const uid = String(b.user_id || "");
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (!isAdmin && !(await isMyMember(uid))) return json({ error: "Você só pode ver sócios do seu capítulo." }, 403);
      const { data: u, error } = await admin.auth.admin.getUserById(uid);
      if (error || !u?.user) return json({ error: "Conta não encontrada." }, 404);
      const { data: p } = await admin.from("profiles").select("full_name,phone").eq("id", uid).maybeSingle();
      const { data: r } = await admin.from("user_roles").select("id,role,region_id,chapter_id,is_active").eq("user_id", uid);
      return json({ ok: true, user: { id: uid, email: u.user.email, full_name: p?.full_name || u.user.user_metadata?.full_name || "", phone: p?.phone || "", roles: r || [] } });
    }

    // ---------- dados comuns de create/update
    const email = String(b.email || "").trim().toLowerCase();
    const full_name = String(b.full_name || "").trim();
    const role = String(b.role || "");
    const phone = String(b.phone || "").replace(/\D/g, "") || null;
    const password = String(b.password || "");
    const region_id = REGION_ROLES.includes(role) && b.region_id ? Number(b.region_id) : null;
    const chapter_id = CHAPTER_ROLES.includes(role) && b.chapter_id ? Number(b.chapter_id) : null;
    if (!EMAIL_RE.test(email)) return json({ error: "E-mail inválido." }, 400);
    if (full_name.length < 3) return json({ error: "Informe o nome completo." }, 400);
    if (!ROLES.includes(role)) return json({ error: "Perfil inválido." }, 400);
    if (REGION_ROLES.includes(role) && !region_id) return json({ error: "Este perfil exige uma região." }, 400);
    if (CHAPTER_ROLES.includes(role) && !chapter_id) return json({ error: "Este perfil exige um capítulo." }, 400);
    if (password && password.length < 8) return json({ error: "A senha deve ter ao menos 8 caracteres." }, 400);
    if (!isAdmin) {
      if (role !== "member") return json({ error: "Presidentes só podem cadastrar sócios." }, 403);
      if (!chapter_id || !myChapters.includes(chapter_id)) return json({ error: "Você só pode cadastrar sócios do seu capítulo." }, 403);
    }

    // ---------- editar cadastro existente
    if (action === "update") {
      const uid = String(b.user_id || "");
      if (!uid) return json({ error: "Usuário não informado." }, 400);
      if (!isAdmin && !(await isMyMember(uid))) return json({ error: "Você só pode editar sócios do seu capítulo." }, 403);
      if (uid === me && !isAdmin) return json({ error: "Use Minha conta para alterar os seus dados." }, 400);
      const { data: cur } = await admin.auth.admin.getUserById(uid);
      if (!cur?.user) return json({ error: "Conta não encontrada." }, 404);
      const attrs: Record<string, unknown> = { user_metadata: { ...(cur.user.user_metadata || {}), full_name } };
      if (email !== String(cur.user.email || "").toLowerCase()) {
        const other = await findByEmail(email);
        if (other && other.id !== uid) return json({ error: "Este e-mail já é usado por outra conta.", code: "email_in_use" }, 409);
        attrs.email = email; attrs.email_confirm = true;
      }
      if (password) attrs.password = password;
      const { error: ue } = await admin.auth.admin.updateUserById(uid, attrs);
      if (ue) return json({ error: ue.message }, 400);
      const { error: pe } = await admin.from("profiles").upsert({ id: uid, full_name, phone });
      if (pe) return json({ error: "Não foi possível salvar o perfil: " + pe.message }, 500);
      if (uid !== me) {
        const { data: rows } = await admin.from("user_roles").select("id").eq("user_id", uid);
        if ((rows || []).length > 1) {
          // mais de uma designação: não mexe no perfil de acesso (evita apagar algo sem querer)
          return json({ ok: true, mode: "dados", note: "Nome, e-mail, telefone e senha salvos. Esta pessoa tem mais de uma designação; o perfil de acesso não foi alterado." });
        }
        const rec = { user_id: uid, role, region_id, chapter_id, is_active: true };
        const { error: re } = rows && rows.length
          ? await admin.from("user_roles").update({ role, region_id, chapter_id }).eq("id", rows[0].id)
          : await admin.from("user_roles").insert(rec);
        if (re) return json({ error: "Dados salvos, mas o perfil de acesso não: " + re.message }, 500);
      }
      return json({ ok: true, mode: "editado" });
    }

    // ---------- criar
    const existing = await findByEmail(email);
    if (existing) {
      const { data: rr } = await admin.from("user_roles").select("id").eq("user_id", existing.id);
      if ((rr || []).length) {
        let who = null;
        if (isAdmin) {
          const { data: p } = await admin.from("profiles").select("full_name").eq("id", existing.id).maybeSingle();
          who = p?.full_name || existing.user_metadata?.full_name || null;
        }
        return json({ error: "Este e-mail já pertence a um cadastro" + (who ? " (" + who + ")" : "") + ".", code: "email_in_use", user_id: isAdmin ? existing.id : null }, 409);
      }
      // login "órfão" (sobrou de uma exclusão): reaproveita
      const attrs: Record<string, unknown> = { email_confirm: true, ban_duration: "none", user_metadata: { ...(existing.user_metadata || {}), full_name } };
      if (password) attrs.password = password;
      const { error: ue } = await admin.auth.admin.updateUserById(existing.id, attrs);
      if (ue) return json({ error: ue.message }, 400);
      const { error: pe } = await admin.from("profiles").upsert({ id: existing.id, full_name, phone });
      if (pe) return json({ error: "Não foi possível salvar o perfil: " + pe.message }, 500);
      const { error: re } = await admin.from("user_roles").insert({ user_id: existing.id, role, is_active: true, region_id, chapter_id });
      if (re) return json({ error: "Não foi possível definir o perfil de acesso: " + re.message }, 500);
      if (!password) await admin.auth.resetPasswordForEmail(email, { redirectTo: b.redirect_to || undefined });
      return json({ ok: true, user_id: existing.id, mode: password ? "senha" : "convite", reused: true });
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
    if (pe) { await admin.auth.admin.deleteUser(uid); return json({ error: "Não foi possível salvar o perfil (nada foi criado): " + pe.message }, 500); }
    const { error: re } = await admin.from("user_roles").insert({ user_id: uid, role, is_active: true, region_id, chapter_id });
    if (re) { await admin.auth.admin.deleteUser(uid); return json({ error: "Não foi possível definir o perfil de acesso (nada foi criado): " + re.message }, 500); }
    return json({ ok: true, user_id: uid, mode: password ? "senha" : "convite" });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
