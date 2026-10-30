/* ADHONEP-SC · aplicativo — estrutura de telas: abas reais, navegação por perfil, avisos, configurações. */
(function(){
'use strict';
var C=window.Capacitor,NATIVE=!!(C&&C.isNativePlatform&&C.isNativePlatform());
if(!NATIVE&&!/[?&]appshell=1/.test(location.search))return;
var H=document.documentElement;H.classList.add('in-app');
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var S={tab:'home',rankAccess:null,landed:false,unread:0,sig:'',cent:null,pt:null,period:'all',popShown:null};

/* ===== ícones (traço único, mesma família) ===== */
var ICONS={
 home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
 pin:'<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
 bell:'<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 8H4c0-1 2-2 2-8z"/><path d="M10 20a2 2 0 004 0"/>',
 sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 trophy:'<path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3"/><path d="M12 13v4M8 21h8M10 17h4"/>',
 grid:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
 send:'<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
 moon:'<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
 chev:'<path d="M9 6l6 6-6 6"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
 building:'<path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.2.6 3.5 2.6 3.5 6"/>',
 file:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 logout:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
 map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
 clip:'<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
 repeat:'<path d="M17 3l3 3-3 3M4 11V9a3 3 0 013-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 01-3 3H4"/>',
 book:'<path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h10"/>',
 bars:'<path d="M5 21V10M12 21V4M19 21v-7"/>',
 userplus:'<circle cx="10" cy="8" r="3.5"/><path d="M3 20c0-3.5 3-6 7-6M18 14v6M15 17h6"/>',
 mega:'<path d="M4 10v4h3l8 4V6L7 10z"/><path d="M19 9a4 4 0 010 6"/>',
 award:'<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 nav:'<path d="M12 3l7 17-7-4-7 4z"/>',
 share:'<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 gps:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>',
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'
};
function ic(n,c){return '<svg class="ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(ICONS[n]||'')+'</svg>'}

/* ===== estado da sessão ===== */
function logged(){try{return !!(typeof adhSession!=='undefined'&&adhSession)}catch(e){return false}}
function role(){try{return (typeof adhProfile!=='undefined'&&adhProfile&&adhProfile.role)||''}catch(e){return ''}}
function can(p){try{return typeof canViewPage==='function'&&canViewPage(p)}catch(e){return false}}
function isLeader(){return /^(state_admin|state_director|regional_director|chapter_president)$/.test(role())}
function isAdminRole(){var r=role();return logged()&&r&&r!=='member'&&r!=='speaker_editor'}
function curMode(){
 if(!logged())return 'public';
 if($('adminView')&&$('adminView').classList.contains('on'))return 'admin';
 if($('memberView')&&$('memberView').classList.contains('on'))return 'member';
 return 'public'}
function rpc(name,body){var tok=(logged()&&adhSession.access_token)||ADH_SUPABASE_KEY;
 return fetch(ADH_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify(body||{})})
  .then(function(r){return r.text().then(function(t){var j=null;try{j=t?JSON.parse(t):null}catch(e){}if(!r.ok)throw new Error((j&&j.message)||'Erro '+r.status);return j})})}

/* ===== permissões: avisos/configurações para todos; ranking só com acesso ===== */
(function(){var _rp=window.rolePermissions;if(typeof _rp!=='function')return;
 window.rolePermissions=function(r){var p=_rp(r),pages=p.pages.slice();
  ['avisos','settings'].forEach(function(x){if(pages.indexOf(x)<0)pages.push(x)});
  var i=pages.indexOf('ranking');
  if(S.rankAccess==='none'&&i>-1)pages.splice(i,1);
  if((S.rankAccess==='state'||S.rankAccess==='region')&&i<0)pages.push('ranking');
  return {pages:pages,edit:p.edit}}})();

/* ===== estrutura ===== */
function mount(){
 var sp=document.createElement('div');sp.id='appSafeTop';document.body.appendChild(sp);
 var svg=document.createElement('div');svg.style.display='none';svg.innerHTML='';document.body.appendChild(svg);
 /* cabeçalho: logo + tema */
 var top=document.querySelector('header.top');
 if(top){var b=top.querySelector('.brand small');if(b)b.textContent='SANTA CATARINA';
  var tb=document.createElement('button');tb.id='appTheme';tb.type='button';tb.className='app-hbtn';tb.setAttribute('aria-label','Alternar tema claro e escuro');top.appendChild(tb);tb.onclick=toggleTheme;themeIcon()}
 var pv=$('publicView');pv.dataset.tab='home';
 /* Início */
 var home=document.createElement('section');home.id='appHome';home.className='app-tab';
 home.innerHTML='<div class="ah-globe" data-v="sc"><canvas id="appSC" aria-label="Mapa de Santa Catarina em partículas"></canvas><canvas id="appGlobe" aria-label="Globo interativo"></canvas><div class="ah-sw" role="tablist"><button type="button" data-v="sc" class="on">Santa Catarina</button><button type="button" data-v="world">Mundo</button></div><div class="ah-hint">Toque e arraste</div></div><div class="ah-copy"><div class="ah-eyebrow">ADHONEP · Santa Catarina</div><h1>Conectando pessoas a <em>uma missão.</em></h1><p>Encontre um capítulo, acompanhe os eventos e fique perto da rede em Santa Catarina.</p><div class="ah-stats"><div><b id="ahChap">—</b><span>capítulos ativos</span></div><div><b id="ahCity">—</b><span>municípios com capítulo</span></div></div><div class="ah-actions"><button class="b b-gold" data-go="map">'+ic('pin','sm')+'Capítulos</button><button class="b b-line" data-go="events">'+ic('calendar','sm')+'Eventos</button></div></div>';
 pv.insertBefore(home,pv.firstChild);
 home.querySelectorAll('[data-go]').forEach(function(x){x.onclick=function(){setTab(x.dataset.go)}});
 if(window.AdhGlobe)AdhGlobe.init($('appGlobe'));
 if(window.AdhSC)AdhSC.init($('appSC'));
 (function(){var g=home.querySelector('.ah-globe');home.querySelectorAll('.ah-sw button').forEach(function(b){b.onclick=function(){g.dataset.v=b.dataset.v;home.querySelectorAll('.ah-sw button').forEach(function(x){x.classList.toggle('on',x===b)});homeAnim(S.tab==='home')}})})();
 /* demais abas */
 ['mapSection','eventsSection','aboutSection'].forEach(function(id){var e=$(id);if(e)e.classList.add('app-tab')});
 buildMap();buildEvents();buildAbout();buildAccount();
 /* navegação */
 var nav=document.createElement('nav');nav.id='appNav';nav.setAttribute('aria-label','Navegação');document.body.appendChild(nav);
 nav.addEventListener('click',function(e){var b=e.target.closest('button');if(b&&b._go)b._go()});
 /* páginas extras do painel */
 var ac=document.querySelector('#adminView .admincontent');
 if(ac){var pa=document.createElement('section');pa.className='apage';pa.id='page-avisos';
  pa.innerHTML='<div class="adminhead"><div><div class="eyebrow">Comunicação</div><h1>Avisos</h1><p>Mensagens e lembretes que chegam para você.</p></div><div class="actions" id="avActs"></div></div><div class="panel" id="avList"></div>';ac.appendChild(pa);
  var ps=document.createElement('section');ps.className='apage';ps.id='page-settings';ps.innerHTML='<div class="adminhead"><div><div class="eyebrow">Sua conta</div><h1>Configurações</h1></div></div><div id="stBody"></div>';ac.appendChild(ps)}
 renderNav();
}

/* ===== tema ===== */
function curTheme(){return H.getAttribute('data-theme')==='dark'?'dark':'light'}
function themeIcon(){var b=$('appTheme');if(b)b.innerHTML=ic(curTheme()==='dark'?'sun':'moon','sm')}
function setTheme(p){try{localStorage.setItem('adh-tema',p)}catch(e){}if(window.adhThemeApply)adhThemeApply();themeIcon()}
function toggleTheme(){setTheme(curTheme()==='dark'?'light':'dark')}

/* ===== abas públicas ===== */
function setTab(t){
 S.tab=t;
 if(logged()&&role()==='member'){try{adhMemberViewOn(false)}catch(e){}}
 try{setMode('public')}catch(e){}
 var pv=$('publicView');pv.classList.add('on');pv.dataset.tab=t;window.scrollTo(0,0);
 homeAnim(t==='home');
 renderNav()}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&curMode()==='public'&&S.tab==='home')homeAnim(true)});

