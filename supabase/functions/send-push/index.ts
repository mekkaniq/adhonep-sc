// ADHONEP-SC · envio de push (APNs) dos avisos pendentes. NÃO publicado ainda: precisa da chave APNs da conta Apple.
// Segredos (Supabase → Edge Functions → Secrets): APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (br.com.adhonepemsc.app)
// Chamada: a cada minuto por pg_cron/pg_net, com o cabeçalho x-cron-secret = CRON_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const b64u = (b: ArrayBuffer | string) => btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function jwt() {
  const pem = Deno.env.get("APNS_KEY_P8")!.replace(/-----[^-]+-----|\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }));
  const body = b64u(JSON.stringify({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(head + "." + body));
  return head + "." + body + "." + b64u(sig);
}
async function tokensFor(n: any): Promise<string[]> {
  let q = sb.from("device_tokens").select("token,user_id").eq("platform", "ios").eq("state_code", n.state_code);
  if (n.audience === "state") { /* todos os aparelhos do estado */ }
  else {
    let uq = sb.from("user_roles").select("user_id,chapter_id,region_id,role").eq("is_active", true);
    const { data: roles } = await uq;
    let ids = new Set<string>();
    const { data: chs } = await sb.from("chapters").select("id,region_id");
    const regOf = new Map((chs ?? []).map((c: any) => [c.id, c.region_id]));
    for (const r of roles ?? []) {
      if (n.audience === "chapter" && r.chapter_id === n.chapter_id) ids.add(r.user_id);
      if (n.audience === "region" && (r.region_id === n.region_id || regOf.get(r.chapter_id) === n.region_id)) ids.add(r.user_id);
      if (n.audience === "managers" && ["state_admin", "state_director"].includes(r.role)) ids.add(r.user_id);
    }
    if (!ids.size) return [];
    q = q.in("user_id", [...ids]);
  }
  const { data } = await q;
  return (data ?? []).map((d: any) => d.token);
}
Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const { data: pend } = await sb.from("notifications").select("*").is("push_sent_at", null).lte("send_at", new Date().toISOString()).order("id").limit(20);
  if (!pend?.length) return new Response("0");
  const token = await jwt(); let sent = 0;
  for (const n of pend) {
    for (const t of await tokensFor(n)) {
      const r = await fetch(`https://api.push.apple.com/3/device/${t}`, { method: "POST", headers: { authorization: `bearer ${token}`, "apns-topic": Deno.env.get("APNS_BUNDLE_ID")!, "apns-push-type": "alert", "apns-priority": "10" }, body: JSON.stringify({ aps: { alert: { title: n.title, body: n.body }, sound: "default" }, section: n.link_section }) });
      if (r.status === 410 || r.status === 400) await sb.from("device_tokens").delete().eq("token", t); else if (r.ok) sent++;
    }
    await sb.from("notifications").update({ push_sent_at: new Date().toISOString() }).eq("id", n.id);
  }
  return new Response(String(sent));
});
