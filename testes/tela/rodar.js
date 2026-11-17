/* ADHONEP-SC · testes de tela do /beta (Playwright + Supabase simulado).
 * Uso: node testes/tela/rodar.js      (precisa de: npm i playwright && npx playwright install chromium)
 * Cada checagem imprime OK/FAIL; sai com erro se alguma falhar. Nunca usa a produção nem senha real. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { simular } = require('./simulador');

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
