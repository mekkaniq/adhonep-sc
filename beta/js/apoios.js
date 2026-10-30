/* ADHONEP-SC · Relatório mensal do Apoio Jovem e do Apoio Feminino (claude v1.10)
   Mesmo modelo do "Andamento mensal": envia o coordenador do apoio (ou o presidente do capítulo), até o dia 5 do mês seguinte;
   o diretor regional aprova ou pede correções. Tabela: chapter_support_reports (supabase/migracao-v3.14-relatorio-apoios.sql). */
(function(){
 var KIND={youth:'Apoio Jovem',women:'Apoio Feminino'};
 var SP=[],CS={};
 function has(c,k){var r=CS[String(c)];return !r||r['has_'+k]!==false}
 var canSet=function(){return isAdmin()||isPres()||isRD()};
 var role=function(){return adhProfile&&adhProfile.role};
 var isAdmin=function(){return role()==='state_admin'},isPres=function(){return role()==='chapter_president'},isCoord=function(){return role()==='coordinator'},isRD=function(){return role()==='regional_director'};
 var canReview=function(){return isAdmin()||isRD()};
 /* pares (capítulo, apoio) em que este perfil pode enviar */
 function myPairs(){var chs=(adhDbChapters||[]),out=[];
  if(isAdmin()){chs.filter(function(c){return String(c.status||'').toLowerCase()==='active'}).forEach(function(c){['youth','women'].forEach(function(k){if(has(c.id,k))out.push({c:c.id,k:k})})})}
  else if(isPres()){(adhProfile.chapterIds||[]).forEach(function(id){['youth','women'].forEach(function(k){if(has(id,k))out.push({c:id,k:k})})})}
  else if(isCoord()){(adhProfile.apoios||[]).forEach(function(a){out.push({c:a.c,k:a.k})})}
  return out}
 function chName(id){var c=(adhDbChapters||[]).find(function(x){return String(x.id)===String(id)});return c?c.name:('Capítulo '+id)}
 var canSubmit=function(){return myPairs().length>0};
 function inject(){
  if(document.getElementById('page-support'))return;
  var mon=document.getElementById('page-monthly');if(!mon)return;
  var sec=document.createElement('section');sec.className='apage';sec.id='page-support';
  sec.innerHTML='<div class="adminhead"><div><div class="eyebrow">Acompanhamento</div><h1>Apoios Jovem e Feminino</h1><p>Relatório mensal de cada apoio no capítulo. Prazo de entrega: até o dia 5 do mês seguinte. Enviado pelo coordenador do apoio ou pelo presidente do capítulo e aprovado pelo diretor regional.</p></div><div class="actions"><button class="btn primary" id="spNewBtn" onclick="openSupportForm()">+ Relatório do mês</button><button class="btn" onclick="loadSupport()">Atualizar</button></div></div>'+
   '<div class="panel"><details id="spPanel" style="margin-bottom:14px" hidden><summary style="cursor:pointer;font-weight:700">Apoios do capítulo</summary><p class="meta" style="margin:8px 0">Marque os apoios que existem. O que não existir não aparece nem fica pendente.</p><div id="spToggles"></div></details><div class="filters"><select class="field" id="spMonth" onchange="renderSupport()"></select><select class="field" id="spKind" onchange="renderSupport()"><option value="">Todos os apoios</option><option value="youth">Apoio Jovem</option><option value="women">Apoio Feminino</option></select><select class="field" id="spStatus" onchange="renderSupport()"><option value="all">Todas as situações</option><option value="review">Aguardando aprovação</option><option value="fix">Correções solicitadas</option><option value="done">Aprovados</option></select><input class="field" id="spSearch" placeholder="Buscar capítulo…" oninput="renderSupport()"></div><div id="spNotice" class="notice" role="status">Carregando…</div><div class="tablewrap"><table><thead><tr><th>Capítulo</th><th>Apoio</th><th>Reuniões<br><span class="meta">média · novos</span></th><th>Visitantes</th><th>Eventos</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="spRows"><tr><td colspan="7" class="empty">Carregando…</td></tr></tbody></table></div><div id="spMissingBox" hidden><h3 style="margin:18px 0 6px">Sem relatório neste mês</h3><div id="spMissing" class="meta"></div></div></div>';
  mon.parentNode.insertBefore(sec,mon.nextSibling);
  var mb=document.querySelector('.nav[data-page="monthly"]');
  if(mb){var b=document.createElement('button');b.className='nav';b.dataset.page='support';b.setAttribute('onclick',"showPage('support',this);loadSupport()");b.innerHTML='▥ Apoios Jovem e Feminino <span id="spNavCount" class="pillnum"></span>';mb.parentNode.insertBefore(b,mb.nextSibling)}
  var m=document.createElement('div');m.id='spModal';m.className='modal';
  m.innerHTML='<form class="modalbox" style="width:min(760px,100%)" id="spForm"><div class="modalhead"><div><div class="eyebrow">Relatório mensal</div><h2 id="spTitle">Relatório do apoio</h2><p class="sub">Preencha com os números do mês. Zero é uma resposta válida.</p></div><button type="button" class="btn" onclick="closeModal(\'spModal\')">Fechar</button></div><div id="spFeedback" class="notice" hidden style="background:#fff3df;border-color:#eee0be"></div><div class="formgrid"><label class="flabel">Apoio<select class="field" name="kind" id="spFKind" required></select></label><label class="flabel">Capítulo<select class="field" name="chapter_id" id="spFChapter" required></select></label><label class="flabel span2">Mês de referência<select class="field" name="ref_month" id="spFMonth" required></select></label>'+
   '<div class="span2"><strong>Reuniões</strong></div><label class="flabel">Reuniões no mês<input class="field" name="meetings" type="number" min="0" max="40" value="0" required></label><label class="flabel">Média de participantes<input class="field" name="avg_attendance" type="number" min="0" max="5000"></label><label class="flabel">Participantes novos<input class="field" name="new_participants" type="number" min="0" max="5000" value="0" required></label><label class="flabel">Visitantes (não sócios)<input class="field" name="visitors" type="number" min="0" max="5000" value="0" required></label><label class="flabel span2">Observações sobre visitantes (opcional)<input class="field" name="visitors_notes" maxlength="1000"></label>'+
   '<div class="span2"><strong>Eventos</strong></div><label class="flabel">Eventos no mês<input class="field" name="events_count" type="number" min="0" max="40" value="0" required></label><label class="flabel">Nomes dos eventos<input class="field" name="events_notes" maxlength="1500" placeholder="Ex.: Noite de louvor; Encontro de jovens"></label>'+
   '<label class="flabel span2">Destaques ou testemunhos (opcional)<textarea class="field" name="highlights" rows="3" maxlength="3000"></textarea></label><label class="flabel span2">Pedidos de apoio à diretoria (opcional)<textarea class="field" name="support_requests" rows="2" maxlength="2000"></textarea></label><label class="flabel span2">Considerações (opcional)<textarea class="field" name="considerations" rows="2" maxlength="3000"></textarea></label></div><div class="notice" id="spMsg" style="margin-top:10px">Depois de enviado, o relatório segue para aprovação do diretor regional. Enquanto não for revisado, você pode corrigi-lo.</div><div class="actions" style="justify-content:end;margin-top:14px"><button type="button" class="btn" onclick="closeModal(\'spModal\')">Cancelar</button><button class="btn primary" id="spSubmit">Enviar relatório</button></div></form>';
  document.body.appendChild(m);document.getElementById('spForm').onsubmit=submitSupport;
  var v=document.createElement('div');v.id='spViewModal';v.className='modal';
  v.innerHTML='<div class="modalbox" style="width:min(680px,100%)"><div class="modalhead"><div><div class="eyebrow">Relatório mensal</div><h2 id="spvTitle"></h2></div><button type="button" class="btn" onclick="closeModal(\'spViewModal\')">Fechar</button></div><div id="spvBody"></div><div class="actions" id="spvActions" style="justify-content:end;margin-top:14px"></div></div>';
  document.body.appendChild(v)}
 /* permissão da página */
 var _rp=rolePermissions;rolePermissions=function(r){var p=_rp(r);var ro=(typeof adhProfile!=='undefined'&&adhProfile)?adhProfile.role:null;
  if(['state_admin','state_director','regional_director','chapter_president','coordinator'].indexOf(ro)>=0&&p.pages.indexOf('support')<0)p={pages:p.pages.concat(['support']),edit:p.edit};return p};
 /* perfil de coordenador guarda qual apoio e qual capítulo */
 var _r=adhResolveProfile;adhResolveProfile=function(roles,se){var p=_r(roles,se);
  if(p&&p.role==='coordinator'){var act=(Array.isArray(roles)?roles:[]).filter(function(x){return x.is_active!==false&&(x.role==='youth_coordinator'||x.role==='women_coordinator')&&x.chapter_id!=null});
   p.apoios=act.map(function(x){return {k:x.role==='youth_coordinator'?'youth':'women',c:x.chapter_id}});
   if(act.length&&act.every(function(x){return x.role===act[0].role}))p.label=act[0].role==='youth_coordinator'?'Coordenador de apoio jovem':'Coordenador de apoio feminino'}
  return p};
 window.loadSupport=async function(silent){
  if(!adhSession||!adhProfile||adhProfile.role==='member')return;inject();var note=document.getElementById('spNotice');
  try{if(!(adhDbChapters||[]).length){try{await loadChaptersAdmin()}catch(e){}}
   var rows=await adhFetch('/rest/v1/chapter_support_reports?select=*&order=ref_month.desc,chapter_id.asc&limit=3000');
   SP=Array.isArray(rows)?rows:[];try{var cs=await adhFetch('/rest/v1/chapter_supports?select=*');CS={};(Array.isArray(cs)?cs:[]).forEach(function(r){CS[String(r.chapter_id)]=r})}catch(e){}mrFillMonthSelect(document.getElementById('spMonth'),12,true);
   var nb=document.getElementById('spNewBtn');if(nb)nb.style.display=canSubmit()?'':'none';
   navCount();renderToggles();if(!silent||document.getElementById('page-support')?.classList.contains('on'))renderSupport()}
  catch(e){var m=String(e&&e.message||e);if(note&&!silent)note.textContent=/relation .* does not exist|schema cache|chapter_support_reports/i.test(m)?'A migração v3.14 ainda não foi aplicada no Supabase (supabase/migracao-v3.14-relatorio-apoios.sql).':'Não foi possível carregar os relatórios: '+m}};
 function navCount(){var el=document.getElementById('spNavCount');if(!el)return;var n=0;
  if(canReview())n=SP.filter(function(r){return r.status==='Entregue'||r.status==='Reenviado'}).length;
  else if(canSubmit()){var d=new Date(),prev=mrKey(new Date(d.getFullYear(),d.getMonth()-1,1));n=myPairs().filter(function(p){return !SP.some(function(r){return String(r.chapter_id)===String(p.c)&&r.kind===p.k&&String(r.ref_month).slice(0,10)===prev})}).length+SP.filter(function(r){return r.status==='Correções solicitadas'}).length}
  el.textContent=n?String(n):'';el.style.display=n?'':'none'}
function editable(){var chs=(adhDbChapters||[]).filter(function(c){return String(c.status||'').toLowerCase()==='active'});
  if(isPres()){var ids=(adhProfile.chapterIds||[]).map(String);return chs.filter(function(c){return ids.indexOf(String(c.id))>=0})}
  if(isRD()){var rg=(adhProfile.regionIds||[]).map(String);return chs.filter(function(c){return rg.indexOf(String(c.region_id))>=0})}
  return isAdmin()?chs:[]}
 function renderToggles(){var d=document.getElementById('spPanel'),box=document.getElementById('spToggles');if(!d||!box)return;
  var list=canSet()?editable():[];d.hidden=!list.length;if(!list.length)return;if(list.length===1)d.open=true;
  box.innerHTML=list.map(function(c){return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:6px 0;border-top:1px solid #e3e9f0"><strong style="flex:1 1 180px">'+escapeHtml(c.name)+'</strong>'+['youth','women'].map(function(k){return '<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" data-c="'+escapeHtml(String(c.id))+'" data-k="'+k+'"'+(has(c.id,k)?' checked':'')+'> '+KIND[k]+'</label>'}).join('')+'</div>'}).join('');
  box.querySelectorAll('input[type=checkbox]').forEach(function(i){i.onchange=function(){setSupport(i.dataset.c,i.dataset.k,i.checked,i)}})}
 async function setSupport(c,k,v,el){try{await adhFetch('/rest/v1/rpc/adh_set_chapter_support',{method:'POST',body:JSON.stringify({p_chapter:Number(c),p_kind:k,p_value:v})});
   var r=CS[String(c)]||{chapter_id:c,has_youth:true,has_women:true};r['has_'+k]=v;CS[String(c)]=r;toast(v?KIND[k]+' marcado como existente neste capítulo.':KIND[k]+' removido das pendências deste capítulo.');navCount();renderSupport();var nb=document.getElementById('spNewBtn');if(nb)nb.style.display=canSubmit()?'':'none'}
  catch(e){if(el)el.checked=!v;toast('Não foi possível salvar: '+(e&&e.message||e))}}
 window.renderSupport=function(){
  var body=document.getElementById('spRows');if(!body)return;
  var month=document.getElementById('spMonth').value||mrDefaultMonth(),kind=document.getElementById('spKind').value,st=document.getElementById('spStatus').value,q=(document.getElementById('spSearch').value||'').toLowerCase();
  var inMonth=SP.filter(function(r){return String(r.ref_month).slice(0,10)===month&&(!kind||r.kind===kind)});
  var rows=inMonth.filter(function(r){return (st==='all'||(st==='review'&&(r.status==='Entregue'||r.status==='Reenviado'))||(st==='fix'&&r.status==='Correções solicitadas')||(st==='done'&&r.status==='Aprovado'))&&chName(r.chapter_id).toLowerCase().indexOf(q)>=0});
  body.innerHTML=rows.map(function(r){var mine=myPairs().some(function(p){return String(p.c)===String(r.chapter_id)&&p.k===r.kind});var canEdit=isAdmin()||(mine&&(r.status==='Entregue'||r.status==='Correções solicitadas'));
   return '<tr><td><strong>'+escapeHtml(chName(r.chapter_id))+'</strong>'+(r.on_time===false?'<div class="meta">entregue fora do prazo</div>':'')+'</td><td data-l="Apoio">'+KIND[r.kind]+'</td><td data-l="Reuniões">'+r.meetings+(r.avg_attendance!=null?' · média '+r.avg_attendance:'')+' · '+r.new_participants+' novo(s)</td><td data-l="Visitantes">'+r.visitors+'</td><td data-l="Eventos">'+r.events_count+'</td><td data-l="Situação">'+mrTagHtml(r.status)+(r.status==='Correções solicitadas'&&r.reviewer_notes?'<div class="meta">'+escapeHtml(r.reviewer_notes)+'</div>':'')+'</td><td><div class="actions"><button class="btn small" onclick="openSupportView(\''+r.id+'\')">Ver</button>'+(canEdit?'<button class="btn small" onclick="openSupportForm(\''+r.id+'\')">'+(r.status==='Correções solicitadas'?'Corrigir':'Editar')+'</button>':'')+'</div></td></tr>'}).join('')||'<tr><td colspan="7" class="empty">Nenhum relatório encontrado.</td></tr>';
  var note=document.getElementById('spNotice'),late=new Date()>mrDeadline(month);
  var expected=(canSubmit()&&!canReview()&&!isAdmin()?myPairs():(function(){var out=[],rg=isRD()?(adhProfile.regionIds||[]).map(String):null;(adhDbChapters||[]).filter(function(c){return String(c.status||'').toLowerCase()==='active'&&(!rg||rg.indexOf(String(c.region_id))>=0)}).forEach(function(c){['youth','women'].forEach(function(k){if(has(c.id,k))out.push({c:c.id,k:k})})});return out})()).filter(function(p){return !kind||p.k===kind});
  var missing=expected.filter(function(p){return !SP.some(function(r){return String(r.chapter_id)===String(p.c)&&r.kind===p.k&&String(r.ref_month).slice(0,10)===month})});
  var box=document.getElementById('spMissingBox'),list=document.getElementById('spMissing');
  if(isPres()&&!myPairs().length){note.textContent='Nenhum apoio marcado neste capítulo. Se houver Apoio Jovem ou Apoio Feminino, marque acima para abrir o relatório.';box.hidden=true;return}
  if(canSubmit()&&!canReview()){var fix=SP.filter(function(r){return r.status==='Correções solicitadas'}).length;
   note.textContent=(missing.length?'Falta enviar o relatório de '+mrLabel(month)+' ('+missing.map(function(p){return KIND[p.k]+' · '+chName(p.c)}).join(', ')+'). Prazo: '+mrDeadline(month).toLocaleDateString('pt-BR')+(late?' — já passou; envie assim mesmo, mas ele não conta como entregue no prazo.':'.'):'Relatório de '+mrLabel(month)+' enviado.')+(fix?' Há '+fix+' relatório(s) com correções solicitadas.':'');box.hidden=true}
  else{var aw=SP.filter(function(r){return r.status==='Entregue'||r.status==='Reenviado'}).length;
   note.textContent=mrLabel(month)+': '+inMonth.length+' relatório(s) recebido(s).'+(aw&&canReview()?' '+aw+' aguardando sua aprovação (todos os meses).':'');
   box.hidden=!missing.length;list.innerHTML=missing.map(function(p){return escapeHtml(KIND[p.k]+' · '+chName(p.c))}).join(' · ')+(late?'':'<div class="meta" style="margin-top:6px">O prazo deste mês ainda não terminou ('+mrDeadline(month).toLocaleDateString('pt-BR')+').</div>')}};
 window.openSupportForm=function(id){
  if(!canSubmit()){toast('Somente o coordenador do apoio ou o presidente do capítulo envia este relatório.');return}
  inject();var f=document.getElementById('spForm');f.reset();var pairs=myPairs(),ed=null;
  var ks=document.getElementById('spFKind'),cs=document.getElementById('spFChapter'),ms=document.getElementById('spFMonth');
  var kinds=[...new Set(pairs.map(function(p){return p.k}))],chaps=[...new Set(pairs.map(function(p){return String(p.c)}))];
  ks.innerHTML=(kinds.length>1?'<option value="">Selecione o apoio</option>':'')+kinds.map(function(k){return '<option value="'+k+'">'+KIND[k]+'</option>'}).join('');
  cs.innerHTML=(chaps.length>1?'<option value="">Selecione o capítulo</option>':'')+chaps.map(function(c){return '<option value="'+escapeHtml(c)+'">'+escapeHtml(chName(c))+'</option>'}).join('');
  ms.innerHTML=mrMonths(isAdmin()?12:3).map(function(k){return '<option value="'+k+'">'+escapeHtml(mrLabel(k))+'</option>'}).join('');ms.value=mrDefaultMonth();
  ks.disabled=cs.disabled=ms.disabled=false;document.getElementById('spFeedback').hidden=true;window.adhSpEditing=null;
  document.getElementById('spTitle').textContent='Relatório do apoio';document.getElementById('spSubmit').textContent='Enviar relatório';
  if(id){ed=SP.find(function(x){return String(x.id)===String(id)});if(!ed)return;window.adhSpEditing=ed;
   if(![...ks.options].some(function(o){return o.value===ed.kind}))ks.insertAdjacentHTML('beforeend','<option value="'+ed.kind+'">'+KIND[ed.kind]+'</option>');
   if(![...cs.options].some(function(o){return o.value===String(ed.chapter_id)}))cs.insertAdjacentHTML('beforeend','<option value="'+ed.chapter_id+'">'+escapeHtml(chName(ed.chapter_id))+'</option>');
   var mk=String(ed.ref_month).slice(0,10);if(![...ms.options].some(function(o){return o.value===mk}))ms.insertAdjacentHTML('beforeend','<option value="'+mk+'">'+escapeHtml(mrLabel(mk))+'</option>');
   ks.value=ed.kind;cs.value=String(ed.chapter_id);ms.value=mk;ks.disabled=cs.disabled=ms.disabled=true;
   ['meetings','avg_attendance','new_participants','visitors','visitors_notes','events_count','events_notes','highlights','support_requests','considerations'].forEach(function(k){if(f.elements[k])f.elements[k].value=ed[k]==null?'':ed[k]});
   document.getElementById('spTitle').textContent=KIND[ed.kind]+' · '+mrLabel(mk)+' — '+chName(ed.chapter_id);
   document.getElementById('spSubmit').textContent=ed.status==='Correções solicitadas'?'Reenviar para aprovação':'Salvar alterações';
   if(ed.status==='Correções solicitadas'&&ed.reviewer_notes){var fb=document.getElementById('spFeedback');fb.hidden=false;fb.innerHTML='<strong>Correções pedidas pelo diretor:</strong> '+escapeHtml(ed.reviewer_notes)}}
  else{if(kinds.length===1)ks.value=kinds[0];if(chaps.length===1)cs.value=chaps[0]}
  document.getElementById('spModal').classList.add('open')};
 async function submitSupport(ev){ev.preventDefault();var f=ev.target,d=new FormData(f),btn=document.getElementById('spSubmit'),msg=document.getElementById('spMsg');
  var num=function(k){var v=parseInt(d.get(k),10);return isFinite(v)&&v>=0?v:0},txt=function(k){return String(d.get(k)||'').trim()||null};
  var body={meetings:num('meetings'),avg_attendance:d.get('avg_attendance')===''?null:num('avg_attendance'),new_participants:num('new_participants'),visitors:num('visitors'),visitors_notes:txt('visitors_notes'),events_count:num('events_count'),events_notes:txt('events_notes'),highlights:txt('highlights'),support_requests:txt('support_requests'),considerations:txt('considerations')};
  var ed=window.adhSpEditing;btn.disabled=true;msg.textContent='Enviando…';
  try{if(ed){if(ed.status==='Correções solicitadas')body.status='Reenviado';await adhFetch('/rest/v1/chapter_support_reports?id=eq.'+encodeURIComponent(ed.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
   else{var k=document.getElementById('spFKind').value,cid=document.getElementById('spFChapter').value,mk=document.getElementById('spFMonth').value;
    if(!k||!cid){msg.textContent='Selecione o apoio e o capítulo.';btn.disabled=false;return}
    var dup=SP.find(function(r){return String(r.chapter_id)===String(cid)&&r.kind===k&&String(r.ref_month).slice(0,10)===mk});
    if(dup){btn.disabled=false;closeModal('spModal');toast('Já existe o relatório deste mês. Abrindo para edição.');openSupportForm(dup.id);return}
    await adhFetch('/rest/v1/chapter_support_reports',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(Object.assign({},body,{chapter_id:Number(cid),kind:k,ref_month:mk,status:'Entregue'}))})}
   closeModal('spModal');toast(ed?'Relatório atualizado.':'Relatório enviado. Obrigado!');await loadSupport()}
  catch(e){msg.textContent='Não foi possível enviar: '+(e&&e.message||e)}finally{btn.disabled=false}}
 window.openSupportView=function(id){var r=SP.find(function(x){return String(x.id)===String(id)});if(!r)return;var mk=String(r.ref_month).slice(0,10);
  document.getElementById('spvTitle').textContent=KIND[r.kind]+' · '+chName(r.chapter_id)+' — '+mrLabel(mk);
  var row=function(a,b){return '<div class="detail"><strong>'+a+'</strong><p>'+b+'</p></div>'},nl=function(s){return escapeHtml(s).replace(/\n/g,'<br>')};
  document.getElementById('spvBody').innerHTML='<p>'+mrTagHtml(r.status)+' '+(r.on_time===false?'<span class="meta">entregue fora do prazo</span>':r.on_time?'<span class="meta">entregue no prazo</span>':'')+'</p>'+
   row('Reuniões','<b>'+r.meetings+'</b> no mês'+(r.avg_attendance!=null?' · média de <b>'+r.avg_attendance+'</b> participantes':'')+' · <b>'+r.new_participants+'</b> participante(s) novo(s)')+
   row('Visitantes (não sócios)','<b>'+r.visitors+'</b>'+(r.visitors_notes?' — '+escapeHtml(r.visitors_notes):''))+
   row('Eventos','<b>'+r.events_count+'</b>'+(r.events_notes?' — '+escapeHtml(r.events_notes):''))+
   (r.highlights?row('Destaques e testemunhos',nl(r.highlights)):'')+(r.support_requests?row('Pedidos de apoio à diretoria',nl(r.support_requests)):'')+(r.considerations?row('Considerações',nl(r.considerations)):'')+(r.reviewer_notes?row('Orientações do diretor',nl(r.reviewer_notes)):'');
  var act=document.getElementById('spvActions');act.innerHTML='';
  if(canReview()&&(r.status==='Entregue'||r.status==='Reenviado'||(isAdmin()&&r.status!=='Aprovado')))act.innerHTML='<button class="btn danger" onclick="reviewSupport(\''+r.id+'\',\'Correções solicitadas\')">Pedir correções</button><button class="btn primary" onclick="reviewSupport(\''+r.id+'\',\'Aprovado\')">Aprovar</button>';
  document.getElementById('spViewModal').classList.add('open')};
 window.reviewSupport=async function(id,status){var notes=null;
  if(status==='Correções solicitadas'){notes=await adhDialog({title:'Pedir correções',message:'Diga o que precisa ser corrigido:',input:true,confirmLabel:'Enviar pedido'});if(!notes||notes.trim().length<3){if(notes!==null)toast('Informe o que precisa ser corrigido.');return}}
  else if(!(await adhDialog({title:'Aprovar relatório',message:'Ao aprovar, o relatório não poderá mais ser editado por quem enviou.'})))return;
  try{await adhFetch('/rest/v1/chapter_support_reports?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:status,reviewer_notes:notes?notes.trim():null})});closeModal('spViewModal');toast(status==='Aprovado'?'Relatório aprovado.':'Correções solicitadas.');await loadSupport()}
  catch(e){toast('A decisão não foi concluída: '+(e&&e.message||e))}};
 inject();
 var ap=adhApplyProfile;adhApplyProfile=function(p){var r=ap.apply(this,arguments);if(p&&p.role!=='member')setTimeout(function(){try{inject();loadSupport(true)}catch(e){}},1500);return r};
})();
