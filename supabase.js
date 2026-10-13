
// Camada de integração Supabase para autenticação e solicitações de acesso.
// Reutiliza a única configuração pública definida em app.js. Nunca coloque service_role no navegador.
const ADH_SUPABASE_URL = SUPABASE_URL;
const ADH_SUPABASE_KEY = SUPABASE_ANON_KEY;
const ADH_SESSION_STORAGE_KEY = 'adhonep_admin_session_3v2';
let adhStorageWarningShown=false, adhSessionStorage=null, adhLocalStorage=null, adhSessionStorageChecked=false, adhLocalStorageChecked=false;
function adhSafeStorage(kind){
 try{const candidate=window[kind];if(!candidate)return null;const probe='__adhonep_storage_probe__';candidate.setItem(probe,'1');candidate.removeItem(probe);return candidate}
 catch(e){if(!adhStorageWarningShown){console.info('Armazenamento do navegador indisponível neste ambiente isolado; a aplicação continuará sem cache/sessão persistente.');adhStorageWarningShown=true;}return null}
}
function adhGetStorage(kind){if(kind==='sessionStorage'){if(!adhSessionStorageChecked){adhSessionStorage=adhSafeStorage(kind);adhSessionStorageChecked=true}return adhSessionStorage}if(!adhLocalStorageChecked){adhLocalStorage=adhSafeStorage(kind);adhLocalStorageChecked=true}return adhLocalStorage}
function adhReadSession(){try{const store=adhGetStorage('sessionStorage');if(!store)return null;const raw=store.getItem(ADH_SESSION_STORAGE_KEY);if(!raw)return null;const value=JSON.parse(raw);return value&&value.access_token&&value.refresh_token?value:null}catch{return null}}
function adhStoreSession(value){adhSession=value||null;try{const store=adhGetStorage('sessionStorage');if(!store)return;if(value)store.setItem(ADH_SESSION_STORAGE_KEY,JSON.stringify(value));else store.removeItem(ADH_SESSION_STORAGE_KEY)}catch(e){adhSessionStorage=null;adhSessionStorageChecked=true;if(!adhStorageWarningShown){console.info('Sessão não persistida neste ambiente isolado; entre novamente após recarregar.');adhStorageWarningShown=true;}}}
let adhSession = adhReadSession(), adhAccessRequests = [], adhRealUsers = [];
let adhDbChapters = [], adhDbRegions = [], adhDbMunicipalities = [], adhChapterLoadError = '';
const adhStatusToDb = {'Ativo':'active','Inativo':'inactive','Em ativação':'in_activation','Em reativação':'reactivation'};
const adhStatusFromDb = {active:'Ativo',inactive:'Inativo',in_activation:'Em ativação',reactivation:'Em reativação'};
const adhHeaders = (extra={}) => ({ apikey: ADH_SUPABASE_KEY, Authorization: 'Bearer '+(adhSession?.access_token || ADH_SUPABASE_KEY), 'Content-Type':'application/json', ...extra });
async function adhRefreshSession(){
 if(!adhSession?.refresh_token)throw new Error('A sessão expirou. Entre novamente.');
 const res=await fetch(ADH_SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:adhSession.refresh_token})});
 const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
 if(!res.ok||!data?.access_token||!data?.refresh_token){adhStoreSession(null);throw new Error(data?.message||data?.error_description||'Não foi possível renovar a sessão. Entre novamente.')}
 adhStoreSession(data);return data;
}
async function adhFetch(path, options={}, retried=false){
 const headers=adhHeaders(options.headers||{});
 const res=await fetch(ADH_SUPABASE_URL+path,{...options,headers});
 if(res.status===401&&adhSession?.refresh_token&&!retried){
  await adhRefreshSession();
  const retryHeaders={...adhHeaders(options.headers||{}),Authorization:'Bearer '+adhSession.access_token};
  return adhFetch(path,{...options,headers:retryHeaders},true);
 }
 const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
 if(!res.ok)throw new Error(data?.message||data?.msg||data?.error_description||raw||('HTTP '+res.status));return data;
}
const adhSupportedRoles={state_admin:'Administrador',state_director:'Diretor estadual',regional_director:'Diretor regional',chapter_president:'Presidente de capítulo'};
function adhResolveProfile(roles,speakerEditor){const act=(Array.isArray(roles)?roles:[]).filter(r=>r.is_active!==false);const mk=(k,label)=>({role:k,label,speakerEditor:!!speakerEditor,regionIds:[...new Set(act.filter(r=>r.role==='regional_director'&&r.region_id!=null).map(r=>r.region_id))],chapterIds:[...new Set(act.filter(r=>r.role==='chapter_president'&&r.chapter_id!=null).map(r=>r.chapter_id))]});for(const k of ['state_admin','state_director','regional_director','chapter_president']){if(act.some(r=>r.role===k))return mk(k,adhSupportedRoles[k])}if(act.some(r=>r.role==='member'))return mk('member','Sócio');return speakerEditor?mk('speaker_editor','Responsável por preletores'):null}
async function adhIsSpeakerEditor(uid){try{const r=await adhFetch('/rest/v1/speaker_editors?select=user_id&user_id=eq.'+encodeURIComponent(uid)+'&limit=1');return Array.isArray(r)&&r.length>0}catch(e){return false}}
function adhApplyProfile(p){adhProfile=p;currentRole=p.label;const sel=document.getElementById('roleSelect');if(sel)sel.value=p.label;const lbl=document.getElementById('roleLabel');if(lbl)lbl.textContent=p.role==='state_admin'?'Administrador estadual':p.label;document.querySelector('.rolebar')?.setAttribute('style','display:none!important');if(typeof applyRole==='function')applyRole()}
async function adhValidateRestoredSession(){
 if(!adhSession)return false;
 try{const user=await adhFetch('/auth/v1/user');if(!user?.id)throw new Error('Sessão sem usuário válido.');const roles=await adhFetch('/rest/v1/user_roles?select=role,is_active,region_id,chapter_id&user_id=eq.'+encodeURIComponent(user.id)+'&is_active=eq.true');const prof=adhResolveProfile(roles,await adhIsSpeakerEditor(user.id));if(!prof)throw new Error('Conta sem perfil habilitado.');adhApplyProfile(prof);if(prof.role==='member'){showMemberArea();return true}Promise.all([(prof.role==='state_admin'?loadAccessRequests().catch(()=>{}):0),typeof loadChaptersAdmin==='function'?loadChaptersAdmin().catch(()=>{}):0,typeof loadPersistentModules==='function'?loadPersistentModules().catch(()=>{}):0,typeof loadEventsFromSupabase==='function'?loadEventsFromSupabase(false).catch(()=>{}):0]);return true}
 catch(e){console.warn('Sessão administrativa restaurada foi descartada:',e.message);adhStoreSession(null);return false}
}
function signOutAdmin(){adhStoreSession(null);adhProfile=null;currentRole='Administrador';reports=[];speakers=[];statewideAnnouncements=[];audit=[];adhAccessRequests=[];adhRealUsers=[];try{renderAll()}catch(e){}closeRealLogin();document.getElementById('adminView').classList.remove('on');document.getElementById('publicView').classList.add('on');document.getElementById('adminBtn').classList.remove('on');document.getElementById('publicBtn').classList.add('on');toast('Sessão administrativa encerrada.');}

