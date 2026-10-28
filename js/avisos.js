/* ADHONEP-SC · Avisos (caixa de entrada + envio pelos líderes). Funciona no site e no app. */
(function(){
 var $=function(id){return document.getElementById(id)};
 var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
 function rpc(name,body){var tok=(typeof adhSession!=='undefined'&&adhSession&&adhSession.access_token)||ADH_SUPABASE_KEY;
  return fetch(ADH_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify(body||{})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j&&j.message||'Erro');return j})})}
 var css=document.createElement('style');css.textContent='.av-o{position:fixed;inset:0;z-index:200;background:rgba(8,20,40,.55);display:flex;align-items:flex-end;justify-content:center}.av-b{background:#fff;width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25)}@media(min-width:700px){.av-o{align-items:center}.av-b{border-radius:18px}}.av-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.av-h b{font-size:18px;color:#102b4e}.av-x{border:0;background:#eef2f8;border-radius:50%;width:34px;height:34px;font-size:16px;cursor:pointer}.av-i{padding:12px 0;border-top:1px solid #e4e9f1;cursor:pointer}.av-i.n b::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#c9a24a;margin-right:6px}.av-i b{color:#102b4e;font-size:15px}.av-i p{margin:3px 0;color:#4a5a73;font-size:14px}.av-i small{color:#8593a8}.av-f label{display:block;margin:10px 0 4px;font-size:13px;font-weight:600;color:#102b4e}.av-f input,.av-f select,.av-f textarea{width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8e6;border-radius:10px;font:inherit}.av-f button.go{margin-top:14px;width:100%;padding:12px;border:0;border-radius:12px;background:#102b4e;color:#fff;font-weight:700;font-size:15px}#avBadge{position:absolute;top:2px;right:calc(50% - 22px);background:#c0392b;color:#fff;border-radius:9px;font:700 10px/1 inherit;padding:2px 5px;min-width:8px}#avBell{position:fixed;right:14px;bottom:18px;z-index:80;width:48px;height:48px;border-radius:50%;border:0;background:#102b4e;color:#fff;font-size:20px;box-shadow:0 6px 18px rgba(0,0,0,.3)}html.in-app #avBell{display:none}#avBell span{position:absolute;top:-4px;right:-4px;background:#c0392b;border-radius:9px;font:700 11px/1 sans-serif;padding:3px 6px}';document.head.appendChild(css);
 function overlay(html){var o=document.createElement('div');o.className='av-o';o.innerHTML='<div class="av-b" role="dialog" aria-modal="true">'+html+'</div>';o.addEventListener('click',function(e){if(e.target===o||e.target.closest('.av-x'))o.remove()});document.body.appendChild(o);return o}
 var KIND={event_new:'Novo evento',event_reminder:'Lembrete',meeting:'Reunião',message:'Mensagem',pending:'Pendência'};
 function fmt(d){try{return new Date(d).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return ''}}
 var unread=0;
 function badge(n){unread=n;var b=$('avBadge');if(b){b.textContent=n;b.hidden=!n}var bl=$('avBell');if(bl){var s=bl.querySelector('span');if(s){s.textContent=n;s.hidden=!n}}}
 window.adhRefreshAvisos=function(){return rpc('adh_my_notifications',{p_limit:50}).then(function(rows){var n=(rows||[]).filter(function(r){return !r.is_read}).length;badge(n);return rows||[]}).catch(function(){return []})};
 window.adhOpenInbox=function(){
  adhRefreshAvisos().then(function(rows){
   var o=overlay('<div class="av-h"><b>Avisos</b><button class="av-x" aria-label="Fechar">✕</button></div>'+(rows.length?rows.map(function(r){return '<div class="av-i'+(r.is_read?'':' n')+'" data-s="'+esc(r.link_section||'')+'"><b>'+esc(r.title)+'</b>'+(r.body?'<p>'+esc(r.body)+'</p>':'')+'<small>'+esc(KIND[r.kind]||'')+' · '+fmt(r.created_at)+'</small></div>'}).join(''):'<p style="color:#4a5a73">Nenhum aviso por enquanto.</p>'));
   o.addEventListener('click',function(e){var it=e.target.closest('.av-i');if(!it)return;var s=it.dataset.s;o.remove();var el=s&&$(s);if(el)el.scrollIntoView({behavior:'smooth'})});
   if(typeof adhSession!=='undefined'&&adhSession&&rows.some(function(r){return !r.is_read}))rpc('adh_mark_notifications_read',{}).then(function(){badge(0)}).catch(function(){});
  })};
 /* Envio pelos líderes */
 var LEAD={state_admin:1,state_director:1,regional_director:1,chapter_president:1};
 window.adhOpenSend=function(){
  var role=(typeof adhProfile!=='undefined'&&adhProfile&&adhProfile.role)||'',all=role==='state_admin'||role==='state_director';
  var regs=(typeof adhDbRegions!=='undefined'?adhDbRegions:[]),chs=(typeof adhDbChapters!=='undefined'?adhDbChapters:[]).filter(function(c){return c.status==='active'});
  var aud=[];if(all)aud.push(['state','Todo o estado']);if(all||role==='regional_director')aud.push(['region','Uma região']);aud.push(['chapter','Um capítulo']);
  var o=overlay('<div class="av-h"><b>Enviar aviso</b><button class="av-x" aria-label="Fechar">✕</button></div><form class="av-f"><label>Tipo</label><select name="kind"><option value="message">Mensagem / palavra do dia</option><option value="meeting">Reunião do capítulo</option></select><label>Para</label><select name="aud">'+aud.map(function(a){return '<option value="'+a[0]+'">'+a[1]+'</option>'}).join('')+'</select><div id="avT"></div><label>Título</label><input name="title" maxlength="120" required><label>Mensagem</label><textarea name="body" rows="4" maxlength="600"></textarea><label>Enviar em (opcional)</label><input type="datetime-local" name="when"><button class="go" type="submit">Enviar aviso</button><p id="avM" style="font-size:13px;color:#4a5a73"></p></form>');
  var f=o.querySelector('form');
  function tgt(){var a=f.aud.value,h='';if(a==='region')h='<label>Região</label><select name="region">'+regs.map(function(r){return '<option value="'+r.id+'">'+esc(r.name)+'</option>'}).join('')+'</select>';if(a==='chapter')h='<label>Capítulo</label><select name="chapter">'+chs.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>'}).join('')+'</select>';o.querySelector('#avT').innerHTML=h}
  f.aud.onchange=tgt;tgt();
  f.onsubmit=function(e){e.preventDefault();var b={p_kind:f.kind.value,p_title:f.title.value,p_body:f.body.value,p_audience:f.aud.value,p_region:f.region?+f.region.value:null,p_chapter:f.chapter?+f.chapter.value:null,p_send_at:f.when.value?new Date(f.when.value).toISOString():new Date().toISOString()};
   $('avM')&&0;o.querySelector('#avM').textContent='Enviando…';
   rpc('adh_send_notification',b).then(function(){o.querySelector('#avM').textContent='Aviso enviado.';setTimeout(function(){o.remove()},900)}).catch(function(x){o.querySelector('#avM').textContent=x.message})};
 };
 /* botões */
 function ensure(){
  var logged=typeof adhSession!=='undefined'&&adhSession;
  var role=(typeof adhProfile!=='undefined'&&adhProfile&&adhProfile.role)||'';
  var host=document.querySelector('#adminView .rolebar,#adminView [onclick*="openAccount"]');
  var acct=document.querySelector('#adminView button[onclick="openAccount()"]');
  var sb=$('avSend');
  if(logged&&LEAD[role]&&acct&&!sb){sb=document.createElement('button');sb.id='avSend';sb.type='button';sb.className='btn small';sb.style.marginLeft='10px';sb.textContent='📣 Enviar aviso';sb.onclick=window.adhOpenSend;acct.parentNode.insertBefore(sb,acct)}
  if((!logged||!LEAD[role])&&sb)sb.remove();
  var mb=document.querySelector('#memberView .actions');
  if(logged&&mb&&!$('avInbox2')){var ib=document.createElement('button');ib.id='avInbox2';ib.className='btn';ib.type='button';ib.textContent='🔔 Avisos';ib.onclick=window.adhOpenInbox;mb.insertBefore(ib,mb.firstChild)}
  if(!$('avBell')){var bl=document.createElement('button');bl.id='avBell';bl.type='button';bl.setAttribute('aria-label','Avisos');bl.innerHTML='🔔<span hidden>0</span>';bl.onclick=window.adhOpenInbox;document.body.appendChild(bl)}
 }
 setInterval(ensure,1500);ensure();
 setTimeout(adhRefreshAvisos,2500);setInterval(adhRefreshAvisos,120000);
})();