/* --- capítulos --- */
function buildMap(){
 var find=document.createElement('div');find.id='appFind';
 var p2=document.querySelector('#mapSection .cols>.panel:nth-child(2)');
 find.innerHTML='<h3>Encontre seu capítulo</h3><div class="filters"></div>';
 if(p2){var fl=p2.querySelector('.filters'),inp=$('findChapter');
  if(inp){inp.placeholder='Município ou capítulo';inp.type='search';find.querySelector('.filters').appendChild(inp)}
  var sel=$('publicCity');if(sel)find.querySelector('.filters').appendChild(sel);
  find.appendChild($('publicList'));find.appendChild($('publicDetail'))}
 var md=$('mapCityDetail');if(md)find.insertBefore(md,find.querySelector('.filters'));
 window.__adhFind=find;var pan=document.querySelector('#mapSection .cols>.panel:first-child');if(pan)pan.appendChild(find);
 var obs=new MutationObserver(syncFind);['publicDetail','mapCityDetail'].forEach(function(id){var e=$(id);if(e)obs.observe(e,{childList:true,subtree:true,characterData:true})});
 var inp2=$('findChapter');if(inp2)inp2.addEventListener('input',syncFind);
 syncFind()}
function syncFind(){var f=window.__adhFind;if(!f)return;
 var q=($('findChapter')&&$('findChapter').value||'').trim(),mf=window.adhMapFilter||{};
 f.classList.toggle('has-q',!!(q||mf.region||mf.city));
 ['publicDetail','mapCityDetail'].forEach(function(id){var e=$(id);if(!e)return;var t=(e.textContent||'');e.classList.toggle('is-idle',!t.trim()||/^\s*(Selecione um capítulo|Explore o mapa)/.test(t))})}

/* --- eventos --- */
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()}
function hav(a,b){var R=6371,d=Math.PI/180,dl=(b[0]-a[0])*d,dn=(b[1]-a[1])*d,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*d)*Math.cos(b[0]*d)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x))}
function buildEvents(){
 var sec=$('eventsSection');if(!sec)return;
 var ev=document.createElement('div');ev.id='appEv';
 ev.innerHTML='<div class="ev-title"><h2>Eventos</h2><span id="evCount"></span></div>'
 +'<div class="ev-near"><label for="evCity">Encontre o evento mais perto de você</label><div class="ev-near-row"><input id="evCity" list="evCities" autocomplete="off" placeholder="Digite sua cidade"><button type="button" id="evGeo" aria-label="Usar minha localização">'+ic('gps','sm')+'</button></div><datalist id="evCities"></datalist><div class="ev-res" id="evRes"></div></div>'
 +'<div class="ev-chips" id="evChips"></div><div class="ev-rail" id="evRail"></div><div class="ev-dots" id="evDots"></div>';
 sec.insertBefore(ev,sec.firstChild);
 fetch('data/sc-cent.json').then(function(r){return r.json()}).then(function(j){S.cent=j;
  $('evCities').innerHTML=Object.keys(j.n).map(function(k){return '<option value="'+esc(j.n[k])+'">'}).join('');renderEv()}).catch(function(){});
 $('evCity').addEventListener('input',function(){var k=norm(this.value);if(S.cent&&S.cent.c[k]){S.pt={ll:S.cent.c[k],label:S.cent.n[k]};renderEv()}else if(!k){S.pt=null;renderEv()}});
 $('evGeo').onclick=function(){if(!navigator.geolocation){showRes('Localização indisponível. Digite sua cidade.');return}
  navigator.geolocation.getCurrentPosition(function(p){S.pt={ll:[p.coords.latitude,p.coords.longitude],label:'você'};$('evCity').value='';renderEv()},function(){showRes('Não consegui sua localização. Digite sua cidade.')},{timeout:9000,maximumAge:600000})};
 $('evRail').addEventListener('scroll',function(){clearTimeout(S.dt);S.dt=setTimeout(dots,60)});
 $('evChips').addEventListener('click',function(e){var b=e.target.closest('[data-p]');if(!b)return;S.period=b.dataset.p;renderEv()})}
