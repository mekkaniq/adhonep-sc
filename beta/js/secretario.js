/* ADHONEP-SC · Secretário e Representante de campo (claude v1.17, banco v3.24)
   Quem tem cargo (presidente, diretor, coordenador, administrador) designa alguém em "Minha conta".
   A pessoa designada passa a ter exatamente as mesmas permissões de quem a designou; tudo fica registrado
   com o nome dela e "em nome de" quem designou. Encerrar a designação tira o acesso na hora.
   Representante de campo = mesma coisa do secretário, com outro nome. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NOME = { secretario: 'Secretário', representante_campo: 'Representante de campo' };
  var lista = [], meuId = null;
  function E(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function logado() { return typeof adhSession !== 'undefined' && !!adhSession; }
  function rpc(nome, corpo) { return adhFetch('/rest/v1/rpc/' + nome, { method: 'POST', body: JSON.stringify(corpo || {}) }); }
  function msgErro(e) { var m = String((e && e.message) || e || ''); return m.replace(/^.*?(Só |Secretário |Não existe|Essa pessoa|A pessoa|Sem permissão|Designação|Entre na)/, '$1'); }

  async function carregar() {
    if (!logado()) { lista = []; meuId = null; return lista; }
    try {
      if (!meuId) { var u = await adhFetch('/auth/v1/user'); meuId = u && u.id; }
      var r = await rpc('adh_delegation_list');
      lista = Array.isArray(r) ? r : [];
    } catch (e) { lista = []; }
    return lista;
  }
  window.adhDelegacoes = function () { return lista.slice(); };

  /* faixa "Você está atuando como secretário de …" e o cargo exibido */
  function faixa() {
    var minhas = lista.filter(function (d) { return d.delegate_id === meuId; });
    var bar = $('adhDelegBar');
    if (!minhas.length || !logado()) { if (bar) bar.hidden = true; return; }
    var txt = minhas.map(function (d) { return '<strong>' + E(NOME[d.kind] || 'Secretário') + '</strong> de ' + E(d.delegator_name || 'quem designou'); }).join(' · ');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'adhDelegBar'; bar.setAttribute('role', 'status');
      bar.style.cssText = 'background:#fff8e1;color:#2a3a55;border-bottom:1px solid #e9d48a;padding:9px 16px;font-size:14px;line-height:1.4';
      var av = $('adminView'); if (av) av.insertBefore(bar, av.firstChild); else document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.hidden = false;
    bar.innerHTML = 'Você está atuando como ' + txt + '. Tudo o que fizer fica registrado com o seu nome, em nome de quem o designou.';
    var lbl = $('roleLabel');
    if (lbl && typeof adhProfile !== 'undefined' && adhProfile && minhas.length) lbl.textContent = (NOME[minhas[0].kind] || 'Secretário') + ' · ' + adhProfile.label;
  }

  /* seção em "Minha conta" */
  function secao() {
    var box = document.querySelector('#accountModal .modalbox'); if (!box) return;
    var d = $('acctDeleg');
    var podeDesignar = typeof adhProfile !== 'undefined' && adhProfile && adhProfile.role !== 'member';
    var minhas = lista.filter(function (x) { return x.delegate_id === meuId; });
    var dei = lista.filter(function (x) { return x.delegator_id === meuId; });
    if (!podeDesignar && !minhas.length) { if (d) d.hidden = true; return; }
    if (!d) {
      d = document.createElement('div'); d.id = 'acctDeleg'; d.style.cssText = 'margin-top:18px;padding-top:14px;border-top:1px solid #e4e9f1';
      var del = $('acctDelete'); if (del) box.insertBefore(d, del); else box.appendChild(d);
    }
    d.hidden = false;
    var h = '<b style="font-size:14px">Secretário e representante de campo</b>';
    if (minhas.length) {
      h += '<p class="sub" style="margin:6px 0 8px;font-size:13px">Você foi designado como:</p>' + minhas.map(function (x) {
        return '<div class="detail" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>' + E(NOME[x.kind]) + ' de <strong>' + E(x.delegator_name || '—') + '</strong></span><button type="button" class="btn small" data-deleg-fim="' + Number(x.id) + '">Deixar a função</button></div>';
      }).join('');
    }
    if (podeDesignar) {
      h += '<p class="sub" style="margin:8px 0 8px;font-size:13px">A pessoa designada passa a ter <strong>as mesmas permissões que você</strong> (inclusive excluir, se você exclui). Tudo o que ela fizer fica registrado com o nome dela, em seu nome. Só designe quem é de confiança.</p>';
      h += dei.length ? dei.map(function (x) {
        return '<div class="detail" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span><strong>' + E(x.delegate_name || '—') + '</strong> · ' + E(NOME[x.kind]) + (x.delegate_email ? ' · ' + E(x.delegate_email) : '') + '</span><button type="button" class="btn small" data-deleg-fim="' + Number(x.id) + '">Encerrar</button></div>';
      }).join('') : '<p class="sub" style="margin:0 0 8px;font-size:13px">Ninguém designado.</p>';
      h += '<form id="acctDelegForm" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-top:8px">'
        + '<label class="flabel" style="flex:2;min-width:180px">E-mail da pessoa (precisa ter conta)<input class="field" name="email" type="email" required maxlength="254"></label>'
        + '<label class="flabel" style="flex:1;min-width:150px">Função<select class="field" name="kind"><option value="secretario">Secretário</option><option value="representante_campo">Representante de campo</option></select></label>'
        + '<button class="btn primary" id="acctDelegBtn">Designar</button></form>';
    }
    h += '<div class="notice" id="acctDelegMsg" style="margin-top:8px" hidden></div>';
    d.innerHTML = h;
    var msg = $('acctDelegMsg'), aviso = function (t) { msg.hidden = !t; msg.textContent = t || ''; };
    var f = $('acctDelegForm');
    if (f) f.onsubmit = async function (ev) {
      ev.preventDefault();
      var email = f.elements.email.value.trim(), kind = f.elements.kind.value;
      var ok = typeof adhDialog === 'function' ? await adhDialog({ title: 'Designar ' + NOME[kind].toLowerCase(), message: email + ' terá as mesmas permissões que você no sistema, até você encerrar. Confirma?', confirmLabel: 'Designar' }) : confirm('Confirmar?');
      if (!ok) return;
      var b = $('acctDelegBtn'); b.disabled = true; aviso('Designando…');
      try { await rpc('adh_delegation_create', { p_email: email, p_kind: kind }); await carregar(); secao(); var m2 = $('acctDelegMsg'); if (m2) { m2.hidden = false; m2.textContent = NOME[kind] + ' designado. Na próxima vez que entrar, a pessoa já terá o acesso.'; } }
      catch (e) { b.disabled = false; aviso('Não foi possível designar: ' + msgErro(e)); }
    };
    d.querySelectorAll('[data-deleg-fim]').forEach(function (b) {
      b.onclick = async function () {
        var ok = typeof adhDialog === 'function' ? await adhDialog({ title: 'Encerrar designação', message: 'O acesso dado por esta designação acaba agora. Confirma?', confirmLabel: 'Encerrar' }) : confirm('Encerrar?');
        if (!ok) return; b.disabled = true;
        try { await rpc('adh_delegation_end', { p_id: Number(b.dataset.delegFim) }); await carregar(); secao(); faixa(); if (typeof toast === 'function') toast('Designação encerrada.'); }
        catch (e) { b.disabled = false; aviso('Não foi possível encerrar: ' + msgErro(e)); }
      };
    });
  }

  function liga() {
    if (typeof adhApplyProfile === 'function' && !adhApplyProfile.__deleg) {
      var ap = adhApplyProfile;
      adhApplyProfile = function () { var r = ap.apply(this, arguments); meuId = null; carregar().then(faixa); return r; };
      adhApplyProfile.__deleg = 1;
    }
    if (typeof openAccount === 'function' && !openAccount.__deleg) {
      var oa = openAccount;
      openAccount = async function () { var r = await oa.apply(this, arguments); await carregar(); secao(); return r; };
      openAccount.__deleg = 1;
    }
    if (typeof signOutAdmin === 'function' && !signOutAdmin.__deleg) {
      var so = signOutAdmin;
      signOutAdmin = function () { lista = []; meuId = null; var b = $('adhDelegBar'); if (b) b.hidden = true; return so.apply(this, arguments); };
      signOutAdmin.__deleg = 1;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', liga); else liga();
})();
