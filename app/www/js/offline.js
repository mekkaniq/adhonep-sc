/* ADHONEP-SC app · uso offline: guarda a última resposta pública do servidor e usa quando não há internet. */
(function(){
 if(!window.fetch||window.__adhOffline)return;window.__adhOffline=1;
 var PUB=/\/rest\/v1\/(chapters|events|municipalities|regions|public_announcements|chapter_public_info)\?/;
 var orig=window.fetch.bind(window),PFX='adhc1:';
 function banner(ts){var b=document.getElementById('adhOff');if(!b){b=document.createElement('div');b.id='adhOff';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:300;background:#7a5b14;color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:calc(6px + env(safe-area-inset-top)) 12px 6px;text-align:center';document.body&&document.body.appendChild(b)}
  b.textContent='Sem conexão — mostrando dados salvos'+(ts?' de '+new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'');b.hidden=false}
 window.addEventListener('online',function(){var b=document.getElementById('adhOff');if(b)b.hidden=true});
 window.fetch=function(input,init){
  var url=typeof input==='string'?input:(input&&input.url)||'',method=((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
  if(method!=='GET'||!PUB.test(url))return orig(input,init);
  var hdr=(init&&init.headers)||{},auth=hdr.Authorization||hdr.authorization||'';
  var S=null;try{S=typeof adhSession!=='undefined'?adhSession:null}catch(e){}var user=!!(S&&S.access_token&&String(auth).indexOf(S.access_token)>-1);
  if(user)return orig(input,init);                       // dados autenticados nunca são guardados
  return orig(input,init).then(function(r){
    if(r&&r.ok){try{r.clone().text().then(function(t){try{localStorage.setItem(PFX+url,JSON.stringify({t:Date.now(),b:t}))}catch(e){}})}catch(e){}}
    return r;
  }).catch(function(err){
    try{var c=JSON.parse(localStorage.getItem(PFX+url)||'null');
      if(c){banner(c.t);return new Response(c.b,{status:200,headers:{'Content-Type':'application/json'}})}}catch(e){}
    throw err;
  });
 };
})();