function showRes(t){var r=$('evRes');if(r){r.innerHTML=t;r.classList.toggle('on',!!t)}}
function fmtDay(iso){var m=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'],p=String(iso||'').split('-');return p.length===3?{d:p[2],m:m[+p[1]-1]||''}:{d:'',m:''}}
function hhmm(id){try{var r=(adhDbEvents||[]).filter(function(x){return String(x.id)===String(id)})[0];if(r&&r.starts_at)return new Date(r.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}catch(e){}return ''}
function evInfo(e){var ch=null,mu=null;try{ch=(chapters||[]).filter(function(c){return String(c.id)===String(e.chapter_id)})[0];mu=(adhDbMunicipalities||[]).filter(function(m){return String(m.id)===String(e.municipality_id)})[0]}catch(x){}
 e._ch=(ch&&ch.name)||(e.chapter&&e.chapter!=='Capítulo'?e.chapter:'');e._city=(mu&&mu.name)||(ch&&ch.city&&ch.city!=='Município não vinculado'?ch.city:'')||e.city||''}
function renderEv(){
 if(!$('evRail')||typeof publicEvents!=='function')return;
 var list=[];try{list=publicEvents().slice()}catch(e){}
 var today=new Date(),y=today.getFullYear(),mo=today.getMonth();
 var wk=new Date(today.getTime()+7*864e5).toISOString().slice(0,10);
 var ym=y+'-'+String(mo+1).padStart(2,'0');
 var all=list.length;
 if(S.period==='week')list=list.filter(function(e){return e.date<=wk});
 if(S.period==='month')list=list.filter(function(e){return String(e.date).slice(0,7)===ym});
 list.forEach(function(e){evInfo(e);e._km=null;var c=S.cent&&S.cent.c[norm(e._city)];if(S.pt&&c)e._km=hav(S.pt.ll,c)});
 if(S.pt)list.sort(function(a,b){return (a._km==null?1e9:a._km)-(b._km==null?1e9:b._km)});
 $('evCount').textContent=all?(all+(all===1?' evento':' eventos')):'';
 $('evChips').innerHTML=[['all','Todos'],['week','Próximos 7 dias'],['month','Este mês']].map(function(c){return '<button type="button" class="ev-chip'+(S.period===c[0]?' on':'')+'" data-p="'+c[0]+'">'+c[1]+'</button>'}).join('');
 if(S.pt&&list.length&&list[0]._km!=null){showRes('Mais perto de '+esc(S.pt.label)+': <b>'+esc(list[0].name)+'</b> em '+esc(list[0]._city)+', a '+Math.max(1,Math.round(list[0]._km))+' km. <button type="button" class="ev-clear" id="evClr">Limpar</button>');var cl=$('evClr');if(cl)cl.onclick=function(){S.pt=null;$('evCity').value='';renderEv()}}
 else if(!S.pt)showRes('');
 var rail=$('evRail');
 if(!list.length){rail.innerHTML='<div class="ev-empty">'+(all?'Nenhum evento neste período.':'Nenhum evento futuro publicado no momento.')+'</div>';$('evDots').innerHTML='';return}
 rail.innerHTML=list.map(function(e){
  var d=fmtDay(e.date),t=hhmm(e.id),ph=String(e.contact_whatsapp||'').replace(/\D/g,'');
  var img=e.image_data?'<img src="'+esc(e.image_data)+'" alt="Convite: '+esc(e.name)+'" loading="lazy">':ic('spark');
  return '<article class="ev-card" data-id="'+esc(e.id)+'"><div class="ev-img">'+img+'<div class="ev-date"><b>'+esc(d.d)+'</b><span>'+d.m+'</span></div>'+(e._km!=null?'<div class="ev-dist">'+Math.max(1,Math.round(e._km))+' km</div>':'')+'</div>'
  +'<div class="ev-body"><h3>'+esc(e.name)+'</h3><div class="ev-meta">'+ic('building','xs')+'<span>'+esc([e._ch,e._city].filter(Boolean).join(' · '))+'</span></div>'
  +'<div class="ev-meta">'+ic('clock','xs')+'<span>'+(t?t+' · ':'')+esc(e.location||'Local a confirmar')+'</span></div>'
  +(e.description?'<p class="ev-desc">'+esc(e.description)+'</p>':'')
  +'<div class="ev-acts"><button type="button" class="btn small primary" data-cal="'+esc(e.id)+'">'+ic('calendar','xs')+'Calendário</button><button type="button" class="btn small sq" data-inv="'+esc(e.id)+'" aria-label="Convidar">'+ic('share','xs')+'</button>'
  +(ph.length>=10?'<a class="btn small sq" aria-label="WhatsApp" href="https://wa.me/'+ph+'?text='+encodeURIComponent('Olá! Gostaria de informações sobre o evento '+e.name+(e._city?' em '+e._city:'')+'.')+'" target="_blank" rel="noopener">'+ic('chat','xs')+'</a>':'')+'</div></div></article>'}).join('');
 rail.scrollLeft=0;
 rail.querySelectorAll('[data-cal]').forEach(function(b){b.onclick=function(){if(window.adhAddCal)adhAddCal(b.dataset.cal)}});
 rail.querySelectorAll('[data-inv]').forEach(function(b){b.onclick=function(){try{adhInviteEvent(b.dataset.inv)}catch(e){}}});
 $('evDots').innerHTML=list.map(function(_,i){return '<i'+(i===0?' class="on"':'')+'></i>'}).join('');
 dots()}
function dots(){var r=$('evRail');if(!r)return;var cs=r.querySelectorAll('.ev-card');if(!cs.length)return;var mid=r.scrollLeft+r.clientWidth/2,best=0,bd=1e9;
 cs.forEach(function(c,i){var d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=i}});
 $('evDots').querySelectorAll('i').forEach(function(x,i){x.classList.toggle('on',i===best)})}

/* --- sobre --- */
function buildAbout(){
 var sec=$('aboutSection');if(!sec)return;
 var lead=sec.querySelector('.about-lead'),cards=[].slice.call(sec.querySelectorAll('.about-card'));
 var w=document.createElement('div');w.id='appAbout';
 w.innerHTML='<div class="ab-eyebrow">Conheça a ADHONEP</div><h2>O que é a ADHONEP?</h2><div class="ab-lead">'+(lead?lead.innerHTML:'')+'</div>'
 +cards.map(function(c,i){var t=c.querySelector('h3');var body=c.cloneNode(true);var h=body.querySelector('h3');if(h)h.remove();
  return '<details class="ab-card"'+(i===0?' open':'')+'><summary>'+esc(t?t.textContent:'')+ic('chev','sm')+'</summary><div class="ab-in">'+body.innerHTML+'</div></details>'}).join('')
 +'<div class="ab-cta"><a class="b b-line" href="https://adhonep.com" target="_blank" rel="noopener">Quero saber mais'+ic('arrow','sm')+'</a><a class="b b-gold" href="https://adhonep.com/pt/socio/" target="_blank" rel="noopener">Quero ser sócio'+ic('arrow','sm')+'</a></div>';
 sec.innerHTML='';sec.appendChild(w)}

/* --- conta do visitante --- */
function buildAccount(){
 var a=document.createElement('section');a.id='appAccount';a.className='app-tab';
 a.innerHTML='<div class="ac-badge">'+ic('user')+'</div><h2>Sua conta</h2><p>Entre para acessar a área do sócio, os avisos e a gestão do seu capítulo.</p><div class="ac-btns"><button class="b b-navy" id="acIn">Entrar</button><button class="b b-line" id="acReq">Solicitar cadastro</button><a class="b b-gold" href="https://adhonep.com/pt/socio/" target="_blank" rel="noopener">Quero ser sócio'+ic('arrow','sm')+'</a></div><div class="ac-links"><a href="privacidade.html">Política de privacidade</a><a href="termos.html">Termos de uso</a></div>';
 $('publicView').appendChild(a);
 $('acIn').onclick=function(){try{openRealLogin()}catch(e){}};
 $('acReq').onclick=function(){try{openPublicRequest()}catch(e){}}}

/* ===== barra inferior por perfil ===== */
var LOAD={central:'cmdOpen',  'access-requests':'loadAccessRequests',mandates:'gxLoadMandates',meetings:'gxLoadMeetings',calendar:'gxRenderCalendar',members:'loadMembers',users:'loadRealUsers',ranking:'loadRanking',library:'loadLibrary',audit:'loadAuditDb',monthly:'loadMonthly',support:'loadSupport'};
function go(p){
 try{showPage(p)}catch(e){}
 var fn=LOAD[p];if(fn&&typeof window[fn]==='function'){try{window[fn]()}catch(e){}}
 window.scrollTo(0,0);renderNav()}
function adminSlots(){
 var s1=can('central')?['central','Central','target']:can('dashboard')?['dashboard','Início','home']:can('reports')?['reports','Relatórios','clip']:can('support')?['support','Relatório','bars']:null;
 var out=[];if(s1)out.push(s1);
 if(can('chapters'))out.push(['chapters','Capítulos','building']);
 if(can('events'))out.push(['events','Eventos','calendar']);
 return out}
function items(){
 var m=curMode(),L=[];
 if(m==='admin'||(logged()&&isAdminRole()&&m!=='public')){
  adminSlots().forEach(function(s){L.push({k:s[0],l:s[1],i:s[2],go:function(){go(s[0])}})});
  L.push({k:'avisos',l:'Avisos',i:'bell',bd:S.unread,go:function(){go('avisos')}});
  L.push({k:'more',l:'Mais',i:'grid',go:openMore});return L}
 if(logged()&&(m==='member'||m==='public')){
  return [{k:'home',l:'Início',i:'home',go:function(){try{showMemberArea()}catch(e){}}},
   {k:'map',l:'Capítulos',i:'pin',go:function(){setTab('map')}},
   {k:'events',l:'Eventos',i:'calendar',go:function(){setTab('events')}},
   {k:'avisos',l:'Avisos',i:'bell',bd:S.unread,go:openInboxSheet},
   {k:'settings',l:'Config.',i:'sliders',go:openSettingsSheet}]}
 return [{k:'home',l:'Início',i:'home',go:function(){setTab('home')}},
  {k:'map',l:'Capítulos',i:'pin',go:function(){setTab('map')}},
  {k:'events',l:'Eventos',i:'calendar',go:function(){setTab('events')}},
  {k:'about',l:'Sobre',i:'info',go:function(){setTab('about')}},
  {k:'account',l:'Conta',i:'user',go:function(){setTab('account')}}]}
function activeKey(L){
 var m=curMode();
 if(m==='admin'){var on=document.querySelector('#adminView .apage.on'),p=on?on.id.replace('page-',''):'';
  return L.some(function(x){return x.k===p})?p:'more'}
 if(m==='member')return 'home';
 return S.tab}
function renderNav(){
 var nav=$('appNav');if(!nav)return;
 var m=curMode(),auth=logged();
 H.classList.toggle('app-auth',auth&&m!=='public'||(auth&&isAdminRole()));
 var L=items(),a=activeKey(L);
 nav.innerHTML='';
 L.forEach(function(x){var b=document.createElement('button');b.type='button';if(x.k===a)b.className='on';b.setAttribute('aria-label',x.l);
  b.innerHTML=ic(x.i)+'<span>'+esc(x.l)+'</span>'+(x.bd?'<i class="bdg">'+(x.bd>9?'9+':x.bd)+'</i>':'');b._go=x.go;nav.appendChild(b)})}

/* ===== menu "Mais" ===== */
var MORE=[['Gestão',[['dashboard','Visão geral','home'],['central','Central de comando','target'],['access-requests','Solicitações de cadastro','userplus'],['chapters','Capítulos','building'],['regions','Regiões e municípios','map'],['mandates','Mandatos','award'],['meetings','Reuniões','repeat'],['events','Eventos','calendar'],['calendar','Agenda','calendar'],['members','Sócios','users'],['speakers','Preletores','mic'],['users','Usuários e acessos','shield']]],
 ['Acompanhamento',[['reports','Relatórios de eventos','clip'],['monthly','Andamento mensal','bars'],['support','Apoios Jovem e Feminino','users'],['ranking','Ranking','trophy'],['announcements','Comunicados','mega'],['library','Biblioteca','book']]]];
function sheet(html,mount){var o=document.createElement('div');o.className='av-o';o.innerHTML='<div class="av-b" role="dialog" aria-modal="true">'+html+'</div>';
 o.addEventListener('click',function(e){if(e.target===o||e.target.closest('.av-x'))o.remove()});document.body.appendChild(o);if(mount)mount(o);return o}
function openMore(){
 var prim=adminSlots().map(function(s){return s[0]}),h='<div class="av-h"><b>Mais</b><button class="av-x" aria-label="Fechar">'+ic('x','sm')+'</button></div>';
 MORE.forEach(function(g){var rows=g[1].filter(function(r){return can(r[0])&&prim.indexOf(r[0])<0});if(!rows.length)return;
  h+='<div class="mr-g">'+g[0]+'</div>'+rows.map(function(r){return '<button class="mr-r" data-p="'+r[0]+'">'+ic(r[2])+'<span class="lb">'+r[1]+'</span>'+ic('chev')+'</button>'}).join('')});
 h+='<div class="mr-g">Conta</div><button class="mr-r" data-p="settings">'+ic('sliders')+'<span class="lb">Configurações</span>'+ic('chev')+'</button>';
 sheet(h,function(o){o.querySelectorAll('[data-p]').forEach(function(b){b.onclick=function(){o.remove();go(b.dataset.p)}})})}

/* ===== avisos ===== */
var KIND={event_new:['Novo evento','calendar'],event_reminder:['Lembrete','clock'],meeting:['Reunião','repeat'],message:['Mensagem','chat'],pending:['Pendência','userplus']};
function fmt(d){try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
function inbox(){return logged()?rpc('adh_my_notifications',{p_limit:50}).catch(function(){return []}):Promise.resolve([])}
function setUnread(rows){S.unread=(rows||[]).filter(function(r){return !r.is_read}).length;renderNav()}
function renderInbox(el,rows,after){
 el.innerHTML=rows.length?rows.map(function(r,i){var k=KIND[r.kind]||['Aviso','bell'];
  return '<div class="av-i'+(r.is_read?'':' n')+'" data-i="'+i+'"><div class="ico">'+ic(k[1],'sm')+'</div><div class="tx"><b>'+esc(r.title)+'</b>'+(r.body?'<p>'+esc(r.body)+'</p>':'')+'<small>'+k[0]+' · '+fmt(r.created_at)+'</small></div>'+(r.image_url?'<img class="th" src="'+esc(r.image_url)+'" alt="">':'')+'</div>'}).join(''):'<p style="color:var(--a-mut);margin:6px 0">Nenhum aviso por enquanto.</p>';
 el.querySelectorAll('.av-i').forEach(function(n){n.onclick=function(){popup(rows[+n.dataset.i],true)}});
 if(after)after()}
function markRead(rows){if(rows.some(function(r){return !r.is_read}))rpc('adh_mark_notifications_read',{}).then(function(){S.unread=0;renderNav()}).catch(function(){})}
function refreshAvisos(){return inbox().then(function(rows){setUnread(rows);return rows})}
function openInboxSheet(){
 var o=sheet('<div class="av-h"><b>Avisos</b><button class="av-x" aria-label="Fechar">'+ic('x','sm')+'</button></div><div id="avSheetList"><p style="color:var(--a-mut)">Carregando…</p></div>');
 inbox().then(function(rows){setUnread(rows);renderInbox(o.querySelector('#avSheetList'),rows);markRead(rows)})}
function renderAvisosPage(){
 var acts=$('avActs');if(acts){acts.innerHTML=isLeader()?'<button class="btn primary" id="avNew">'+ic('plus','sm')+'Enviar aviso</button>':'';var n=$('avNew');if(n)n.onclick=openSend}
 var l=$('avList');if(l)l.innerHTML='<p style="color:var(--a-mut);margin:0">Carregando…</p>';
 inbox().then(function(rows){setUnread(rows);if(l)renderInbox(l,rows);markRead(rows)})}
/* pop-up em tela cheia (mensagem do dia etc.) */
function popup(r,manual){
 if(!r)return;var o=document.createElement('div');o.className='pp';var k=KIND[r.kind]||['Aviso'];
 o.innerHTML='<div class="pk">'+esc(k[0])+' · '+fmt(r.created_at)+'</div>'+(r.image_url?'<img src="'+esc(r.image_url)+'" alt="">':'')+'<h2>'+(r.kind==='message'?'“'+esc(r.title)+'”':esc(r.title))+'</h2>'+(r.body?'<p>'+esc(r.body)+'</p>':'')+'<div class="pf"><button class="b b-gold" id="ppOk">Entendi</button></div>';
 document.body.appendChild(o);$('ppOk').onclick=function(){o.remove();if(!manual)markRead([r])}}
function popCheck(rows){
 try{var seen=JSON.parse(localStorage.getItem('adh-pop')||'[]');
  var r=rows.filter(function(x){return x.kind==='message'&&!x.is_read&&seen.indexOf(x.id)<0&&Date.now()-new Date(x.created_at).getTime()<3*864e5})[0];
  if(r&&!document.querySelector('.pp')){seen.push(r.id);localStorage.setItem('adh-pop',JSON.stringify(seen.slice(-40)));popup(r,false)}}catch(e){}}

/* ===== enviar aviso ===== */
function myChapters(){
 var all=[];try{all=(adhDbChapters||[]).filter(function(c){return c.status==='active'})}catch(e){}
 var r=role();
 if(r==='chapter_president'){var mine=(adhProfile.chapterIds||[]).map(String);return all.filter(function(c){return mine.indexOf(String(c.id))>-1})}
 if(r==='regional_director'){var rg=(adhProfile.regionIds||[]).map(String);return all.filter(function(c){return rg.indexOf(String(c.region_id))>-1})}
 return all}
function myRegions(){var rs=[];try{rs=adhDbRegions||[]}catch(e){}if(role()==='regional_director'){var rg=(adhProfile.regionIds||[]).map(String);return rs.filter(function(x){return rg.indexOf(String(x.id))>-1})}return rs}
function openSend(){
 var r=role(),state=r==='state_admin'||r==='state_director';
 var o=sheet('<div class="av-h"><b>Enviar aviso</b><button class="av-x" aria-label="Fechar">'+ic('x','sm')+'</button></div><form class="av-f" id="avF"></form>',function(o){
  var f=o.querySelector('#avF'),kind='message';
  function body(){
   var aud=[];
   if(kind==='message'){if(state)aud.push(['state','Todo o estado']);if(state||r==='regional_director')aud.push(['region',state?'Uma região':'Minha região']);aud.push(['chapter',r==='chapter_president'?'Meu capítulo':'Um capítulo'])}
   else aud.push(['chapter',r==='chapter_president'?'Meu capítulo':'Capítulo'])
   var cur=f.aud?f.aud.value:aud[0][0];if(!aud.some(function(a){return a[0]===cur}))cur=aud[0][0];
   var tg='';
   if(cur==='region')tg='<label>Região</label><select name="region">'+myRegions().map(function(x){return '<option value="'+x.id+'">'+esc(x.name)+'</option>'}).join('')+'</select>';
   if(cur==='chapter')tg='<label>Capítulo</label><select name="chapter">'+myChapters().map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('')+'</select>';
   var keep={title:f.title?f.title.value:'',body:f.body?f.body.value:'',when:f.when?f.when.value:''};
   f.innerHTML='<label>Tipo</label><div class="seg"><button type="button" data-k="message" class="'+(kind==='message'?'on':'')+'">Mensagem do dia</button><button type="button" data-k="meeting" class="'+(kind==='meeting'?'on':'')+'">Reunião do capítulo</button></div>'
   +'<label>Para</label><select name="aud"'+(aud.length===1?' disabled':'')+'>'+aud.map(function(a){return '<option value="'+a[0]+'"'+(a[0]===cur?' selected':'')+'>'+a[1]+'</option>'}).join('')+'</select>'+tg
   +'<label>Título da notificação</label><input name="title" maxlength="120" required value="'+esc(keep.title)+'"><p class="hint">É a primeira linha que aparece no celular. Na mensagem do dia, o texto completo abre em tela cheia.</p>'
   +'<label>Mensagem</label><textarea name="body" rows="4" maxlength="600">'+esc(keep.body)+'</textarea>'
   +'<label>Imagem (opcional)</label><div class="imgbox"><button type="button" class="btn small" id="avImgB">'+ic('image','xs')+'Escolher imagem</button><span id="avImgN" class="hint"></span></div><input type="file" id="avImg" accept="image/jpeg,image/png,image/webp" hidden>'
   +'<label>Enviar em (opcional)</label><input type="datetime-local" name="when" value="'+esc(keep.when)+'">'
   +'<button class="go" type="submit">Enviar aviso</button><p id="avM" class="hint"></p>';
   f.querySelectorAll('.seg button').forEach(function(b){b.onclick=function(){kind=b.dataset.k;body()}});
   f.aud.onchange=body;
   $('avImgB').onclick=function(){$('avImg').click()};
   $('avImg').onchange=function(){var fl=this.files&&this.files[0];$('avImgN').textContent=fl?fl.name:''}}
  body();
  f.onsubmit=async function(e){e.preventDefault();var m=$('avM');m.textContent='Enviando…';
   try{var img=null,fl=$('avImg').files&&$('avImg').files[0];if(fl)img=await uploadImg(fl);
    var aud=f.aud.value,b={p_kind:kind,p_title:f.title.value,p_body:f.body.value,p_audience:aud,p_region:f.region?+f.region.value:null,p_chapter:f.chapter?+f.chapter.value:null,p_send_at:f.when.value?new Date(f.when.value).toISOString():new Date().toISOString(),p_image:img};
    if(aud==='chapter'&&!b.p_chapter)throw new Error('Escolha o capítulo.');if(aud==='region'&&!b.p_region)throw new Error('Escolha a região.');
    await rpc('adh_send_notification',b);m.textContent='Aviso enviado.';setTimeout(function(){o.remove();if($('avList'))renderAvisosPage()},800)}
   catch(x){m.textContent=x.message||'Não foi possível enviar.'}}})}
function uploadImg(file){
 return new Promise(function(res,rej){var im=new Image(),u=URL.createObjectURL(file);im.onload=function(){
   var s=Math.min(1,1400/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);
   cv.toBlob(function(b){b?res(b):rej(new Error('Imagem inválida.'))},'image/jpeg',.82)};im.onerror=function(){rej(new Error('Não foi possível ler a imagem.'))};im.src=u})
 .then(function(blob){if(blob.size>5*1024*1024)throw new Error('Imagem acima de 5 MB.');
  var path=Date.now()+'-'+Math.random().toString(36).slice(2,9)+'.jpg';
  return fetch(ADH_SUPABASE_URL+'/storage/v1/object/notification-images/'+path,{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,Authorization:'Bearer '+adhSession.access_token,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob})
   .then(function(r){if(!r.ok)throw new Error('Não foi possível enviar a imagem ('+r.status+').');return ADH_SUPABASE_URL+'/storage/v1/object/public/notification-images/'+path})})}

/* ===== configurações ===== */
function homeAnim(on){var g=document.querySelector('#appHome .ah-globe'),v=g&&g.dataset.v;
 if(window.AdhGlobe){if(on&&v==='world')AdhGlobe.start();else AdhGlobe.stop()}
 if(window.AdhSC){if(on&&v!=='world')AdhSC.start();else AdhSC.stop()}}
function settingsHtml(){
 var p=null;try{p=adhProfile}catch(e){}
 var pref='auto';try{pref=localStorage.getItem('adh-tema')||'auto'}catch(e){}
 var h='<div class="st-box"><div class="st-who"><b id="stName">'+esc((p&&p.label)||'Conta')+'</b><span id="stMail"></span></div><button class="mr-r" data-a="acct">'+ic('user')+'<span class="lb">Minha conta</span>'+ic('chev')+'</button></div>';
 h+='<div class="st-g">Aparência</div><div class="st-box"><div class="st-seg" data-seg>'+[['auto','Automático','sliders'],['light','Claro','sun'],['dark','Escuro','moon']].map(function(t){return '<button type="button" data-t="'+t[0]+'" class="'+(pref===t[0]?'on':'')+'">'+ic(t[2],'xs')+t[1]+'</button>'}).join('')+'</div></div>';
 var fid='';if(window.adhFaceId&&window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())fid='<div class="st-g">Acesso</div><div class="st-box"><button class="mr-r" data-a="fid">'+ic('lock')+'<span class="lb">Entrar com Face ID</span><span class="st-st" id="fidSt">'+(adhFaceId.isOn()?'Ativado':'Desativado')+'</span></button></div>';
 h+=fid;
 var extra='';
 if(can('audit'))extra+='<button class="mr-r" data-a="audit">'+ic('clock')+'<span class="lb">Histórico de ações</span>'+ic('chev')+'</button>';
 if(can('lgpd'))extra+='<button class="mr-r" data-a="lgpd">'+ic('lock')+'<span class="lb">Privacidade (LGPD)</span>'+ic('chev')+'</button>';
 h+='<div class="st-g">Gestão</div><div class="st-box">'+(extra||'')+'<a class="mr-r" href="privacidade.html" style="text-decoration:none">'+ic('shield')+'<span class="lb">Política de privacidade</span>'+ic('chev')+'</a><a class="mr-r" href="termos.html" style="text-decoration:none">'+ic('file')+'<span class="lb">Termos de uso</span>'+ic('chev')+'</a></div>';
 h+='<div class="st-g"> </div><div class="st-box"><button class="mr-r" data-a="out">'+ic('logout')+'<span class="lb">Sair</span>'+ic('chev')+'</button></div><div class="st-ver">ADHONEP-SC · app '+esc(window.ADH_VER_APP||'')+'</div>';
 return h}
function bindSettings(root,close){
 root.querySelectorAll('[data-t]').forEach(function(b){b.onclick=function(){setTheme(b.dataset.t);root.querySelectorAll('[data-t]').forEach(function(x){x.classList.toggle('on',x===b)})}});
 root.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){var a=b.dataset.a;if(a!=='fid'&&close)close();
  if(a==='fid'){var st=root.querySelector('#fidSt');(adhFaceId.isOn()?adhFaceId.disable():adhFaceId.enable()).then(function(){if(st)st.textContent=adhFaceId.isOn()?'Ativado':'Desativado';toast(adhFaceId.isOn()?'Face ID ativado.':'Face ID desativado.')}).catch(function(){toast('Não foi possível ativar o Face ID.')});return}
  if(a==='acct'){try{openAccount()}catch(e){}}
  else if(a==='audit'||a==='lgpd'){setMode('admin');go(a)}
  else if(a==='out'){try{signOutAdmin()}catch(e){}S.landed=false;S.rankAccess=null;S.unread=0;setTab('home')}}});
 try{adhFetch('/auth/v1/user').then(function(u){var m=root.querySelector('#stMail');if(m&&u)m.textContent=u.email||''})}catch(e){}}
