/* ADHONEP-SC · teste de carga (k6) — claude v1.12
 *
 * Só LEITURA: nenhuma gravação no banco. Usa as mesmas consultas que o site e o app fazem.
 * Alvo: Supabase (API, login e funções). O site em si (GitHub Pages) não entra no teste:
 * é estático, servido pela CDN do GitHub, e não deve ser bombardeado.
 *
 * Perfis (variável PERFIL):
 *   fumaca     → 2 usuários por 1 min. Confere se está tudo respondendo. Rode sempre primeiro.
 *   lancamento → o dia do lançamento: ~100 usuários logados abrindo o app quase juntos
 *                + 60 visitantes no site público. Esperado: passar com folga.
 *   pico       → sobe até 300 logados + 150 visitantes para achar o limite. Rode fora do horário de uso.
 *
 * Variáveis: K6_EMAIL / K6_PASSWORD = conta de TESTE (perfil sócio ou presidente). Sem elas, roda só a parte pública.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL || 'https://ayrdfetnscrfrlcssiua.supabase.co';
const KEY = __ENV.SUPABASE_KEY || 'sb_publishable_4q2FsB0DhzqgdR91JM0FDA_DMyuWNxs'; // chave pública (já está no site)
const PERFIL = (__ENV.PERFIL || 'fumaca').toLowerCase();
const TEM_LOGIN = !!(__ENV.K6_EMAIL && __ENV.K6_PASSWORD);
// CACHE=1 (padrão): imita o cache do site/app (claude v1.12) — regiões, municípios, capítulos, contatos e comunicados
// só vão ao servidor uma vez a cada 5 min por pessoa. CACHE=0: comportamento antigo (tudo sempre no servidor).
const CACHE = __ENV.CACHE !== '0';
// Ritmo de uso: no 'lancamento' cada pessoa abre o app e navega a cada ~2–4 min (uso real de quem acabou de instalar);
// 'fumaca' e 'pico' mantêm o ritmo acelerado (pessoa recarregando a cada ~20–30 s), que é teste de estresse.
const RITMO = PERFIL === 'lancamento' ? 6 : 1;
const CACHEAVEIS = { regioes: 1, municipios: 1, regiao_municipio: 1, capitulos: 1, comunicados_pub: 1, contatos: 1 };
const ultimo = {}; // por usuário virtual (cada VU tem a sua cópia)

const tPublico = new Trend('tempo_abrir_site_publico', true);
const tLogado = new Trend('tempo_abrir_app_logado', true);
const tLogin = new Trend('tempo_login', true);
const erros = new Rate('erros');
const limitado = new Counter('respostas_429_limite');

const PERFIS = {
  fumaca: {
    publico: { executor: 'constant-vus', vus: 1, duration: '1m' },
    logado: { executor: 'constant-vus', vus: 1, duration: '1m' },
    login: { executor: 'constant-arrival-rate', rate: 2, timeUnit: '1m', duration: '1m', preAllocatedVUs: 1 },
  },
  lancamento: {
    publico: { executor: 'ramping-vus', stages: [{ duration: '2m', target: 60 }, { duration: '6m', target: 60 }, { duration: '1m', target: 0 }] },
    logado: { executor: 'ramping-vus', stages: [{ duration: '1m', target: 100 }, { duration: '7m', target: 100 }, { duration: '1m', target: 0 }] },
    login: { executor: 'constant-arrival-rate', rate: 4, timeUnit: '1m', duration: '8m', preAllocatedVUs: 2 },
  },
  pico: {
    publico: { executor: 'ramping-vus', stages: [{ duration: '2m', target: 50 }, { duration: '3m', target: 150 }, { duration: '3m', target: 150 }, { duration: '1m', target: 0 }] },
    logado: { executor: 'ramping-vus', stages: [{ duration: '2m', target: 100 }, { duration: '3m', target: 300 }, { duration: '3m', target: 300 }, { duration: '1m', target: 0 }] },
    login: { executor: 'constant-arrival-rate', rate: 4, timeUnit: '1m', duration: '8m', preAllocatedVUs: 2 },
  },
};
if (!PERFIS[PERFIL]) throw new Error('PERFIL inválido: ' + PERFIL + ' (use fumaca, lancamento ou pico)');

const cen = {};
Object.entries(PERFIS[PERFIL]).forEach(([nome, c]) => {
  if (nome !== 'publico' && !TEM_LOGIN) return; // sem conta de teste: só a parte pública
  cen[nome] = Object.assign({ exec: nome, gracefulStop: '20s' }, c);
});

export const options = {
  scenarios: cen,
  thresholds: {
    erros: ['rate<0.01'],                                   // menos de 1% de falhas
    'http_req_duration{tipo:leitura}': ['p(95)<800'],      // 95% das consultas em menos de 0,8 s
    tempo_abrir_site_publico: ['p(95)<2500'],               // tela pública carregada em menos de 2,5 s
    tempo_abrir_app_logado: ['p(95)<3000'],                 // app logado carregado em menos de 3 s
    tempo_login: ['p(95)<2000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const base = { apikey: KEY, 'Content-Type': 'application/json' };
function hdr(token) { return { headers: Object.assign({}, base, { Authorization: 'Bearer ' + (token || KEY) }), tags: { tipo: 'leitura' } }; }

function ok(res, nome) {
  if (res.status === 429) limitado.add(1);
  const bom = check(res, { [nome + ' 200']: (r) => r.status === 200 });
  erros.add(!bom);
  return bom;
}

/* Pedidos em paralelo, como o navegador faz ao abrir a tela */
function lote(token, lista) {
  const t0 = Date.now();
  if (CACHE) {
    const agora = Date.now();
    lista = lista.filter(([nome]) => {
      const k = (token ? 'L:' : 'P:') + nome;
      if (!CACHEAVEIS[nome]) return true;
      if (ultimo[k] && agora - ultimo[k] < 5 * 60e3) return false;
      ultimo[k] = agora; return true;
    });
    if (!lista.length) return Date.now() - t0;
  }
  const res = http.batch(lista.map(([nome, path, body]) => {
    const p = hdr(token); p.tags = Object.assign({ nome }, p.tags);
    return body ? ['POST', URL + path, JSON.stringify(body), p] : ['GET', URL + path, null, p];
  }));
  res.forEach((r, i) => ok(r, lista[i][0]));
  return Date.now() - t0;
}

