/* ADHONEP-SC app · Face ID, ações nativas (ligar, mapa, compartilhar), calendário e atalho de reunião. */
(function(){
 var C=window.Capacitor,NATIVE=!!(C&&C.isNativePlatform&&C.isNativePlatform());
 var $=function(id){return document.getElementById(id)};
 var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
 function plug(n){try{return (C&&C.Plugins&&C.Plugins[n])||null}catch(e){return null}}
 function sess(){try{return typeof adhSession!=='undefined'?adhSession:null}catch(e){return null}}
 function role(){try{return (typeof adhProfile!=='undefined'&&adhProfile&&adhProfile.role)||''}catch(e){return ''}}
 function pop(html){var o=document.createElement('div');o.className='av-o';o.innerHTML='<div class="av-b" role="dialog" aria-modal="true">'+html+'</div>';o.addEventListener('click',function(e){if(e.target===o||e.target.closest('.av-x'))o.remove()});document.body.appendChild(o);return o}
 function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}

 /* ===== 1) Face ID / biometria ===== */
 var BIO=plug('BiometricAuth'),SS=plug('SecureStorage'),KEY='adh_rt';
 function bioOk(){return BIO&&SS&&BIO.checkBiometry?BIO.checkBiometry().then(function(r){return !!(r&&r.isAvailable)}).catch(function(){return false}):Promise.resolve(false)}
 function bioAsk(reason){return BIO.authenticate({reason:reason||'Entrar no ADHONEP-SC',cancelTitle:'Cancelar',allowDeviceCredential:false,iosFallbackTitle:''})}
 function offerFaceId(){
  if(!NATIVE||ls('adh-faceid')||!sess()||!sess().refresh_token)return;
  bioOk().then(function(ok){if(!ok)return;
   var o=pop('<div class="av-h"><b>Entrar com Face ID?</b><button class="av-x" aria-label="Fechar">×</button></div><p style="color:#4a5a73;font-size:14px">Nas próximas vezes você entra sem digitar a senha. Seus dados de acesso ficam protegidos no iPhone.</p><div class="av-f"><button class="go" id="fidYes">Ativar Face ID</button><button class="go" id="fidNo" style="background:#eef2f8;color:#102b4e">Agora não</button></div>');
   $('fidNo').onclick=function(){ls('adh-faceid','off');o.remove()};
   $('fidYes').onclick=function(){var s=sess();bioAsk('Ativar entrada com Face ID').then(function(){return SS.set({key:KEY,data:s.refresh_token})}).then(function(){ls('adh-faceid','on');o.remove()}).catch(function(){o.remove()})};
  })}
 function faceLogin(){
  if(!NATIVE||ls('adh-faceid')!=='on'||sess())return;
  var o=pop('<div class="av-h"><b>Entrar com Face ID</b><button class="av-x" aria-label="Fechar">×</button></div><div class="av-f"><button class="go" id="fidGo">Usar Face ID</button><p id="fidM" style="font-size:13px;color:#4a5a73"></p></div>');
  function run(){var m=$('fidM');bioAsk('Entrar no ADHONEP-SC').then(function(){return SS.get({key:KEY})}).then(function(r){var rt=r&&(r.data||r.value);if(!rt)throw new Error('sem token');
    return fetch(ADH_SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:rt})}).then(function(x){return x.json()})})
   .then(function(d){if(!d||!d.access_token)throw new Error('expirou');adhStoreSession(d);SS.set({key:KEY,data:d.refresh_token}).catch(function(){});o.remove();return adhValidateRestoredSession()})
   .then(function(ok){try{if(ok&&adhProfile&&adhProfile.role!=='member')setMode('admin')}catch(e){}})
   .catch(function(e){if(m)m.textContent=(e&&/expirou|sem token/.test(e.message))?'Sessão expirada. Entre com e-mail e senha.':'';if(e&&/expirou|sem token/.test(e.message)){ls('adh-faceid','');try{SS.remove({key:KEY})}catch(x){}}})}
  $('fidGo').onclick=run;setTimeout(run,300)}
 window.adhFaceId={
  available:bioOk,
  isOn:function(){return ls('adh-faceid')==='on'},
  enable:function(){var t=sess();if(!t||!t.refresh_token)return Promise.reject(new Error('sem sessão'));return bioAsk('Ativar entrada com Face ID').then(function(){return SS.set({key:KEY,data:t.refresh_token})}).then(function(){ls('adh-faceid','on')})},
  disable:function(){ls('adh-faceid','off');try{SS.remove({key:KEY})}catch(e){}return Promise.resolve()}
 };
 window.addEventListener('load',function(){setTimeout(faceLogin,1200)});
 setInterval(offerFaceId,4000);
 /* ao sair, limpa o que foi guardado */
 var _so=window.signOutAdmin;if(typeof _so==='function'){window.signOutAdmin=function(){try{ls('adh-faceid','');SS&&SS.remove({key:KEY})}catch(e){}return _so.apply(this,arguments)}}

 /* ===== 2) Ações nativas nos capítulos e eventos ===== */
 function maps(q){return 'https://maps.apple.com/?q='+encodeURIComponent(q)}
 function openUrl(u){var B=plug('Browser');if(NATIVE&&B&&B.open&&/^https?:/.test(u)){B.open({url:u})}else location.href=u}
 function shareIt(t,x,u){var S=plug('Share');if(NATIVE&&S&&S.share)return S.share({title:t,text:x,url:u||'https://www.adhonepemsc.com.br/'});if(navigator.share)return navigator.share({title:t,text:x,url:u});}
 function enhanceChapter(){
  var d=$('publicDetail');if(!d||d.querySelector('.nx-acts')||!d.querySelector('strong'))return;
  var name=d.querySelector('strong').textContent;if(/Selecione/.test(name))return;
  var txt=d.innerText,m=/Município: (.+?) ·/.exec(txt),ad=/Endereço: (.+)/.exec(txt),city=m?m[1].trim():'';
  var wa=d.querySelector('a[href*="wa.me/"]'),num=wa?(/wa\.me\/(\d+)/.exec(wa.href)||[])[1]:'';
  var h='<div class="nx-acts">';
  if(num)h+='<a class="btn small" href="tel:+'+esc(num)+'">Ligar</a>';
  h+='<a class="btn small" data-m="'+esc((ad?ad[1].trim()+', ':'')+city+', SC')+'">Como chegar</a><a class="btn small" data-s="1">Compartilhar</a></div>';
  d.insertAdjacentHTML('beforeend',h);
  d.querySelector('[data-m]').onclick=function(e){e.preventDefault();openUrl(maps(this.dataset.m))};
  d.querySelector('[data-s]').onclick=function(e){e.preventDefault();shareIt(name,'Capítulo '+name+' da ADHONEP em '+city+' — encontre no app ADHONEP-SC.')}}
 /* ===== 3) Calendário ===== */
 function ics(ev){var z=function(d){return new Date(d).toISOString().replace(/[-:]|\.\d{3}/g,'')};var s=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ADHONEP-SC//PT','BEGIN:VEVENT','UID:'+ev.id+'@adhonepemsc.com.br','DTSTAMP:'+z(Date.now()),'DTSTART:'+z(ev.start),'DTEND:'+z(ev.end),'SUMMARY:'+String(ev.title).replace(/[,;\n]/g,' '),'LOCATION:'+String(ev.loc||'').replace(/[,;\n]/g,' '),'END:VEVENT','END:VCALENDAR'].join('\r\n');var a=document.createElement('a');a.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(s);a.download='evento.ics';document.body.appendChild(a);a.click();a.remove()}
 function addCal(id){
  var e=null;try{e=(adhDbEvents||[]).filter(function(x){return String(x.id)===String(id)})[0]}catch(x){}if(!e||!e.starts_at)return;
  var st=new Date(e.starts_at).getTime(),en=e.ends_at?new Date(e.ends_at).getTime():st+2*3600e3,loc=e.venue_name||e.address||'';
  var K=plug('CapacitorCalendar');
  if(NATIVE&&K&&K.createEventWithPrompt)K.createEventWithPrompt({title:e.title,location:loc,startDate:st,endDate:en,description:'ADHONEP-SC'}).catch(function(){});
  else ics({id:id,title:e.title,start:st,end:en,loc:loc})}
 window.adhAddCal=addCal;window.adhShareIt=shareIt;
 var css=document.createElement('style');css.textContent='.nx-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.nx-acts .btn{text-decoration:none;display:inline-block}.nx-cal{margin-left:0}';document.head.appendChild(css);
 setInterval(enhanceChapter,1200);
})();