function renderSettingsPage(){var b=$('stBody');if(!b)return;b.innerHTML=settingsHtml();bindSettings(b)}
function openSettingsSheet(){var o=sheet('<div class="av-h"><b>Configurações</b><button class="av-x" aria-label="Fechar">'+ic('x','sm')+'</button></div><div id="stSheet">'+settingsHtml()+'</div>');bindSettings(o,function(){o.remove()})}

/* ===== ranking: quem pode ver (somente administrador estadual) ===== */
function rankAccessPanel(){
 var pg=$('page-ranking');if(!pg||role()!=='state_admin'){var old=$('rkAcc');if(old)old.remove();return}
 var box=$('rkAcc');if(!box){box=document.createElement('div');box.id='rkAcc';box.className='panel rk-acc';pg.appendChild(box)}
 box.innerHTML='<h3>Quem pode ver o ranking</h3><p class="sub">Administrador e diretoria estadual já veem tudo. Cada diretor regional vê só a sua região. Aqui você libera ou retira o acesso de outras pessoas.</p><div id="rkList"><p class="sub">Carregando…</p></div>'
 +'<form id="rkF"><input class="field" name="email" type="email" placeholder="E-mail da conta" required><select class="field" name="scope"><option value="state">Ranking estadual</option><option value="region">Ranking de uma região</option></select><select class="field" name="region" hidden>'+((adhDbRegions||[]).map(function(x){return '<option value="'+x.id+'">'+esc(x.name)+'</option>'}).join(''))+'</select><button class="btn primary" type="submit">Liberar acesso</button></form><p class="sub" id="rkM"></p>';
 var f=$('rkF');f.scope.onchange=function(){f.region.hidden=f.scope.value!=='region'};
 function list(){rpc('adh_ranking_access_list',{}).then(function(rows){$('rkList').innerHTML=(rows||[]).length?rows.map(function(r){return '<div class="row"><span>'+esc(r.email)+' · '+(r.scope==='state'?'estadual':esc(r.region_name||'região'))+'</span><button class="btn small" data-e="'+esc(r.email)+'" data-s="'+r.scope+'" data-r="'+(r.region_id||'')+'">Remover</button></div>'}).join(''):'<p class="sub">Nenhuma liberação manual.</p>';
  $('rkList').querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){rpc('adh_ranking_access_set',{p_email:b.dataset.e,p_scope:b.dataset.s,p_region:b.dataset.r?+b.dataset.r:null,p_on:false}).then(list).catch(function(e){$('rkM').textContent=e.message})}})}).catch(function(e){$('rkList').innerHTML='<p class="sub">'+esc(e.message)+'</p>'})}
 f.onsubmit=function(e){e.preventDefault();$('rkM').textContent='Salvando…';rpc('adh_ranking_access_set',{p_email:f.email.value,p_scope:f.scope.value,p_region:f.scope.value==='region'?+f.region.value:null,p_on:true}).then(function(){f.reset();f.region.hidden=true;$('rkM').textContent='Acesso liberado.';list()}).catch(function(x){$('rkM').textContent=x.message})};
 list()}