/* ---------- login único compartilhado (evita esbarrar no limite de logins do Supabase) ---------- */
export function setup() {
  if (!TEM_LOGIN) { console.warn('K6_EMAIL/K6_PASSWORD não informados: rodando só a parte pública.'); return {}; }
  const r = http.post(URL + '/auth/v1/token?grant_type=password', JSON.stringify({ email: __ENV.K6_EMAIL, password: __ENV.K6_PASSWORD }), { headers: base });
  if (r.status !== 200) throw new Error('Login da conta de teste falhou (' + r.status + '): ' + r.body);
  const j = r.json();
  return { token: j.access_token, uid: j.user.id };
}

/* ---------- visitante do site público ---------- */
export function publico() {
  const agora = encodeURIComponent(new Date().toISOString());
  group('abrir site público', () => {
    const ms = lote(null, [
      ['regioes', '/rest/v1/regions?select=id,name&order=name.asc&limit=500&state_code=eq.SC'],
      ['municipios', '/rest/v1/municipalities?select=id,ibge_code,name&order=id.asc&limit=1000&state_code=eq.SC'],
      ['regiao_municipio', '/rest/v1/region_municipalities?select=municipality_id,region_id&valid_until=is.null&limit=1000&state_code=eq.SC'],
      ['capitulos', '/rest/v1/chapters?select=id,name,chapter_number,municipality_id,region_id,status,is_public,president_name&order=name.asc&limit=2000&state_code=eq.SC'],
      ['eventos', '/rest/v1/events?select=id,chapter_id,title,event_type,description,starts_at,ends_at,venue_name,address,municipality_id,status,is_published,public_contact,image_url&is_published=eq.true&status=eq.scheduled&starts_at=gt.' + agora + '&order=starts_at.asc&limit=1000'],
      ['comunicados_pub', '/rest/v1/public_announcements?select=id,title,category,summary,body,action_label,action_url,scope,region_id&order=published_at.desc&limit=40&state_code=eq.SC'],
      ['contatos', '/rest/v1/public_chapter_contacts?select=chapter_id,president_phone&limit=1000'],
    ]);
    tPublico.add(ms);
  });
  sleep((8 + Math.random() * 12) * RITMO); // a pessoa olha o mapa antes de sair/recarregar
}