// Cache local versionado: reutiliza os últimos dados reais carregados com sucesso.
// O cache é apenas de leitura; gravações administrativas continuam exigindo confirmação do Supabase.
const ADH_CACHE_VERSION = 'claude-v3.0';
function adhCacheRead(key, maxAgeMs=30*24*60*60*1000){
  try{
    const store=adhGetStorage('localStorage');if(!store)return null;
    const raw=store.getItem('adhonep_sc_'+ADH_CACHE_VERSION+'_'+key);
    if(!raw)return null;
    const item=JSON.parse(raw);
    if(!item || !Array.isArray(item.data) || !item.savedAt)return null;
    const age=Date.now()-new Date(item.savedAt).getTime();if(!Number.isFinite(age)||age<0||age>maxAgeMs)return null;return {data:item.data,savedAt:item.savedAt,age};
  }catch(e){adhLocalStorage=null;adhLocalStorageChecked=true;return null}
}
function adhCacheWrite(key,data){
  if(!Array.isArray(data))return false;
  try{const store=adhGetStorage('localStorage');if(!store)return false;store.setItem('adhonep_sc_'+ADH_CACHE_VERSION+'_'+key,JSON.stringify({savedAt:new Date().toISOString(),data}));return true}
  catch(e){adhLocalStorage=null;adhLocalStorageChecked=true;return false}
}
function adhCacheLabel(savedAt){
  return savedAt ? ' · cópia local de '+new Date(savedAt).toLocaleString('pt-BR') : '';
}