/* ===== ganchos nas telas existentes ===== */
function hook(){
 var _sp=window.showPage;
 if(typeof _sp==='function')window.showPage=function(name,btn){
  if(name==='access-requests'&&!S.landed&&logged()){var s=adminSlots()[0];if(s)name=s[0]}
  S.landed=true;var r=_sp.call(this,name,btn);onPage(name);renderNav();return r};
 var _rp=window.renderPublic;
 if(typeof _rp==='function')window.renderPublic=function(){var r=_rp.apply(this,arguments);try{homeStats();renderEv();syncFind()}catch(e){}return r};
 var _sm=window.setMode;
 if(typeof _sm==='function')window.setMode=function(m){var r=_sm.apply(this,arguments);if(m==='admin'&&logged()){S.landed=S.landed||false}renderNav();return r}}
function onPage(n){
 if(n==='avisos')renderAvisosPage();
 if(n==='settings')renderSettingsPage();
 if(n==='ranking')rankAccessPanel();
 if(n==='audit'||n==='lgpd'){var h=document.querySelector('#page-'+n+' .adminhead');if(h&&!h.querySelector('[data-back]')){var b=document.createElement('button');b.className='btn small';b.setAttribute('data-back','1');b.innerHTML=ic('chev','xs').replace('class="ic xs"','class="ic xs" style="transform:rotate(180deg)"')+'Configurações';b.onclick=function(){go('settings')};h.insertBefore(b,h.firstChild)}}}
