/* ADHONEP-SC claude v1.1 · gestão: agenda, reuniões, mandatos, histórico do capítulo, alertas e modo beta.
   Carrega depois de app.js e supabase.js. Tudo aqui usa o prefixo "gx" para não conflitar com o resto. */
window.ADH_VER_GX = '1.9';

/* ---------- modo beta (site rodando dentro da pasta /beta) ---------- */
window.ADH_BETA = /\/beta(\/|$)/i.test(location.pathname);
(function () {
  if (!window.ADH_BETA) return;
  try {
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m);
    document.title = '[TESTE] ' + document.title;
    document.documentElement.classList.add('gx-is-beta');
    const r = document.createElement('div'); r.id = 'gxBetaRibbon'; r.setAttribute('role', 'status');
    r.textContent = 'VERSÃO DE TESTE (beta) — os dados são os mesmos do site oficial. Use nomes com "TESTE —" e apague depois.';
    document.addEventListener('DOMContentLoaded', () => document.body.insertBefore(r, document.body.firstChild));
  } catch (e) { /* sem problema */ }
})();

/* ---------- utilidades ---------- */
const GX_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function gxEl(id) { return document.getElementById(id); }
function gxRole() { return (typeof adhProfile !== 'undefined' && adhProfile) ? adhProfile.role : null; }
function gxIsState() { const r = gxRole(); return r === 'state_admin' || r === 'state_director'; }
function gxIsManager() { const r = gxRole(); return r === 'state_admin' || r === 'state_director' || r === 'regional_director'; }
function gxToday() { return adhLocalDateISO(); }
function gxDays(fromISO, toISO) { const a = new Date(fromISO + 'T12:00:00'), b = new Date(toISO + 'T12:00:00'); return Math.round((b - a) / 864e5); }
function gxAddDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return adhLocalDateISO(d); }
function gxFmtDate(iso) { if (!iso) return '—'; const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
function gxChapNum(c) { return c && c.chapter_number != null ? String(c.chapter_number).padStart(3, '0') : ''; }
function gxChapLabel(c) { return c ? ((gxChapNum(c) ? gxChapNum(c) + ' — ' : '') + c.name) : ''; }
function gxChapById(id) { return (typeof chapters !== 'undefined' ? chapters : []).find(c => String(c.id) === String(id)); }
function gxActiveChapters() { return (typeof chapters !== 'undefined' ? chapters : []).filter(c => c.status === 'Ativo'); }
function gxSortName(a, b) { return String(a.name).localeCompare(String(b.name), 'pt-BR'); }
function gxCan(kind) { try { return rolePermissions(currentRole).edit.includes(kind); } catch (e) { return false; } }
/* data e hora locais de um evento (usa o horário completo gravado no banco; evita erro de fuso) */
function gxEvWhen(e) {
  const raw = (typeof adhDbEvents !== 'undefined' ? adhDbEvents : []).find(x => String(x.id) === String(e.id));
  if (raw && raw.starts_at) {
    const d = new Date(raw.starts_at);
    if (!isNaN(d)) return { date: adhLocalDateISO(d), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
  }
  return { date: e.date || '', time: '' };
}

/* ---------- permissões: páginas novas ---------- */
(function () {
  const _rp = rolePermissions;
  rolePermissions = function (r) {
    let p = _rp(r);
    const role = gxRole();
    if (!role) return p;
    const pages = p.pages.slice(), edit = p.edit.slice();
    const addPage = x => { if (!pages.includes(x)) pages.push(x); };
    const addEdit = x => { if (!edit.includes(x)) edit.push(x); };
    if (pages.includes('events')) addPage('calendar');
    if (['state_admin', 'state_director', 'regional_director', 'chapter_president'].includes(role)) { addPage('meetings'); addPage('mandates'); }
    if (['state_admin', 'state_director', 'chapter_president'].includes(role)) addEdit('meeting');
    if (['state_admin', 'state_director', 'regional_director'].includes(role)) addEdit('mandate');
    if (['state_admin', 'state_director', 'regional_director', 'chapter_president'].includes(role)) addEdit('board');
    return { pages, edit };
  };
})();

/* ---------- dados ---------- */
let gxRankAtt = null;
let gxMeet = [], gxFreq = {}, gxMand = [], gxLoaded = { meet: false, mand: false };
async function gxLoadMeetings(quiet) {
  if (!adhSession) return;
  try {
    const since = gxAddDays(gxToday(), -200);
    const [rows, info] = await Promise.all([
      adhFetch('/rest/v1/chapter_meeting_log?select=id,chapter_id,meeting_date,held,attendance,visitors,notes&meeting_date=gte.' + since + '&order=meeting_date.desc&limit=5000'),
      adhFetch('/rest/v1/chapter_public_info?select=chapter_id,frequency,meeting_day,meeting_time&limit=2000').catch(() => [])
    ]);
    gxMeet = Array.isArray(rows) ? rows : [];
    gxFreq = {}; (Array.isArray(info) ? info : []).forEach(x => { gxFreq[String(x.chapter_id)] = x; });
    gxLoaded.meet = true;
  } catch (e) {
    gxLoaded.meet = false;
    if (!quiet) toast('Não foi possível carregar as reuniões: ' + (/relation|does not exist|42P01|schema cache/i.test(e.message) ? 'rode o SQL da v1.1 (migracao-v1.1-gestao.sql).' : e.message));
  }
  try { gxRender(); adhRenderAttention(); } catch (e) { /* ok */ }
}
async function gxLoadMandates(quiet) {
  if (!adhSession) return;
  try {
    const rows = await adhFetch('/rest/v1/leader_mandates?select=*&order=end_date.asc&limit=3000');
    gxMand = Array.isArray(rows) ? rows : []; gxLoaded.mand = true;
  } catch (e) {
    gxLoaded.mand = false;
    if (!quiet) toast('Não foi possível carregar os mandatos: ' + (/relation|does not exist|42P01|schema cache/i.test(e.message) ? 'rode o SQL da v1.1 (migracao-v1.1-gestao.sql).' : e.message));
  }
  try { gxRender(); adhRenderAttention(); } catch (e) { /* ok */ }
}
async function gxLoadRankAtt() {
  if (!adhSession || !gxIsManager()) return;
  try {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    gxRankAtt = await adhFetch('/rest/v1/rpc/adh_ranking', { method: 'POST', body: JSON.stringify({ p_month: mrKey(d) }) });
  } catch (e) { gxRankAtt = null; }
  try { adhRenderAttention(); } catch (e) { /* ok */ }
}
(function () {
  const ap = adhApplyProfile;
  adhApplyProfile = function (p) {
    const r = ap.apply(this, arguments);
    if (p && p.role !== 'member') setTimeout(() => { gxLoadMeetings(true); gxLoadMandates(true); gxLoadRankAtt(); }, 1600);
    return r;
  };
  const ra = renderAll;
  renderAll = function () { const r = ra.apply(this, arguments); try { gxRender(); } catch (e) { console.warn('gx', e); } return r; };
})();
function gxRender() {
  const on = id => { const el = gxEl(id); return el && el.classList.contains('on'); };
  if (on('page-calendar')) gxRenderCalendar();
  if (on('page-meetings')) gxRenderMeetings();
  if (on('page-mandates')) gxRenderMandates();
  if (on('page-ranking')) gxRenderHealth();
}

/* ==================================================================
   AGENDA (calendário do mês)
   ================================================================== */
const gxCal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: null };
function gxCalEvents() {
  const chap = (gxEl('gxCalChapter') || {}).value || '';
  return (typeof events !== 'undefined' ? events : []).filter(e => adhEventVisible(e) && e.status !== 'Cancelado' && (!chap || String(e.chapter_id) === chap))
    .map(e => ({ e, w: gxEvWhen(e) })).filter(x => x.w.date);
}
function gxCalMandates() {
  const chap = (gxEl('gxCalChapter') || {}).value || '';
  return gxMand.filter(m => m.end_date && (!chap || String(m.chapter_id) === chap));
}
function gxCalNav(d) {
  if (d === 0) { gxCal.y = new Date().getFullYear(); gxCal.m = new Date().getMonth(); }
  else { gxCal.m += d; if (gxCal.m < 0) { gxCal.m = 11; gxCal.y--; } if (gxCal.m > 11) { gxCal.m = 0; gxCal.y++; } }
  gxCal.sel = null; gxRenderCalendar();
}
function gxCalPick(iso) { gxCal.sel = (gxCal.sel === iso ? null : iso); gxRenderCalendar(); }
function gxRenderCalendar() {
  const grid = gxEl('gxCalGrid'); if (!grid) return;
  const sel = gxEl('gxCalChapter');
  if (sel && !sel.dataset.ready) {
    const list = (typeof chapters !== 'undefined' ? chapters : []).slice().sort(gxSortName);
    if (list.length) { sel.innerHTML = '<option value="">Todos os capítulos</option>' + list.map(c => '<option value="' + esc(c.id) + '">' + esc(gxChapLabel(c)) + '</option>').join(''); sel.dataset.ready = '1'; }
  }
  const y = gxCal.y, m = gxCal.m, today = gxToday();
  gxEl('gxCalTitle').textContent = GX_MONTHS[m].charAt(0).toUpperCase() + GX_MONTHS[m].slice(1) + ' de ' + y;
  const evs = gxCalEvents(), mans = gxCalMandates();
  const byDay = {};
  evs.forEach(x => { (byDay[x.w.date] = byDay[x.w.date] || []).push({ k: 'ev', x }); });
  mans.forEach(mn => { (byDay[mn.end_date] = byDay[mn.end_date] || []).push({ k: 'mn', mn }); });
  const first = new Date(y, m, 1), startOffset = first.getDay(), dim = new Date(y, m + 1, 0).getDate();
  let h = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => '<div class="gx-dow">' + d + '</div>').join('');
  for (let i = 0; i < startOffset; i++) h += '<div class="gx-day gx-empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const iso = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), items = byDay[iso] || [];
    const pills = items.slice(0, 2).map(it => it.k === 'ev'
      ? '<span class="gx-pill ' + (it.x.e.status === 'Realizado' ? 'done' : '') + '">' + esc(it.x.e.name) + '</span>'
      : '<span class="gx-pill mand">⏳ ' + esc(it.mn.person_name) + '</span>').join('');
    const more = items.length > 2 ? '<span class="gx-more">+' + (items.length - 2) + '</span>' : '';
    const dots = items.length ? '<span class="gx-dots">' + '●'.repeat(Math.min(items.length, 3)) + '</span>' : '';
    h += '<button type="button" class="gx-day' + (iso === today ? ' today' : '') + (iso === gxCal.sel ? ' sel' : '') + (items.length ? ' has' : '') + '" onclick="gxCalPick(\'' + iso + '\')"><span class="gx-n">' + d + '</span>' + pills + more + dots + '</button>';
  }
  grid.innerHTML = h;
  const monthPrefix = y + '-' + String(m + 1).padStart(2, '0');
  const listItems = Object.keys(byDay).filter(k => gxCal.sel ? k === gxCal.sel : k.startsWith(monthPrefix)).sort();
  gxEl('gxCalListTitle').textContent = gxCal.sel ? 'Dia ' + gxFmtDate(gxCal.sel) : 'Neste mês';
  let l = '';
  listItems.forEach(k => {
    byDay[k].forEach(it => {
      if (it.k === 'ev') {
        const e = it.x.e, w = it.x.w, ch = gxChapById(e.chapter_id);
        l += '<div class="detail gx-item"><div><strong>' + esc(e.name) + '</strong><div class="meta">' + gxFmtDate(w.date) + (w.time ? ' às ' + esc(w.time) : '') + ' · ' + esc(e.chapter || (ch && ch.name) || '') + (e.city ? ' · ' + esc(e.city) : '') + ' · ' + esc(e.status) + '</div></div><div class="actions">' +
          (gxCan('event') ? '<button class="btn small" onclick="openEvent(' + (typeof e.id === 'number' ? e.id : JSON.stringify(String(e.id))) + ')">Editar</button>' : '') +
          '<button class="btn small" onclick="gxScriptOpen(' + JSON.stringify(String(e.id)) + ')">Roteiro</button>' +
          '<button class="btn small" onclick="adhInviteEvent(' + (typeof e.id === 'number' ? e.id : JSON.stringify(String(e.id))) + ')">Convidar</button></div></div>';
      } else {
        const mn = it.mn, ch = gxChapById(mn.chapter_id), left = gxDays(today, mn.end_date);
        l += '<div class="detail gx-item"><div><strong>⏳ Fim de mandato — ' + esc(mn.person_name) + '</strong><div class="meta">' + esc(mn.role_label) + (ch ? ' · ' + esc(ch.name) : '') + ' · ' + gxFmtDate(mn.end_date) + ' (' + (left >= 0 ? 'em ' + left + ' dia(s)' : 'venceu há ' + (-left) + ' dia(s)') + ')</div></div></div>';
      }
    });
  });
  gxEl('gxCalList').innerHTML = l || '<p class="sub">Nenhum evento ' + (gxCal.sel ? 'neste dia' : 'neste mês') + '.</p>';
}

