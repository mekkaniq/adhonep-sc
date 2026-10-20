/* ADHONEP-SC claude v1.1 · Roteiro (script) do evento: assistente em 4 etapas + folha para imprimir / salvar em PDF.
   Modelo de jantar empresarial. Campos em aberto saem destacados em amarelo (nunca "*DECIDIR*" solto). */
window.ADH_VER_RT = '1.9';

const GX_TREAT = ['Sr.', 'Sra.', 'Pastor', 'Pastora', 'Dr.', 'Dra.', ''];
const GX_TREAT_LABEL = { 'Sr.': 'Sr.', 'Sra.': 'Sra.', 'Pastor': 'Pastor', 'Pastora': 'Pastora', 'Dr.': 'Dr.', 'Dra.': 'Dra.', '': 'sem tratamento' };
const GX_STEPS = ['Evento e mestre de cerimônias', 'Mesa diretiva', 'Demais participações', 'Revisão e informações do capítulo'];
let gxS = null, gxSTimer = null;
const GX_OPEN = '⟦', GX_CLOSE = '⟧';

function gxSKey(id) { return 'adh_roteiro_v1_' + id; }
function gxSLoad(id) { try { const r = localStorage.getItem(gxSKey(id)); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function gxSSave() {
  if (!gxS) return;
  clearTimeout(gxSTimer);
  gxSTimer = setTimeout(() => {
    try { localStorage.setItem(gxSKey(gxS.id), JSON.stringify({ d: gxS.d, step: gxS.step })); const b = document.getElementById('gxSSaved'); if (b) { b.style.opacity = '1'; setTimeout(() => { b.style.opacity = '0'; }, 1400); } } catch (e) { /* sem armazenamento: segue sem rascunho */ }
  }, 350);
}
function gxSClearDraft() { try { localStorage.removeItem(gxSKey(gxS.id)); } catch (e) { /* ok */ } }
function gxFmtPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (/^55\d{10,11}$/.test(d)) { const n = d.slice(2); return '(' + n.slice(0, 2) + ') ' + (n.length === 11 ? n.slice(2, 7) + '-' + n.slice(7) : n.slice(2, 6) + '-' + n.slice(6)); }
  return String(raw || '');
}

/* valores iniciais, vindos do cadastro (evento, capítulo, mandatos, página pública) */
function gxSDefaults(ev, ch) {
  const num = ch ? gxChapNum(ch) : '';
  const mesa = [];
  const capDesc = ch ? 'Presidente do Capítulo ' + (num ? num + ' - ' : '') + ch.name + ' da ADHONEP' : 'Presidente do Capítulo da ADHONEP';
  mesa.push({ role: 'pres', tr: 'Sr.', name: ch && ch.president || '', desc: capDesc, src: !!(ch && ch.president) });
  if (ch && ch.vice_president) mesa.push({ role: 'vice', tr: 'Sr.', name: ch.vice_president, desc: 'Vice-presidente do Capítulo ' + (num ? num + ' - ' : '') + ch.name, src: true });
  const rd = (typeof gxMand !== 'undefined' ? gxMand : []).find(m => ch && m.region_id != null && String(m.region_id) === String(ch.region_id) && /regional/i.test(m.role_label) && gxMandInfo(m).key !== 'expired');
  mesa.push({ role: 'reg', tr: 'Sr.', name: rd ? rd.person_name : '', desc: 'Diretor Regional da ADHONEP', src: !!rd });
  return {
    tipo: 'Jantar Empresarial',
    mc: { name: '', prof: '', cargo: '' },
    mesa,
    speaker: { tr: 'Sr.', name: '', prof: '' },
    oracao: { tr: 'Sr.', name: '' },
    adhonep: { tr: 'Sr.', name: '' },
    sorteio: { tr: 'Sr.', name: '' },
    intl: { on: true, name: 'ALTOMIR REGIS DA CUNHA' },
    minutos: 50,
    info: { on: true, dia: '', hora: '', local: '', whats: '' }
  };
}
async function gxSFillInfo(ch) {
  if (!ch || !gxS || gxS.infoLoaded) return;
  gxS.infoLoaded = true;
  try {
    const [pi, cc] = await Promise.all([
      adhFetch('/rest/v1/chapter_public_info?select=meeting_place,address,meeting_day,meeting_time&chapter_id=eq.' + Number(ch.id)).catch(() => []),
      adhFetch('/rest/v1/chapter_contacts?select=president_phone&chapter_id=eq.' + Number(ch.id)).catch(() => [])
    ]);
    const i = gxS.d.info, p = (pi && pi[0]) || {}, c = (cc && cc[0]) || {};
    let changed = false;
    if (!i.dia && p.meeting_day) { i.dia = p.meeting_day; changed = true; }
    if (!i.hora && p.meeting_time) { i.hora = p.meeting_time; changed = true; }
    if (!i.local && (p.meeting_place || p.address)) { i.local = [p.meeting_place, p.address].filter(Boolean).join(' · '); changed = true; }
    if (!i.whats && c.president_phone) { i.whats = gxFmtPhone(c.president_phone); changed = true; }
    if (changed) { gxSSave(); if (gxS.step === 3) gxSRender(); }
  } catch (e) { /* sem dados da página pública: o usuário preenche */ }
}

function gxScriptOpen(id) {
  const ev = (typeof events !== 'undefined' ? events : []).find(e => String(e.id) === String(id));
  if (!ev) { toast('Evento não encontrado.'); return; }
  const ch = gxChapById(ev.chapter_id) || (typeof chapters !== 'undefined' ? chapters : []).find(c => c.name === ev.chapter);
  const saved = gxSLoad(ev.id), base = gxSDefaults(ev, ch);
  gxS = { id: ev.id, ev, ch, step: 0, d: base, infoLoaded: false, recovered: false };
  if (saved && saved.d) { gxS.d = Object.assign(base, saved.d); gxS.step = Math.min(3, Math.max(0, saved.step | 0)); gxS.recovered = true; }
  gxSRender(); document.getElementById('gxScriptModal').classList.add('open');
  gxSFillInfo(ch);
}
function gxSIn(el) {
  const p = el.dataset.k.split('.'); let o = gxS.d;
  for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
  const last = p[p.length - 1];
  o[last] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? (parseInt(el.value, 10) || 0) : el.value);
  gxSSave();
}
function gxSTreat(k, cur) { return '<select class="field gx-tr" data-k="' + k + '" onchange="gxSIn(this)">' + GX_TREAT.map(t => '<option value="' + esc(t) + '"' + (t === cur ? ' selected' : '') + '>' + esc(GX_TREAT_LABEL[t]) + '</option>').join('') + '</select>'; }
function gxSTxt(k, val, ph, extra) { return '<input class="field" data-k="' + k + '" value="' + esc(val || '') + '" placeholder="' + esc(ph || '') + '" maxlength="160" oninput="gxSIn(this)"' + (extra || '') + '>'; }
function gxSRender() {
  const d = gxS.d, st = gxS.step, ev = gxS.ev, ch = gxS.ch;
  const body = document.getElementById('gxScriptBody');
  const w = gxEvWhen(ev);
  let h = '<div class="gx-ctx">' + esc(ev.name) + ' · ' + gxFmtDate(w.date) + (w.time ? ' às ' + esc(w.time) : '') + (ch ? ' · Capítulo ' + esc(gxChapLabel(ch)) : '') + '</div>';
  if (gxS.recovered && st === 0) h += '<div class="notice" style="margin-bottom:10px">Rascunho recuperado — continuamos de onde você parou.</div>';
  if (st === 0) {
    h += '<label class="flabel">Tipo do evento (aparece no título)' + gxSTxt('tipo', d.tipo, 'Jantar Empresarial') + '</label>' +
      '<label class="flabel">Nome do mestre de cerimônias *' + gxSTxt('mc.name', d.mc.name, 'Nome completo') + '</label>' +
      '<label class="flabel">Profissão' + gxSTxt('mc.prof', d.mc.prof, 'Ex.: Engenheiro Civil') + '</label>' +
      '<label class="flabel">Cargo ou vínculo na ADHONEP' + gxSTxt('mc.cargo', d.mc.cargo, 'Ex.: Sócio no capítulo 057') + '</label>' +
      '<p class="sub">Este roteiro segue o modelo de jantar empresarial. Tudo que ficar em branco sai destacado em amarelo para você completar depois.</p>';
  } else if (st === 1) {
    h += '<div class="gx-card"><strong>Convidado especial / preletor *</strong><div class="gx-row">' + gxSTreat('speaker.tr', d.speaker.tr) + gxSTxt('speaker.name', d.speaker.name, 'Nome do preletor') + '</div>' + gxSTxt('speaker.prof', d.speaker.prof, 'Profissão ou apresentação curta (opcional)') + '</div>';
    d.mesa.forEach((r, i) => {
      h += '<div class="gx-card"><div class="gx-card-h"><strong>' + (i + 1) + 'º — ' + esc(r.role === 'pres' ? 'Presidente do capítulo' : r.role === 'vice' ? 'Vice-presidente' : r.role === 'reg' ? 'Diretor regional' : 'Autoridade') + '</strong>' + (r.src ? '<span class="tag active">Carregado do cadastro</span>' : '') + '<button type="button" class="btn small" onclick="gxSMesaDel(' + i + ')">Remover</button></div><div class="gx-row">' + gxSTreat('mesa.' + i + '.tr', r.tr) + gxSTxt('mesa.' + i + '.name', r.name, 'Nome') + '</div>' + gxSTxt('mesa.' + i + '.desc', r.desc, 'Profissão e cargo (aparece antes do nome)') + '</div>';
    });
    h += '<button type="button" class="btn" onclick="gxSMesaAdd()">+ Adicionar autoridade à mesa</button><p class="sub">A ordem aqui é a ordem em que o mestre de cerimônias apresenta. O convidado especial entra por último.</p>';
  } else if (st === 2) {
    h += '<div class="gx-card"><strong>Quem fará a oração pelos alimentos?</strong><div class="gx-row">' + gxSTreat('oracao.tr', d.oracao.tr) + gxSTxt('oracao.name', d.oracao.name, 'Nome da pessoa') + '</div></div>' +
      '<div class="gx-card"><strong>Quem falará sobre a ADHONEP e a Revista VOZ?</strong><div class="gx-row">' + gxSTreat('adhonep.tr', d.adhonep.tr) + gxSTxt('adhonep.name', d.adhonep.name, 'Nome da pessoa') + '</div></div>' +
      '<div class="gx-card"><strong>Quem fará o sorteio dos brindes? <span class="meta">(opcional — sem nome, o mestre de cerimônias chama um voluntário)</span></strong><div class="gx-row">' + gxSTreat('sorteio.tr', d.sorteio.tr) + gxSTxt('sorteio.name', d.sorteio.name, 'Nome da pessoa') + '</div></div>' +
      '<div class="gx-card"><label class="gx-chk"><input type="checkbox" data-k="intl.on" ' + (d.intl.on ? 'checked' : '') + ' onchange="gxSIn(this)"> Incluir o destaque ao Presidente Internacional</label>' + gxSTxt('intl.name', d.intl.name, 'Nome do Presidente Internacional') + '</div>' +
      '<label class="flabel">Duração do jantar (minutos)<input class="field" type="number" min="10" max="180" data-k="minutos" value="' + Number(d.minutos) + '" oninput="gxSIn(this)"></label>';
  } else {
    const miss = gxSMissing();
    h += '<div class="gx-card"><label class="gx-chk"><input type="checkbox" data-k="info.on" ' + (d.info.on ? 'checked' : '') + ' onchange="gxSIn(this)"> Incluir "Informações do capítulo" no encerramento</label>' +
      '<div class="formgrid"><label class="flabel">Dia' + gxSTxt('info.dia', d.info.dia, 'Ex.: Terça-feira') + '</label><label class="flabel">Horário' + gxSTxt('info.hora', d.info.hora, 'Ex.: 20:00') + '</label><label class="flabel span2">Local' + gxSTxt('info.local', d.info.local, 'Local e endereço') + '</label><label class="flabel span2">WhatsApp para contato' + gxSTxt('info.whats', d.info.whats, '(48) 99999-9999') + '</label></div><p class="sub">Preenchido com a página pública do capítulo e o telefone do presidente, quando existirem.</p></div>' +
      '<div class="gx-card"><strong>Antes de gerar</strong>' + (miss.length ? '<ul class="gx-miss">' + miss.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul><p class="sub">Esses pontos sairão em <mark>amarelo</mark> no roteiro. Dá para gerar assim mesmo e completar à mão.</p>' : '<p class="sub">✔ Tudo preenchido.</p>') + '</div>';
  }
  document.getElementById('gxScriptTitle').textContent = 'Gerar roteiro do evento';
  document.getElementById('gxScriptStep').textContent = 'Etapa ' + (st + 1) + '/4 — ' + GX_STEPS[st];
  body.innerHTML = h;
  document.getElementById('gxSBack').style.visibility = st === 0 ? 'hidden' : 'visible';
  document.getElementById('gxSNext').hidden = st === 3;
  document.getElementById('gxSGen').hidden = st !== 3;
}
function gxSMissing() {
  const d = gxS.d, m = [];
  if (!d.mc.name.trim()) m.push('Nome do mestre de cerimônias');
  if (!d.speaker.name.trim()) m.push('Nome do preletor');
  d.mesa.forEach(r => { if (!r.name.trim()) m.push('Nome na mesa: ' + (r.role === 'pres' ? 'presidente do capítulo' : r.role === 'vice' ? 'vice-presidente' : r.role === 'reg' ? 'diretor regional' : 'autoridade')); });
  if (!d.oracao.name.trim()) m.push('Quem fará a oração pelos alimentos');
  if (!d.adhonep.name.trim()) m.push('Quem falará sobre a ADHONEP e a Revista VOZ');
  if (d.intl.on && !d.intl.name.trim()) m.push('Nome do Presidente Internacional');
  return m;
}
function gxSMesaAdd() { gxS.d.mesa.push({ role: 'other', tr: 'Sr.', name: '', desc: '', src: false }); gxSSave(); gxSRender(); }
function gxSMesaDel(i) { gxS.d.mesa.splice(i, 1); gxSSave(); gxSRender(); }
function gxSStep(n) {
  if (n > 0) {
    if (gxS.step === 0 && !gxS.d.mc.name.trim()) { toast('Informe o nome do mestre de cerimônias.'); return; }
    if (gxS.step === 1 && !gxS.d.speaker.name.trim()) { toast('Informe o nome do convidado especial / preletor.'); return; }
  }
  gxS.step = Math.max(0, Math.min(3, gxS.step + n)); gxS.recovered = false; gxSSave(); gxSRender();
  const b = document.getElementById('gxScriptBox'); if (b) b.scrollTop = 0;
}
async function gxSClear() {
  if (!(await adhDialog({ title: 'Limpar rascunho?', message: 'Todos os campos voltam aos valores do cadastro.', confirmLabel: 'Limpar' }))) return;
  gxSClearDraft(); const ev = gxS.ev; gxScriptOpen(ev.id);
}

/* ---------- montagem do texto ---------- */
function gxPh(t) { return GX_OPEN + t + GX_CLOSE; }
function gxName(tr, name, ph) { const n = String(name || '').trim(); return n ? ((tr ? tr + ' ' : '') + n.toUpperCase()) : gxPh(ph); }
function gxArt(tr, hasName) { return !hasName || !tr ? 'o(a)' : /^(Sra\.|Pastora|Dra\.)$/.test(tr) ? 'a' : 'o'; }
function gxRoman(n) { return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'][n - 1] || String(n); }
function gxGreeting(time) { const h = parseInt(String(time || '').slice(0, 2), 10); if (isNaN(h)) return 'BOA NOITE'; return h < 12 ? 'BOM DIA' : h < 18 ? 'BOA TARDE' : 'BOA NOITE'; }
function gxScriptBuild() {
  const d = gxS.d, ev = gxS.ev, ch = gxS.ch, w = gxEvWhen(ev), num = ch ? gxChapNum(ch) : '', chName = ch ? ch.name : ev.chapter || '';
  const capTxt = 'Capítulo ' + (num ? num + ' - ' : '') + chName;
  const pres = d.mesa.find(r => r.role === 'pres');
  const presArt = pres && pres.name.trim() ? gxArt(pres.tr, true).replace('o(a)', 'o') : 'o(a)';
  const presCall = pres && pres.name.trim() ? ((pres.tr ? pres.tr + ' ' : '') + pres.name.trim().toUpperCase()) : gxPh('presidente do capítulo');
  const sp = d.speaker, spName = gxName(sp.tr, sp.name, 'nome do preletor');
  const S = []; const add = (t, lines) => S.push({ t, lines });
  const mc = s => ({ k: 'mc', s: 'MC - ' + s }), p = s => ({ k: 'p', s }), n = s => ({ k: 'note', s });
  const dateTxt = w.date ? new Date(w.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : gxPh('data');
  const mcLine = 'Meu nome é ' + (d.mc.name.trim() ? d.mc.name.trim().toUpperCase() : gxPh('nome do mestre de cerimônias')) + (d.mc.prof.trim() ? ', ' + d.mc.prof.trim() : '') + (d.mc.cargo.trim() ? ', ' + d.mc.cargo.trim() : '') + '.';
  add('ABERTURA', [mc('Senhoras e Senhores, muito ' + gxGreeting(w.time) + '!'), p('Em nome deste ' + capTxt + ' da ADHONEP, queremos dar as boas-vindas a todos, desejando que esta noite seja especialmente agradável e que se sintam muito bem em nosso meio.'), p(mcLine), p('Nesta noite serei o Mestre de Cerimônias e estaremos juntos por alguns minutos.')]);
  const mesaLines = [mc('Sendo assim, vos apresento nossa mesa principal, que está composta das seguintes autoridades e personalidades:')];
  let idx = 0;
  d.mesa.forEach(r => { idx++; mesaLines.push(p(gxRoman(idx) + ' - ' + (r.desc.trim() ? r.desc.trim() + ', ' : '') + (r.tr ? r.tr + ' ' : '') + (r.name.trim() ? r.name.trim().toUpperCase() : gxPh('nome')) + '.')); });
  idx++; mesaLines.push(p(gxRoman(idx) + ' - Convidado Especial da ADHONEP, nosso convidado especial, ' + spName + '.'));
  add('APRESENTAÇÃO DA MESA DIRETIVA', mesaLines);
  add('PALAVRA DE ABERTURA DO PRESIDENTE', [mc('Neste momento, convido ' + presArt + ' Presidente, ' + presCall + ', para fazer a abertura oficial deste ' + (d.tipo.trim() || 'evento') + '.'), n('(PRESIDENTE FAZ A ABERTURA)')]);
  if (d.intl.on) add('DESTAQUE AO PRESIDENTE INTERNACIONAL', [mc('Gostaríamos de destacar e homenagear o Presidente Internacional da ADHONEP, o empresário ' + (d.intl.name.trim() ? d.intl.name.trim().toUpperCase() : gxPh('nome do Presidente Internacional')) + ', cujo nome é referência de honra em nossa associação. Seu incansável trabalho tem sido fundamental para manter e expandir a ADHONEP por todo o Brasil e pelo mundo inteiro, levando a missão do Evangelho Pleno a milhares de homens e mulheres de negócios.')]);
  add('RECONHECIMENTO DOS MEMBROS ADHONEP', [mc('Para que este ' + (d.tipo.trim() || 'evento') + ' pudesse ser realizado, nossa equipe preparou tudo com muita dedicação. Gostaria de solicitar a todos os associados da ADHONEP aqui presentes que fiquem de pé para que nossos convidados possam conhecê-los.'), p('Obrigado.'), p('E você, que está nos visitando pela primeira ou mais vezes, fique também de pé para que possamos nos cumprimentar.'), mc('Quero informar que sobre as mesas estão dispostas fichas de convidados. Solicito a todos que estão participando deste ' + (d.tipo.trim() || 'evento') + ' que as preencham, possibilitando que depois façamos o sorteio de um brinde, além de viabilizar avisos sobre eventos futuros.'), n('* Música de Fundo')]);
  add('AGRADECIMENTO PELO ALIMENTO', [mc('Neste momento, convido ' + gxArt(d.oracao.tr, !!d.oracao.name.trim()) + ' ' + gxName(d.oracao.tr, d.oracao.name, 'quem fará a oração') + ' para fazer um breve agradecimento pelos alimentos, que serão servidos em seguida.'), n('(ORAÇÃO PELOS ALIMENTOS)')]);
  add('INÍCIO DO JANTAR', [mc('Neste momento daremos início ao jantar, que terá em torno de ' + (Number(d.minutos) || 50) + ' minutos. Gostaria de convidar a mesa diretiva para se dirigir até o buffet.'), p('TENHAM TODOS UM EXCELENTE JANTAR!'), n('* Música durante o Jantar')]);
  add('REINÍCIO DA PROGRAMAÇÃO', [mc('Retornando à nossa programação, informamos que após a palestra você poderá desfrutar de uma deliciosa sobremesa.')]);
  add('O QUE É A ADHONEP E A REVISTA VOZ', [mc('Você que está conosco pela primeira vez, deve estar se perguntando: "O que é essa ADHONEP?" Para nos trazer maiores esclarecimentos sobre a Associação e o que é a Revista VOZ, convido então ' + gxArt(d.adhonep.tr, !!d.adhonep.name.trim()) + ' ' + gxName(d.adhonep.tr, d.adhonep.name, 'quem apresentará a ADHONEP') + '.'), n('(APRESENTAÇÃO DA ADHONEP E REVISTA VOZ)'), mc('Gostaria de solicitar aos nossos convidados que ainda não preencheram as fichas que estão em suas mesas, que as preencham, possibilitando o envio de notícias da ADHONEP e convites para nossos próximos eventos, além de participar do sorteio de um brinde.')]);
  add('PALESTRA DO CONVIDADO ESPECIAL', [mc('Estamos realmente muito felizes pela presença de todos em nosso ' + (d.tipo.trim() || 'evento') + '. Neste momento, temos a imensa satisfação de anunciar nosso convidado especial, ' + spName + (sp.prof.trim() ? ', ' + sp.prof.trim() : '') + '.'), n('(SOLICITAR ÀS PESSOAS PARA AJUSTAREM A POSIÇÃO DA CADEIRA, PARA FICAREM MAIS CONFORTÁVEIS PARA A PALESTRA)')]);
  add('APELO', [n('(PALESTRANTE FAZ O APELO AO FUNDO MUSICAL)'), n('* Música de Fundo (Suave)'), mc('Gostaria de convidar ' + presArt + ' Presidente, ' + presCall + ', para entregar uma lembrança ao nosso preletor, ' + spName + '.')]);
  add('SORTEIO DE BRINDES', [d.sorteio.name.trim() ? mc('Dando continuidade à programação, estaremos neste momento sorteando um brinde entre os nossos convidados. Para realizar o sorteio, convido ' + gxArt(d.sorteio.tr, true) + ' ' + gxName(d.sorteio.tr, d.sorteio.name, 'nome') + '.') : mc('Dando continuidade à programação deste ' + (d.tipo.trim() || 'evento') + ', estaremos neste momento sorteando um brinde entre os nossos convidados. Gostaria de convidar um(a) voluntário(a) para nos ajudar neste sorteio.'), n('(REALIZAÇÃO DO SORTEIO)')]);
  add('ENCERRAMENTO', [mc('Senhoras e Senhores, estamos chegando ao final do nosso ' + (d.tipo.trim() || 'evento') + '. Agradecemos sobremaneira a presença de todos. Foi realmente um prazer tê-los conosco nesta noite.'), mc('Gostaria de chamar ' + presArt + ' Presidente, ' + presCall + ', para lhes fazer um convite especial.'), n('(AGRADECIMENTOS E AVISOS DO PRESIDENTE)')]);
  if (d.info.on) {
    const il = [mc('Nossas reuniões plenárias acontecem regularmente:')];
    const row = (lb, v, ph) => il.push(p(lb + ': ' + (String(v || '').trim() || gxPh(ph))));
    row('Dia', d.info.dia, 'dia da reunião'); row('Horário', d.info.hora, 'horário'); row('Local', d.info.local, 'local e endereço'); row('WhatsApp', d.info.whats, 'WhatsApp para contato');
    il.push(p('Procure conhecer nossas reuniões e venha nos conhecer melhor!'));
    add('INFORMAÇÕES DO CAPÍTULO', il);
  }
  add('PALAVRA FINAL', [mc('Por fim, queremos convidar a todos para se servirem de uma deliciosa sobremesa que será servida em nosso buffet.'), p('Fiquem à vontade, desfrutem desse momento para que possamos conhecer uns aos outros, trocar cartões de visita e apresentar sua profissão aos demais.'), p('Em nome do ' + capTxt + ' da ADHONEP, agradecemos a todos pela presença e informamos que o nosso palestrante e demais associados estarão à disposição para conversar com você.'), p('Boa noite a todos e que Deus os acompanhe!')]);
  return { title: (d.tipo.trim() || 'Evento').toUpperCase() + ' DO CAPÍTULO ' + (num ? num + ' - ' : '') + chName, sub: dateTxt + (w.time ? ' · ' + w.time : ''), local: ev.location || gxPh('local do evento'), sections: S, chapterLine: capTxt };
}
function gxFmtHtml(s) { return esc(s).split(GX_OPEN).join('<mark>[').split(GX_CLOSE).join(']</mark>'); }
function gxFmtPlain(s) { return s.split(GX_OPEN).join('[').split(GX_CLOSE).join(']'); }
function gxScriptHtml(R) {
  let h = '<div class="gx-sheet"><div class="gx-sh-head"><img src="assets/logo-colorida.png" alt="ADHONEP" class="gx-logo"><div class="gx-sh-org">ASSOCIAÇÃO DE HOMENS DE NEGÓCIO DO EVANGELHO PLENO</div></div><div class="gx-sh-title"><h1>' + gxFmtHtml(R.title) + '</h1><div>' + gxFmtHtml(R.sub) + '</div><div>' + gxFmtHtml(R.local) + '</div></div>';
  R.sections.forEach((s, i) => {
    h += '<section class="gx-sec"><h2>' + (i + 1) + ' - ' + esc(s.t) + '</h2>' + s.lines.map(l => '<p class="' + l.k + '">' + gxFmtHtml(l.s) + '</p>').join('') + '</section>';
  });
  return h + '<div class="gx-end">FIM DO SCRIPT</div></div>';
}
function gxScriptText(R) {
  let t = R.title + '\n' + R.sub + '\n' + R.local + '\n';
  R.sections.forEach((s, i) => { t += '\n' + (i + 1) + ' - ' + s.t + '\n' + s.lines.map(l => gxFmtPlain(l.s)).join('\n') + '\n'; });
  return gxFmtPlain(t) + '\nFIM DO SCRIPT\n';
}
function gxScriptGenerate() {
  const R = gxScriptBuild(), open = JSON.stringify(R).split(GX_OPEN).length - 1;
  gxS.R = R;
  let o = document.getElementById('gxPrint');
  if (!o) { o = document.createElement('div'); o.id = 'gxPrint'; document.body.appendChild(o); }
  o.innerHTML = '<div class="gx-toolbar"><button class="btn" onclick="gxPrintClose(true)">← Voltar e editar</button><span class="gx-count">' + (open ? '<mark>' + open + ' campo(s) em aberto</mark>' : '✔ Sem campos em aberto') + '</span><span class="gx-tb-actions"><button class="btn" onclick="gxScriptCopy()">Copiar texto</button><button class="btn primary" onclick="gxScriptPrint()">Imprimir / Salvar PDF</button><button class="btn" onclick="gxPrintClose(false)">Fechar</button></span></div>' + gxScriptHtml(R);
  o.classList.add('open'); document.body.classList.add('adh-noscroll'); o.scrollTop = 0;
  closeModal('gxScriptModal');
}
function gxPrintClose(back) {
  const o = document.getElementById('gxPrint'); if (o) o.classList.remove('open');
  document.body.classList.remove('adh-noscroll', 'gx-printing');
  if (back && gxS) document.getElementById('gxScriptModal').classList.add('open');
}
function gxScriptPrint() {
  const old = document.title, ev = gxS.ev;
  document.title = 'Roteiro - ' + String(ev.name || 'evento').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  document.body.classList.add('gx-printing');
  const done = () => { document.body.classList.remove('gx-printing'); document.title = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch (e) { done(); toast('Não foi possível abrir a impressão neste aparelho. Use "Copiar texto".'); } }, 80);
}
async function gxScriptCopy() {
  const txt = gxScriptText(gxS.R);
  try { await navigator.clipboard.writeText(txt); toast('Roteiro copiado.'); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Roteiro copiado.'); } catch (e2) { toast('Não foi possível copiar neste aparelho.'); }
    ta.remove();
  }
}