function openRealLogin(){document.getElementById('realLoginMessage').textContent='Use a conta administrativa já cadastrada no Supabase.';document.getElementById('realLoginModal').classList.add('open')}
function closeRealLogin(){document.getElementById('realLoginModal').classList.remove('open')}
async function realAdminLogin(ev){ev.preventDefault();const msg=document.getElementById('realLoginMessage'),btn=document.getElementById('realLoginSubmit');btn.disabled=true;msg.textContent='Verificando credenciais e permissões…';try{const login=await adhFetch('/auth/v1/token?grant_type=password',{method:'POST',headers:{},body:JSON.stringify({email:document.getElementById('realLoginEmail').value.trim(),password:document.getElementById('realLoginPassword').value})});if(!login?.access_token||!login?.user?.id)throw new Error('O Supabase não retornou uma sessão válida. Confira o e-mail e a senha.');adhStoreSession(login);const roles=await adhFetch('/rest/v1/user_roles?select=role,is_active,region_id,chapter_id&user_id=eq.'+encodeURIComponent(login.user.id)+'&is_active=eq.true');const profile=adhResolveProfile(roles,await adhIsSpeakerEditor(login.user.id));if(!profile){adhStoreSession(null);throw new Error('A autenticação funcionou, mas esta conta não tem um perfil habilitado (administrador, diretor, presidente, sócio ou responsável por preletores).');}adhApplyProfile(profile);closeRealLogin();if(profile.role==='member'){showMemberArea();return}if(profile.role!=='state_admin'){originalSetMode('admin');showPage(firstAllowedPage());toast('Login confirmado: '+profile.label+'.');await loadChaptersAdmin().catch(()=>{});try{await loadEventsFromSupabase(false)}catch(e){}if(typeof loadPersistentModules==='function')await loadPersistentModules();try{renderAll()}catch(e){}return}const rb=document.querySelector('.rolebar');if(rb)rb.style.display='none';const note=document.querySelector('#page-dashboard .adminhead p');if(note)note.textContent='Painel autenticado pelo Supabase. Os módulos ainda não integrados ao banco estão identificados como etapa de implantação.';/* Importante: entrar no modo administrativo explicitamente; antes a sessão era validada, mas a interface podia continuar na vista anterior. */originalSetMode('admin');document.querySelector('.rolebar')?.setAttribute('style','display:none!important');showPage('access-requests');toast('Login confirmado. Administração estadual autorizada.');await Promise.all([loadAccessRequests(),loadRealUsers(),loadTerritoryFromSupabase(),loadChaptersAdmin().catch(e=>{adhChapterLoadError=e.message;const el=document.getElementById("chapterRows");if(el){el.textContent="Falha ao carregar capítulos reais do Supabase: "+e.message;}})]);if(typeof loadPersistentModules==='function')await loadPersistentModules();}catch(e){adhStoreSession(null);msg.textContent='Não foi possível entrar: '+(e.message||'erro inesperado')+'. Se as credenciais estiverem corretas, envie esta mensagem para corrigirmos a configuração.';}finally{btn.disabled=false}}
const originalSetMode = window.setMode;
window.setMode = function(mode){if(mode==='admin'&&!adhSession){document.getElementById('publicView').classList.remove('on');document.getElementById('adminView').classList.remove('on');document.getElementById('publicBtn').classList.remove('on');document.getElementById('adminBtn').classList.add('on');openRealLogin();return;}if(mode==='admin'&&adhSession){document.querySelector('.rolebar')?.setAttribute('style','display:none!important');}const __r=originalSetMode(mode);if(mode==='admin'&&adhSession&&adhProfile&&adhProfile.role!=='state_admin'&&typeof showPage==='function')showPage(firstAllowedPage());return __r};
function openPublicRequest(){document.getElementById('publicRequestModal').classList.add('open');loadRequestChapters()}
async function loadRequestChapters(){const sel=document.getElementById('publicRequestChapter');try{const rows=await adhFetch('/rest/v1/chapters?select=id,name,municipality_id&order=name.asc&limit=1000',{headers:{Authorization:'Bearer '+ADH_SUPABASE_KEY}});if(Array.isArray(rows)){const ms=await adhFetch('/rest/v1/municipalities?select=id,name&limit=1000',{headers:{Authorization:'Bearer '+ADH_SUPABASE_KEY}}).catch(()=>[]);const mm=new Map((ms||[]).map(m=>[String(m.id),m.name]));sel.innerHTML='<option value="">Não se aplica / será analisado</option>'+rows.map(c=>`<option value="${String(c.id).replace(/[^0-9]/g,'')}">${escapeHtml(c.name||'Capítulo')}${mm.get(String(c.municipality_id))?' — '+escapeHtml(mm.get(String(c.municipality_id))):''}</option>`).join('')}}catch{ /* capítulo opcional; não impede a solicitação */}}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function submitPublicAccessRequest(ev){ev.preventDefault();const f=ev.target;if(f.elements.website&&f.elements.website.value){toast('Solicitação enviada com sucesso.');return}if(Date.now()-adhPageT0<8000){toast('Aguarde alguns segundos e envie novamente.');return}if(!f.elements.privacy_consent?.checked){toast('É necessário consentir com o uso dos dados para enviar a solicitação.');return}const fdata=new FormData(f),d=fdata,msg=document.getElementById('publicRequestMessage'),btn=document.getElementById('publicRequestSubmit');btn.disabled=true;msg.textContent='Enviando solicitação…';const body={full_name:String(d.get('full_name')).trim(),email:String(d.get('email')).trim().toLowerCase(),phone:String(d.get('phone')||'').trim()||null,city:String(d.get('city')).trim(),requested_role:String(d.get('requested_role')),chapter_id:d.get('chapter_id')?Number(d.get('chapter_id')):null,justification:String(d.get('justification')).trim(),status:'pending'};try{await adhFetch('/rest/v1/access_requests',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});msg.textContent='✓ Recebemos o seu pedido! A diretoria estadual vai analisá-lo e entrará em contato. Não é preciso enviar de novo.';f.reset();toast('Solicitação enviada com sucesso.');}catch(e){msg.textContent='Não foi possível enviar: '+e.message; }finally{btn.disabled=false}}
async function loadAccessRequests(){const status=document.getElementById('accessRequestStatusMessage');if(!adhSession){status.textContent='Entre com uma conta state_admin para consultar as solicitações.';return}status.textContent='Carregando solicitações do Supabase…';try{adhAccessRequests=await adhFetch('/rest/v1/access_requests?select=id,full_name,email,phone,city,chapter_id,requested_role,justification,status,created_at,review_notes&order=created_at.desc&limit=500');if(!Array.isArray(adhAccessRequests))adhAccessRequests=[];status.textContent=adhAccessRequests.length+' solicitação(ões) carregada(s) do banco.';document.getElementById('accessRequestCount').textContent=adhAccessRequests.filter(x=>x.status==='pending').length||'';adhPendingBanner();renderAccessRequests()}catch(e){status.textContent='Falha ao carregar solicitações: '+e.message+' — verifique a política SELECT de access_requests e a função de autorização.'}}
const adhRoleNames={state_director:'Diretor estadual',regional_director:'Diretor regional',field_representative:'Representante de campo',chapter_president:'Presidente de capítulo',member:'Sócio',youth_coordinator:'Apoio jovem',women_coordinator:'Apoio feminino'};
function renderAccessRequests(){const body=document.getElementById('accessRequestRows');if(!body)return;const q=(document.getElementById('accessRequestSearch')?.value||'').toLowerCase(),st=document.getElementById('accessRequestStatus')?.value||'pending';const rows=adhAccessRequests.filter(r=>(st==='all'||r.status===st)&&[r.full_name,r.email,r.city].some(v=>String(v||'').toLowerCase().includes(q)));body.innerHTML=rows.map(r=>`<tr><td><strong>${escapeHtml(r.full_name)}</strong><div class="meta">${escapeHtml(r.email)}${r.phone?' · '+escapeHtml(r.phone):''}</div><div class="meta">${escapeHtml(r.justification||'')}</div></td><td>${escapeHtml(adhRoleNames[r.requested_role]||r.requested_role)}</td><td>${escapeHtml(r.city||'—')}</td><td>${escapeHtml(r.created_at?new Date(r.created_at).toLocaleDateString('pt-BR'):'—')}</td><td><span class="tag ${r.status==='approved'?'active':r.status==='rejected'?'inactive':'activation'}">${escapeHtml(r.status)}</span>${r.review_notes?'<div class="meta">'+escapeHtml(r.review_notes)+'</div>':''}</td><td>${r.status==='pending'?`<div class="actions"><button class="btn small primary" onclick="decideAccessRequest('${r.id}','approved')">Aprovar</button><button class="btn small danger" onclick="decideAccessRequest('${r.id}','rejected')">Rejeitar</button></div>`:'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhuma solicitação encontrada.</td></tr>'}
async function decideAccessRequest(id,decision){if(!adhSession)return openRealLogin();let notes='';if(decision==='rejected'){notes=(await adhDialog({title:'Rejeitar solicitação',message:'Informe o motivo da rejeição (será registrado no pedido):',input:true,confirmLabel:'Rejeitar'}))||'';if(!notes.trim()){toast('Informe o motivo para rejeitar.');return}}else if(!(await adhDialog({title:'Aprovar solicitação',message:'Confirmar aprovação desta solicitação? A conta de autenticação precisa já existir no Supabase.'})))return;try{await adhFetch('/rest/v1/rpc/review_access_request',{method:'POST',body:JSON.stringify({p_request_id:id,p_decision:decision,p_notes:notes||null})});toast(decision==='approved'?'Solicitação aprovada.':'Solicitação rejeitada.');await loadAccessRequests()}catch(e){toast('A decisão não foi concluída: '+e.message+'\n\nA aprovação depende de a conta já existir no Supabase Auth e de a função SQL estar compatível com as colunas reais.');}}
const adhRoleLabels={state_admin:'Administrador estadual',state_director:'Diretor estadual',regional_director:'Diretor regional',field_representative:'Representante de campo',chapter_president:'Presidente de capítulo',member:'Sócio',youth_coordinator:'Coordenador de apoio jovem',women_coordinator:'Coordenador de apoio feminino'};
async function loadRealUsers(){const _us=document.getElementById('userStatus');if(_us&&_us.value&&_us.value!=='Ativo'&&_us.value!=='Inativo')_us.value='';const msg=document.getElementById('realUsersMessage'),btn=document.getElementById('realUsersRefresh');if(!adhSession){if(msg)msg.textContent='Entre com uma conta administrativa para carregar as designações reais.';return}if(btn)btn.disabled=true;if(msg)msg.textContent='Carregando perfis e designações do Supabase…';try{const [profiles,roles,regions,chapters]=await Promise.all([
 adhFetch('/rest/v1/profiles?select=id,full_name,phone&limit=1000'),
 adhFetch('/rest/v1/user_roles?select=user_id,role,is_active,region_id,chapter_id,granted_at&limit=2000'),
 adhFetch('/rest/v1/regions?select=id,name&limit=500').catch(()=>[]),
 adhFetch('/rest/v1/chapters?select=id,name,city&limit=1000').catch(()=>[])
]);const pmap=new Map((profiles||[]).map(p=>[p.id,p])),rmap=new Map((regions||[]).map(x=>[String(x.id),x.name])),cmap=new Map((chapters||[]).map(x=>[String(x.id),x.name+(x.city?' — '+x.city:'')]));adhRealUsers=(roles||[]).map(r=>{const p=pmap.get(r.user_id)||{};const scope=r.region_id?(rmap.get(String(r.region_id))||('Região #'+r.region_id)):r.chapter_id?(cmap.get(String(r.chapter_id))||('Capítulo #'+r.chapter_id)):'Estadual';return {id:r.user_id, name:p.full_name||'Nome não informado', email:'', role:adhRoleLabels[r.role]||r.role, scope, status:r.is_active?'Ativo':'Inativo', phone:p.phone||'', userId:r.user_id, rawRole:r.role}});if(msg)msg.textContent=`${adhRealUsers.length} designação(ões) carregada(s) do Supabase. E-mails não são exibidos porque não fazem parte da tabela profiles consultada.`;renderRealUsers()}catch(e){if(msg)msg.textContent='Não foi possível carregar usuários e designações: '+e.message+'. Confira as políticas RLS de profiles/user_roles e as colunas existentes.'}finally{if(btn)btn.disabled=false}}
function renderRealUsers(){const el=document.getElementById('userRows');if(!el)return;if(!adhSession){el.innerHTML='<tr><td colspan="6" class="empty">Autentique-se como administrador estadual para consultar os usuários reais.</td></tr>';return}const q=slug(document.getElementById('userSearch')?.value||''),st=document.getElementById('userStatus')?.value||'';const arr=adhRealUsers.filter(u=>(!q||slug(u.name+' '+u.userId+' '+u.role+' '+u.scope).includes(q))&&(!st||u.status===st));el.innerHTML=arr.map(u=>`<tr><td><strong>${escapeHtml(u.name)}</strong><div class="meta">ID: ${escapeHtml(u.userId)}</div></td><td>Não consultado</td><td>${escapeHtml(u.role)}</td><td>${escapeHtml(u.scope||'—')}</td><td><span class="tag ${u.status==='Ativo'?'active':'inactive'}">${escapeHtml(u.status)}</span></td><td>Somente consulta</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhuma designação encontrada para os filtros.</td></tr>'}

// Inicialização da integração pública depois que todas as funções Supabase foram declaradas.
function startSupabasePublicIntegration(){adhHandleAuthHash();loadPublicAnnouncements();
  if(adhSession)adhValidateRestoredSession();
  loadPublicChapters().finally(()=>{ if(typeof loadOfficialMap==='function') loadOfficialMap(); });
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',startSupabasePublicIntegration,{once:true});}
else{startSupabasePublicIntegration();}

/* Legado da versão 2: capítulos públicos conectados ao mapa por municipality_id. */
async function loadPublicChapters(){
 const noteId='publicChapterConnectionStatus';
 const noteOld=document.getElementById(noteId);if(noteOld)noteOld.remove();
 let cacheMode=false, savedAt=null;
 try{
   const [rows,munis,regs]=await Promise.all([
     adhFetch('/rest/v1/chapters?select=*&order=name.asc&limit=1000'),
     adhFetch('/rest/v1/municipalities?select=id,name,ibge_code&limit=1000'),
     adhFetch('/rest/v1/regions?select=*&limit=500')
   ]);
   if(!Array.isArray(rows)||!Array.isArray(munis)||!Array.isArray(regs))throw new Error('O Supabase retornou um formato inesperado.');
   adhCacheWrite('chapters',rows);adhCacheWrite('municipalities',munis);adhCacheWrite('regions',regs);
   adhDbChapters=rows;adhDbMunicipalities=munis;adhDbRegions=regs;
   const mm=new Map(munis.map(x=>[String(x.id),x.name||x.nome||x.municipality_name||'']));
   const rm=new Map(regs.map(x=>[String(x.id),x.name||x.region_name||x.nome||'']));
   const statusMap={active:'Ativo',inactive:'Inativo',in_activation:'Em ativação',reactivation:'Em reativação'};
   chapters=rows.map(c=>{
     const mid=c.municipality_id??c.city_id??c.municipio_id;
     const rid=c.region_id??c.regiao_id;
     const dbStatus=String(c.status??c.situation??c.situacao??'inactive').toLowerCase();
     const pub=c.is_public===true||c.published===true||c.is_published===true;
     return {id:c.id,municipalityId:mid==null?null:String(mid),name:c.name||c.chapter_name||c.nome||('Capítulo '+c.id),
       city:mm.get(String(mid))||c.city||c.municipality||c.municipio||'Município não vinculado',
       region:rm.get(String(rid))||c.region_name||c.region||'Região não vinculada',
       president:c.president_name||c.president||'',status:statusMap[dbStatus]||c.status||'Inativo',
       contact:c.contact||c.phone||'',address:c.address||c.address_line||'',
       published:pub,chapter_number:c.chapter_number??c.number??null,raw:c};
   });
   renderAll();
   const n=document.createElement('div');n.id=noteId;n.className='meta';n.style.cssText='padding:6px 10px;margin-top:8px';
   n.textContent=chapters.length+' registro(s) de capítulo recebido(s) do Supabase. Se forem zero, é preciso importar os capítulos oficiais para a tabela chapters; cache não importa registros.';
   document.getElementById('publicList')?.parentElement?.appendChild(n);
 }catch(err){
   console.error('Falha ao consultar capítulos no Supabase:',err);
   const cc=adhCacheRead('chapters'), mc=adhCacheRead('municipalities'), rc=adhCacheRead('regions');
   if(cc&&mc&&rc){
     cacheMode=true;savedAt=cc.savedAt;
     const mm=new Map(mc.data.map(x=>[String(x.id),x.name||x.nome||x.municipality_name||'']));
     const rm=new Map(rc.data.map(x=>[String(x.id),x.name||x.region_name||x.nome||'']));
     const statusMap={active:'Ativo',inactive:'Inativo',in_activation:'Em ativação',reactivation:'Em reativação'};
     chapters=cc.data.map(c=>{const mid=c.municipality_id??c.city_id??c.municipio_id,rid=c.region_id??c.regiao_id,st=String(c.status??c.situation??c.situacao??'inactive').toLowerCase();return {
       id:c.id,municipalityId:mid==null?null:String(mid),name:c.name||c.chapter_name||c.nome||('Capítulo '+c.id),city:mm.get(String(mid))||c.city||c.municipality||c.municipio||'Município não vinculado',
       region:rm.get(String(rid))||c.region_name||c.region||'Região não vinculada',president:c.president_name||c.president||'',
       status:statusMap[st]||c.status||'Inativo',contact:c.contact||c.phone||'',address:c.address||c.address_line||'',
       published:c.is_public===true||c.published===true||c.is_published===true,chapter_number:c.chapter_number??c.number??null,raw:c};});
     renderAll();
   }else{chapters=[];renderAll();}
   const n=document.createElement('div');n.id=noteId;n.className='meta';n.style.cssText='padding:6px 10px;margin-top:8px;color:#8a5a00';
   n.textContent=cacheMode
     ? 'Sem conexão válida com o Supabase: exibindo a última cópia local dos dados reais'+adhCacheLabel(savedAt)+'. Pode estar desatualizada.'
     : 'Não foi possível carregar capítulos do Supabase e não existe cópia local anterior. Erro: '+(err.message||'falha de consulta')+'. Se a tabela estiver vazia, será necessário importar os capítulos oficiais; o cache não cria registros.';
   document.getElementById('publicList')?.parentElement?.appendChild(n);
 }
}

// Link público para o formulário de acesso, sem expor a área administrativa.
// O link de solicitação de acesso fica no rodapé público, fora da navegação principal.
// Impede que a prévia de perfil seja confundida com autenticação real.
const roleSelect=document.getElementById('roleSelect');if(roleSelect){roleSelect.disabled=true;roleSelect.title='A autorização real é definida pelo Supabase, não por este seletor.'}const rolebarInitial=document.querySelector('.rolebar');if(rolebarInitial)rolebarInitial.style.display='none';

/* ---- v1.3: recuperação de senha, comunicados públicos ---- */
let adhRecoveryToken=null;
async function adhRecoverPassword(){const email=(document.getElementById('realLoginEmail').value||'').trim(),msg=document.getElementById('realLoginMessage');if(!email){msg.textContent='Digite o seu e-mail acima e clique novamente em "Esqueci minha senha".';return}try{const res=await fetch(ADH_SUPABASE_URL+'/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',headers:{apikey:ADH_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email})});msg.textContent=res.ok?'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.':'Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.'}catch(e){msg.textContent='Falha de conexão. Tente novamente.'}}
function adhHandleAuthHash(){const raw=location.hash.replace(/^#/,'');if(!raw)return;const p=new URLSearchParams(raw);if(p.get('error_description')){history.replaceState(null,'',location.pathname+location.search);toast('Link inválido ou expirado. Peça um novo em "Esqueci minha senha".');return}if(p.get('type')==='recovery'&&p.get('access_token')){adhRecoveryToken=p.get('access_token');history.replaceState(null,'',location.pathname+location.search);document.getElementById('adhResetModal').classList.add('open')}}
async function adhSetNewPassword(ev){ev.preventDefault();const f=ev.target,msg=document.getElementById('adhResetMessage'),pw=f.elements.pw1.value;if(pw.length<10){msg.textContent='Use pelo menos 10 caracteres.';return}if(pw!==f.elements.pw2.value){msg.textContent='As senhas não coincidem.';return}if(!adhRecoveryToken){msg.textContent='Link expirado. Peça um novo.';return}try{const res=await fetch(ADH_SUPABASE_URL+'/auth/v1/user',{method:'PUT',headers:{apikey:ADH_SUPABASE_KEY,Authorization:'Bearer '+adhRecoveryToken,'Content-Type':'application/json'},body:JSON.stringify({password:pw})});if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.msg||d.message||d.error_description||('HTTP '+res.status))}adhRecoveryToken=null;f.reset();document.getElementById('adhResetModal').classList.remove('open');toast('Senha atualizada. Entre com a nova senha.');openRealLogin()}catch(e){msg.textContent='Não foi possível salvar: '+e.message}}
let adhPublicRegional=[];
function annCardHtml(r){const url=/^https?:\/\//i.test(r.action_url||'')?r.action_url:'';return `<article class="card" style="padding:16px"><div class="eyebrow">${esc(r.category||'Comunicado')}</div><h3 style="margin:6px 0">${esc(r.title)}</h3><p class="sub">${esc(r.summary||r.body||'')}</p>${url?`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(r.action_label||'Saiba mais')}</a>`:''}</article>`}
async function loadPublicAnnouncements(){const box=document.getElementById('announcementsSection');if(!box)return;try{const rows=await adhFetch('/rest/v1/public_announcements?select=id,title,category,summary,body,action_label,action_url,scope,region_id&order=published_at.desc&limit=40');if(!Array.isArray(rows)||!rows.length){box.hidden=true;return}const st=rows.filter(r=>r.scope!=='regional').slice(0,4);adhPublicRegional=rows.filter(r=>r.scope==='regional');box.querySelector('[data-list]').innerHTML=st.map(annCardHtml).join('');const rbox=box.querySelector('[data-regional]');if(adhPublicRegional.length){let regs=[];try{regs=await adhFetch('/rest/v1/regions?select=id,name&order=name.asc&limit=100')||[]}catch(e){}const ids=[...new Set(adhPublicRegional.map(r=>String(r.region_id)))];document.getElementById('annRegionPick').innerHTML='<option value="">Escolha a sua região…</option>'+ids.map(id=>{const rg=regs.find(x=>String(x.id)===id);return `<option value="${esc(id)}">${esc(rg?rg.name:'Região '+id)}</option>`}).join('');rbox.hidden=false}else rbox.hidden=true;box.hidden=!(st.length||adhPublicRegional.length)}catch(e){box.hidden=true}}
function renderRegionalAnnouncements(){const id=document.getElementById('annRegionPick').value;document.querySelector('#announcementsSection [data-rlist]').innerHTML=id?adhPublicRegional.filter(r=>String(r.region_id)===id).map(annCardHtml).join(''):''}

/* ---- v2.4: usuários, sócios, exclusão (Edge Function admin-create-user) ---- */
async function adhUserFn(body){const res=await fetch(ADH_SUPABASE_URL+'/functions/v1/admin-create-user',{method:'POST',headers:adhHeaders(),body:JSON.stringify(body)});const out=await res.json().catch(()=>({}));if(!res.ok||!out.ok)throw new Error(out.error||('Erro '+res.status+(res.status===404?' — a função admin-create-user ainda não foi publicada no Supabase.':'')));return out}
function nuScope(){const r=document.getElementById('nuRole').value;document.getElementById('nuRegionWrap').style.display=r==='regional_director'||r==='field_representative'?'':'none';document.getElementById('nuChapterWrap').style.display=r==='chapter_president'||r==='member'?'':'none'}
function openNewUser(mode){if(!adhSession)return openRealLogin();const pres=adhProfile&&adhProfile.role==='chapter_president';if(!adhProfile||(adhProfile.role!=='state_admin'&&!pres)){toast('Sem permissão para cadastrar usuários.');return}
 const f=document.querySelector('#newUserModal form');f.reset();const roleSel=document.getElementById('nuRole');
 if(!window.__nuRoleHtml)window.__nuRoleHtml=roleSel.innerHTML;
 roleSel.innerHTML=pres?'<option value="member">Sócio</option>':window.__nuRoleHtml;
 document.getElementById('nuRegion').innerHTML='<option value="">Selecione a região</option>'+adhDbRegions.map(r=>`<option value="${escapeHtml(String(r.id))}">${escapeHtml(r.name)}</option>`).join('');
 let chs=adhDbChapters.slice();if(pres){const ids=(adhProfile.chapterIds||[]).map(String);chs=chs.filter(c=>ids.includes(String(c.id)))}
 chs.sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR'));
 document.getElementById('nuChapter').innerHTML=(chs.length===1?'':'<option value="">Selecione o capítulo</option>')+chs.map(c=>`<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name)}</option>`).join('');
 if(mode==='member'&&!pres)roleSel.value='member';
 document.querySelector('#newUserModal h2').textContent=roleSel.value==='member'?'Novo sócio':'Novo usuário';
 nuScope();document.getElementById('nuMsg').textContent='Com senha provisória a conta já nasce ativa e você repassa a senha à pessoa (peça para trocá-la). Sem senha, um convite é enviado ao e-mail.';document.getElementById('newUserModal').classList.add('open')}
async function submitNewUser(ev){ev.preventDefault();const f=ev.target,d=new FormData(f),btn=document.getElementById('nuSubmit'),msg=document.getElementById('nuMsg');
 let phone=String(d.get('phone')||'').replace(/\D/g,'');if(phone&&!phone.startsWith('55'))phone='55'+phone;
 const role=document.getElementById('nuRole').value;const body={action:'create',full_name:d.get('full_name'),email:d.get('email'),role,phone,password:d.get('password')||'',region_id:(role==='regional_director'||role==='field_representative')?(d.get('region_id')||null):null,chapter_id:(role==='chapter_president'||role==='member')?(d.get('chapter_id')||null):null,redirect_to:location.origin+location.pathname};
 btn.disabled=true;msg.textContent='Criando…';
 try{const out=await adhUserFn(body);closeModal('newUserModal');toast(out.mode==='senha'?'Conta criada com senha provisória.':'Convite enviado ao e-mail informado.');if(document.getElementById('page-members').classList.contains('on'))loadMembers();else loadRealUsers()}
 catch(e){msg.textContent='Não foi possível criar: '+e.message}finally{btn.disabled=false}}
async function adhSetActive(uid,active,after){try{await adhUserFn({action:'set_active',user_id:uid,active});toast(active?'Acesso reativado.':'Acesso desativado.');after()}catch(e){toast('Não foi possível alterar: '+e.message)}}
async function adhDeleteUser(uid,name,after){if(!adhProfile||adhProfile.role!=='state_admin')return;if(!(await adhDialog({title:'Excluir usuário',message:'A conta e as designações de “'+name+'” serão apagadas definitivamente. Para apenas bloquear o acesso, use Desativar.',confirmLabel:'Excluir'})))return;try{await adhUserFn({action:'delete',user_id:uid});toast('Usuário excluído.');after()}catch(e){toast('Não foi possível excluir: '+e.message)}}

renderRealUsers=function(){const el=document.getElementById('userRows');if(!el)return;if(!adhSession){el.innerHTML='<tr><td colspan="6" class="empty">Autentique-se como administrador estadual para consultar os usuários reais.</td></tr>';return}const q=slug(document.getElementById('userSearch')?.value||''),st=document.getElementById('userStatus')?.value||'';const arr=adhRealUsers.filter(u=>(!q||slug(u.name+' '+u.userId+' '+u.role+' '+u.scope).includes(q))&&(!st||u.status===st));const adm=adhProfile&&adhProfile.role==='state_admin';el.innerHTML=arr.map(u=>`<tr><td><strong>${escapeHtml(u.name)}</strong><div class="meta">ID: ${escapeHtml(u.userId)}</div></td><td>${escapeHtml(u.phone||'—')}</td><td>${escapeHtml(u.role)}</td><td>${escapeHtml(u.scope||'—')}</td><td><span class="tag ${u.status==='Ativo'?'active':'inactive'}">${escapeHtml(u.status)}</span></td><td>${adm?`<div class="actions"><button class="btn small" data-u="${escapeHtml(u.userId)}" data-act="${u.status==='Ativo'?'off':'on'}">${u.status==='Ativo'?'Desativar':'Reativar'}</button><button class="btn small danger" data-u="${escapeHtml(u.userId)}" data-n="${escapeHtml(u.name)}" data-act="del">Excluir</button></div>`:'Somente consulta'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhuma designação encontrada para os filtros.</td></tr>'};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[data-act][data-u]');if(!b)return;const inMembers=!!b.closest('#memberRows');const after=inMembers?loadMembers:loadRealUsers;if(b.dataset.act==='del')adhDeleteUser(b.dataset.u,b.dataset.n||'usuário',after);else adhSetActive(b.dataset.u,b.dataset.act==='on',after)});

async function loadMembers(){const body=document.getElementById('memberRows'),msg=document.getElementById('memberMsg');if(!adhSession||!body)return;body.innerHTML='<tr><td colspan="5" class="empty">Carregando…</td></tr>';try{const roles=await adhFetch('/rest/v1/user_roles?select=user_id,chapter_id,is_active&role=eq.member&limit=1000');const ids=[...new Set((roles||[]).map(r=>r.user_id))];let profs=[];if(ids.length)profs=await adhFetch('/rest/v1/profiles?select=id,full_name,phone&id=in.('+ids.join(',')+')');const pm=new Map((profs||[]).map(p=>[p.id,p])),cm=new Map(adhDbChapters.map(c=>[String(c.id),c.name]));const adm=adhProfile&&adhProfile.role==='state_admin';body.innerHTML=(roles||[]).map(r=>{const p=pm.get(r.user_id)||{};const nm=p.full_name||'Nome não informado';return `<tr><td><strong>${escapeHtml(nm)}</strong></td><td>${escapeHtml(p.phone||'—')}</td><td>${escapeHtml(cm.get(String(r.chapter_id))||('Capítulo #'+r.chapter_id))}</td><td><span class="tag ${r.is_active?'active':'inactive'}">${r.is_active?'Ativo':'Inativo'}</span></td><td><div class="actions"><button class="btn small" data-u="${escapeHtml(r.user_id)}" data-act="${r.is_active?'off':'on'}">${r.is_active?'Desativar':'Reativar'}</button>${adm?`<button class="btn small danger" data-u="${escapeHtml(r.user_id)}" data-n="${escapeHtml(nm)}" data-act="del">Excluir</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Nenhum sócio cadastrado ainda. Use “+ Novo sócio”.</td></tr>';if(msg)msg.textContent=(roles||[]).length+' sócio(s). Desativar bloqueia o acesso sem apagar o cadastro.'}catch(e){body.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar: '+escapeHtml(e.message)+'</td></tr>'}}

function adhMemberViewOn(on){const mv=document.getElementById('memberView');if(!mv)return;if(on){document.getElementById('publicView').classList.remove('on');document.getElementById('adminView').classList.remove('on')}mv.classList.toggle('on',on)}
async function showMemberArea(){adhMemberViewOn(true);window.scrollTo(0,0);const $=id=>document.getElementById(id);try{const user=await adhFetch('/auth/v1/user');const uid=user.id;const roles=await adhFetch('/rest/v1/user_roles?select=chapter_id&role=eq.member&is_active=eq.true&user_id=eq.'+encodeURIComponent(uid));const cid=roles&&roles[0]&&roles[0].chapter_id;let ch=null;if(cid){const r=await adhFetch('/rest/v1/chapters?select=name,city&id=eq.'+cid+'&limit=1').catch(()=>[]);ch=r&&r[0]}
 const prof=((await adhFetch('/rest/v1/profiles?select=full_name,phone&id=eq.'+encodeURIComponent(uid)+'&limit=1').catch(()=>[]))||[])[0]||{};
 $('mbHello').textContent='Olá, '+((prof.full_name||'sócio').split(' ')[0])+'!';$('mbChapter').textContent=ch?('Capítulo '+ch.name+(ch.city?' · '+ch.city:'')):'Capítulo não identificado';
 const f=document.querySelector('#memberView form');f.elements.full_name.value=prof.full_name||'';f.elements.phone.value=String(prof.phone||'').replace(/^55(?=\d{10,11}$)/,'');
 const now=new Date().toISOString();
 const ev=cid?await adhFetch('/rest/v1/events?select=title,starts_at,venue_name,description&is_published=eq.true&chapter_id=eq.'+cid+'&starts_at=gte.'+encodeURIComponent(now)+'&order=starts_at.asc&limit=20').catch(()=>[]):[];
 $('mbEvents').innerHTML=(ev||[]).map(e=>`<div class="detail"><strong>${escapeHtml(e.title)}</strong><p>${escapeHtml(new Date(e.starts_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}))}${e.venue_name?' · '+escapeHtml(e.venue_name):''}</p>${e.description?'<p>'+escapeHtml(e.description)+'</p>':''}</div>`).join('')||'<p class="sub">Nenhum evento futuro publicado para o seu capítulo.</p>';
 const an=await adhFetch('/rest/v1/statewide_announcements?select=title,summary,body,scope,starts_at&status=eq.published&order=starts_at.desc&limit=20').catch(()=>[]);
 $('mbAnn').innerHTML=(an||[]).map(a=>`<div class="detail"><strong>${escapeHtml(a.title)}</strong> <span class="tag activation">${a.scope==='regional'?'Regional':'Estadual'}</span><p>${escapeHtml(a.summary||'')}</p></div>`).join('')||'<p class="sub">Nenhum comunicado no momento.</p>'
 }catch(e){const m=document.getElementById('mbMsg');if(m)m.textContent='Não foi possível carregar alguns dados: '+e.message}}
async function saveMemberProfile(ev){ev.preventDefault();const f=ev.target,m=document.getElementById('mbMsg');let phone=String(f.elements.phone.value||'').replace(/\D/g,'');if(phone&&!phone.startsWith('55'))phone='55'+phone;try{const user=await adhFetch('/auth/v1/user');const r=await adhFetch('/rest/v1/profiles?id=eq.'+encodeURIComponent(user.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({full_name:f.elements.full_name.value.trim(),phone:phone||null})});if(Array.isArray(r)&&!r.length)throw new Error('nenhuma linha atualizada (rode a migracao-v2.3 no Supabase).');m.textContent='Dados atualizados.';toast('Dados atualizados.')}catch(e){m.textContent='Não foi possível salvar: '+e.message}}
(function(){const sm=window.setMode;window.setMode=function(mode){const isMember=adhProfile&&adhProfile.role==='member'&&adhSession;if(isMember&&mode==='admin'){showMemberArea();return}adhMemberViewOn(false);return sm.apply(this,arguments)};const so=window.signOutAdmin;window.signOutAdmin=function(){adhMemberViewOn(false);return so.apply(this,arguments)}})();

const ADH_DEL=[
 {root:'#eventRows',re:/openEvent\(([^)]+)\)/,table:'events',reload:()=>loadEventsFromSupabase(false)},
 {root:'#chapterRows',re:/openChapter\(([^)]+)\)/,table:'chapters',reload:()=>loadChaptersAdmin()},
 {root:'#speakerRows',re:/openSpeaker\(([^)]+)\)/,table:'speakers',reload:()=>loadPersistentModules()},
 {root:'#announcementRecords',re:/editAnnouncementIntegrated\('([^']+)'\)/,table:'statewide_announcements',reload:()=>loadPersistentModules()}];
function adhInjectDeletes(){if(!adhProfile||adhProfile.role!=='state_admin')return;ADH_DEL.forEach(d=>{const root=document.querySelector(d.root);if(!root)return;root.querySelectorAll('button[onclick]').forEach(b=>{const m=b.getAttribute('onclick').match(d.re);if(!m||b.parentNode.querySelector('[data-del]'))return;const x=document.createElement('button');x.className='btn small danger';x.type='button';x.textContent='Excluir';x.dataset.del=d.table;x.dataset.id=m[1].replace(/['"]/g,'');b.parentNode.appendChild(x)})})}
document.addEventListener('click',async e=>{const b=e.target.closest&&e.target.closest('button[data-del]');if(!b)return;const d=ADH_DEL.find(x=>x.table===b.dataset.del);const row=b.closest('tr,.detail');const label=(row&&row.querySelector('strong')?row.querySelector('strong').textContent:'este registro').trim();if(!adhProfile||adhProfile.role!=='state_admin')return;if(!(await adhDialog({title:'Excluir definitivamente',message:'“'+label+'” será apagado e não poderá ser recuperado. Se só quiser tirar do ar, use Ocultar/Desativar/Arquivar.',confirmLabel:'Excluir'})))return;try{const r=await adhFetch('/rest/v1/'+d.table+'?id=eq.'+encodeURIComponent(b.dataset.id),{method:'DELETE',headers:{Prefer:'return=representation'}});if(Array.isArray(r)&&!r.length)throw new Error('nada foi excluído (sem permissão ou registro já removido). Rode a migracao-v2.4 no Supabase.');toast('Registro excluído.');await d.reload();renderAll()}catch(err){toast(/foreign key|violates/i.test(err.message)?'Não é possível excluir: há registros vinculados (eventos, relatórios…). Desative em vez de excluir.':'Não foi possível excluir: '+err.message)}});

function exportAccessRequests(){const st=document.getElementById('accessRequestStatus')?.value||'pending';const q=(document.getElementById('accessRequestSearch')?.value||'').toLowerCase();const rows=adhAccessRequests.filter(r=>(st==='all'||r.status===st)&&[r.full_name,r.email,r.city].some(v=>String(v||'').toLowerCase().includes(q)));if(!rows.length){toast('Nada para exportar com os filtros atuais.');return}const head=['Data','Nome','E-mail','Telefone','Município','Perfil solicitado','Status','Justificativa'];const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[head,...rows.map(r=>[r.created_at?new Date(r.created_at).toLocaleString('pt-BR'):'',r.full_name,r.email,r.phone,r.city,adhRoleNames[r.requested_role]||r.requested_role,r.status,r.justification])].map(l=>l.map(esc).join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}));a.download='solicitacoes-de-cadastro.csv';a.click();URL.revokeObjectURL(a.href);toast(rows.length+' solicitação(ões) exportada(s).')}

/* v2.5: atualiza a fila de solicitações sozinha enquanto a tela está aberta */
setInterval(()=>{try{if(adhSession&&adhProfile&&adhProfile.role==='state_admin'&&document.getElementById('page-access-requests')?.classList.contains('on')&&!document.hidden)loadAccessRequests()}catch(e){}},45000);

function adhPendingBanner(){const b=document.getElementById('pendingBanner');if(!b)return;const n=adhAccessRequests.filter(x=>x.status==='pending').length;const ok=n>0&&adhProfile&&adhProfile.role==='state_admin';b.hidden=!ok;b.style.display=ok?'flex':'none';if(ok)document.getElementById('pendingBannerText').textContent='▣ '+n+(n===1?' solicitação de cadastro aguardando análise.':' solicitações de cadastro aguardando análise.')}

/* v3.0 · histórico de ações vindo do banco (admin_audit_log) */
async function loadAuditDb(){const el=document.getElementById('auditRows');if(!el)return;if(!adhSession){el.innerHTML='<tr><td colspan="5" class="empty">Entre como administrador para ver o histórico.</td></tr>';return}
 el.innerHTML='<tr><td colspan="5" class="empty">Carregando…</td></tr>';
 try{const rows=await adhFetch('/rest/v1/admin_audit_log?select=id,actor_id,action,entity_type,entity_id,summary,created_at&order=created_at.desc&limit=200');
  const ids=[...new Set((rows||[]).map(r=>r.actor_id).filter(Boolean))];let pm=new Map();
  if(ids.length){try{const ps=await adhFetch('/rest/v1/profiles?select=id,full_name&id=in.('+ids.join(',')+')');pm=new Map((ps||[]).map(p=>[p.id,p.full_name]))}catch(e){}}
  el.innerHTML=(rows||[]).map(r=>`<tr><td>${escapeHtml(new Date(r.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}))}</td><td>${escapeHtml(pm.get(r.actor_id)||(r.actor_id?('ID '+String(r.actor_id).slice(0,8)):'Sistema'))}</td><td><strong>${escapeHtml(r.action)}</strong></td><td>${escapeHtml(r.entity_type+(r.entity_id?' #'+r.entity_id:''))}</td><td>${escapeHtml(r.summary||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma ação registrada ainda.</td></tr>'}
 catch(e){el.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar o histórico: '+escapeHtml(e.message)+'</td></tr>'}}
