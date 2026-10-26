/* ADHONEP-SC claude v1.7 · Central de comando (visão estadual e regional).
   Só leitura: junta capítulos, sócios, reuniões, relatórios, mandatos, eventos e ranking numa tela só.
   Carrega depois de gestao.js. Prefixo "cmd". Não grava nada no banco. */
window.ADH_VER_CMD = '1.9';

const CMD = { scope: 'state', regionId: '', month: null, members: null, loaded: false, loading: false, timer: null, rank: null, at: null };
const CMD_C = { gold: '#c9a45c', gold2: '#e6cf9c', blue: '#5b9bd5', green: '#3ecf8e', yellow: '#f2c94c', orange: '#f2994a', red: '#ef5b5b', mute: '#8896ab', line: 'rgba(255,255,255,.08)' };
const cmdE = s => escapeHtml(String(s == null ? '' : s));
const cmdN = n => (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('pt-BR');
function cmdEl(id) { return document.getElementById(id); }
function cmdRole() { return (typeof adhProfile !== 'undefined' && adhProfile) ? adhProfile.role : null; }
function cmdMyRegions() { return ((typeof adhProfile !== 'undefined' && adhProfile && adhProfile.regionIds) || []).map(String); }
function cmdIsRegional() { return cmdRole() === 'regional_director'; }
function cmdRegions() {
  const all = (typeof adhDbRegions !== 'undefined' ? adhDbRegions : []);
  if (cmdIsRegional()) { const mine = cmdMyRegions(); return all.filter(r => mine.includes(String(r.id))); }
  return all;
}
function cmdScopeChapters() {
  let list = (typeof chapters !== 'undefined' ? chapters : []);
  if (cmdIsRegional()) { const mine = cmdMyRegions(); list = list.filter(c => mine.includes(String(c.region_id))); }
  if (CMD.scope === 'region' && CMD.regionId) list = list.filter(c => String(c.region_id) === String(CMD.regionId));
  return list;
}
function cmdActive() { return cmdScopeChapters().filter(c => c.status === 'Ativo'); }
function cmdInScope(cid) { const s = new Set(cmdScopeChapters().map(c => String(c.id))); return s.has(String(cid)); }

/* ---------- gráficos em SVG (sem biblioteca) ---------- */
function cmdDonut(segs, centerBig, centerSmall) {
  const tot = segs.reduce((s, x) => s + x.v, 0), R = 54, C = 2 * Math.PI * R;
  let off = 0, arcs = '';
  if (tot > 0) segs.filter(x => x.v > 0).forEach(x => {
    const len = x.v / tot * C;
    arcs += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + x.c + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)"></circle>';
    off += len;
  });
  else arcs = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16"></circle>';
  return '<svg viewBox="0 0 140 140" class="cmd-donut" role="img" aria-label="' + cmdE(centerSmall || '') + '">' + arcs
    + '<text x="70" y="70" text-anchor="middle" class="cmd-dbig">' + cmdE(centerBig) + '</text>'
    + '<text x="70" y="88" text-anchor="middle" class="cmd-dsm">' + cmdE(centerSmall || '') + '</text></svg>';
}
function cmdLegend(segs) {
  return '<ul class="cmd-leg">' + segs.map(x => '<li><i style="background:' + x.c + '"></i><span>' + cmdE(x.l) + '</span><b>' + cmdN(x.v) + '</b></li>').join('') + '</ul>';
}
function cmdArea(vals, labels, color, opt) {
  opt = opt || {}; const W = 360, H = 130, pl = 28, pr = 18, pt = 10, pb = 20;
  const mx = Math.max(1, ...vals), top = opt.max || Math.ceil(mx * 1.15);
  const x = i => pl + (vals.length <= 1 ? 0 : i * (W - pl - pr) / (vals.length - 1)), y = v => pt + (H - pt - pb) * (1 - v / top);
  const id = 'ag' + Math.random().toString(36).slice(2, 7);
  let g = '';
  [0, .5, 1].forEach(t => { const yy = pt + (H - pt - pb) * (1 - t); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(255,255,255,.08)"></line><text x="' + (pl - 5) + '" y="' + (yy + 3) + '" text-anchor="end" class="cmd-ax">' + Math.round(top * t) + '</text>'; });
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pb) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - pb) + ' Z';
  const lab = labels.map((l, i) => (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) ? '<text x="' + x(i) + '" y="' + (H - 5) + '" text-anchor="middle" class="cmd-ax">' + cmdE(l) + '</text>' : '').join('');
  const last = pts[pts.length - 1];
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cmd-chart" role="img"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".45"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' + g
    + '<path d="' + area + '" fill="url(#' + id + ')"></path><path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"></path>'
    + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="4" fill="' + color + '"></circle><text x="' + Math.min(last[0], W - 14) + '" y="' + (last[1] - 8) + '" text-anchor="end" class="cmd-val">' + cmdN(vals[vals.length - 1]) + '</text>' + lab + '</svg>';
}
function cmdCols(series, labels, colors) {
  // series: [[...],[...]] empilhadas
  const W = 360, H = 130, pl = 28, pr = 8, pt = 10, pb = 20, n = labels.length;
  const totals = labels.map((_, i) => series.reduce((s, a) => s + (a[i] || 0), 0)), mx = Math.max(1, ...totals), top = Math.ceil(mx * 1.15);
  const bw = Math.min(34, (W - pl - pr) / n * .62), step = (W - pl - pr) / n;
  let g = '';
  [0, .5, 1].forEach(t => { const yy = pt + (H - pt - pb) * (1 - t); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" stroke="rgba(255,255,255,.08)"></line><text x="' + (pl - 5) + '" y="' + (yy + 3) + '" text-anchor="end" class="cmd-ax">' + Math.round(top * t) + '</text>'; });
  let bars = '';
  labels.forEach((l, i) => {
    const cx = pl + step * i + step / 2; let acc = 0;
    series.forEach((a, k) => {
      const v = a[i] || 0; if (!v) return;
      const h = (H - pt - pb) * v / top, yy = H - pb - (H - pt - pb) * acc / top - h; acc += v;
      bars += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, h).toFixed(1) + '" rx="3" fill="' + colors[k] + '"></rect>';
    });
    if (totals[i]) bars += '<text x="' + cx + '" y="' + (H - pb - (H - pt - pb) * totals[i] / top - 4) + '" text-anchor="middle" class="cmd-val">' + cmdN(totals[i]) + '</text>';
    bars += '<text x="' + cx + '" y="' + (H - 5) + '" text-anchor="middle" class="cmd-ax">' + cmdE(l) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cmd-chart" role="img">' + g + bars + '</svg>';
}
function cmdBar(pct, color) { return '<div class="cmd-bar"><div style="width:' + Math.max(0, Math.min(100, pct)) + '%;background:' + color + '"></div></div>'; }
function cmdBandColor(n) { return n >= 80 ? CMD_C.green : n >= 60 ? CMD_C.yellow : n >= 40 ? CMD_C.orange : CMD_C.red; }
function cmdBandLabel(n) { return gxBand(n).label; }
function cmdSpark(vals, color) {
  if (!vals || vals.length < 2) return '';
  const W = 90, H = 26, mx = Math.max(1, ...vals), mn = Math.min(...vals), rg = Math.max(1, mx - mn);
  const p = vals.map((v, i) => (i ? 'L' : 'M') + (i * W / (vals.length - 1)).toFixed(1) + ' ' + (H - 3 - (H - 6) * (v - mn) / rg).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="cmd-spark"><path d="' + p + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"></path></svg>';
}

/* ---------- dados ---------- */
async function cmdLoad(force) {
  if (CMD.loading) return; if (!adhSession || !adhProfile || adhProfile.role === 'member') return;
  CMD.loading = true;
  const note = cmdEl('cmdNote'); if (note) note.textContent = 'Carregando dados…';
  try {
    if (!(typeof chapters !== 'undefined' && chapters.length)) { try { await loadChaptersAdmin(); } catch (e) { /* ok */ } }
    const sel = cmdEl('cmdMonth');
    if (sel && !sel.options.length) { mrFillMonthSelect(sel, 12, false); sel.value = mrDefaultMonth(); }
    CMD.month = (sel && sel.value) || mrDefaultMonth();
    const tasks = [];
    tasks.push(gxLoadMeetings(true), gxLoadMandates(true));
    tasks.push(loadMonthly(true));
    tasks.push(adhFetch('/rest/v1/rpc/adh_ranking', { method: 'POST', body: JSON.stringify({ p_month: CMD.month }) }).then(d => { CMD.rank = d; }).catch(() => { CMD.rank = null; }));
    tasks.push(adhFetch('/rest/v1/user_roles?select=user_id,chapter_id&role=eq.member&is_active=eq.true&limit=10000').then(rows => {
      const m = {}; (Array.isArray(rows) ? rows : []).forEach(r => { if (r.chapter_id != null) m[String(r.chapter_id)] = (m[String(r.chapter_id)] || 0) + 1; }); CMD.members = m;
    }).catch(() => { CMD.members = null; }));
    if (!(typeof adhDbEvents !== 'undefined' && adhDbEvents.length)) tasks.push(loadEventsFromSupabase(false).catch(() => { }));
    try { adhEnsureContacts(); } catch (e) { /* ok */ }
    await Promise.all(tasks.map(t => Promise.resolve(t).catch(() => { })));
    CMD.loaded = true; CMD.at = new Date();
  } finally { CMD.loading = false; }
  cmdRender();
  cmdMapSync();
}
function cmdHealthRows() {
  const rk = (CMD.rank && CMD.rank.chapters) || [];
  return cmdActive().map(c => {
    const r = rk.find(x => String(x.chapter_id != null ? x.chapter_id : x.id) === String(c.id)) || null;
    return { c, rk: r, h: gxHealth(c, r) };
  });
}
function cmdWeeks(n) {
  const today = gxToday(), out = [];
  const ids = new Set(cmdScopeChapters().map(c => String(c.id)));
  for (let i = n - 1; i >= 0; i--) {
    const end = gxAddDays(today, -7 * i), start = gxAddDays(end, -6);
    const rows = gxMeet.filter(r => r.held && ids.has(String(r.chapter_id)) && r.meeting_date >= start && r.meeting_date <= end);
    const att = rows.filter(r => r.attendance != null);
    out.push({ label: end.slice(8, 10) + '/' + end.slice(5, 7), n: rows.length, att: att.length ? Math.round(att.reduce((s, r) => s + r.attendance, 0) / att.length) : 0, vis: rows.reduce((s, r) => s + (r.visitors || 0), 0) });
  }
  return out;
}
function cmdMonths(n) {
  const d = new Date(), out = []; const ids = new Set(cmdScopeChapters().map(c => String(c.id)));
  for (let i = n - 1; i >= 0; i--) {
    const k = mrKey(new Date(d.getFullYear(), d.getMonth() - i, 1));
    const rows = (adhMonthly || []).filter(r => String(r.ref_month).slice(0, 10) === k && ids.has(String(r.chapter_id)));
    out.push({ k, label: mrLabel(k).split(' ')[0].slice(0, 3), total: rows.length, appr: rows.filter(r => r.status === 'Aprovado').length,
      events: rows.reduce((s, r) => s + (r.chapter_events || 0) + (r.women_events || 0) + (r.youth_events || 0), 0),
      vis: rows.reduce((s, r) => s + (r.visitors || 0), 0), meet: rows.reduce((s, r) => s + (r.chapter_meetings || 0) + (r.women_meetings || 0) + (r.youth_meetings || 0), 0),
      prison: rows.filter(r => r.prison_ministry_active).length });
  }
  return out;
}
function cmdUpcoming() {
  const ids = new Set(cmdScopeChapters().map(c => String(c.id))), now = Date.now();
  return (typeof adhDbEvents !== 'undefined' ? adhDbEvents : []).filter(e => e.starts_at && new Date(e.starts_at).getTime() >= now && (e.chapter_id == null || ids.has(String(e.chapter_id))))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

/* ---------- desenho ---------- */
function cmdRender() {
  const root = cmdEl('cmdRoot'); if (!root) return;
  root.classList.toggle('cmd-reg', !(CMD.scope === 'state' && !cmdIsRegional()));
  root.classList.toggle('cmd-st', CMD.scope === 'state' && !cmdIsRegional());
  const E = cmdE, act = cmdActive(), all = cmdScopeChapters(), rows = cmdHealthRows();
  const avg = rows.length ? Math.round(rows.reduce((s, x) => s + x.h.score, 0) / rows.length) : null;
  const weeks = cmdWeeks(12), months = cmdMonths(6);
  const last4 = weeks.slice(-4), prev1 = weeks[weeks.length - 1], prev0 = weeks[weeks.length - 2];
  const attVals = last4.map(w => w.att).filter(v => v > 0), attAvg = attVals.length ? Math.round(attVals.reduce((s, v) => s + v, 0) / attVals.length) : null;
  const visSum = last4.reduce((s, w) => s + w.vis, 0);
  const ids = new Set(all.map(c => String(c.id)));
  const memTot = CMD.members ? all.reduce((s, c) => s + (CMD.members[String(c.id)] || 0), 0) : null;
  const repMonth = (adhMonthly || []).filter(r => String(r.ref_month).slice(0, 10) === CMD.month && ids.has(String(r.chapter_id)) && act.some(c => String(c.id) === String(r.chapter_id)));
  const repPct = act.length ? Math.round(repMonth.length / act.length * 100) : 0;
  const mand = gxMandGroups(gxMand.filter(m => m.chapter_id != null && ids.has(String(m.chapter_id)))).map(g => g.i);
  const mExp = mand.filter(x => x.key === 'expired').length, mSoon = mand.filter(x => x.key === 'soon').length;
  const up = cmdUpcoming(), up30 = up.filter(e => new Date(e.starts_at).getTime() <= Date.now() + 30 * 864e5).length;
  const crit = rows.filter(x => x.h.score < 40).length;
  const sts = { a: all.filter(c => c.status === 'Ativo').length, i: all.filter(c => c.status === 'Inativo').length, n: all.filter(c => c.status === 'Em ativação').length, r: all.filter(c => c.status === 'Em reativação').length };

  const scopeName = CMD.scope === 'region' && CMD.regionId ? ('Região ' + ((cmdRegions().find(r => String(r.id) === String(CMD.regionId)) || {}).name || '')) : ADH_UF_NAME;
  cmdEl('cmdScopeTitle').textContent = scopeName;
  cmdEl('cmdNote').textContent = (CMD.at ? 'Atualizado às ' + CMD.at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' : '') + 'mês de referência: ' + mrLabel(CMD.month) + ' (relatório e atividade); reuniões e mandatos de hoje.';

  const tile = (lab, big, sub, color, spark) => '<div class="cmd-kpi"><label>' + lab + '</label><strong style="color:' + (color || '#fff') + '">' + big + '</strong><small>' + sub + '</small>' + (spark || '') + '</div>';
  const dW = prev1 && prev0 ? prev1.n - prev0.n : 0;
  cmdEl('cmdKpis').innerHTML =
    tile('Capítulos ativos', cmdN(sts.a), 'de ' + cmdN(all.length) + ' cadastrados', CMD_C.gold2)
    + tile('Sócios ativos', memTot == null ? '—' : cmdN(memTot), memTot == null ? 'sem acesso à lista' : (sts.a ? '≈ ' + Math.round(memTot / Math.max(1, sts.a)) + ' por capítulo' : ''), '#fff')
    + tile('Nota de saúde média', avg == null ? '—' : avg + '<span class="cmd-of">/100</span>', avg == null ? 'sem dados' : cmdBandLabel(avg), avg == null ? '#fff' : cmdBandColor(avg))
    + tile('Capítulos críticos', cmdN(crit), 'nota abaixo de 40', crit ? CMD_C.red : CMD_C.green)
    + tile('Reuniões (7 dias)', cmdN(prev1 ? prev1.n : 0), (dW > 0 ? '▲ ' : dW < 0 ? '▼ ' : '= ') + Math.abs(dW) + ' vs. semana anterior', '#fff', cmdSpark(weeks.map(w => w.n), CMD_C.gold))
    + tile('Presença média', attAvg == null ? '—' : cmdN(attAvg), 'por reunião, 4 semanas', '#fff', cmdSpark(weeks.map(w => w.att), CMD_C.blue))
    + tile('Visitantes (4 semanas)', cmdN(visSum), 'registrados nas reuniões', '#fff', cmdSpark(weeks.map(w => w.vis), CMD_C.green))
    + tile('Relatórios do mês', repPct + '%', repMonth.length + ' de ' + act.length + ' ativos', repPct >= 80 ? CMD_C.green : repPct >= 50 ? CMD_C.yellow : CMD_C.red)
    + tile('Mandatos', cmdN(mExp + mSoon), mExp + ' vencido(s) · ' + mSoon + ' vencendo', mExp ? CMD_C.red : (mSoon ? CMD_C.yellow : CMD_C.green))
    + tile('Eventos nos próx. 30 dias', cmdN(up30), up.length ? 'próximo: ' + (up[0].title || '') .slice(0, 28) : 'nenhum agendado', '#fff');

  // saúde (donut)
  const bands = [['Saudável', 80, 101, CMD_C.green], ['Atenção', 60, 80, CMD_C.yellow], ['Em risco', 40, 60, CMD_C.orange], ['Crítico', 0, 40, CMD_C.red]];
  const bs = bands.map(b => ({ l: b[0], c: b[3], v: rows.filter(x => x.h.score >= b[1] && x.h.score < b[2]).length }));
  cmdEl('cmdHealth').innerHTML = '<div class="cmd-split">' + cmdDonut(bs, avg == null ? '—' : String(avg), 'saúde média') + cmdLegend(bs) + '</div>'
    + '<p class="cmd-foot">Nota 0–100: relatório 30 · reuniões 30 · mandato 20 · atividade 20.</p>';
  const ss = [{ l: 'Ativos', c: CMD_C.gold, v: sts.a }, { l: 'Em ativação', c: CMD_C.blue, v: sts.n }, { l: 'Em reativação', c: CMD_C.yellow, v: sts.r }, { l: 'Inativos', c: '#5d6b80', v: sts.i }];
  cmdEl('cmdStatus').innerHTML = '<div class="cmd-split">' + cmdDonut(ss, cmdN(all.length), 'capítulos') + cmdLegend(ss) + '</div>';

  // ranking top 8
  const rk = ((CMD.rank && CMD.rank.chapters) || []).filter(x => ids.has(String(x.chapter_id != null ? x.chapter_id : x.id))).slice().sort((a, b) => b.points - a.points).slice(0, 8);
  const mxp = Math.max(1, ...rk.map(x => x.points));
  cmdEl('cmdRank').innerHTML = rk.length ? rk.map((x, i) => '<div class="cmd-rk"><span class="cmd-pos' + (i < 3 ? ' top' : '') + '">' + (i + 1) + 'º</span><div class="cmd-rkm"><div class="cmd-rkt"><b>' + E(x.name) + '</b><em>' + E(x.region_name || '') + '</em></div>' + cmdBar(x.points / mxp * 100, i < 3 ? CMD_C.gold : '#7f95b5') + '</div><strong>' + x.points + '</strong></div>').join('')
    : '<p class="cmd-empty">Sem pontuação neste mês (nenhum relatório aprovado ainda).</p>';

  // comparativo: regiões (estado) ou capítulos (região)
  if (CMD.scope === 'state' && !cmdIsRegional()) {
    const regs = cmdRegions().map(r => {
      const cs = (typeof chapters !== 'undefined' ? chapters : []).filter(c => String(c.region_id) === String(r.id) && c.status === 'Ativo');
      const hs = rows.filter(x => String(x.c.region_id) === String(r.id));
      const sc = hs.length ? Math.round(hs.reduce((s, x) => s + x.h.score, 0) / hs.length) : null;
      const rep = cs.length ? Math.round(cs.filter(c => (adhMonthly || []).some(m => String(m.chapter_id) === String(c.id) && String(m.ref_month).slice(0, 10) === CMD.month)).length / cs.length * 100) : 0;
      const ok = cs.length ? Math.round(cs.filter(c => gxMeetInfo(c).key === 'ok').length / cs.length * 100) : 0;
      const mem = CMD.members ? cs.reduce((s, c) => s + (CMD.members[String(c.id)] || 0), 0) : null;
      return { r, n: cs.length, sc, rep, ok, mem };
    }).filter(x => x.n > 0).sort((a, b) => (b.sc == null ? -1 : b.sc) - (a.sc == null ? -1 : a.sc));
    cmdEl('cmdCompareTitle').textContent = 'Regiões comparadas';
    cmdEl('cmdCompare').innerHTML = '<div class="tablewrap"><table class="cmd-tb"><thead><tr><th>Região</th><th>Cap.</th><th>Sócios</th><th>Saúde</th><th>Relatório</th><th>Reunião em dia</th></tr></thead><tbody>'
      + regs.map(x => '<tr class="cmd-click" onclick="cmdPickRegion(\'' + x.r.id + '\')"><td><b>' + E(x.r.name) + '</b></td><td>' + x.n + '</td><td>' + cmdN(x.mem) + '</td><td>' + (x.sc == null ? '—' : '<span class="cmd-pill" style="color:' + cmdBandColor(x.sc) + ';border-color:' + cmdBandColor(x.sc) + '">' + x.sc + '</span>') + '</td><td>' + x.rep + '%' + cmdBar(x.rep, x.rep >= 80 ? CMD_C.green : x.rep >= 50 ? CMD_C.yellow : CMD_C.red) + '</td><td>' + x.ok + '%' + cmdBar(x.ok, x.ok >= 80 ? CMD_C.green : x.ok >= 50 ? CMD_C.yellow : CMD_C.red) + '</td></tr>').join('')
      + '</tbody></table></div><p class="cmd-foot">Clique em uma região para abrir a visão regional.</p>';
  } else {
    cmdEl('cmdCompareTitle').textContent = 'Capítulos da região';
    // ranking embutido: posição e pontos do mês na própria tabela da região
    const rkAll = ((CMD.rank && CMD.rank.chapters) || []).filter(x => ids.has(String(x.chapter_id != null ? x.chapter_id : x.id))).slice().sort((a, b) => b.points - a.points);
    const rkMap = new Map(rkAll.map((x, i) => [String(x.chapter_id != null ? x.chapter_id : x.id), { pos: i + 1, pts: x.points }]));
    const sorted = rows.slice().sort((a, b) => ((rkMap.get(String(b.c.id)) || { pts: -1 }).pts - (rkMap.get(String(a.c.id)) || { pts: -1 }).pts) || (b.h.score - a.h.score));
    const rkCell = c => { const r = rkMap.get(String(c.id)); return r ? '<span class="cmd-rkpos' + (r.pos <= 3 ? ' top' : '') + '">' + r.pos + 'º</span><em>' + cmdN(r.pts) + ' pts</em>' : '<em>—</em>'; };
    cmdEl('cmdCompare').innerHTML = '<div class="tablewrap"><table class="cmd-tb"><thead><tr><th>Ranking</th><th>Capítulo</th><th>Presidente</th><th>Saúde</th><th>Reunião</th><th>Relatório</th><th>Mandato</th><th>Sócios</th></tr></thead><tbody>'
      + sorted.map(x => { const mi = gxMeetInfo(x.c), p = x.h.parts; return '<tr class="cmd-click" onclick="gxChapterTimeline(\'' + x.c.id + '\')"><td class="cmd-rkcell">' + rkCell(x.c) + '</td><td><b>' + E(x.c.name) + '</b><em>' + E(x.c.city || '') + '</em></td><td class="cmd-pres">' + E(x.c.president || '—') + '</td><td><span class="cmd-pill" style="color:' + cmdBandColor(x.h.score) + ';border-color:' + cmdBandColor(x.h.score) + '">' + x.h.score + '</span></td><td>' + E(p[1][3]) + '</td><td>' + E(p[0][3]) + '</td><td>' + E(p[2][3]) + '</td><td>' + (CMD.members ? cmdN(CMD.members[String(x.c.id)] || 0) : '—') + '</td></tr>'; }).join('')
      + '</tbody></table></div><p class="cmd-foot">Ordenado pelo ranking do mês. Clique em um capítulo para ver o histórico.</p>';
  }

  // alertas
  const al = [];
  rows.filter(x => x.h.score < 60).sort((a, b) => a.h.score - b.h.score).slice(0, 6).forEach(x => {
    const weak = x.h.parts.filter(p => p[1] < p[2] * .5).map(p => p[0].toLowerCase()).join(', ');
    al.push({ k: x.h.score < 40 ? 'r' : 'o', t: '<b>' + E(x.c.name) + '</b> — saúde ' + x.h.score + (weak ? ', fraco em ' + E(weak) : ''), c: x.c });
  });
  gxMandGroups(gxMand.filter(m => m.chapter_id != null && ids.has(String(m.chapter_id)))).filter(x => x.i.key !== 'ok').sort((a, b) => a.i.left - b.i.left).slice(0, 4).forEach(x => {
    al.push({ k: x.i.key === 'expired' ? 'r' : 'y', t: (x.n > 1 ? 'Mandato da <b>diretoria</b> (' + x.n + ' cargos, ' + E(gxMandScopeName(x.m)) + ')' : 'Mandato de <b>' + E(x.m.person_name) + '</b> (' + E(gxMandScopeName(x.m)) + ')') + ' — ' + E(x.i.label.toLowerCase()) });
  });
  const semRel = act.filter(c => !(adhMonthly || []).some(m => String(m.chapter_id) === String(c.id) && String(m.ref_month).slice(0, 10) === CMD.month));
  if (semRel.length) al.push({ k: 'y', t: '<b>' + semRel.length + '</b> capítulo(s) ativo(s) sem relatório de ' + E(mrLabel(CMD.month).toLowerCase()) + ': ' + E(semRel.slice(0, 4).map(c => c.name).join(', ')) + (semRel.length > 4 ? '…' : '') });
  const semReu = act.filter(c => gxMeetInfo(c).key === 'late').length;
  if (semReu) al.push({ k: 'o', t: '<b>' + semReu + '</b> capítulo(s) com reunião atrasada (acima do limite da frequência).' });
  cmdEl('cmdAlerts').innerHTML = al.length ? al.slice(0, 10).map(a => '<div class="cmd-al ' + a.k + '"><i></i><span>' + a.t + '</span></div>').join('') : '<p class="cmd-empty">Nada crítico agora. 👏</p>';

  // tendências
  cmdEl('cmdWeekMeet').innerHTML = cmdArea(weeks.map(w => w.n), weeks.map(w => w.label), CMD_C.gold);
  cmdEl('cmdWeekAtt').innerHTML = cmdArea(weeks.map(w => w.att), weeks.map(w => w.label), CMD_C.blue);
  cmdEl('cmdMonRep').innerHTML = cmdCols([months.map(m => m.appr), months.map(m => m.total - m.appr)], months.map(m => m.label), [CMD_C.gold, '#5d6b80'])
    + '<div class="cmd-key"><i style="background:' + CMD_C.gold + '"></i>aprovados<i style="background:#5d6b80"></i>em análise/outros</div>';
  cmdEl('cmdMonEv').innerHTML = cmdCols([months.map(m => m.events)], months.map(m => m.label), [CMD_C.green])
    + '<div class="cmd-key"><i style="background:' + CMD_C.green + '"></i>eventos informados nos relatórios</div>';
  cmdEl('cmdMonVis').innerHTML = cmdCols([months.map(m => m.vis)], months.map(m => m.label), [CMD_C.blue])
    + '<div class="cmd-key"><i style="background:' + CMD_C.blue + '"></i>visitantes nos relatórios mensais</div>';
  cmdEl('cmdMonPrison').innerHTML = cmdCols([months.map(m => m.prison)], months.map(m => m.label), [CMD_C.yellow])
    + '<div class="cmd-key"><i style="background:' + CMD_C.yellow + '"></i>capítulos com Ministério de Prisões ativo</div>';

  // eventos próximos
  cmdEvSlides(up);
  cmdFit();
}

/* ---------- controles ---------- */
function cmdSetScope(s) {
  if (s === 'state' && cmdIsRegional()) return;
  CMD.scope = s;
  const regs = cmdRegions();
  if (s === 'region') { if (!CMD.regionId && regs.length) CMD.regionId = String(regs[0].id); }
  else CMD.regionId = '';
  cmdSyncControls(); cmdRender(); cmdMapSync();
}
function cmdPickRegion(id) { CMD.scope = 'region'; CMD.regionId = String(id); cmdSyncControls(); cmdRender(); cmdMapSync(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function cmdSyncControls() {
  const reg = cmdEl('cmdRegionSel'), regs = cmdRegions();
  if (reg) {
    reg.innerHTML = regs.slice().sort(gxSortName).map(r => '<option value="' + cmdE(r.id) + '">' + cmdE(r.name) + '</option>').join('');
    reg.value = CMD.regionId || (regs[0] ? String(regs[0].id) : ''); reg.hidden = CMD.scope !== 'region';
  }
  const bs = cmdEl('cmdBtnState'), br = cmdEl('cmdBtnRegion');
  if (bs) { bs.setAttribute('aria-pressed', CMD.scope === 'state'); bs.hidden = cmdIsRegional(); }
  if (br) br.setAttribute('aria-pressed', CMD.scope === 'region');
}
function cmdRegionChanged() { CMD.regionId = cmdEl('cmdRegionSel').value; cmdRender(); cmdMapSync(); }
function cmdMapSync() {
  try {
    if (!window.AdhMap || !adhSession) return;
    const run = () => {
      const m = AdhMap.cmd; if (!m || !m.goRegionName) return;
      if (CMD.scope === 'region' && CMD.regionId) { const r = cmdRegions().find(x => String(x.id) === String(CMD.regionId)); if (r) m.goRegionName(r.name); }
      else if (m.reset) m.reset();
    };
    if (!AdhMap.cmd) { const p = AdhMap.initCmd(); if (p && p.then) p.then(run).catch(() => { }); } else run();
  } catch (e) { console.warn('cmd mapa', e); }
}
function cmdFull() {
  const el = cmdEl('page-central'); if (!el) return;
  try { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => { }); } catch (e) { /* ok */ }
}
function cmdOpen() {
  const role = cmdRole(); if (!role) return;
  if (cmdIsRegional()) { CMD.scope = 'region'; const r = cmdRegions(); if (!CMD.regionId && r.length) CMD.regionId = String(r[0].id); }
  cmdSyncControls();
  cmdLoad();
  clearInterval(CMD.timer);
  CMD.timer = setInterval(() => { const p = cmdEl('page-central'); if (p && p.classList.contains('on') && !document.hidden) cmdLoad(true); }, 5 * 60 * 1000);
}
document.addEventListener('fullscreenchange', () => { const p = cmdEl('page-central'); if (p) p.classList.toggle('cmd-fs', document.fullscreenElement === p); });

/* ---------- permissão da página ---------- */
(function () {
  const _rp = rolePermissions;
  rolePermissions = function (r) {
    const p = _rp(r); const role = cmdRole();
    if (['state_admin', 'state_director', 'regional_director'].includes(role) && !p.pages.includes('central')) p.pages = p.pages.concat(['central']);
    return p;
  };
})();


/* ---------- Próximos eventos: apresentação com os banners (claude v1.9) ---------- */
function cmdEvSlides(up) {
  const el = cmdEl('cmdEvents'); if (!el) return;
  clearInterval(CMD.slideTimer); CMD.slideTimer = null;
  if (!up.length) { el.innerHTML = '<p class="cmd-empty">Nenhum evento futuro cadastrado.</p>'; return; }
  const list = up.slice(0, 8), E = cmdE;
  el.innerHTML = '<div class="cmd-slides">' + list.map((e, i) => {
    const d = new Date(e.starts_at), c = gxChapById(e.chapter_id), img = e.image_url || e.image_data || '';
    const when = String(d.getDate()).padStart(2, '0') + ' ' + GX_MONTHS[d.getMonth()].slice(0, 3).toLowerCase() + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return '<div class="cmd-slide' + (i === 0 ? ' on' : '') + (img ? '' : ' noimg') + '">' + (img ? '<img src="' + E(img) + '" alt="" loading="lazy" decoding="async">' : '<div class="cmd-slide-date"><b>' + String(d.getDate()).padStart(2, '0') + '</b><span>' + GX_MONTHS[d.getMonth()].slice(0, 3) + '</span></div>')
      + '<div class="cmd-slide-cap"><b>' + E(e.title || 'Evento') + '</b><em>' + E((c ? c.name + ' · ' : '') + when) + '</em></div></div>';
  }).join('') + (list.length > 1 ? '<div class="cmd-dots">' + list.map((_, i) => '<i' + (i === 0 ? ' class="on"' : '') + '></i>').join('') + '</div>' : '') + '</div>';
  if (list.length > 1) {
    let k = 0;
    CMD.slideTimer = setInterval(() => {
      const sl = el.querySelectorAll('.cmd-slide'), dt = el.querySelectorAll('.cmd-dots i'); if (!sl.length) { clearInterval(CMD.slideTimer); return; }
      sl[k].classList.remove('on'); dt[k] && dt[k].classList.remove('on'); k = (k + 1) % sl.length; sl[k].classList.add('on'); dt[k] && dt[k].classList.add('on');
    }, 6000);
  }
}

/* ---------- ajusta a Central à altura da tela (visões compactas) ---------- */
function cmdFit() {
  const root = cmdEl('cmdRoot'); if (!root) return;
  const compact = root.classList.contains('cmd-reg') || root.classList.contains('cmd-st');
  if (!compact || innerWidth < 1100 || !root.offsetParent) { root.style.height = ''; return; }
  const fs = !!document.fullscreenElement;
  const top = fs ? 14 : root.getBoundingClientRect().top + (window.pageYOffset || 0);
  root.style.height = Math.max(640, innerHeight - top - (fs ? 14 : 12)) + 'px';
}
addEventListener('resize', () => { clearTimeout(CMD.fitT); CMD.fitT = setTimeout(cmdFit, 120); });
document.addEventListener('fullscreenchange', () => setTimeout(cmdFit, 60));