function homeStats(){
 try{var pub=(chapters||[]).filter(isPublicChapter);if(window.AdhSC)AdhSC.gold(pub.map(function(c){return c.city}));var a=$('ahChap'),b=$('ahCity');if(a)a.textContent=pub.length;if(b)b.textContent=new Set(pub.map(function(c){return c.city})).size}catch(e){}}

/* sem emoji: texto de botões e títulos fica só com palavras; os ícones são sempre SVG */
var EMO=/^[\s←-⯿☀-➿\u{1F000}-\u{1FAFF}️‍]+(?=[A-Za-zÀ-ú0-9"“(])/u;
function clean(root){
 try{root.querySelectorAll('button,.btn,summary,h1,h2,h3,option,label,.nav,a.btn').forEach(function(el){
  if(el.closest('#appNav,.pp'))return;var n=el.firstChild;if(n&&n.nodeType===3&&EMO.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(EMO,'')})}catch(e){}}
var cq=null;
new MutationObserver(function(){if(cq)return;cq=setTimeout(function(){cq=null;clean(document.body)},300)}).observe(document.body,{childList:true,subtree:true});

window.adhGoTab=setTab;window.adhOpenAvisos=function(){if(!logged())return;if(curMode()==='admin')go('avisos');else openInboxSheet()};
/* ===== ciclo ===== */
function poll(){
 var sig=[curMode(),role(),logged(),(document.querySelector('#adminView .apage.on')||{}).id,S.tab,S.unread,S.rankAccess].join('|');
 if(sig!==S.sig){var was=S.sig.split('|')[2];S.sig=sig;renderNav();
  if(logged()&&was!=='true'){S.rankAccess=null;rpc('adh_my_ranking_access',{}).then(function(v){S.rankAccess=v||'none';renderNav()}).catch(function(){S.rankAccess=null});refreshAvisos().then(popCheck)}
  if(!logged()&&was==='true'){S.landed=false;S.unread=0;S.rankAccess=null}}}
function init(){
 if(!$('publicView'))return;
 mount();hook();homeStats();renderEv();clean(document.body);
 homeAnim(true);
 setInterval(poll,700);
 setInterval(function(){if(logged())refreshAvisos().then(popCheck)},120000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