/* ---------- sócio/presidente logado no app ---------- */
export function logado(d) {
  group('abrir app logado', () => {
    const ms = lote(d.token, [
      ['usuario', '/auth/v1/user'],
      ['papeis', '/rest/v1/user_roles?select=role,is_active,region_id,chapter_id&user_id=eq.' + d.uid + '&is_active=eq.true'],
      ['regioes', '/rest/v1/regions?select=id,name&order=name.asc&limit=500&state_code=eq.SC'],
      ['municipios', '/rest/v1/municipalities?select=id,ibge_code,name&order=id.asc&limit=1000&state_code=eq.SC'],
      ['capitulos', '/rest/v1/chapters?select=id,name,chapter_number,municipality_id,region_id,status,is_public,president_name&order=name.asc&limit=2000&state_code=eq.SC'],
      ['avisos', '/rest/v1/rpc/adh_my_notifications', { p_limit: 50 }],
      ['acesso_saude', '/rest/v1/rpc/adh_my_ranking_access', {}],
    ]);
    tLogado.add(ms);
  });
  sleep(3 + Math.random() * 4);
  group('navegar', () => {
    lote(d.token, [
      ['andamento_mensal', '/rest/v1/chapter_monthly_reports?select=*&order=ref_month.desc,chapter_id.asc&limit=3000'],
      ['apoios', '/rest/v1/chapter_support_reports?select=*&order=ref_month.desc,chapter_id.asc&limit=3000'],
      ['comunicados', '/rest/v1/statewide_announcements?select=*&order=created_at.desc&limit=1000&state_code=eq.SC'],
      ['eventos', '/rest/v1/events?select=id,chapter_id,title,starts_at,status,is_published&order=starts_at.asc&limit=1000'],
    ]);
  });
  sleep((10 + Math.random() * 20) * RITMO);
}

/* ---------- login real, em ritmo baixo (o Supabase limita logins por IP) ---------- */
export function login() {
  const r = http.post(URL + '/auth/v1/token?grant_type=password', JSON.stringify({ email: __ENV.K6_EMAIL, password: __ENV.K6_PASSWORD }), { headers: base, tags: { tipo: 'login', nome: 'login' } });
  tLogin.add(r.timings.duration);
  ok(r, 'login');
}

export function handleSummary(data) {
  const m = data.metrics, v = (k, s) => (m[k] && m[k].values && m[k].values[s] != null) ? m[k].values[s] : null;
  const f = (x) => x == null ? '—' : (x >= 1000 ? (x / 1000).toFixed(2) + ' s' : Math.round(x) + ' ms');
  const th = Object.entries(m).filter(([, x]) => x.thresholds).map(([k, x]) => '| ' + k + ' | ' + Object.entries(x.thresholds).map(([t, r]) => (r.ok ? '✅ ' : '❌ ') + t).join('<br>') + ' |').join('\n');
  const md = '# Teste de carga ADHONEP-SC — perfil `' + PERFIL + '`' + (CACHE ? ' · com cache' : ' · sem cache') + '\n\n'
    + '| Medida | Mediana | p95 | Pior |\n|---|---|---|---|\n'
    + [['Abrir site público', 'tempo_abrir_site_publico'], ['Abrir app logado', 'tempo_abrir_app_logado'], ['Login', 'tempo_login'], ['Cada consulta', 'http_req_duration']]
      .map(([n, k]) => '| ' + n + ' | ' + f(v(k, 'med')) + ' | ' + f(v(k, 'p(95)')) + ' | ' + f(v(k, 'max')) + ' |').join('\n')
    + '\n\n- Pedidos feitos: **' + (v('http_reqs', 'count') || 0) + '** (' + (v('http_reqs', 'rate') || 0).toFixed(1) + '/s)'
    + '\n- Falhas: **' + ((v('erros', 'rate') || 0) * 100).toFixed(2) + '%**'
    + '\n- Respostas "limite atingido" (429): **' + (v('respostas_429_limite', 'count') || 0) + '**'
    + '\n\n## Metas\n| Métrica | Resultado |\n|---|---|\n' + th + '\n';
  return { stdout: md, 'resultado.md': md, 'resultado.json': JSON.stringify(data, null, 1) };
}
