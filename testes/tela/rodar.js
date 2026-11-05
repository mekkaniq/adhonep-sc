/* ADHONEP-SC · testes de tela do /beta (Playwright + Supabase simulado).
 * Uso: node testes/tela/rodar.js      (precisa de: npm i playwright && npx playwright install chromium)
 * Cada checagem imprime OK/FAIL; sai com erro se alguma falhar. Nunca usa a produção nem senha real. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { simular } = require('./simulador');

const RAIZ = path.resolve(__dirname, '../..');
const PORTA = 8799;
const BASE = `http://localhost:${PORTA}/beta/index.html`;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4' };

let ok = 0, falhas = 0;
function confere(nome, cond, detalhe) {
  if (cond) { ok++; console.log('OK   ' + nome); }
  else { falhas++; console.log('FAIL ' + nome + (detalhe ? '  →  ' + detalhe : '')); }
}

function servidor() {
  return http.createServer((req, res) => {
    let f = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(PORTA);
}

async function abrir(browser, papel, celular) {
  const ctx = await browser.newContext(celular
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('adh-seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  const log = await simular(page, papel);
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  return { ctx, page, erros, log };
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
