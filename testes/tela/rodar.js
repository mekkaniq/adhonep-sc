/* ADHONEP-SC · testes de tela do /beta (Playwright + Supabase simulado).
 * Uso: node testes/tela/rodar.js      (precisa de: npm i playwright && npx playwright install chromium)
 * Cada checagem imprime OK/FAIL; sai com erro se alguma falhar. Nunca usa a produção nem senha real. */
const http = require('http');
const fs = require('fs');
const path = require('path');
// deixa o teste interceptar também os pedidos feitos pelo service worker (fotos guardadas no aparelho)
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS || '1';
const { chromium } = require('playwright');
const { simular, eventos: SIM_EVENTOS, CONFIG: SIM_CFG, DELEG: SIM_DELEG } = require('./simulador');

const REPO = path.resolve(__dirname, '../..');
// ADH_SITE=pasta → testa a pasta montada por scripts/montar-site.py (o que de fato vai para o ar)
const RAIZ = process.env.ADH_SITE ? path.resolve(process.env.ADH_SITE) : REPO;
const PORTA = 8799;
const BASE = `http://localhost:${PORTA}/beta/index.html`;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };

let ok = 0, falhas = 0;
function confere(nome, cond, detalhe) {
  if (cond) { ok++; console.log('OK   ' + nome); }
  else { falhas++; console.log('FAIL ' + nome + (detalhe ? '  →  ' + detalhe : '')); }
}

// Cabeçalhos de segurança do vercel.json (CSP etc.), aplicados como a Vercel aplicaria — usados no servidor "com cabeçalhos".
const CABECALHOS_VERCEL = Object.fromEntries((JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8')).headers
  .find((h) => h.source === '/(.*)') || { headers: [] }).headers.map((h) => [h.key, h.value]));

