/* ADHONEP-SC · Supabase SIMULADO para os testes de tela.
 * Intercepta tudo que o navegador pediria ao Supabase e responde com dados fictícios.
 * Nada sai para a internet: nunca toca a produção e nunca usa senha real. */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '../..');
const SC = JSON.parse(fs.readFileSync(path.join(RAIZ, 'beta/data/mun/SC.json'), 'utf8'));
const muni = SC.map((m, i) => ({ id: i + 1, name: m.n, ibge_code: String(m.id), state_code: 'SC' }));
const idDe = (n) => (muni.find((m) => m.name === n) || muni[0]).id;
const regioes = [[1, 'Florianópolis'], [2, 'Vale do Itajaí'], [3, 'Norte'], [4, 'Oeste']]
  .map(([id, name]) => ({ id, name, is_active: true, state_code: 'SC', description: '', director_name: '' }));
const regiaoMun = muni.map((m, i) => ({ id: i + 1, municipality_id: m.id, region_id: (i % 4) + 1, valid_until: null }));
const capitulos = [['Florianópolis', 1], ['Blumenau', 2], ['Joinville', 3], ['Brusque', 2], ['Chapecó', 4], ['Itajaí', 2]]
  .map(([c, r], i) => ({ id: i + 1, name: 'TESTE ' + c, chapter_number: 100 + i, municipality_id: idDe(c), region_id: r, address: 'Rua Central, 100',
    status: 'active', is_public: true, state_code: 'SC', country_iso3: 'BRA', president_name: 'Presidente ' + (i + 1), vice_president_name: '', city: c }));
const dia = (n) => new Date(Date.now() + n * 864e5).toISOString();
const eventos = [[1, 'TESTE Jantar de lideranças', 2], [3, 'TESTE Café de negócios', 5], [4, 'TESTE Workshop', 12]]
  .map(([ch, t, d], i) => ({ id: i + 1, chapter_id: ch, title: t, event_type: 'dinner', description: 'Encontro de teste.', starts_at: dia(d), ends_at: null,
    venue_name: 'Centro de Eventos', address: 'Rua A, 1', municipality_id: capitulos[ch - 1].municipality_id, status: 'scheduled', is_published: true, public_contact: '', image_url: null }));
const comunicados = [
  { id: 1, title: 'TESTE Aviso estadual', category: 'Geral', summary: 'Para todo o estado', body: 'Texto', scope: 'state', region_id: null, published_at: dia(-1) },
  { id: 2, title: 'TESTE Aviso Vale do Itajaí', category: 'Região', summary: 'Só do Vale', body: 'Texto', scope: 'regional', region_id: 2, published_at: dia(-1) },
  { id: 3, title: 'TESTE Aviso Oeste', category: 'Região', summary: 'Só do Oeste', body: 'Texto', scope: 'regional', region_id: 4, published_at: dia(-1) },
];

/* Perfis fictícios: papel → designações (o capítulo 4 "Brusque" fica na região 2 "Vale do Itajaí") */
const PERFIS = {
  state_admin: [{ role: 'state_admin', is_active: true, region_id: null, chapter_id: null }],
  state_director: [{ role: 'state_director', is_active: true, region_id: null, chapter_id: null }],
  regional_director: [{ role: 'regional_director', is_active: true, region_id: 2, chapter_id: null }],
  chapter_president: [{ role: 'chapter_president', is_active: true, region_id: null, chapter_id: 4 }],
  member: [{ role: 'member', is_active: true, region_id: null, chapter_id: 4 }],
};

function json(r, x, status = 200) {
  return r.fulfill({ status, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify(x) });
}

/* Liga o simulador numa página. Devolve o registro de pedidos (para os testes conferirem o que foi enviado). */
async function simular(page, papel) {
  const log = [];
  await page.route('https://ayrdfetnscrfrlcssiua.supabase.co/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    let corpo = null; try { corpo = req.postData() ? JSON.parse(req.postData()) : null; } catch (e) { corpo = req.postData(); }
    log.push({ m, p, q: u.search, corpo });
    if (p.endsWith('/auth/v1/token')) return json(r, { access_token: 'token-de-teste', refresh_token: 'rt', expires_in: 3600, user: { id: 'u-teste', email: 'teste@teste.invalid' } });
    if (p.endsWith('/auth/v1/user')) return json(r, { id: 'u-teste', email: 'teste@teste.invalid' });
    if (p.endsWith('/user_roles')) return json(r, papel ? PERFIS[papel] : []);
    if (p.endsWith('/profiles')) return json(r, [{ id: 'u-teste', full_name: 'Pessoa de Teste', phone: '' }]);
    if (p.endsWith('/municipalities')) return json(r, muni);
    if (p.endsWith('/regions')) return json(r, regioes);
    if (p.endsWith('/region_municipalities')) return json(r, regiaoMun);
    if (p.endsWith('/chapters')) return json(r, capitulos);
    if (p.endsWith('/events')) return json(r, eventos);
    if (p.endsWith('/public_announcements')) return json(r, comunicados);
    if (p.endsWith('/public_chapter_contacts')) return json(r, capitulos.map((c) => ({ chapter_id: c.id, president_phone: '' })));
    if (p.endsWith('/rpc/adh_my_ranking_access')) return json(r, papel === 'state_admin' || papel === 'state_director' ? 'state' : papel === 'regional_director' ? 'region' : 'none');
    if (p.endsWith('/rpc/adh_ranking')) return json(r, { month: '2026-10-01', chapters: [], regions: [], settings: {} });
    if (p.includes('/rpc/')) return json(r, null);
    if (m === 'POST') return r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
    if (m === 'PATCH' || m === 'DELETE') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    return json(r, []);
  });
  // qualquer outro endereço externo também não sai (fontes, mapas etc.)
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!ayrdfetnscrfrlcssiua).*/, (r) => r.fulfill({ status: 204, body: '' }));
  return log;
}

module.exports = { simular, PERFIS, regioes, capitulos, comunicados };
