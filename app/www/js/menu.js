/* ADHONEP-SC · menu da gestão em grupos (claude v1.18, pedido do Eduardo 18/11/2026; item 15 do diretor: menu recolhível)
   - Reaproveita os botões .nav[data-page] que já existem (mesmos onclick e endereços): só os move para grupos.
   - Grupos abrem e fecham; o grupo da página atual abre sozinho; o que a pessoa deixou aberto fica lembrado.
   - Grupo sem nenhum item permitido para o perfil some.
   - Computador: botão para recolher o menu em ícones (passando o mouse, o grupo abre ao lado).
   - Celular: botão "Menu" que se transforma na gaveta (morphing drawer). */
(function () {
  const ICON = {
    central: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M12 12l6-6"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    capitulos: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    eventos: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    acompanhamento: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    comunicacao: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    estrutura: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
    administracao: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>',
    outros: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    painel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    fechar: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  const svg = (k) => '<svg class="mi" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICON[k] || '') + '</svg>';
  const DIRETOS = [['central', 'central'], ['dashboard', 'dashboard']];
  const GRUPOS = [
    { id: 'capitulos', nome: 'Capítulos', paginas: ['chapters', 'mandates', 'meetings', 'members'] },
    { id: 'eventos', nome: 'Eventos', paginas: ['events', 'calendar', 'reports'] },
    { id: 'acompanhamento', nome: 'Acompanhamento', paginas: ['monthly', 'support', 'ranking'] },
    { id: 'comunicacao', nome: 'Comunicação', paginas: ['announcements', 'library'] },
    { id: 'estrutura', nome: 'Estrutura', paginas: ['regions', 'speakers'] },   // Preletores em Estrutura (decisão do Eduardo, 19/11/2026)
    { id: 'administracao', nome: 'Administração', paginas: ['access-requests', 'users', 'audit', 'lgpd'] }
  ];
  const DONO = {}; GRUPOS.forEach((g) => g.paginas.forEach((p) => { DONO[p] = g.id; }));
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const grava = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ok */ } };
  let abertos = ler('adh-menu-abertos', {});
  let side = null, montado = false;

  /* tira o símbolo antigo (◉ ▦ ⌂ …) do começo do texto do botão e põe o texto num span */
  function limpaBotao(b) {
    if (b.dataset.menuOk) return;
    b.dataset.menuOk = '1';
    const t = [...b.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (t) {
      const txt = t.textContent.replace(/^\s*[^\p{L}\p{N}(]+\s*/u, '').trim();
      const s = document.createElement('span'); s.className = 'nav-txt'; s.textContent = txt;
      b.replaceChild(s, t);
    }
    if (!DONO[b.dataset.page]) {   // item direto: ganha ícone
      const d = DIRETOS.find((x) => x[0] === b.dataset.page);
      b.insertAdjacentHTML('afterbegin', svg(d ? d[1] : 'outros'));
    }
    b.title = (b.querySelector('.nav-txt') || b).textContent.trim();
  }

  function grupoEl(g) {
    const w = document.createElement('div');
    w.className = 'ngroup'; w.dataset.grp = g.id;
    w.innerHTML = '<button type="button" class="ngh" aria-expanded="false" title="' + g.nome + '">' + svg(g.id) + '<span class="nav-txt">' + g.nome + '</span><span class="ngcount" hidden></span>' + svg('chevron').replace('class="mi"', 'class="mi chev"') + '</button>'
      + '<div class="ngbody"><div class="nginner"><div class="ngfly-title">' + g.nome + '</div></div></div>';
    w.querySelector('.ngh').addEventListener('click', () => {
      if (document.documentElement.classList.contains('menu-mini') && !document.documentElement.classList.contains('menu-aberto')) return;
      abre(g.id, !w.classList.contains('open'), true);
    });
    return w;
  }
  function abre(id, sim, lembrar) {
    const w = side && side.querySelector('.ngroup[data-grp="' + id + '"]'); if (!w) return;
    w.classList.toggle('open', !!sim);
    const h = w.querySelector('.ngh'); if (h) h.setAttribute('aria-expanded', sim ? 'true' : 'false');
    if (lembrar) { abertos[id] = !!sim; grava('adh-menu-abertos', abertos); }
  }

  function monta() {
    side = document.querySelector('#adminView aside.side'); if (!side) return;
    if (!montado) {
      montado = true;
      const label = side.querySelector('.side-label');
      const topo = document.createElement('div'); topo.className = 'side-top';
      topo.innerHTML = '<button type="button" class="side-mini" id="menuRecolher" aria-label="Recolher menu" title="Recolher menu">' + svg('painel') + '</button>'
        + '<button type="button" class="side-close" id="menuFechar" aria-label="Fechar menu">' + svg('fechar') + '</button>';
      side.insertBefore(topo, side.firstChild);
      if (label) topo.appendChild(label);
      const foot = side.querySelector('.side-foot');
      GRUPOS.forEach((g) => side.insertBefore(grupoEl(g), foot || null));
      topo.querySelector('#menuRecolher').addEventListener('click', () => {
        const mini = !document.documentElement.classList.contains('menu-mini');
        document.documentElement.classList.toggle('menu-mini', mini); grava('adh-menu-mini', mini);
        topo.querySelector('#menuRecolher').setAttribute('aria-label', mini ? 'Abrir menu' : 'Recolher menu');
        topo.querySelector('#menuRecolher').title = mini ? 'Abrir menu' : 'Recolher menu';
      });
      topo.querySelector('#menuFechar').addEventListener('click', () => gaveta(false));
      if (ler('adh-menu-mini', false)) document.documentElement.classList.add('menu-mini');
      // botão "Menu" do celular, na barra do topo da gestão
      const bar = document.querySelector('#adminView .adminbar');
      if (bar && !document.getElementById('menuGaveta')) {
        const b = document.createElement('button'); b.type = 'button'; b.id = 'menuGaveta'; b.className = 'menu-btn';
        b.setAttribute('aria-label', 'Abrir menu'); b.innerHTML = svg('menu') + '<span>Menu</span>';
        b.addEventListener('click', () => gaveta(true));
        bar.insertBefore(b, bar.firstChild);
      }
      const veu = document.createElement('div'); veu.className = 'menu-veu'; veu.addEventListener('click', () => gaveta(false));
      (side.parentNode || document.body).insertBefore(veu, side);   // mesma camada da gaveta (a animação de entrada da página cria uma camada própria)
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.documentElement.classList.contains('menu-aberto')) gaveta(false); });
    }
    // move cada botão para o seu grupo (também os criados depois, como "Apoios")
    side.querySelectorAll('.nav[data-page]').forEach((b) => {
      limpaBotao(b);
      const gid = DONO[b.dataset.page]; if (!gid) return;
      const inner = side.querySelector('.ngroup[data-grp="' + gid + '"] .nginner');
      if (inner && b.parentNode !== inner) {
        const g = GRUPOS.find((x) => x.id === gid), ordem = g.paginas.indexOf(b.dataset.page);
        const depois = [...inner.querySelectorAll('.nav[data-page]')].find((o) => g.paginas.indexOf(o.dataset.page) > ordem);
        inner.insertBefore(b, depois || null);
      }
    });
    atualiza();
  }

  /* esconde grupo vazio para o perfil, abre o da página atual, soma pendências */
  function atualiza() {
    if (!side) return;
    const atual = document.querySelector('.apage.on'), pg = atual ? atual.id.replace('page-', '') : '';
    side.querySelectorAll('.ngroup').forEach((w) => {
      const itens = [...w.querySelectorAll('.nav[data-page]')];
      const vis = itens.filter((b) => !b.hidden && !b.classList.contains('role-hidden'));
      if (w.hidden !== !vis.length) w.hidden = !vis.length;
      const temAtual = itens.some((b) => b.dataset.page === pg);
      w.classList.toggle('current', temAtual);
      const id = w.dataset.grp;
      abre(id, temAtual || !!abertos[id], false);
      let n = 0; vis.forEach((b) => b.querySelectorAll('.pillnum').forEach((p) => { const v = parseInt(p.textContent, 10); if (v > 0) n += v; }));
      const c = w.querySelector('.ngcount'), tx = n ? String(n) : '';
      if (c && c.hidden !== !n) c.hidden = !n;
      if (c && c.textContent !== tx) c.textContent = tx;
    });
  }

  /* gaveta do celular: o botão "Menu" cresce e vira o painel */
  function gaveta(sim) {
    const html = document.documentElement, b = document.getElementById('menuGaveta');
    if (sim && b && side) {
      const r = b.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
      side.style.setProperty('--de', `inset(${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px round 999px)`);
    }
    html.classList.toggle('menu-aberto', !!sim);
    if (b) b.setAttribute('aria-expanded', sim ? 'true' : 'false');
    if (sim) { const f = side && side.querySelector('.nav.on, .ngh'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 50); }
  }
  window.adhMenuGaveta = gaveta;

  function liga() {
    monta();
    if (typeof showPage === 'function' && !showPage.__menu) {
      const sp = showPage;
      showPage = function () { const r = sp.apply(this, arguments); try { atualiza(); gaveta(false); } catch (e) { /* ok */ } return r; };
      showPage.__menu = 1;
    }
    if (typeof applyRole === 'function' && !applyRole.__menu) {
      const ar = applyRole;
      applyRole = function () { const r = ar.apply(this, arguments); try { monta(); } catch (e) { /* ok */ } return r; };
      applyRole.__menu = 1;
    }
    // botões novos (ex.: "Apoios") e contadores que mudam
    try { new MutationObserver(() => { clearTimeout(liga.t); liga.t = setTimeout(monta, 30); }).observe(side, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] }); } catch (e) { /* ok */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga();
})();