function servidor(porta = PORTA, cabecalhos = {}) {
  return http.createServer((req, res) => {
    let f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { ...cabecalhos, 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(porta);
}

async function abrir(browser, papel, celular, base = BASE) {
  const ctx = await browser.newContext(celular
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('adh-seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  const csp = [];   // avisos de CSP: bloqueios de verdade e os "Report-Only" (só avisam)
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  const log = await simular(page, papel);
  await page.goto(base);
  await page.waitForTimeout(1500);
  return { ctx, page, erros, log, csp };
}

async function entrar(page) {
  await page.evaluate(() => openRealLogin());
  await page.fill('#realLoginEmail', 'teste@teste.invalid');
  await page.fill('#realLoginPassword', 'senha-de-teste');   // senha fictícia: o Supabase é simulado
  await page.evaluate(() => document.getElementById('realLoginSubmit').click());
  await page.waitForTimeout(2500);
}

const menu = (page) => page.evaluate(() => [...document.querySelectorAll('#adminView .nav[data-page]')]
  .filter((n) => getComputedStyle(n).display !== 'none' && n.offsetParent !== null).map((n) => n.dataset.page));

const semRolagemLateral = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const srv = servidor();
  const browser = await chromium.launch();
  try {
    // ===== 1n) fotos dos convites (pasta pública do Supabase) ficam guardadas no aparelho =====
    {
      const ctx = await browser.newContext();
      await ctx.route(/storage\/v1\/object\/public\/adhonep-event-invitations\//, (r) => r.fulfill({ status: 200, contentType: 'image/png',
        headers: { 'access-control-allow-origin': '*' }, body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64') }));
      const page = await ctx.newPage();
      await simular(page, null);
      await page.goto(BASE); await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload(); await page.waitForTimeout(1000);
      const foto = await page.evaluate(async () => {
        const u = 'https://ayrdfetnscrfrlcssiua.supabase.co/storage/v1/object/public/adhonep-event-invitations/teste/convite-1.png';
        const ok = await new Promise((r) => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = u; });
        for (let k = 0; k < 20; k++) { const c = await caches.open('adh-media-v1-beta'); if (await c.match(u)) return ok; await new Promise((r) => setTimeout(r, 200)); }
        return 'não guardou (carregou: ' + ok + ')';
      });
      confere('Cache: foto de convite aparece e fica guardada no aparelho', foto === true, String(foto));
      const faixa = await page.evaluate(() => (document.getElementById('gxBetaRibbon') || {}).textContent || '');
      confere('Faixa do /beta diz "FASE DE IMPLANTAÇÃO" (não mais "versão de teste")', /^FASE DE IMPLANTAÇÃO/.test(faixa) && !/TESTE/.test(faixa), faixa);
      await ctx.close();
    }

    // ===== 1) login por perfil: cada um vê só o que pode =====
    const esperado = {
      state_admin:       { tem: ['dashboard', 'users', 'audit', 'monthly', 'ranking', 'support'], naoTem: [] },
      state_director:    { tem: ['dashboard', 'monthly', 'ranking', 'audit'], naoTem: ['users'] },   // histórico de ações: só leitura (banco: adh_is_state_manager)
      regional_director: { tem: ['monthly', 'ranking'], naoTem: ['users', 'audit'] },
      chapter_president: { tem: ['monthly', 'members', 'support'], naoTem: ['users', 'audit', 'ranking'] },
    };
    for (const [papel, e] of Object.entries(esperado)) {
      const { ctx, page, erros } = await abrir(browser, papel, false);
      await entrar(page);
      const m = await menu(page);
      for (const p of e.tem) confere(`Login ${papel}: vê "${p}" no menu`, m.includes(p), 'menu: ' + m.join(','));
      for (const p of e.naoTem) confere(`Login ${papel}: NÃO vê "${p}" no menu`, !m.includes(p), 'menu: ' + m.join(','));
      confere(`Login ${papel}: sem erro de JavaScript`, erros.length === 0, erros.join(' | '));
      await ctx.close();
    }
    {
      const { ctx, page, erros } = await abrir(browser, 'member', false);
      await entrar(page);
      const area = await page.evaluate(() => ({ socio: document.getElementById('memberView')?.classList.contains('on'), admin: document.getElementById('adminView')?.classList.contains('on') }));
      confere('Login sócio: vai para a área do sócio, não para o painel', area.socio && !area.admin, JSON.stringify(area));
      confere('Login sócio: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1a) /beta em sigilo até o lançamento: buscadores não indexam =====
    {
      const { ctx, page } = await abrir(browser, 'member', false);
      const robots = await page.evaluate(() => (document.querySelector('meta[name="robots"]') || {}).content || '');
      confere('Beta: buscadores não indexam (noindex,nofollow)', robots === 'noindex,nofollow', robots);
      await ctx.close();
    }

    // ===== 1b) tela de login: texto para o usuário, sem citar o Supabase =====
    {
      const { ctx, page } = await abrir(browser, 'member', false);
      const txt = await page.evaluate(() => { openRealLogin(); return document.getElementById('realLoginMessage').textContent; });
      confere('Login: mensagem "Entre com sua conta já cadastrada ou solicite o cadastro."', txt === 'Entre com sua conta já cadastrada ou solicite o cadastro.', txt);
      await ctx.close();
    }

    // ===== 1c) regiões: administrador muda a cidade de região (v3.20); outros perfis não =====
    for (const papel of ['state_admin', 'state_director']) {
      const { ctx, page, erros, log } = await abrir(browser, papel, false);
      await entrar(page);
      await page.evaluate(async () => { showPage('regions', document.querySelector('.nav[data-page="regions"]')); await loadTerritoryFromSupabase(); });
      await page.evaluate(() => { document.getElementById('municipalitySearch').value = 'Brusque'; renderMunicipalities(); });
      await page.waitForTimeout(400);
      const seletores = await page.locator('select.adh-mover-cidade').count();
      const botao = await page.evaluate(() => !document.getElementById('adhNewRegionBtn').hidden);
      if (papel === 'state_admin') {
        confere('Regiões: administrador vê a lista para mudar a cidade de região', seletores > 0, 'listas: ' + seletores);
        confere('Regiões: administrador vê "+ Nova região"', botao);
        const sel = page.locator('select.adh-mover-cidade').first();
        const atual = await sel.inputValue();
        const outra = await sel.evaluate((s, a) => [...s.options].map((o) => o.value).find((v) => v && v !== a), atual);
        await sel.selectOption(outra);
        await page.waitForTimeout(300);
        await page.locator('.modal.open button[data-k="1"]').last().click();
        await page.waitForTimeout(1200);
        const envio = log.find((x) => x.m === 'POST' && x.p.endsWith('/rpc/adh_admin_mover_municipio'));
        confere('Regiões: mudar a cidade de região vai para o banco com cidade e região', !!envio && Number(envio.corpo.p_regiao) === Number(outra) && Number(envio.corpo.p_municipio) > 0, JSON.stringify(envio && envio.corpo));
      } else {
        confere('Regiões: ' + papel + ' NÃO vê a lista para mudar a cidade de região', seletores === 0, 'listas: ' + seletores);
        confere('Regiões: ' + papel + ' NÃO vê "+ Nova região"', !botao);
      }
      confere('Regiões (' + papel + '): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1d) Central, diretor regional: depois de ver o estado inteiro, o mapa volta para a região dele =====
    {
      const { ctx, page, erros } = await abrir(browser, 'regional_director', false);
      await entrar(page);
      await page.evaluate(() => { showPage('central', document.querySelector('.nav[data-page="central"]')); cmdOpen(); });
      await page.waitForFunction(() => window.AdhMap && AdhMap.cmd && document.getElementById('cmdMapLabel').textContent.startsWith('Região:'), null, { timeout: 15000 }).catch(() => {});
      const naRegiao = await page.evaluate(() => document.getElementById('cmdMapLabel').textContent + ' · carregado=' + !!(AdhMap.cmd && AdhMap.cmd.state().loaded) + ' · ' + (document.getElementById('cmdMapStatus') || {}).textContent);
      confere('Central (diretor regional): mapa abre na região dele', naRegiao.startsWith('Região:'), naRegiao);
      await page.evaluate(() => AdhMap.cmd.state().loaded && AdhMap.cmd.reset());
      await page.waitForTimeout(500);
      const btn = await page.evaluate(() => { const b = document.getElementById('cmdMapReset'); return { t: b.textContent, d: b.disabled }; });
      confere('Central (diretor regional): no estado inteiro, botão "Voltar à região"', btn.t.startsWith('Voltar à região') && !btn.d, naRegiao + ' | ' + JSON.stringify(btn));
      await page.evaluate(() => document.getElementById('cmdMapReset').click());
      await page.waitForTimeout(800);
      const volta = await page.evaluate(() => document.getElementById('cmdMapLabel').textContent);
      confere('Central (diretor regional): o botão volta o mapa para a região', volta.startsWith('Região:'), volta);
      confere('Central (diretor regional): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1f) "Desejo ser sócio" (no lugar de "Quero ser sócio") no site e no app =====
    {
      const fs = require('fs'), path = require('path'), raiz = path.resolve(__dirname, '../..');
      const site = fs.readFileSync(path.join(raiz, 'beta/index.html'), 'utf8'), app = fs.readFileSync(path.join(raiz, 'app/native/shell.js'), 'utf8');
      confere('"Desejo ser sócio" no site e no app, sem "Quero ser sócio"', site.includes('Desejo ser sócio') && app.includes('Desejo ser sócio') && !/Quero ser sócio/.test(site + app));
    }

    // ===== 1g) relatório de evento com até 3 fotos =====
    {
      const { ctx, page, erros, log } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(() => openReport());
      await page.waitForSelector('#reportModal.open', { timeout: 5000 }).catch(() => {});
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
      const fotos = [1, 2, 3, 4].map((i) => ({ name: 'foto' + i + '.png', mimeType: 'image/png', buffer: png }));
      await page.setInputFiles('#reportPhotos', fotos);
      await page.waitForTimeout(300);
      const est = await page.evaluate(() => ({ n: document.querySelectorAll('#reportPhotoList .adh-rep-foto').length, c: document.getElementById('reportPhotoCount').textContent, d: document.getElementById('reportPhotos').disabled, t: (document.querySelector('.toast') || {}).textContent || '' }));
      confere('Relatório: escolhendo 4 fotos, ficam só 3 ("3 de 3") e o campo trava', est.n === 3 && est.c === '3 de 3' && est.d, JSON.stringify(est));
      confere('Relatório: avisa "Máximo de 3 fotos"', /Máximo de 3 fotos/.test(est.t), est.t);
      await page.evaluate(() => adhRepFotoTirar(0));
      const dois = await page.evaluate(() => ({ n: document.querySelectorAll('#reportPhotoList .adh-rep-foto').length, d: document.getElementById('reportPhotos').disabled }));
      confere('Relatório: tirar uma foto libera o campo de novo', dois.n === 2 && !dois.d, JSON.stringify(dois));
      await page.evaluate(() => { const f = document.querySelector('#reportModal form'); f.elements.eventName.value = 'TESTE evento'; f.elements.owner.value = 'Fulano'; f.elements.summary.value = 'Resumo'; });
      await page.evaluate(() => document.querySelector('#reportModal form').requestSubmit());
      await page.waitForTimeout(1500);
      const envios = log.filter((x) => x.m === 'POST' && x.p.includes('/storage/v1/object/event-report-photos/'));
      const rel = log.find((x) => x.m === 'POST' && x.p.endsWith('/chapter_reports'));
      const caminhos = rel && rel.corpo && rel.corpo.photo_paths;
      confere('Relatório: envia as 2 fotos para a pasta do capítulo dele', envios.length === 2 && envios.every((x) => /event-report-photos\/4\/[\w.-]+$/.test(x.p)), envios.map((x) => x.p).join(' | '));
      confere('Relatório: grava os 2 caminhos no relatório', Array.isArray(caminhos) && caminhos.length === 2 && caminhos.every((c) => /^4\//.test(c)), JSON.stringify(caminhos));
      await page.evaluate(() => { reports = [mapReportRow({ id: 77, chapter_id: 4, event_name: 'TESTE evento', responsible_name: 'Fulano', summary: 'Resumo', status: 'Entregue', photo_paths: ['4/a.jpg', '4/b.jpg'] })]; reportDetail(77); });
      await page.waitForTimeout(600);
      const det = await page.evaluate(() => [...document.querySelectorAll('#reportDetailFotos img')].map((i) => i.src));
      confere('Relatório: o detalhe mostra as fotos por link protegido', det.length === 2 && det.every((u) => /object\/sign\/event-report-photos\/4\//.test(u)), det.join(' | '));
      confere('Relatório com fotos: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1h) Central: com uma região aberta, clicar em "Santa Catarina" volta o painel inteiro ao estado =====
    for (const papel of ['state_admin', 'regional_director']) {
      const { ctx, page, erros } = await abrir(browser, papel, false);
      await entrar(page);
      await page.evaluate(() => { showPage('central', document.querySelector('.nav[data-page="central"]')); cmdOpen(); });
      await page.waitForFunction(() => window.AdhMap && AdhMap.cmd && AdhMap.cmd.state().loaded, null, { timeout: 15000 }).catch(() => {});
      await page.evaluate(() => { if (CMD.scope !== 'region') cmdPickRegion(2); });
      await page.waitForFunction(() => document.getElementById('cmdMapLabel').textContent.startsWith('Região:'), null, { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('#cmdMap .amap-crumbs [data-g="0"]'); if (b) b.click(); });
      await page.waitForTimeout(800);
      const r = await page.evaluate(() => ({ scope: CMD.scope, titulo: document.getElementById('cmdScopeTitle').textContent, mapa: document.getElementById('cmdMapLabel').textContent }));
      if (papel === 'state_admin') confere('Central (administrador): clicar em "Santa Catarina" volta a Central inteira ao estado', r.scope === 'state' && r.titulo === 'Santa Catarina' && r.mapa.startsWith('Visão geral'), JSON.stringify(r));
      else confere('Central (diretor regional): clicar em "Santa Catarina" mostra o mapa do estado mas a Central fica na região dele', r.scope === 'region' && r.mapa.startsWith('Visão geral'), JSON.stringify(r));
      confere(`Central (${papel}): sem erro de JavaScript ao voltar ao estado`, erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1i) relatório TRIMESTRAL (mar/jun/set/dez, prazo dia 5) — nada pendente antes do lançamento =====
    {
      const { ctx, page, erros } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(async () => { showPage('monthly', document.querySelector('.nav[data-page="monthly"]')); await loadMonthly(); });
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => ({ sel: [...document.getElementById('monthlyMonth').options].map((o) => o.value + '|' + o.textContent),
        nota: document.getElementById('monthlyNotice').textContent, titulo: document.querySelector('#page-monthly h1').textContent }));
      confere('Trimestral: página "Andamento trimestral"', r.titulo === 'Andamento trimestral', r.titulo);
      confere('Trimestral: o filtro só tem trimestres (mar/jun/set/dez)', r.sel.length >= 4 && r.sel.every((x) => /^\d{4}-(03|06|09|12)-01\|\dº trimestre de \d{4}/.test(x)), r.sel.slice(0, 3).join(' · '));
      confere('Trimestral: antes do lançamento, aviso diz que não é cobrado (sem "atrasado")', /não é cobrado|abre em|enviado/.test(r.nota) && !/atrasado/.test(r.nota), r.nota);
      await page.evaluate(() => openMonthlyForm());
      const f = await page.evaluate(() => ({ t: document.getElementById('monthlyTitle').textContent, ms: [...document.getElementById('mrMonth').options].map((o) => o.value) }));
      confere('Trimestral: formulário só oferece trimestres que já abriram', f.t === 'Relatório do trimestre' && f.ms.length >= 1 && f.ms.every((m) => /-(03|06|09|12)-01$/.test(m) && new Date(m + 'T00:00:00') <= new Date()), JSON.stringify(f));
      const aviso = await page.evaluate(() => { const b = document.getElementById('adhMeusAvisos'); return b ? (b.hidden ? '' : b.textContent) : ''; });
      confere('Antes do lançamento: presidente não vê nenhum aviso de pendência', aviso === '', aviso);
      confere('Trimestral (presidente): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }
    {
      // depois do lançamento: evento que já passou sem relatório vira "relatório pendente"; relatório do trimestre cobrado
      SIM_CFG.lancamento = '2026-01-01';
      SIM_EVENTOS.push({ id: 99, chapter_id: 4, title: 'TESTE Evento que já passou', event_type: 'dinner', description: '', starts_at: new Date(Date.now() - 3 * 864e5).toISOString(), ends_at: null,
        venue_name: '', address: '', municipality_id: null, status: 'scheduled', is_published: true, public_contact: '', image_url: null });
      try {
        const { ctx, page, erros } = await abrir(browser, 'chapter_president', false);
        await entrar(page);
        // sem forçar nada: o presidente entra em Capítulos e os avisos aparecem lá
        await page.waitForTimeout(1200);
        confere('Seus avisos: aparecem na página em que o presidente entra (Capítulos)', await page.evaluate(() => { const b = document.getElementById('adhMeusAvisos'); return !!b && !b.hidden && !!b.closest('#page-chapters') && document.getElementById('page-chapters').classList.contains('on'); }));
        const av = await page.evaluate(() => { const b = document.getElementById('adhMeusAvisos'); return b && !b.hidden ? b.textContent : ''; });
        confere('Depois do lançamento: "Seus avisos" mostra o relatório do trimestre', /Relatório do|relatório do/.test(av) && /trimestre/.test(av), av);
        confere('Depois do lançamento: evento que já passou vira "Relatório pendente"', /Relatório pendente: TESTE Evento que já passou/.test(av), av);
        await page.evaluate(() => adhReportForEvent('99'));
        const rf = await page.evaluate(() => { const f = document.querySelector('#reportModal form'); return { open: document.getElementById('reportModal').classList.contains('open'), ev: document.getElementById('reportEvent').value, nome: f.elements.eventName.value }; });
        confere('"Fazer relatório" abre o relatório já com o evento escolhido', rf.open && rf.ev === '99' && rf.nome === 'TESTE Evento que já passou', JSON.stringify(rf));
        await page.evaluate(() => { closeModal('reportModal'); showPage('reports', document.querySelector('.nav[data-page="reports"]')); renderReports(); });
        const rp = await page.evaluate(() => { const b = document.getElementById('adhRelPendentes'); return b && !b.hidden ? b.textContent : ''; });
        confere('Relatórios de eventos: lista os eventos já realizados sem relatório', /1 evento\(s\) já realizado\(s\) sem relatório/.test(rp), rp);
        confere('Avisos (presidente): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
        await ctx.close();
        const d = await abrir(browser, 'regional_director', false);
        await entrar(d.page);
        await d.page.evaluate(async () => { await loadMonthly(true); showPage('dashboard', document.querySelector('.nav[data-page="dashboard"]')); renderDashboard(); });
        await d.page.waitForTimeout(800);
        const at = await d.page.evaluate(() => (document.getElementById('attentionPanel') || {}).textContent || '');
        confere('Diretor regional: quadro "Atenção" mostra evento da região sem relatório', /evento\(s\) já realizado\(s\) sem relatório/.test(at) && /TESTE Evento que já passou/.test(at), at.slice(0, 300));
        confere('Diretor regional: avisos sem erro de JavaScript', d.erros.length === 0, d.erros.join(' | '));
        await d.ctx.close();
      } finally { SIM_CFG.lancamento = null; SIM_EVENTOS.pop(); }
    }
    // ===== 1j) Saúde por trimestre e aviso de fim de mandato definido pelo diretor =====
    {
      const { ctx, page, erros, log } = await abrir(browser, 'state_director', false);
      await entrar(page);
      await page.evaluate(async () => { showPage('ranking', document.querySelector('.nav[data-page="ranking"]')); await loadRanking(); });
      await page.waitForTimeout(500);
      const rk = log.filter((x) => x.p.endsWith('/rpc/adh_ranking')).map((x) => x.corpo && x.corpo.p_month);
      confere('Saúde: pede sempre um trimestre (mar/jun/set/dez)', rk.length > 0 && rk.every((m) => /-(03|06|09|12)-01$/.test(m)), rk.join(','));
      await page.evaluate(async () => { showPage('mandates', document.querySelector('.nav[data-page="mandates"]')); await gxLoadMandates(true); gxRenderMandates(); });
      const m = await page.evaluate(() => ({ btn: !document.getElementById('gxMandAlertBtn').hidden, txt: document.getElementById('gxMandDias').textContent }));
      confere('Mandatos: diretor estadual vê "Aviso de fim de mandato" (60 e 30 dias)', m.btn && m.txt === '60 e 30', JSON.stringify(m));
      await page.evaluate(() => { gxMandAlertEdit(); });
      await page.waitForTimeout(200);
      const pre = await page.evaluate(() => (document.getElementById('adhDlgInput') || {}).value);
      await page.evaluate(() => { document.getElementById('adhDlgInput').value = '90, 45'; [...document.querySelectorAll('.modal.open button')].find((b) => /Salvar/.test(b.textContent)).click(); });
      await page.waitForTimeout(500);
      const set = log.find((x) => x.p.endsWith('/rpc/adh_config_set'));
      confere('Mandatos: o diretor muda para 90 e 45 dias e o sistema grava', pre === '60, 30' && set && set.corpo.p_key === 'alerta_mandato_dias' && JSON.stringify(set.corpo.p_value) === '[90,45]', pre + ' → ' + JSON.stringify(set && set.corpo));
      const depois = await page.evaluate(() => document.getElementById('gxMandDias').textContent);
      confere('Mandatos: tela passa a mostrar "90 e 45"', depois === '90 e 45', depois);
      confere('Saúde/mandatos (diretor estadual): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
      const p2 = await abrir(browser, 'chapter_president', false);
      await entrar(p2.page);
      await p2.page.evaluate(async () => { showPage('mandates', document.querySelector('.nav[data-page="mandates"]')); await gxLoadMandates(true); gxRenderMandates(); });
      const pb = await p2.page.evaluate(() => !document.getElementById('gxMandAlertBtn').hidden);
      confere('Mandatos: presidente não muda o aviso de mandato', !pb);
      await p2.ctx.close();
    }

    // ===== 1k) secretário e representante de campo: designar em "Minha conta" e faixa "atuando como" =====
    {
      const { ctx, page, erros, log } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(async () => { await openAccount(); });
      await page.waitForSelector('#acctDelegForm', { timeout: 4000 }).catch(() => {});
      const temForm = await page.evaluate(() => !!document.getElementById('acctDelegForm') && /mesmas permissões que você/.test(document.getElementById('acctDeleg').textContent));
      confere('Secretário: presidente vê "Secretário e representante de campo" em Minha conta, com o aviso de mesmas permissões', temForm);
      await page.evaluate(() => { const f = document.getElementById('acctDelegForm'); f.elements.email.value = 'secretaria@teste.invalid'; f.elements.kind.value = 'secretario'; f.requestSubmit(); });
      await page.waitForTimeout(200);
      await page.evaluate(() => { [...document.querySelectorAll('.modal.open button')].find((b) => /^Designar$/.test(b.textContent.trim()) && b.closest('.modalbox') && !b.closest('#accountModal')).click(); });
      await page.waitForTimeout(600);
      const cr = log.find((x) => x.p.endsWith('/rpc/adh_delegation_create'));
      const lst = await page.evaluate(() => document.getElementById('acctDeleg').textContent);
      confere('Secretário: designar envia e-mail e função ao banco', cr && cr.corpo.p_email === 'secretaria@teste.invalid' && cr.corpo.p_kind === 'secretario', JSON.stringify(cr && cr.corpo));
      confere('Secretário: a pessoa designada aparece na lista com "Encerrar"', /TESTE Secretária/.test(lst) && /Encerrar/.test(lst), lst.slice(0, 200));
      await page.evaluate(() => document.querySelector('#acctDeleg [data-deleg-fim]').click());
      await page.waitForTimeout(200);
      await page.evaluate(() => { [...document.querySelectorAll('.modal.open button')].find((b) => /^Encerrar$/.test(b.textContent.trim()) && !b.closest('#accountModal')).click(); });
      await page.waitForTimeout(600);
      confere('Secretário: encerrar chama o banco e some da lista', log.some((x) => x.p.endsWith('/rpc/adh_delegation_end')) && !/TESTE Secretária/.test(await page.evaluate(() => document.getElementById('acctDeleg').textContent)));
      confere('Secretário (presidente): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
      // quem foi designado vê a faixa "Você está atuando como Secretário de …"
      SIM_DELEG.push({ id: 900, kind: 'secretario', delegator_id: 'u-chefe', delegator_name: 'TESTE Presidente Brusque', delegate_id: 'u-teste', delegate_name: 'Pessoa de Teste', created_at: new Date().toISOString() });
      const p2 = await abrir(browser, 'chapter_president', false);
      await entrar(p2.page);
      await p2.page.waitForSelector('#adhDelegBar:not([hidden])', { timeout: 4000 }).catch(() => {});
      const bar = await p2.page.evaluate(() => { const b = document.getElementById('adhDelegBar'); return b && !b.hidden ? b.textContent : ''; });
      confere('Secretário: quem foi designado vê "Você está atuando como Secretário de …"', /atuando como Secretário de TESTE Presidente Brusque/.test(bar), bar);
      const sm = await p2.page.evaluate(() => document.getElementById('roleLabel').textContent);
      confere('Secretário: cargo exibido mostra "Secretário · Presidente de capítulo"', /^Secretário · /.test(sm), sm);
      SIM_DELEG.length = 0;
      await p2.ctx.close();
      // sócio não tem a seção
      const p3 = await abrir(browser, 'member', false);
      await entrar(p3.page);
      await p3.page.evaluate(async () => { await openAccount(); });
      await p3.page.waitForTimeout(400);
      confere('Secretário: sócio não vê a opção de designar', await p3.page.evaluate(() => !document.getElementById('acctDelegForm')));
      await p3.ctx.close();
    }

    // ===== 1m) cache no aparelho: quem volta não baixa de novo arquivos, imagens e vídeo; sem internet a página abre =====
    {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await ctx.addInitScript(() => { try { localStorage.setItem('adh-seen', '1'); } catch (e) {} });
      const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message));
      await simular(page, null);
      await page.goto(BASE); await page.waitForTimeout(1500);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await page.reload(); await page.waitForTimeout(1500);   // agora o service worker controla a página
      const doSW = [];
      page.on('response', (r) => { if (/\/beta\/(js\/app\.js|styles\.css|assets\/fundo-hero\.jpg)/.test(r.url())) doSW.push(r.fromServiceWorker()); });
      await page.reload(); await page.waitForTimeout(1500);
      confere('Cache: na volta, arquivos e imagens vêm do aparelho (service worker)', doSW.length >= 2 && doSW.every(Boolean), JSON.stringify(doSW));
      const vid = await page.evaluate(async () => {
        const u = 'assets/video/apresentacao-h.mp4';
        await fetch(u, { headers: { Range: 'bytes=0-' } }).then((r) => r.arrayBuffer());   // 1ª vez: rede (e guarda por trás)
        for (let i = 0; i < 40; i++) { const c = await caches.open('adh-media-v1-beta'); if (await c.match(location.origin + '/beta/' + u)) break; await new Promise((ok) => setTimeout(ok, 250)); }
        const r = await fetch(u, { headers: { Range: 'bytes=100-1099' } });
        return { st: r.status, len: (await r.arrayBuffer()).byteLength, cr: r.headers.get('content-range') };
      });
      confere('Cache: vídeo fica guardado e toca do aparelho, com avanço/retrocesso (pedido parcial 206)', vid.st === 206 && vid.len === 1000 && /^bytes 100-1099\/\d+$/.test(vid.cr || ''), JSON.stringify(vid));
      await ctx.setOffline(true);
      await page.reload().catch(() => {}); await page.waitForTimeout(1500);
      const off = await page.evaluate(() => !!document.querySelector('header.top') && typeof showPage === 'function');
      confere('Cache: sem internet, a página abre com o que está guardado', off);
      await ctx.setOffline(false);
      confere('Cache: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 1l) boas-vindas: implantação até dez/2026, prazos a partir de 2027, só cobra capítulo com presidente =====
    {
      SIM_CFG.lancamento = '2027-01-01';
      try {
        const { ctx, page, erros } = await abrir(browser, 'chapter_president', false);
        await entrar(page);
        await page.waitForSelector('#adhBoasVindas:not([hidden])', { timeout: 4000 }).catch(() => {});
        const bv = await page.evaluate(() => { const b = document.getElementById('adhBoasVindas'); return b && !b.hidden ? b.textContent : ''; });
        confere('Boas-vindas: presidente vê o período de implantação até 31 de dezembro de 2026', /31 de dezembro de 2026/.test(bv) && /Nada é cobrado/.test(bv), bv.slice(0, 160));
        confere('Boas-vindas: diz que os prazos contam a partir de 1º/01/2027 e o 1º relatório é do 1º trimestre de 2027 (até 5 de abril)', /1º de janeiro de 2027/.test(bv) && /1º trimestre de 2027/.test(bv) && /5 de abril de 2027/.test(bv), bv);
        await page.evaluate(() => document.getElementById('adhBoasVindasOk').click());
        confere('Boas-vindas: "Entendi" esconde o painel', await page.evaluate(() => document.getElementById('adhBoasVindas').hidden));
        confere('Boas-vindas (presidente): sem erro de JavaScript', erros.length === 0, erros.join(' | '));
        await ctx.close();
        // depois do lançamento, só cobra capítulo com presidente com login
        SIM_CFG.lancamento = '2026-01-01';
        const d = await abrir(browser, 'state_director', false);
        await entrar(d.page);
        await d.page.evaluate(async () => { await adhLoadConfig(true); showPage('monthly', document.querySelector('.nav[data-page="monthly"]')); await loadMonthly(); });
        await d.page.waitForTimeout(600);
        const miss = await d.page.evaluate(() => document.getElementById('monthlyMissing').textContent);
        confere('Cobrança: capítulos sem presidente com login aparecem como "não cobrados"', /Não cobrados \(sem presidente com acesso à plataforma\):.*TESTE Chapecó/.test(miss) && /TESTE Itajaí/.test(miss), miss);
        const att = await d.page.evaluate(() => adhAttentionItems().map((x) => x.c.name).join(', '));
        confere('Cobrança: quadro "Atenção" não cobra capítulo sem presidente com login', !/Chapecó|Itajaí/.test(att), att);
        confere('Boas-vindas: depois do lançamento o painel não aparece', await d.page.evaluate(() => { const b = document.getElementById('adhBoasVindas'); return !b || b.hidden; }));
        await d.ctx.close();
      } finally { SIM_CFG.lancamento = null; }
    }

    // ===== 1e) logoff por inatividade: aviso com contagem, "Continuar conectado" e saída automática =====
    {
      const { ctx, page, erros, log } = await abrir(browser, 'state_admin', false);
      await entrar(page);
      await page.evaluate(() => { window.adhInatividade = { limite: 5000, aviso: 3000 }; });
      await page.waitForSelector('#adhInatividade', { timeout: 6000 }).catch(() => {});
      const txt = await page.evaluate(() => (document.querySelector('#adhInatividade') || {}).textContent || '');
      confere('Inatividade: aviso "o sistema fará o logoff automaticamente em"', /logoff automaticamente em \d+:\d\d minuto/.test(txt), txt);
      await page.evaluate(() => document.querySelector('#adhInatividade [data-k="ficar"]').click());
      await page.waitForTimeout(500);
      const ficou = await page.evaluate(() => !!adhSession && !document.querySelector('#adhInatividade'));
      confere('Inatividade: "Continuar conectado" mantém a sessão', ficou);
      await page.waitForSelector('#adhInatividadeFim', { timeout: 8000 }).catch(() => {});
      const fim = await page.evaluate(() => ({ sessao: !!adhSession, msg: (document.querySelector('#adhInatividadeFim') || {}).textContent || '', admin: document.getElementById('adminView').classList.contains('on') }));
      confere('Inatividade: sem resposta, sai e pede login novamente', !fim.sessao && !fim.admin && fim.msg.includes('Faça o login novamente'), JSON.stringify(fim));
      confere('Inatividade: encerra a sessão também no servidor', log.some((x) => x.m === 'POST' && x.p.endsWith('/auth/v1/logout')));
      confere('Inatividade: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, 'state_admin', false);
      await page.evaluate(() => document.documentElement.classList.add('in-app'));
      await entrar(page);
      await page.evaluate(() => { window.adhInatividade = { limite: 2000, aviso: 1000 }; });
      await page.waitForTimeout(3500);
      confere('Inatividade: no app a sessão continua', await page.evaluate(() => !!adhSession && !document.querySelector('#adhInatividade')));
      await ctx.close();
    }

    // ===== 2) relatórios: presidente envia o andamento mensal do próprio capítulo =====
    {
      const { ctx, page, erros, log } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(() => { showPage('monthly', document.querySelector('.nav[data-page="monthly"]')); loadMonthly(); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => openMonthlyForm());
      await page.waitForTimeout(600);
      const caps = await page.evaluate(() => [...document.querySelectorAll('#mrChapter option')].map((o) => o.value).filter(Boolean));
      confere('Relatório: presidente só escolhe o próprio capítulo', caps.length === 1 && caps[0] === '4', 'opções: ' + caps.join(','));
      await page.evaluate(() => { const f = document.querySelector('#monthlyModal form'); f.elements.chapter_meetings.value = '4'; f.requestSubmit(); });
      await page.waitForTimeout(1500);
      const envio = log.find((x) => x.m === 'POST' && x.p.endsWith('/chapter_monthly_reports'));
      confere('Relatório: envio vai para o banco com o capítulo e os números', !!envio && String(envio.corpo.chapter_id) === '4' && Number(envio.corpo.chapter_meetings) === 4,
        envio ? JSON.stringify(envio.corpo).slice(0, 200) : 'nenhum envio');
      confere('Relatório: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 3) comunicados por região no site público =====
    {
      const { ctx, page, erros } = await abrir(browser, null, false);
      await page.waitForTimeout(800);
      const estadual = await page.evaluate(() => document.querySelector('#announcementsSection [data-list]')?.innerText || '');
      confere('Comunicados: aviso estadual aparece para todos', estadual.includes('TESTE Aviso estadual'), estadual.slice(0, 120));
      confere('Comunicados: avisos regionais não aparecem misturados no geral', !estadual.includes('TESTE Aviso Oeste') && !estadual.includes('TESTE Aviso Vale'), estadual.slice(0, 160));
      await page.evaluate(() => { const s = document.getElementById('annRegionPick'); s.value = '2'; renderRegionalAnnouncements(); });
      const vale = await page.evaluate(() => document.querySelector('#announcementsSection [data-rlist]')?.innerText || '');
      confere('Comunicados: escolhendo Vale do Itajaí, vê o aviso do Vale', vale.includes('TESTE Aviso Vale do Itajaí'), vale.slice(0, 120));
      confere('Comunicados: escolhendo Vale do Itajaí, NÃO vê o aviso do Oeste', !vale.includes('TESTE Aviso Oeste'), vale.slice(0, 120));
      confere('Comunicados: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }

    // ===== 5) privacidade e exclusão de conta (Google Play / App Store / LGPD) =====
    {
      const fs2 = require('fs');
      for (const pasta of ['', 'beta/']) {   // oficial e /beta
        const pol = fs2.readFileSync(path.join(RAIZ, pasta + 'privacidade.html'), 'utf8');
        const onde = pasta ? '/beta' : 'oficial';
        confere(`Política (${onde}): cita o app ADHONEP SC e o desenvolvedor`, pol.includes('ADHONEP SC') && pol.includes('Eduardo de Souza'));
        confere(`Política (${onde}): explica localização, notificações e Face ID`, /Localização/.test(pol) && /Notificações/.test(pol) && /Face ID/.test(pol));
        confere(`Política (${onde}): diz o que é apagado e o que fica na exclusão`, pol.includes('Exclusão da conta') && pol.includes('sem ligação com a pessoa'));
        confere(`Política (${onde}): aponta a página de exclusão e tem data de atualização`, pol.includes('excluir-conta.html') && /Última atualização: \d{2}\/\d{2}\/\d{4}/.test(pol));
        const exc = path.join(RAIZ, pasta + 'excluir-conta.html');
        const txt = fs2.existsSync(exc) ? fs2.readFileSync(exc, 'utf8') : '';
        confere(`Página de exclusão (${onde}): existe e ensina pelo app, pelo site e por e-mail`, txt.includes('Pelo aplicativo') && txt.includes('Pelo site') && txt.includes('mail'));
      }
      const { ctx, page, erros, log } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(() => openModal ? openModal('accountModal') : null).catch(() => {});
      await page.waitForTimeout(400);
      confere('Minha conta: tem "Solicitar exclusão da conta"', await page.evaluate(() => !!document.getElementById('acctDelBtn')));
      await page.evaluate(() => { window.adhDialog = async () => true; document.getElementById('acctDelBtn').click(); });
      await page.waitForTimeout(800);
      confere('Minha conta: pedido de exclusão vai para o banco', log.some((x) => x.p.endsWith('/rpc/adh_request_account_deletion')));
      confere('Minha conta: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }
    {
      const { ctx, page, erros } = await abrir(browser, 'state_admin', false);
      await entrar(page);
      await page.evaluate(() => { showPage('users', document.querySelector('.nav[data-page="users"]')); loadRealUsers(); });
      await page.waitForTimeout(1500);
      const txt = await page.evaluate(() => document.getElementById('delReqBox')?.innerText || '');
      confere('Administração: vê os pedidos de exclusão pendentes', txt.includes('TESTE Pessoa que pediu exclusão'), txt.slice(0, 120));
      confere('Administração: tem botão para concluir a exclusão', await page.evaluate(() => !!document.querySelector('#delReqBox [data-delreq]')));
      confere('Administração: sem erro de JavaScript', erros.length === 0, erros.join(' | '));
      await ctx.close();
    }
    {
      const { ctx, page } = await abrir(browser, 'chapter_president', false);
      await entrar(page);
      await page.evaluate(() => showPage('users', document.querySelector('.nav[data-page="users"]'))).catch(() => {});
      await page.waitForTimeout(800);
      confere('Presidente: não vê pedidos de exclusão', await page.evaluate(() => { const b = document.getElementById('delReqBox'); return !b || b.hidden; }));
      await ctx.close();
    }

    // ===== 4) celular (390 px): nenhuma tela com rolagem para o lado =====
    {
      const { ctx, page } = await abrir(browser, null, true);
      for (const sec of ['mapSection', 'eventsSection', 'announcementsSection']) {
        await page.evaluate((s) => document.getElementById(s)?.scrollIntoView(), sec);
        await page.waitForTimeout(300);
        confere(`Celular, site público (${sec}): sem rolagem lateral`, await semRolagemLateral(page));
      }
      await ctx.close();
    }
    for (const papel of ['state_admin', 'chapter_president', 'regional_director']) {
      const { ctx, page } = await abrir(browser, papel, true);
      await entrar(page);
      const paginas = await menu(page);
      for (const pg of paginas) {
        await page.evaluate((p) => { try { showPage(p, document.querySelector('.nav[data-page="' + p + '"]')); } catch (e) {} }, pg);
        await page.waitForTimeout(250);
        const ok = await semRolagemLateral(page);
        const larg = ok ? '' : await page.evaluate(() => document.documentElement.scrollWidth + 'px de largura numa tela de ' + window.innerWidth + 'px');
        confere(`Celular, ${papel}, página "${pg}": sem rolagem lateral`, ok, larg);
      }
      await ctx.close();
    }

    // ===== 6) hardening: cabeçalhos de segurança da Vercel (vercel.json) não quebram o site =====
    {
      const srvV = servidor(PORTA + 1, CABECALHOS_VERCEL);
      const baseV = `http://localhost:${PORTA + 1}/beta/index.html`;
      try {
        confere('vercel.json: tem CSP, CSP Report-Only, anti-iframe e nosniff',
          ['Content-Security-Policy', 'Content-Security-Policy-Report-Only', 'X-Frame-Options', 'X-Content-Type-Options'].every((k) => CABECALHOS_VERCEL[k]));
        confere("vercel.json: CSP proíbe o site dentro de iframe de outro domínio e nunca libera 'unsafe-eval'",
          /frame-ancestors 'none'/.test(CABECALHOS_VERCEL['Content-Security-Policy']) && !/unsafe-eval/.test(JSON.stringify(CABECALHOS_VERCEL)));
        for (const papel of [null, 'state_admin']) {
          const nome = papel ? 'administrador logado' : 'site público';
          const { ctx, page, erros, csp } = await abrir(browser, papel, false, baseV);
          if (papel) await entrar(page);
          await page.waitForTimeout(800);
          const bloqueios = csp.filter((t) => !/report[ -]only/i.test(t));
          confere(`CSP da Vercel (${nome}): nada é bloqueado`, bloqueios.length === 0, bloqueios.slice(0, 3).join(' | '));
          confere(`CSP da Vercel (${nome}): sem erro de JavaScript`, erros.length === 0, erros.join(' | '));
          const avisos = csp.length - bloqueios.length;
          console.log(`     (info) CSP Report-Only, ${nome}: ${avisos} aviso(s) — o que falta mudar para tirar 'unsafe-inline' dos scripts`);
          await ctx.close();
        }
      } finally { srvV.close(); }
    }
  } catch (e) {
    confere('Os testes de tela rodaram até o fim', false, String(e && e.stack || e));
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(`== Tela: ${ok} OK, ${falhas} FAIL (de ${ok + falhas})`);
  console.log(falhas ? 'RESULTADO: FAIL' : 'RESULTADO: OK');
  process.exit(falhas ? 1 : 0);
})();
