/* ADHONEP-SC · Excluir minha conta (site e app) — exigência da App Store (5.1.1 v) e do Google Play.
   Aparece em "Minha conta". O pedido desativa o acesso na hora; a administração conclui a exclusão em até 30 dias. */
(function(){
 var $=function(id){return document.getElementById(id)};
 function rpc(name){return fetch(ADH_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{'apikey':ADH_SUPABASE_KEY,'Content-Type':'application/json','Authorization':'Bearer '+((typeof adhSession!=='undefined'&&adhSession)?adhSession.access_token:ADH_SUPABASE_KEY)},body:'{}'}).then(function(r){return r.json().catch(function(){return {}})})}
 window.adhPedirExclusao=async function(msgEl){
  if(typeof adhSession==='undefined'||!adhSession){try{openRealLogin()}catch(e){}return}
  var ok=typeof adhDialog==='function'?await adhDialog({title:'Excluir minha conta',message:'Seus acessos serão desativados agora e a exclusão do seu login e cadastro será concluída em até 30 dias. Registros institucionais dos capítulos (eventos, relatórios) ficam sem ligação com você. Deseja continuar?',confirmLabel:'Solicitar exclusão'}):confirm('Solicitar a exclusão da conta?');
  if(!ok)return false;
  var r=await rpc('adh_request_account_deletion');
  if(r&&r.ok){ if(msgEl)msgEl.textContent='Pedido registrado. Você vai sair da conta agora.'; else if(typeof toast==='function')toast('Pedido de exclusão registrado.');
   setTimeout(function(){try{signOutAdmin();closeModal('accountModal')}catch(e){location.reload()}},1200); return true }
  var t=(r&&r.message)||'Não foi possível registrar agora. Escreva para adhonep@adhonep.com.';
  if(msgEl)msgEl.textContent=t; else if(typeof toast==='function')toast(t); return false;
 };
 function addDelete(){
  var box=document.querySelector('#accountModal .modalbox');if(!box||$('acctDelete'))return;
  var d=document.createElement('div');d.id='acctDelete';d.style.cssText='margin-top:18px;padding-top:14px;border-top:1px solid #e4e9f1';
  d.innerHTML='<b style="font-size:14px">Excluir minha conta</b><p class="sub" style="margin:6px 0 10px;font-size:13px">Seus acessos são desativados na hora e a exclusão do login e do cadastro é concluída em até 30 dias. <a href="excluir-conta.html" target="_blank" rel="noopener">Como funciona</a></p><button type="button" class="btn" id="acctDelBtn" style="background:#fff;color:#a83c42;border:1px solid #e8b9bd">Solicitar exclusão da conta</button><p class="sub" id="acctDelMsg" style="font-size:13px"></p>';
  box.appendChild(d);
  $('acctDelBtn').onclick=function(){adhPedirExclusao($('acctDelMsg'))};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addDelete);else addDelete();
})();

/* Administração: pedidos de exclusão de conta (Usuários e acessos). Só o administrador vê e conclui. */
(function(){
 function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
 function ehAdmin(){try{return !!(adhProfile&&adhProfile.role==='state_admin')}catch(e){return false}}
 window.adhCarregarPedidosExclusao=async function(){
  var page=document.getElementById('page-users');if(!page||!ehAdmin())return;
  var box=document.getElementById('delReqBox');
  if(!box){box=document.createElement('div');box.id='delReqBox';box.className='panel';box.style.marginBottom='18px';var h=page.querySelector('.adminhead');h&&h.parentNode.insertBefore(box,h.nextSibling)}
  var out;try{out=await adhUserFn({action:'deletion_requests'})}catch(e){box.hidden=true;return}
  var lst=(out&&out.requests)||[];
  if(!lst.length){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  box.innerHTML='<h3>Pedidos de exclusão de conta</h3><p class="sub">A pessoa já está sem acesso. Conclua em até 30 dias: o login e o cadastro são apagados; eventos e relatórios ficam sem ligação com ela.</p><div class="tablewrap"><table><thead><tr><th>Pessoa</th><th>E-mail</th><th>Pedido em</th><th></th></tr></thead><tbody>'
   +lst.map(function(r){return '<tr><td><strong>'+esc(r.full_name||'—')+'</strong></td><td>'+esc(r.email||'—')+'</td><td>'+esc(new Date(r.created_at).toLocaleDateString('pt-BR'))+'</td><td><button class="btn small" data-delreq="'+esc(r.user_id)+'">Concluir exclusão</button></td></tr>'}).join('')+'</tbody></table></div>';
  box.querySelectorAll('[data-delreq]').forEach(function(b){b.onclick=async function(){
   var ok=typeof adhDialog==='function'?await adhDialog({title:'Concluir exclusão',message:'Apagar de vez o login e o cadastro desta pessoa? Não dá para desfazer.',confirmLabel:'Excluir de vez'}):confirm('Apagar de vez?');
   if(!ok)return;b.disabled=true;
   try{await adhUserFn({action:'delete',user_id:b.dataset.delreq});if(typeof toast==='function')toast('Exclusão concluída.');adhCarregarPedidosExclusao();try{loadRealUsers()}catch(e){}}
   catch(e){b.disabled=false;if(typeof toast==='function')toast('Não foi possível concluir: '+e.message)}
  }});
 };
 function liga(){if(typeof loadRealUsers!=='function'||loadRealUsers.__del)return;var f=loadRealUsers;loadRealUsers=async function(){var r=await f.apply(this,arguments);try{adhCarregarPedidosExclusao()}catch(e){}return r};loadRealUsers.__del=1}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',liga);else liga();
})();