/* ==================================================================
   REUNIÕES (registro semanal + alerta de 3 semanas)
   ================================================================== */
function gxMeetLimit(cid) {
  const f = String((gxFreq[String(cid)] || {}).frequency || '').toLowerCase();
  if (/mensal/.test(f)) return 45;
  if (/quinzen/.test(f)) return 30;
  return 21;
}
function gxMeetInfo(c) {
  const today = gxToday(), rows = gxMeet.filter(r => String(r.chapter_id) === String(c.id));
  const held = rows.filter(r => r.held);
  const last = held.length ? held[0].meeting_date : null;
  const limit = gxMeetLimit(c.id);
  const cutoff = gxAddDays(today, -56), recent = held.filter(r => r.meeting_date >= cutoff);
  const att = recent.filter(r => r.attendance != null);
  const avg = att.length ? Math.round(att.reduce((s, r) => s + r.attendance, 0) / att.length) : null;
  let key = 'none', days = null;
  if (last) { days = gxDays(last, today); key = days <= limit - 7 ? 'ok' : days <= limit ? 'warn' : 'late'; }
  return { key, last, days, limit, count: recent.length, avg, any: rows.length > 0, rows };
}
const GX_MEET_LABEL = { ok: ['Em dia', 'active'], warn: ['Atenção', 'activation'], late: ['Atrasado', 'inactive'], none: ['Sem registro', 'reactivation'] };
function gxMeetChapters() { return gxActiveChapters().slice().sort(gxSortName); }
function gxRenderMeetings() {
  const body = gxEl('gxMeetRows'); if (!body) return;
  const note = gxEl('gxMeetNote');
  if (!gxLoaded.meet) { body.innerHTML = '<tr><td colspan="7" class="empty">Carregando…</td></tr>'; return; }
  const q = slug((gxEl('gxMeetSearch') || {}).value || ''), st = (gxEl('gxMeetStatus') || {}).value || '';
  const all = gxMeetChapters().map(c => ({ c, i: gxMeetInfo(c) }));
  const cnt = { ok: 0, warn: 0, late: 0, none: 0 };
  all.forEach(x => cnt[x.i.key]++);
  gxEl('gxMeetMetrics').innerHTML = [['Capítulos ativos', all.length, 'no seu escopo'], ['Em dia', cnt.ok, 'reunião registrada recentemente'], ['Atenção', cnt.warn, 'perto do limite'], ['Atrasados', cnt.late, 'passou do limite (3 semanas para capítulos semanais)'], ['Sem registro', cnt.none, 'ainda não usam o registro']].map(m => '<div class="metric"><label>' + m[0] + '</label><strong>' + m[1] + '</strong><small>' + m[2] + '</small></div>').join('');
  const arr = all.filter(x => (!q || slug(x.c.name + ' ' + x.c.city + ' ' + x.c.region).includes(q)) && (!st || x.i.key === st))
    .sort((a, b) => ({ late: 0, warn: 1, none: 2, ok: 3 }[a.i.key] - { late: 0, warn: 1, none: 2, ok: 3 }[b.i.key]) || gxSortName(a.c, b.c));
  const canW = gxCan('meeting');
  body.innerHTML = arr.map(x => {
    const lb = GX_MEET_LABEL[x.i.key];
    return '<tr><td><strong>' + esc(gxChapLabel(x.c)) + '</strong><div class="meta">' + esc(x.c.city) + '</div></td><td>' + esc(x.c.region) + '</td><td>' + (x.i.last ? gxFmtDate(x.i.last) : '—') + '</td><td>' + (x.i.days != null ? x.i.days + ' dia(s)' : '—') + '</td><td>' + x.i.count + ' <span class="meta">em 8 semanas</span>' + (x.i.avg != null ? '<div class="meta">média ' + x.i.avg + ' presentes</div>' : '') + '</td><td><span class="tag ' + lb[1] + '">' + lb[0] + '</span><div class="meta">limite ' + x.i.limit + ' dias</div></td><td><div class="actions"><button class="btn small" onclick="gxMeetDetail(' + Number(x.c.id) + ')">Ver</button>' + (canW ? '<button class="btn small primary" onclick="gxMeetForm(' + Number(x.c.id) + ')">Registrar</button>' : '') + '</div></td></tr>';
  }).join('') || '<tr><td colspan="7" class="empty">Nenhum capítulo para os filtros selecionados.</td></tr>';
  if (note) note.textContent = 'O alerta considera 3 semanas sem reunião para capítulos semanais; se a página pública do capítulo disser "quinzenal" ou "mensal", o limite sobe (30 e 45 dias). "Sem registro" significa que o capítulo ainda não começou a usar o registro.';
  const nb = gxEl('gxMeetNew'); if (nb) nb.hidden = !canW;
}
function gxMeetChoices() {
  if (gxRole() === 'chapter_president') return adhMyChapters().slice().sort(gxSortName);
  return gxMeetChapters();
}
function gxMeetForm(cid, date) {
  if (!gxCan('meeting')) { toast('Seu perfil não registra reuniões.'); return; }
  const f = gxEl('gxMeetForm'); f.reset();
  const list = gxMeetChoices();
  f.elements.chapter_id.innerHTML = list.map(c => '<option value="' + esc(c.id) + '">' + esc(gxChapLabel(c)) + '</option>').join('');
  if (cid) f.elements.chapter_id.value = String(cid);
  f.elements.meeting_date.max = gxToday(); f.elements.meeting_date.value = date || gxToday();
  f.elements.held.value = 'yes'; gxMeetHeld();
  gxEl('gxMeetMsg').textContent = 'Registre a reunião da semana. Se não houve reunião, marque "Não houve" para o sistema saber que foi proposital.';
  gxEl('gxMeetModal').classList.add('open');
}
function gxMeetHeld() { const f = gxEl('gxMeetForm'), no = f.elements.held.value === 'no'; ['attendance', 'visitors'].forEach(k => { f.elements[k].disabled = no; if (no) f.elements[k].value = ''; }); }
async function gxMeetSave(ev) {
  ev.preventDefault();
  const f = ev.target, msg = gxEl('gxMeetMsg'), btn = gxEl('gxMeetSubmit');
  const num = k => { const v = f.elements[k].value; return v === '' ? null : Math.max(0, Math.min(5000, parseInt(v, 10) || 0)); };
  const date = f.elements.meeting_date.value;
  if (!date) { msg.textContent = 'Escolha a data da reunião.'; return; }
  if (date > gxToday()) { msg.textContent = 'A data não pode estar no futuro.'; return; }
  const held = f.elements.held.value === 'yes';
  btn.disabled = true; msg.textContent = 'Salvando…';
  try {
    await adhFetch('/rest/v1/chapter_meeting_log?on_conflict=chapter_id,meeting_date', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ chapter_id: Number(f.elements.chapter_id.value), meeting_date: date, held, attendance: held ? num('attendance') : null, visitors: held ? num('visitors') : null, notes: (f.elements.notes.value || '').trim().slice(0, 500) || null }) });
    closeModal('gxMeetModal'); toast(held ? 'Reunião registrada.' : 'Registrado: não houve reunião.');
    await gxLoadMeetings(true);
    if (gxEl('gxMeetDetail').classList.contains('open')) gxMeetDetail(Number(f.elements.chapter_id.value));
  } catch (e) {
    msg.textContent = 'Não foi possível salvar: ' + (/row-level|permission|42501/i.test(e.message) ? 'sem permissão para este capítulo.' : /relation|42P01/i.test(e.message) ? 'rode o SQL da v1.1 (migracao-v1.1-gestao.sql).' : e.message);
  } finally { btn.disabled = false; }
}
function gxMeetDetail(cid) {
  const c = gxChapById(cid); if (!c) return;
  const i = gxMeetInfo(c), lb = GX_MEET_LABEL[i.key], canW = gxCan('meeting');
  gxEl('gxMeetDetailTitle').textContent = gxChapLabel(c);
  gxEl('gxMeetDetailBody').innerHTML = '<p class="sub"><span class="tag ' + lb[1] + '">' + lb[0] + '</span> ' + (i.last ? 'Última reunião: ' + gxFmtDate(i.last) + ' (há ' + i.days + ' dia(s)).' : 'Ainda sem reuniões registradas.') + ' Reuniões nas últimas 8 semanas: <strong>' + i.count + '</strong>' + (i.avg != null ? ' · média de ' + i.avg + ' presentes' : '') + '.</p>' +
    (i.rows.length ? '<div class="tablewrap"><table><thead><tr><th>Data</th><th>Situação</th><th>Presentes</th><th>Visitantes</th><th>Obs.</th>' + (canW ? '<th></th>' : '') + '</tr></thead><tbody>' + i.rows.slice(0, 40).map(r => '<tr><td>' + gxFmtDate(r.meeting_date) + '</td><td>' + (r.held ? '<span class="tag active">Houve</span>' : '<span class="tag inactive">Não houve</span>') + '</td><td>' + (r.attendance != null ? r.attendance : '—') + '</td><td>' + (r.visitors != null ? r.visitors : '—') + '</td><td>' + esc(r.notes || '') + '</td>' + (canW ? '<td><button class="btn small" onclick="gxMeetDelete(' + Number(r.id) + ',' + Number(c.id) + ')">Apagar</button></td>' : '') + '</tr>').join('') + '</tbody></table></div>' : '') +
    (canW ? '<div class="actions" style="margin-top:12px"><button class="btn primary" onclick="gxMeetForm(' + Number(c.id) + ')">+ Registrar reunião</button></div>' : '');
  gxEl('gxMeetDetail').classList.add('open');
}
async function gxMeetDelete(id, cid) {
  if (!(await adhDialog({ title: 'Apagar este registro?', message: 'O registro dessa reunião será removido.', confirmLabel: 'Apagar' }))) return;
  try { await adhFetch('/rest/v1/chapter_meeting_log?id=eq.' + Number(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); toast('Registro apagado.'); await gxLoadMeetings(true); gxMeetDetail(cid); }
  catch (e) { toast('Não foi possível apagar: ' + e.message); }
}

/* ==================================================================
   MANDATOS
   ================================================================== */
const GX_ROLES = ['Presidente do capítulo', 'Vice-presidente do capítulo', 'Diretor regional', 'Diretor estadual'];
function gxMandInfo(m) {
  const left = gxDays(gxToday(), m.end_date);
  if (left < 0) return { key: 'expired', left, label: 'Vencido há ' + (-left) + ' dia(s)', cls: 'inactive' };
  if (left <= 60) return { key: 'soon', left, label: 'Vence em ' + left + ' dia(s)', cls: 'activation' };
  return { key: 'ok', left, label: 'Vigente', cls: 'active' };
}
function gxMandGroups(list) {
  const map = new Map();
  (list || gxMand).forEach(m => {
    const key = (m.chapter_id != null ? 'c' + m.chapter_id : 'r' + m.region_id) + '|' + m.end_date;
    const g = map.get(key);
    if (!g) map.set(key, { m, n: 1, i: gxMandInfo(m) });
    else { g.n++; if (/^president/i.test(m.role_label)) g.m = m; }
  });
  return Array.from(map.values());
}
function gxMandScopeName(m) {
  if (m.chapter_id != null) { const c = gxChapById(m.chapter_id); return c ? gxChapLabel(c) : 'Capítulo ' + m.chapter_id; }
  const r = (typeof adhDbRegions !== 'undefined' ? adhDbRegions : []).find(x => String(x.id) === String(m.region_id));
  return 'Região ' + (r ? r.name : m.region_id);
}
function gxChaptersWithoutMandate() {
  const have = new Set(gxMand.filter(m => m.chapter_id != null && /president/i.test(m.role_label) && !/vice/i.test(m.role_label) && gxMandInfo(m).key !== 'expired').map(m => String(m.chapter_id)));
  return gxActiveChapters().filter(c => !have.has(String(c.id))).sort(gxSortName);
}
function gxRenderMandates() {
  const body = gxEl('gxMandRows'); if (!body) return;
  if (!gxLoaded.mand) { body.innerHTML = '<tr><td colspan="6" class="empty">Carregando…</td></tr>'; return; }
  const q = slug((gxEl('gxMandSearch') || {}).value || ''), st = (gxEl('gxMandStatus') || {}).value || '';
  const canW = gxCan('mandate');
  const infos = gxMand.map(m => ({ m, i: gxMandInfo(m) })), grp = gxMandGroups();
  const none = gxChaptersWithoutMandate();
  gxEl('gxMandMetrics').innerHTML = [['Vencidos', grp.filter(x => x.i.key === 'expired').length, 'mandatos/diretorias a renovar'], ['Vencem em 60 dias', grp.filter(x => x.i.key === 'soon').length, 'planejar a eleição'], ['Vigentes', grp.filter(x => x.i.key === 'ok').length, 'em dia'], ['Sem mandato cadastrado', none.length, 'ativos sem mandato vigente']].map(m => '<div class="metric"><label>' + m[0] + '</label><strong>' + m[1] + '</strong><small>' + m[2] + '</small></div>').join('');
  let rows = '';
  if (st === 'none') {
    rows = none.filter(c => !q || slug(c.name + ' ' + c.president).includes(q)).map(c => '<tr><td><strong>' + esc(gxChapLabel(c)) + '</strong></td><td>Presidente do capítulo</td><td>' + esc(c.president || '—') + '</td><td>—</td><td><span class="tag reactivation">Sem mandato</span></td><td>' + (canW ? '<button class="btn small primary" onclick="gxMandForm(null,' + Number(c.id) + ')">Cadastrar</button>' : '') + '</td></tr>').join('');
  } else {
    const order = { expired: 0, soon: 1, ok: 2 };
    rows = infos.filter(x => (!q || slug(gxMandScopeName(x.m) + ' ' + x.m.person_name + ' ' + x.m.role_label).includes(q)) && (!st || x.i.key === st))
      .sort((a, b) => order[a.i.key] - order[b.i.key] || String(a.m.end_date).localeCompare(String(b.m.end_date)))
      .map(x => '<tr><td><strong>' + esc(gxMandScopeName(x.m)) + '</strong></td><td>' + esc(x.m.role_label) + '</td><td>' + esc(x.m.person_name) + '</td><td>' + gxFmtDate(x.m.start_date) + ' → <strong>' + gxFmtDate(x.m.end_date) + '</strong></td><td><span class="tag ' + x.i.cls + '">' + esc(x.i.label) + '</span></td><td>' + (canW && (x.m.chapter_id != null || gxIsState()) ? '<div class="actions"><button class="btn small" onclick="gxMandForm(' + Number(x.m.id) + ')">Editar</button><button class="btn small" onclick="gxMandRenew(' + Number(x.m.id) + ')">Renovar</button><button class="btn small" onclick="gxMandDelete(' + Number(x.m.id) + ')">Apagar</button></div>' : '') + '</td></tr>').join('');
  }
  body.innerHTML = rows || '<tr><td colspan="6" class="empty">' + (st === 'none' ? 'Todos os capítulos ativos têm presidente com mandato vigente.' : 'Nenhum mandato cadastrado ainda.') + '</td></tr>';
  const nb = gxEl('gxMandNew'); if (nb) nb.hidden = !canW;
}
function gxMandForm(id, chapterId, prefill) {
  if (!gxCan('mandate')) { toast('Seu perfil não cadastra mandatos.'); return; }
  const f = gxEl('gxMandForm'); f.reset();
  const chs = (typeof chapters !== 'undefined' ? chapters : []).slice().sort(gxSortName);
  f.elements.chapter_id.innerHTML = '<option value="">Selecione o capítulo</option>' + chs.map(c => '<option value="' + esc(c.id) + '">' + esc(gxChapLabel(c)) + '</option>').join('');
  const regs = (typeof adhDbRegions !== 'undefined' ? adhDbRegions : []);
  f.elements.region_id.innerHTML = '<option value="">Selecione a região</option>' + regs.map(r => '<option value="' + esc(r.id) + '">' + esc(r.name) + '</option>').join('');
  f.elements.scope.querySelector('option[value=region]').disabled = !gxIsState();
  f.elements.id.value = id || '';
  const m = id ? gxMand.find(x => Number(x.id) === Number(id)) : (prefill || null);
  if (m) {
    f.elements.scope.value = m.region_id != null ? 'region' : 'chapter';
    if (m.chapter_id != null) f.elements.chapter_id.value = String(m.chapter_id);
    if (m.region_id != null) f.elements.region_id.value = String(m.region_id);
    f.elements.role_label.value = m.role_label || ''; f.elements.person_name.value = m.person_name || '';
    f.elements.start_date.value = m.start_date || ''; f.elements.end_date.value = m.end_date || ''; f.elements.notes.value = m.notes || '';
  } else {
    f.elements.scope.value = 'chapter'; f.elements.role_label.value = GX_ROLES[0];
    if (chapterId) { f.elements.chapter_id.value = String(chapterId); const c = gxChapById(chapterId); if (c && c.president) f.elements.person_name.value = c.president; }
  }
  gxEl('gxMandTitle').textContent = id ? 'Editar mandato' : 'Novo mandato';
  gxMandScope(); gxEl('gxMandMsg').textContent = '';
  gxEl('gxMandModal').classList.add('open');
}
function gxMandScope() { const f = gxEl('gxMandForm'), reg = f.elements.scope.value === 'region'; gxEl('gxMandChapWrap').style.display = reg ? 'none' : ''; gxEl('gxMandRegWrap').style.display = reg ? '' : 'none'; }
function gxMandChapterPicked() {
  const f = gxEl('gxMandForm'); if (f.elements.id.value || f.elements.person_name.value) return;
  const c = gxChapById(f.elements.chapter_id.value); if (c && c.president && /president/i.test(f.elements.role_label.value)) f.elements.person_name.value = c.president;
}
function gxMandRenew(id) {
  const m = gxMand.find(x => Number(x.id) === Number(id)); if (!m) return;
  gxMandForm(null, null, { chapter_id: m.chapter_id, region_id: m.region_id, role_label: m.role_label, person_name: m.person_name, start_date: gxAddDays(m.end_date, 1), end_date: '', notes: '' });
}
async function gxMandSave(ev) {
  ev.preventDefault();
  const f = ev.target, msg = gxEl('gxMandMsg'), btn = gxEl('gxMandSubmit');
  const reg = f.elements.scope.value === 'region', id = f.elements.id.value;
  const body = { chapter_id: reg ? null : (Number(f.elements.chapter_id.value) || null), region_id: reg ? (Number(f.elements.region_id.value) || null) : null, role_label: f.elements.role_label.value.trim(), person_name: f.elements.person_name.value.trim(), start_date: f.elements.start_date.value || null, end_date: f.elements.end_date.value, notes: (f.elements.notes.value || '').trim() || null };
  if (reg ? !body.region_id : !body.chapter_id) { msg.textContent = reg ? 'Escolha a região.' : 'Escolha o capítulo.'; return; }
  if (body.role_label.length < 2 || body.person_name.length < 2) { msg.textContent = 'Informe o cargo e o nome.'; return; }
  if (!body.end_date) { msg.textContent = 'Informe a data de término do mandato.'; return; }
  if (body.start_date && body.end_date < body.start_date) { msg.textContent = 'O término não pode ser antes do início.'; return; }
  btn.disabled = true; msg.textContent = 'Salvando…';
  try {
    if (id) await adhFetch('/rest/v1/leader_mandates?id=eq.' + Number(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    else await adhFetch('/rest/v1/leader_mandates', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    closeModal('gxMandModal'); toast('Mandato salvo.'); await gxLoadMandates(true);
  } catch (e) { msg.textContent = 'Não foi possível salvar: ' + (/row-level|permission|42501/i.test(e.message) ? 'sem permissão para este capítulo/região.' : /relation|42P01/i.test(e.message) ? 'rode o SQL da v1.1 (migracao-v1.1-gestao.sql).' : e.message); }
  finally { btn.disabled = false; }
}
async function gxMandDelete(id) {
  if (!(await adhDialog({ title: 'Apagar este mandato?', message: 'O registro do mandato será removido.', confirmLabel: 'Apagar' }))) return;
  try { await adhFetch('/rest/v1/leader_mandates?id=eq.' + Number(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); toast('Mandato apagado.'); await gxLoadMandates(true); }
  catch (e) { toast('Não foi possível apagar: ' + e.message); }
}

/* ==================================================================
   HISTÓRICO (linha do tempo) DO CAPÍTULO
   ================================================================== */
async function gxChapterTimeline(cid) {
  const c = gxChapById(cid); if (!c) return;
  gxEl('gxTlTitle').textContent = gxChapLabel(c);
  gxEl('gxTlBody').innerHTML = '<p class="sub">Carregando…</p>'; gxEl('gxTlModal').classList.add('open');
  const [hist, mand, meet] = await Promise.all([
    adhFetch('/rest/v1/chapter_status_history?select=old_status,new_status,changed_at&chapter_id=eq.' + Number(cid) + '&order=changed_at.desc&limit=100').catch(() => []),
    adhFetch('/rest/v1/leader_mandates?select=*&chapter_id=eq.' + Number(cid) + '&order=end_date.desc').catch(() => []),
    adhFetch('/rest/v1/chapter_meeting_log?select=meeting_date,held&chapter_id=eq.' + Number(cid) + '&held=eq.false&order=meeting_date.desc&limit=20').catch(() => [])
  ]);
  const it = [], today = gxToday(), S = s => adhStatusFromDb[s] || s;
  (hist || []).forEach(h => it.push({ d: String(h.changed_at).slice(0, 10), ic: '📌', t: h.old_status ? 'Situação mudou de <strong>' + esc(S(h.old_status)) + '</strong> para <strong>' + esc(S(h.new_status)) + '</strong>' : 'Capítulo cadastrado como <strong>' + esc(S(h.new_status)) + '</strong>' }));
  (mand || []).forEach(m => {
    if (m.start_date) it.push({ d: m.start_date, ic: '🧑‍💼', t: 'Início de mandato — <strong>' + esc(m.person_name) + '</strong> (' + esc(m.role_label) + ')' });
    it.push({ d: m.end_date, ic: '⏳', t: (m.end_date >= today ? 'Fim de mandato previsto' : 'Fim de mandato') + ' — <strong>' + esc(m.person_name) + '</strong> (' + esc(m.role_label) + ')' });
  });
  (typeof events !== 'undefined' ? events : []).filter(e => String(e.chapter_id) === String(cid) && e.status !== 'Cancelado').forEach(e => { const w = gxEvWhen(e); if (w.date) it.push({ d: w.date, ic: '📅', t: 'Evento: <strong>' + esc(e.name) + '</strong> (' + esc(e.status) + ')' }); });
  (meet || []).forEach(r => it.push({ d: r.meeting_date, ic: '⚪', t: 'Semana sem reunião (registrado pelo capítulo)' }));
  it.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  const i = gxMeetInfo(c);
  gxEl('gxTlBody').innerHTML = '<p class="sub">Situação atual: ' + tag(c.status) + (c.president ? ' · Presidente: ' + esc(c.president) : '') + (i.last ? ' · Última reunião registrada: ' + gxFmtDate(i.last) : '') + '</p>' +
    (it.length ? '<div class="gx-tl">' + it.map(x => '<div class="gx-tl-i' + (x.d > today ? ' future' : '') + '"><span class="gx-tl-d">' + gxFmtDate(x.d) + '</span><span>' + x.ic + ' ' + x.t + '</span></div>').join('') + '</div>' : '<p class="sub">Ainda não há nada para mostrar. O histórico de situação registra as mudanças a partir da v3.2; os mandatos e as reuniões aparecem quando forem cadastrados.</p>');
}

/* ==================================================================
   ALERTAS no painel "Atenção" (mandatos e reuniões)
   ================================================================== */
function gxAttentionExtra() {
  const r = gxRole(); if (!['state_admin', 'state_director', 'regional_director'].includes(r)) return '';
  const E = escapeHtml, today = gxToday(); let h = '', n = 0;
  if (gxLoaded.mand) {
    const bad = gxMandGroups().filter(x => x.i.key !== 'ok').sort((a, b) => a.i.left - b.i.left);
    bad.slice(0, 6).forEach(x => {
      n++; h += '<div class="detail gx-att"><span>' + (x.i.key === 'expired' ? '🔴' : '🟡') + (x.n > 1 ? ' Mandato da <strong>diretoria</strong> (' + x.n + ' cargos, ' + E(gxMandScopeName(x.m)) + ') — ' : ' Mandato de <strong>' + E(x.m.person_name) + '</strong> (' + E(x.m.role_label) + ', ' + E(gxMandScopeName(x.m)) + ') — ') + E(x.i.label.toLowerCase()) + '</span><button class="btn small" onclick="showPage(\'mandates\',document.querySelector(\'.nav[data-page=mandates]\'));gxRenderMandates()">Ver mandatos</button></div>';
    });
    if (bad.length > 6) h += '<p class="sub">+ ' + (bad.length - 6) + ' mandato(s) vencido(s) ou perto de vencer.</p>';
  }
  if (gxLoaded.meet) {
    const late = gxMeetChapters().map(c => ({ c, i: gxMeetInfo(c) })).filter(x => x.i.key === 'late').sort((a, b) => b.i.days - a.i.days);
    late.slice(0, 6).forEach(x => {
      n++;
      const ph = ((typeof adhChapterContacts !== 'undefined' && adhChapterContacts || {})[String(x.c.id)] || {}).president_phone || '';
      const nome = String(x.c.president || '').trim().split(/\s+/)[0];
      const msg = 'Olá' + (nome ? ', ' + nome : '') + '! Tudo bem? Aqui é da ' + ADH_BRAND + '. Vimos que o capítulo ' + x.c.name + ' não registrou reunião nos últimos ' + x.i.days + ' dias. Aconteceu alguma coisa? Se precisar de apoio, é só chamar. Um abraço!';
      const wa = /^55\d{10,11}$/.test(ph) ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg) : '';
      h += '<div class="detail gx-att"><span>📉 <strong>' + E(x.c.name) + '</strong> — sem reunião registrada há ' + x.i.days + ' dias (limite: ' + x.i.limit + ')</span>' + (wa ? '<a class="btn small" target="_blank" rel="noopener" href="' + E(wa) + '">Falar com o presidente</a>' : '<button class="btn small" onclick="gxMeetDetail(' + Number(x.c.id) + ')">Ver reuniões</button>') + '</div>';
    });
    if (late.length > 6) h += '<p class="sub">+ ' + (late.length - 6) + ' capítulo(s) com reunião atrasada.</p>';
    const none = gxMeetChapters().filter(c => gxMeetInfo(c).key === 'none').length;
    if (none) h += '<p class="sub">' + none + ' capítulo(s) ativo(s) ainda não usam o registro de reuniões.</p>';
  }
  if (gxLoaded.meet && gxLoaded.mand && gxRankAtt) {
    const low = gxHealthList().filter(x => x.h.score < 60).sort((a, b) => a.h.score - b.h.score);
    low.slice(0, 6).forEach(x => {
      n++;
      const ph = ((typeof adhChapterContacts !== 'undefined' && adhChapterContacts || {})[String(x.c.id)] || {}).president_phone || '';
      const nome = String(x.c.president || '').trim().split(/\s+/)[0];
      const fracos = x.h.parts.filter(p => p[1] < p[2] * 0.5).map(p => p[0].toLowerCase());
      const msg = 'Olá' + (nome ? ', ' + nome : '') + '! Tudo bem? Aqui é da ' + ADH_BRAND + '. Estamos acompanhando os capítulos e o ' + x.c.name + ' está precisando de atenção em: ' + (fracos.join(', ') || 'alguns pontos') + '. Posso ajudar em alguma coisa? Conte com a gente.';
      const wa = /^55\d{10,11}$/.test(ph) ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg) : '';
      h += '<div class="detail gx-att"><span>' + (x.h.score < 40 ? '🔴' : '🟠') + ' <strong>' + E(x.c.name) + '</strong> — nota de saúde ' + x.h.score + '/100 (' + x.h.band.label.toLowerCase() + ')' + (fracos.length ? ', fraco em ' + E(fracos.join(', ')) : '') + (x.h.incomplete.length ? ' · dados incompletos' : '') + '</span>' + (wa ? '<a class="btn small" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '') + '</div>';
    });
    if (low.length > 6) h += '<p class="sub">+ ' + (low.length - 6) + ' capítulo(s) com nota de saúde abaixo de 60. Veja todos na página Saúde dos capítulos.</p>';
    if (low.length) h += '<p class="sub">Nota com base em ' + E(mrLabel(gxRankAtt.month || '')) + ' (mês fechado) e nas reuniões e mandatos de hoje.</p>';
  }
  return n || h ? '<div class="gx-att-box" style="margin-top:10px"><div class="eyebrow">Liderança e reuniões</div>' + h + '</div>' : '';
}
(function () {
  const _ra = adhRenderAttention;
  adhRenderAttention = function () {
    _ra.apply(this, arguments);
    try {
      const box = gxEl('attentionPanel'); if (!box) return;
      if (!adhSession || !['state_admin', 'state_director', 'regional_director'].includes(gxRole())) return;
      try { adhEnsureContacts(); } catch (e) { /* ok */ }
      const extra = gxAttentionExtra(); if (!extra) return;
      if (box.hidden) { box.hidden = false; box.innerHTML = '<div class="eyebrow">Atenção</div><h3>Pontos que precisam de um toque</h3>'; }
      box.insertAdjacentHTML('beforeend', extra);
    } catch (e) { console.warn('gx atenção', e); }
  };
})();

/* ==================================================================
   SAÚDE DO CAPÍTULO (0 a 100) — claude v1.6
   Relatório do mês 30 + Reuniões 30 + Mandato 20 + Atividade do mês 20.
   Calculado na tela com dados que o sistema já tem; não grava nada.
   ================================================================== */
const GX_BANDS = [
  { min: 80, label: 'Saudável', color: 'var(--gxc-ok)', bg: 'var(--gxb-ok)', bar: '#2e7d4f' },
  { min: 60, label: 'Atenção', color: 'var(--gxc-warn)', bg: 'var(--gxb-warn)', bar: '#9a6a00' },
  { min: 40, label: 'Em risco', color: 'var(--gxc-risk)', bg: 'var(--gxb-risk)', bar: '#b4531a' },
  { min: 0, label: 'Crítico', color: 'var(--gxc-crit)', bg: 'var(--gxb-crit)', bar: '#a83c42' }
];
function gxBand(n) { return GX_BANDS.find(b => n >= b.min) || GX_BANDS[GX_BANDS.length - 1]; }
function gxHealth(c, rk) {
  const parts = []; let incomplete = [];
  // 1) relatório mensal (30)
  const st = rk && rk.report_status;
  const rep = !st ? 0 : (st === 'Aprovado' ? 30 : 15);
  parts.push(['Relatório', rep, 30, !st ? 'não enviado' : (st === 'Aprovado' ? 'aprovado' : 'ainda não aprovado')]);
  // 2) reuniões (30)
  let meet = 0, mtxt = 'sem registro';
  if (gxLoaded.meet) {
    const i = gxMeetInfo(c);
    meet = { ok: 30, warn: 18, late: 5, none: 0 }[i.key];
    mtxt = i.key === 'none' ? 'sem registro' : (i.key === 'ok' ? 'em dia' : (i.key === 'warn' ? 'perto do limite' : 'atrasadas há ' + i.days + ' dias'));
    if (i.key === 'none') incomplete.push('reuniões');
  } else incomplete.push('reuniões');
  parts.push(['Reuniões', meet, 30, mtxt]);
  // 3) mandato do presidente (20)
  let man = 0, ntxt = 'sem mandato cadastrado';
  if (gxLoaded.mand) {
    const ms = gxMand.filter(m => String(m.chapter_id) === String(c.id) && /president/i.test(m.role_label) && !/vice/i.test(m.role_label)).map(gxMandInfo);
    const best = ms.find(x => x.key === 'ok') || ms.find(x => x.key === 'soon') || ms[0];
    if (best) { man = { ok: 20, soon: 12, expired: 0 }[best.key]; ntxt = best.key === 'ok' ? 'vigente' : (best.key === 'soon' ? 'vence em ' + best.left + ' dia(s)' : 'vencido'); }
    else incomplete.push('mandato');
  } else incomplete.push('mandato');
  parts.push(['Mandato', man, 20, ntxt]);
  // 4) atividade do mês (20)
  const ev = Number(rk && rk.p_events) > 0, rm = Number(rk && rk.p_meetings) > 0, mb = Number(rk && rk.p_members) > 0;
  const act = (ev ? 10 : 0) + (rm ? 5 : 0) + (mb ? 5 : 0);
  parts.push(['Atividade', act, 20, (ev ? 'evento' : 'sem evento') + (mb ? ', sócio novo' : '')]);
  const score = parts.reduce((s, p) => s + p[1], 0);
  return { score, parts, incomplete, band: gxBand(score) };
}
function gxHealthList() {
  const d = ((typeof adhRankData !== 'undefined') ? adhRankData : null) || gxRankAtt; if (!d) return [];
  return (d.chapters || []).map(rk => {
    const c = gxChapById(rk.id != null ? rk.id : rk.chapter_id) || (gxActiveChapters().find(x => x.name === rk.name)) || { id: rk.id, name: rk.name };
    return { rk, c, h: gxHealth(c, rk) };
  }).sort((a, b) => b.h.score - a.h.score || String(a.c.name).localeCompare(String(b.c.name), 'pt-BR'));
}
function gxHealthPill(n) { const b = gxBand(n); return '<span style="display:inline-block;min-width:44px;text-align:center;padding:3px 10px;border-radius:999px;font-weight:800;background:' + b.bg + ';color:' + b.color + '">' + n + '</span> <span style="font-size:12px;color:' + b.color + ';font-weight:700">' + b.label + '</span>'; }
function gxHealthBar(n) { const b = gxBand(n); return '<div style="height:6px;border-radius:99px;background:var(--gx-track);margin-top:6px;overflow:hidden"><div style="height:100%;width:' + n + '%;background:' + b.bar + '"></div></div>'; }
function gxRenderHealth() {
  const page = gxEl('page-ranking'); if (!page) return;
  const grid = page.querySelector('.agrid'); if (!grid) return;
  let box = gxEl('gxHealth');
  if (!box) { box = document.createElement('div'); box.id = 'gxHealth'; box.className = 'panel'; grid.insertBefore(box, grid.firstChild); }
  const list = gxHealthList(); if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
  box.hidden = false;
  const E = escapeHtml;
  const cnt = GX_BANDS.map(b => ({ b, n: list.filter(x => x.h.score >= b.min && x.h.score < (b.min === 80 ? 101 : GX_BANDS[GX_BANDS.indexOf(b) - 1].min)).length }));
  const byReg = {}; list.forEach(x => { const r = x.rk.region_name || '—'; (byReg[r] = byReg[r] || []).push(x.h.score); });
  const regs = Object.keys(byReg).map(r => ({ r, n: Math.round(byReg[r].reduce((s, v) => s + v, 0) / byReg[r].length), c: byReg[r].length })).sort((a, b) => b.n - a.n);
  box.innerHTML = '<h3>Saúde dos capítulos</h3>'
    + '<p class="sub">Nota de 0 a 100: relatório do mês (30), reuniões (30), mandato do presidente (20) e atividade do mês (20). Calculada na tela, não é gravada. Capítulo com “dados incompletos” pode estar sem registrar, não necessariamente sem trabalhar.</p>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px">' + cnt.map(x => '<span style="padding:6px 12px;border-radius:999px;background:' + x.b.bg + ';color:' + x.b.color + ';font-weight:700;font-size:13px">' + x.n + ' ' + x.b.label.toLowerCase() + '</span>').join('') + '</div>'
    + '<div class="tablewrap"><table><thead><tr><th>Capítulo</th><th>Região</th><th>Nota</th><th>Relatório</th><th>Reuniões</th><th>Mandato</th><th>Atividade</th></tr></thead><tbody>'
    + list.map(x => '<tr><td><strong>' + E(x.c.name) + '</strong>' + (x.h.incomplete.length ? '<div class="meta" style="color:#9a6a00">dados incompletos: ' + E(x.h.incomplete.join(', ')) + '</div>' : '') + '</td><td>' + E(x.rk.region_name || '—') + '</td><td style="min-width:150px">' + gxHealthPill(x.h.score) + gxHealthBar(x.h.score) + '</td>'
      + x.h.parts.map(p => '<td title="' + E(p[3]) + '">' + p[1] + '/' + p[2] + '<div class="meta">' + E(p[3]) + '</div></td>').join('') + '</tr>').join('')
    + '</tbody></table></div>'
    + '<h3 style="margin-top:18px">Saúde das regiões</h3><p class="sub">Média da nota dos capítulos ativos da região.</p>'
    + '<div class="tablewrap"><table><thead><tr><th>Região</th><th>Capítulos</th><th>Nota média</th></tr></thead><tbody>'
    + regs.map(r => '<tr><td><strong>' + E(r.r) + '</strong></td><td>' + r.c + '</td><td style="min-width:150px">' + gxHealthPill(r.n) + gxHealthBar(r.n) + '</td></tr>').join('') + '</tbody></table></div>';
}
(function () {
  const rr = renderRanking;
  renderRanking = function () {
    const r = rr.apply(this, arguments);
    try {
      if (!gxLoaded.meet) gxLoadMeetings(true); if (!gxLoaded.mand) gxLoadMandates(true);
      gxRenderHealth();
    } catch (e) { console.warn('gx saúde', e); }
    return r;
  };
})();

/* ==================================================================
   DIRETORIA DO CAPÍTULO (12 cargos) — claude v1.9
   Grava em leader_mandates (um registro por cargo), então mandatos, alertas e Central já enxergam.
   ================================================================== */
const GX_BOARD = [
  'Presidente do capítulo', 'Vice-presidente do capítulo', 'Tesoureiro', '2º Tesoureiro', 'Secretário', '2º Secretário',
  'Diretor de Sócios', 'Diretor de Eventos', 'Coordenadora de Apoio Feminino', 'Vice-coordenadora de Apoio Feminino',
  'Coordenador de Jovens', 'Vice-coordenador de Jovens'
];
const gxBoardNorm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const GX_BOARD_ALIAS = { 'presidente': 0, 'vice presidente': 1, 'segundo tesoureiro': 3, '2 tesoureiro': 3, 'segundo secretario': 5, '2 secretario': 5 };
function gxBoardIndex(label) {
  const n = gxBoardNorm(label);
  const i = GX_BOARD.findIndex(r => gxBoardNorm(r) === n);
  if (i >= 0) return i;
  return GX_BOARD_ALIAS[n] != null ? GX_BOARD_ALIAS[n] : -1;
}
function gxBoardRows(cid) {
  const slots = GX_BOARD.map(() => null);
  gxMand.filter(m => String(m.chapter_id) === String(cid)).forEach(m => {
    const i = gxBoardIndex(m.role_label); if (i < 0) return;
    if (!slots[i] || String(m.end_date) > String(slots[i].end_date)) slots[i] = m;
  });
  return slots;
}
function gxBoardChapters() {
  const r = gxRole();
  if (r === 'chapter_president') return adhMyChapters().slice().sort(gxSortName);
  return gxActiveChapters().concat((typeof chapters !== 'undefined' ? chapters : []).filter(c => c.status !== 'Ativo')).slice().sort(gxSortName);
}
function gxBoardEnsureModal() {
  if (gxEl('gxBoardModal')) return;
  const d = document.createElement('div'); d.id = 'gxBoardModal'; d.className = 'modal';
  d.innerHTML = '<form id="gxBoardForm" class="modalbox" style="width:min(720px,100%);max-height:92vh;overflow:auto" onsubmit="gxBoardSave(event)"><div class="modalhead"><div><div class="eyebrow">Liderança</div><h2>Diretoria do capítulo</h2></div><button type="button" class="btn" onclick="closeModal(\'gxBoardModal\')">Fechar</button></div>'
    + '<div class="formgrid"><label class="flabel span2">Capítulo<select class="field" name="chapter_id" onchange="gxBoardFill()"></select></label><label class="flabel">Início do mandato<input class="field" type="date" name="start_date"></label><label class="flabel">Término do mandato *<input class="field" type="date" name="end_date"></label></div>'
    + '<div id="gxBoardGrid" class="formgrid" style="margin-top:10px"></div><p class="sub" style="margin:10px 0 0">Preencha os cargos que já têm responsável. Deixe em branco o que ainda está vago. As datas valem para todos os cargos preenchidos.</p><div id="gxBoardMsg" class="notice" style="margin-top:10px"></div>'
    + '<div class="actions" style="justify-content:end;margin-top:12px"><button type="button" class="btn" onclick="closeModal(\'gxBoardModal\')">Cancelar</button><button class="btn primary" id="gxBoardSubmit">Salvar diretoria</button></div></form>';
  document.body.appendChild(d);
}
function gxBoardOpen(cid) {
  if (!gxCan('board')) { toast('Seu perfil não edita a diretoria.'); return; }
  gxBoardEnsureModal();
  const f = gxEl('gxBoardForm'), list = gxBoardChapters();
  f.elements.chapter_id.innerHTML = list.map(c => '<option value="' + esc(c.id) + '">' + esc(gxChapLabel(c)) + '</option>').join('');
  if (cid) f.elements.chapter_id.value = String(cid);
  if (!gxLoaded.mand) gxLoadMandates(true).then(gxBoardFill);
  gxBoardFill(); gxEl('gxBoardModal').classList.add('open');
}
function gxBoardFill() {
  const f = gxEl('gxBoardForm'), cid = f.elements.chapter_id.value, slots = gxBoardRows(cid), isPres = gxRole() === 'chapter_president';
  const ch = gxChapById(cid) || {};
  const ends = slots.filter(Boolean).map(m => m.end_date).sort(), starts = slots.filter(Boolean).map(m => m.start_date).filter(Boolean).sort();
  f.elements.end_date.value = ends.length ? ends[ends.length - 1] : '';
  f.elements.start_date.value = starts.length ? starts[0] : '';
  gxEl('gxBoardGrid').innerHTML = GX_BOARD.map((r, i) => {
    let val = slots[i] ? slots[i].person_name : '';
    if (!val && i === 0) val = ch.president || ''; if (!val && i === 1) val = ch.vice_president || '';
    const lock = isPres && i === 0;
    return '<label class="flabel">' + esc(r) + (lock ? ' <small style="color:#6b7a8c">(definido pela diretoria da região/estado)</small>' : '') + '<input class="field" data-role="' + i + '" maxlength="160" value="' + esc(val) + '" ' + (lock ? 'disabled' : '') + ' placeholder="Nome completo"></label>';
  }).join('');
  gxEl('gxBoardMsg').textContent = slots.some(Boolean) ? 'Diretoria carregada. Altere o que precisar.' : 'Nenhum cargo cadastrado ainda para este capítulo.';
}
async function gxBoardSave(ev) {
  ev.preventDefault();
  const f = ev.target, msg = gxEl('gxBoardMsg'), btn = gxEl('gxBoardSubmit'), cid = Number(f.elements.chapter_id.value);
  const slots = gxBoardRows(cid), start = f.elements.start_date.value || null, end = f.elements.end_date.value;
  const inputs = Array.from(f.querySelectorAll('input[data-role]')).filter(i => !i.disabled);
  const plan = [];
  inputs.forEach(inp => {
    const i = Number(inp.dataset.role), name = inp.value.trim().replace(/\s+/g, ' '), cur = slots[i];
    if (name && name.length < 2) return;
    if (name && !cur) plan.push({ op: 'new', i, name });
    else if (name && cur && (cur.person_name !== name || String(cur.end_date) !== String(end) || (cur.start_date || null) !== start)) plan.push({ op: 'edit', i, name, id: cur.id });
    else if (!name && cur) plan.push({ op: 'del', i, id: cur.id });
  });
  if (!plan.length) { msg.textContent = 'Nada mudou.'; return; }
  if (plan.some(x => x.op !== 'del') && !end) { msg.textContent = 'Informe o término do mandato.'; return; }
  if (start && end && end < start) { msg.textContent = 'O término não pode ser antes do início.'; return; }
  const dels = plan.filter(x => x.op === 'del').length;
  if (dels && !(await adhDialog({ title: 'Remover ' + dels + ' cargo(s)?', message: 'Os cargos que você deixou em branco serão removidos da diretoria.', confirmLabel: 'Remover e salvar' }))) return;
  btn.disabled = true; msg.textContent = 'Salvando…';
  try {
    for (const x of plan) {
      const body = { chapter_id: cid, role_label: GX_BOARD[x.i], person_name: x.name, start_date: start, end_date: end };
      if (x.op === 'new') await adhFetch('/rest/v1/leader_mandates', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
      else if (x.op === 'edit') await adhFetch('/rest/v1/leader_mandates?id=eq.' + Number(x.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ person_name: x.name, start_date: start, end_date: end }) });
      else await adhFetch('/rest/v1/leader_mandates?id=eq.' + Number(x.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    // mantém presidente/vice do cadastro do capítulo em sincronia (só gestão; falha silenciosa)
    if (gxIsManager()) {
      const pr = plan.find(x => x.i === 0 && x.op !== 'del'), vp = plan.find(x => x.i === 1 && x.op !== 'del'), patch = {};
      if (pr) patch.president_name = pr.name; if (vp) patch.vice_president_name = vp.name;
      if (Object.keys(patch).length) {
        try {
          await adhFetch('/rest/v1/chapters?id=eq.' + cid, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
          const c = gxChapById(cid); if (c) { if (patch.president_name) c.president = patch.president_name; if (patch.vice_president_name) c.vice_president = patch.vice_president_name; }
        } catch (e) { /* ok */ }
      }
    }
    closeModal('gxBoardModal'); toast('Diretoria salva.'); await gxLoadMandates(true);
  } catch (e) {
    msg.textContent = 'Não foi possível salvar: ' + (/row-level|permission|42501/i.test(e.message) ? 'sem permissão (rode o SQL da v1.8 para o presidente editar a própria diretoria).' : /relation|42P01/i.test(e.message) ? 'rode o SQL da v1.1 (migracao-v1.1-gestao.sql).' : e.message);
  } finally { btn.disabled = false; }
}

/* ==================================================================
   REGISTRO RÁPIDO DE REUNIÃO (3 toques) + COBRANÇA — claude v1.9
   ================================================================== */
const gxQ = { cid: null, date: null, held: null, att: null, vis: 0, saving: false };
function gxWeekdayNum(txt) {
  const n = gxBoardNorm(txt);
  const map = { 'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6 };
  for (const k in map) if (n.includes(k)) return map[k];
  return null;
}
function gxExpectedDate(cid) {
  const today = gxToday(), wd = gxWeekdayNum((gxFreq[String(cid)] || {}).meeting_day);
  if (wd == null) return today;
  for (let i = 0; i < 7; i++) { const d = gxAddDays(today, -i); if (new Date(d + 'T12:00:00').getDay() === wd) return d; }
  return today;
}
function gxWa(c, msg) {
  const ph = ((typeof adhChapterContacts !== 'undefined' && adhChapterContacts || {})[String(c.id)] || {}).president_phone || '';
  return /^55\d{10,11}$/.test(ph) ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(msg) : '';
}
function gxQuickInit() {
  if (gxRole() !== 'chapter_president') return;
  const mine = adhMyChapters(); if (!mine.length) return;
  if (!gxQ.cid || !mine.some(c => String(c.id) === String(gxQ.cid))) { gxQ.cid = mine[0].id; gxQ.date = null; }
  if (!gxQ.date) { gxQ.date = gxExpectedDate(gxQ.cid); gxQ.held = null; gxQ.att = null; gxQ.vis = 0; }
}
function gxQuickRender() {
  const box = gxEl('gxQuick'); if (!box) return;
  const role = gxRole(), E = esc;
  if (role === 'chapter_president') {
    gxQuickInit(); if (!gxQ.cid) { box.innerHTML = ''; return; }
    const mine = adhMyChapters(), c = gxChapById(gxQ.cid);
    const done = gxMeet.find(r => String(r.chapter_id) === String(gxQ.cid) && r.meeting_date === gxQ.date);
    const chip = (v, cur, fn) => '<button type="button" class="gx-chip' + (cur === v ? ' on' : '') + '" onclick="' + fn + '(' + v + ')">' + v + '</button>';
    let h = '<div class="gx-quick"><div class="gx-q-top"><div><div class="eyebrow">Registro rápido</div><h3>' + E(c ? c.name : '') + '</h3></div>'
      + '<div class="gx-q-date"><label>Reunião de <input type="date" class="field" value="' + E(gxQ.date) + '" max="' + gxToday() + '" onchange="gxQDate(this.value)"></label>'
      + (mine.length > 1 ? '<select class="field" onchange="gxQChapter(this.value)">' + mine.map(x => '<option value="' + E(x.id) + '"' + (String(x.id) === String(gxQ.cid) ? ' selected' : '') + '>' + E(x.name) + '</option>').join('') + '</select>' : '') + '</div></div>';
    if (done && gxQ.held === null) {
      h += '<div class="gx-q-done">✔ Já registrada: ' + (done.held ? (done.attendance != null ? done.attendance + ' presentes' : 'realizada') + (done.visitors ? ', ' + done.visitors + ' visitante(s)' : '') : 'não houve reunião') + '. <button type="button" class="btn small" onclick="gxQHeld(' + (done.held ? 'true' : 'false') + ')">Corrigir</button></div>';
    } else {
      h += '<div class="gx-q-row"><span>1. A reunião aconteceu?</span><div><button type="button" class="gx-chip big' + (gxQ.held === true ? ' on' : '') + '" onclick="gxQHeld(true)">✔ Aconteceu</button><button type="button" class="gx-chip big' + (gxQ.held === false ? ' on' : '') + '" onclick="gxQHeld(false)">✖ Não houve</button></div></div>';
      if (gxQ.held === true) {
        h += '<div class="gx-q-row"><span>2. Quantos presentes?</span><div>' + [8, 10, 12, 15, 20, 25, 30, 40].map(v => chip(v, gxQ.att, 'gxQAtt')).join('') + '<input class="field gx-q-n" type="number" min="0" max="5000" placeholder="outro" value="' + (gxQ.att != null && ![8, 10, 12, 15, 20, 25, 30, 40].includes(gxQ.att) ? gxQ.att : '') + '" oninput="gxQAtt(this.value)"></div></div>'
          + '<div class="gx-q-row"><span>Visitantes (opcional)</span><div>' + [0, 1, 2, 3, 4, 5].map(v => chip(v, gxQ.vis, 'gxQVis')).join('') + '</div></div>';
      }
      if (gxQ.held !== null) h += '<div class="gx-q-row"><span>' + (gxQ.held ? '3.' : '2.') + ' Pronto</span><div><button type="button" class="btn primary" ' + ((gxQ.held && gxQ.att == null) || gxQ.saving ? 'disabled' : '') + ' onclick="gxQSave()">' + (gxQ.saving ? 'Salvando…' : 'Salvar reunião') + '</button></div></div>';
    }
    h += '<div class="actions" style="margin-top:10px"><button type="button" class="btn small" onclick="gxBoardOpen(' + Number(gxQ.cid) + ')">Diretoria do capítulo</button></div></div>';
    box.innerHTML = h;
    return;
  }
  if (gxIsManager()) {
    const late = gxMeetChapters().map(c => ({ c, i: gxMeetInfo(c) })).filter(x => x.i.key === 'late' || x.i.key === 'none').sort((a, b) => (b.i.days || 999) - (a.i.days || 999)).slice(0, 12);
    if (!late.length) { box.innerHTML = '<div class="gx-quick"><div class="gx-q-done">✔ Nenhum capítulo atrasado com reunião agora.</div></div>'; return; }
    try { adhEnsureContacts(); } catch (e) { /* ok */ }
    box.innerHTML = '<div class="gx-quick"><div class="eyebrow">Cobrança gentil</div><h3>Capítulos para lembrar (' + late.length + ')</h3><p class="sub" style="margin:0 0 8px">Um toque abre o WhatsApp do presidente com a mensagem pronta.</p>'
      + late.map(x => {
        const nome = String(x.c.president || '').trim().split(/\s+/)[0];
        const msg = 'Olá' + (nome ? ', ' + nome : '') + '! Tudo bem? Aqui é da ' + ADH_BRAND + '. Notamos que o capítulo ' + x.c.name + ' ainda não registrou a reunião' + (x.i.days != null ? ' (última há ' + x.i.days + ' dias)' : '') + '. Leva menos de 1 minuto pelo site, na área Reuniões. Se precisar de ajuda, estamos à disposição!';
        const wa = gxWa(x.c, msg);
        return '<div class="detail gx-att"><span><strong>' + E(x.c.name) + '</strong> — ' + (x.i.days != null ? x.i.days + ' dias sem reunião' : 'sem registro ainda') + '</span>' + (wa ? '<a class="btn small" target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '<span class="sub">sem telefone</span>') + '</div>';
      }).join('') + '</div>';
  } else box.innerHTML = '';
}
function gxQChapter(id) { gxQ.cid = id; gxQ.date = null; gxQuickRender(); }
function gxQDate(d) { if (!d) return; gxQ.date = d; gxQ.held = null; gxQ.att = null; gxQ.vis = 0; gxQuickRender(); }
function gxQHeld(v) { gxQ.held = v; if (!v) { gxQ.att = null; gxQ.vis = 0; } gxQuickRender(); }
function gxQAtt(v) { const n = parseInt(v, 10); gxQ.att = isNaN(n) ? null : Math.max(0, Math.min(5000, n)); const keep = document.activeElement && document.activeElement.classList.contains('gx-q-n'); if (!keep) gxQuickRender(); else { const b = gxEl('gxQuick').querySelector('.btn.primary'); if (b) b.disabled = gxQ.att == null; } }
function gxQVis(v) { gxQ.vis = v; gxQuickRender(); }
async function gxQSave() {
  if (gxQ.saving || gxQ.held === null) return;
  if (gxQ.date > gxToday()) { toast('A data não pode estar no futuro.'); return; }
  gxQ.saving = true; gxQuickRender();
  try {
    await adhFetch('/rest/v1/chapter_meeting_log?on_conflict=chapter_id,meeting_date', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ chapter_id: Number(gxQ.cid), meeting_date: gxQ.date, held: gxQ.held, attendance: gxQ.held ? gxQ.att : null, visitors: gxQ.held ? gxQ.vis : null }) });
    toast(gxQ.held ? 'Reunião registrada. Obrigado!' : 'Registrado: não houve reunião.');
    gxQ.held = null; gxQ.att = null; gxQ.vis = 0;
    await gxLoadMeetings(true);
  } catch (e) { toast('Não foi possível salvar: ' + (/row-level|permission|42501/i.test(e.message) ? 'sem permissão para este capítulo.' : /60 dias/.test(e.message) ? 'só é possível registrar os últimos 60 dias.' : e.message)); }
  finally { gxQ.saving = false; gxQuickRender(); }
}
(function () {
  const rm = gxRenderMeetings;
  gxRenderMeetings = function () {
    const r = rm.apply(this, arguments);
    try {
      let box = gxEl('gxQuick');
      if (!box) { const m = gxEl('gxMeetMetrics'); if (!m) return r; box = document.createElement('div'); box.id = 'gxQuick'; m.parentNode.insertBefore(box, m); }
      gxQuickRender();
    } catch (e) { console.warn('gx rápido', e); }
    return r;
  };
})();

/* ============================================================
   DIRETOR REGIONAL EM CADA REGIÃO (nome + telefone/WhatsApp) + BUSCA — claude v1.9
   Fonte: user_roles (regional_director ativo da região) + profiles (nome/telefone);
   reserva: regions.director_name (só nome).
   ============================================================ */
const gxRD = { map: null, loading: false, tried: false };
function gxRdPhone(p) {
  let d = String(p || '').replace(/\D/g, ''); if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  const n = d.slice(2), fmt = n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : '+' + d;
  return { wa: d, fmt };
}
async function gxRdLoad() {
  if (gxRD.loading || gxRD.tried || typeof adhSession === 'undefined' || !adhSession) return;
  gxRD.loading = true;
  try {
    const [roles, profs] = await Promise.all([
      adhFetch('/rest/v1/user_roles?select=user_id,region_id&role=eq.regional_director&is_active=eq.true&limit=1000'),
      adhFetch('/rest/v1/profiles?select=id,full_name,phone&limit=3000').catch(() => [])
    ]);
    const pm = new Map((profs || []).map(p => [p.id, p])), m = new Map();
    (roles || []).forEach(r => {
      if (r.region_id == null) return;
      const p = pm.get(r.user_id) || {}, k = String(r.region_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push({ name: p.full_name || '', phone: p.phone || '' });
    });
    gxRD.map = m;
  } catch (e) { console.warn('diretores regionais', e); gxRD.map = new Map(); }
  gxRD.loading = false; gxRD.tried = true;
  try { renderRegions(); } catch (e) { }
  try { ['adm', 'cmd'].forEach(k => AdhMap[k] && AdhMap[k].refreshPanel && AdhMap[k].refreshPanel()); } catch (e) { }
}
const GX_NI = /n[ãa]o (informad|possui)|^\s*$/i;
function gxRdBlock(r) {
  const list = ((gxRD.map && gxRD.map.get(String(r.id))) || []).filter(x => x.name || x.phone);
  const raw = r.raw || {}, fbName = String(raw.director_name || r.director || '').trim(), fbOk = fbName && !GX_NI.test(fbName);
  let rows = list.length ? list.map(x => ({ name: x.name, phone: x.phone || raw.director_phone || '' })) : (fbOk ? [{ name: fbName, phone: raw.director_phone || '' }] : []);
  let h = '';
  if (!rows.length) h += '<div class="gx-rd gx-rd-empty">👤 <span class="gx-rd-role">Diretor regional</span> <em>não informado</em></div>';
  else h += rows.map(x => {
    const ph = gxRdPhone(x.phone);
    return `<div class="gx-rd">👤 <span class="gx-rd-role">Diretor regional</span> <strong>${esc(x.name || 'Sem nome')}</strong>` +
      (ph ? ` · <a href="tel:+${ph.wa}">${esc(ph.fmt)}</a> <a class="gx-rd-wa" target="_blank" rel="noopener" href="https://wa.me/${ph.wa}">WhatsApp</a>` : ` · <span class="meta">telefone não cadastrado</span>`) + `</div>`;
  }).join('');
  const rep = String(raw.field_representatives || '').trim();
  if (rep && !GX_NI.test(rep)) h += `<div class="gx-rd"><span class="gx-rd-role">Representante de campo</span> ${esc(rep)}</div>`;
  if (typeof canEdit === 'function' && canEdit('region', true)) h += `<div class="gx-rd"><button type="button" class="btn small" onclick="event.stopPropagation();gxRdEdit(${Number(r.id)})">✎ Editar contato</button></div>`;
  return h;
}
function gxRdFilter() {
  const q = slug(gxEl('gxRdSearch')?.value || ''), items = document.querySelectorAll('#regionList .item');
  let shown = 0;
  items.forEach(it => { const ok = !q || (it.dataset.s || '').includes(q); it.style.display = ok ? '' : 'none'; if (ok) shown++; });
  const c = gxEl('gxRdCount'); if (c) c.textContent = q ? `${shown} de ${items.length} regiões` : `${items.length} regiões`;
  if (q) document.querySelectorAll('#regionList .item').forEach(it => { const d = it.querySelector('details'); if (d && it.style.display !== 'none') d.open = (it.dataset.m || '').includes(q); });
}
(function () {
  const rr = renderRegions;
  renderRegions = function () {
    const r = rr.apply(this, arguments);
    try {
      const el = gxEl('regionList'); if (!el) return r;
      if (!gxEl('gxRdSearch')) {
        const bar = document.createElement('div'); bar.className = 'filters'; bar.style.marginBottom = '10px';
        bar.innerHTML = '<input class="field" id="gxRdSearch" placeholder="Buscar região, diretor regional ou cidade" oninput="gxRdFilter()"><span class="meta" id="gxRdCount" style="align-self:center"></span>';
        el.parentNode.insertBefore(bar, el);
      }
      const items = el.querySelectorAll('.item');
      items.forEach((it, i) => {
        const reg = regions[i]; if (!reg) return;
        const cities = municipalities.filter(m => m.region === reg.name).map(m => m.name).join(' ');
        const list = (gxRD.map && gxRD.map.get(String(reg.id))) || [];
        it.dataset.m = slug(cities);
        it.dataset.s = slug(reg.name + ' ' + list.map(x => x.name + ' ' + x.phone).join(' ') + ' ' + ((reg.raw && reg.raw.director_name) || '') + ' ' + cities);
        const meta = it.querySelector('.meta'); if (meta && !it.querySelector('.gx-rd')) meta.insertAdjacentHTML('afterend', gxRdBlock(reg));
      });
      gxRdFilter(); gxRdLoad();
    } catch (e) { console.warn('gx regiões', e); }
    return r;
  };
})();

function gxRdPanel(id, name) {
  gxRdLoad();
  const reg = (typeof regions !== 'undefined' ? regions : []).find(x => String(x.id) === String(id) || x.name === name);
  return '<div class="detail gx-rd-panel"><strong>Diretor regional</strong>' + gxRdBlock(reg || { id, name }) + '</div>';
}

function gxRdEdit(id) {
  const reg = regions.find(x => String(x.id) === String(id)); if (!reg) return;
  const raw = reg.raw || {}, ni = v => (GX_NI.test(v || '') ? '' : v);
  let m = gxEl('gxRdModal'); if (m) m.remove();
  m = document.createElement('div'); m.id = 'gxRdModal'; m.className = 'modal open';
  m.innerHTML = `<div class="modalbox" style="width:min(520px,100%)"><div class="modalhead"><div><div class="eyebrow">Região</div><h2>${esc(reg.name)}</h2></div><button class="btn small" type="button" onclick="gxEl('gxRdModal').remove()">Fechar</button></div>
  <form onsubmit="gxRdSave(event,${Number(id)})"><div class="formgrid">
   <label class="flabel span2">Diretor regional<input class="field" name="director_name" maxlength="120" value="${esc(ni(raw.director_name))}"></label>
   <label class="flabel span2">Telefone / WhatsApp do diretor<input class="field" name="director_phone" maxlength="30" inputmode="tel" placeholder="(47) 99999-9999" value="${esc(raw.director_phone || '')}"></label>
   <label class="flabel span2">Representante(s) de campo<input class="field" name="field_representatives" maxlength="200" value="${esc(ni(raw.field_representatives))}"></label>
  </div><p class="meta" id="gxRdMsg" style="margin:10px 0"></p><div class="actions"><button class="btn primary" type="submit">Salvar</button></div></form></div>`;
  document.body.appendChild(m);
}
async function gxRdSave(ev, id) {
  ev.preventDefault(); const f = ev.target, msg = gxEl('gxRdMsg'), v = n => String(f.elements[n].value || '').trim();
  const body = { director_name: v('director_name') || null, director_phone: v('director_phone') || null, field_representatives: v('field_representatives') || null };
  if (body.director_phone && !gxRdPhone(body.director_phone)) { msg.textContent = 'Telefone inválido.'; return; }
  msg.textContent = 'Salvando…';
  try {
    await adhFetch('/rest/v1/regions?id=eq.' + Number(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
    const reg = regions.find(x => String(x.id) === String(id)); if (reg) reg.raw = Object.assign({}, reg.raw, body);
    gxEl('gxRdModal').remove(); renderRegions(); ['adm', 'cmd'].forEach(k => AdhMap[k] && AdhMap[k].refreshPanel && AdhMap[k].refreshPanel());
    if (typeof toast === 'function') toast('Contato da região salvo.');
  } catch (e) {
    msg.textContent = 'Não foi possível salvar: ' + (/permission|42501|row-level|column/i.test(e.message) ? 'rode o SQL migracao-v1.9-regioes-diretor.sql no Supabase.' : e.message);
  }
}
