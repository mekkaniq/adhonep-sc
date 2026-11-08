/* ADHONEP-SC · camada de aplicativo (Capacitor). No navegador comum não faz nada (excluir conta fica em js/conta.js). */
(function(){
 var C=window.Capacitor, NATIVE=!!(C&&C.isNativePlatform&&C.isNativePlatform());
 var $=function(id){return document.getElementById(id)};
 function rpc(name,body,auth){return fetch(ADH_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{'apikey':ADH_SUPABASE_KEY,'Content-Type':'application/json','Authorization':'Bearer '+(auth&&adhSession?adhSession.access_token:ADH_SUPABASE_KEY)},body:JSON.stringify(body||{})}).then(function(r){return r.json().catch(function(){return {}})})}

 /* 1) Excluir conta: agora em js/conta.js (site e app usam o mesmo) */

 if(!NATIVE)return;
 document.documentElement.classList.add('in-app');

 /* 3) Plugins nativos (só existem dentro do app) */
 var P=C.Plugins||{};
 try{P.StatusBar&&P.StatusBar.setStyle&&P.StatusBar.setStyle({style:'DARK'})}catch(e){}
 try{P.SplashScreen&&P.SplashScreen.hide&&P.SplashScreen.hide()}catch(e){}
 // links externos abrem no navegador do sistema (WhatsApp, sites, mapas)
 document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href')||'';
  if(/^https?:\/\//i.test(h)&&h.indexOf(location.origin)!==0&&P.Browser&&P.Browser.open){e.preventDefault();P.Browser.open({url:h})}},true);
 // compartilhar capítulo/evento com o menu nativo
 window.adhShare=function(title,text,url){if(P.Share&&P.Share.share)return P.Share.share({title:title,text:text,url:url||'https://www.adhonepemsc.com.br/'});};

 /* 4) Notificações push: pede permissão uma vez e registra o dispositivo */
 var PN=P.PushNotifications;
 if(window.ADH_NO_PUSH){PN=null}
 if(PN){
  PN.addListener('registration',function(t){rpc('adh_register_device',{p_token:t.value,p_platform:(C.getPlatform&&C.getPlatform())==='android'?'android':'ios'},true)});
  PN.addListener('pushNotificationActionPerformed',function(n){var d=(n.notification&&n.notification.data)||{};try{if(d.section==='eventsSection'&&window.adhGoTab)window.adhGoTab('events');else if(window.adhOpenAvisos)window.adhOpenAvisos()}catch(e){}});
  var ask=function(){PN.requestPermissions().then(function(r){if(r.receive==='granted')PN.register()}).catch(function(){})};
  try{if(!localStorage.getItem('adh-push-asked')){setTimeout(function(){localStorage.setItem('adh-push-asked','1');ask()},6000)}else{PN.checkPermissions().then(function(r){if(r.receive==='granted')PN.register()})}}catch(e){}
 }
})();
