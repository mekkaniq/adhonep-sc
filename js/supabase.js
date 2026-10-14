window.ADH_VER_SB='3.13';
/* Endereço (slug) da Edge Function que cria contas, como o Supabase a publicou: .../functions/v1/rapid-responder */
const ADH_USER_FN='rapid-responder';

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
const ADH_CACHE_VERSION = 'claude-v3.4';
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
async function loadAccessRequests(){const status=document.getElementById('accessRequestStatusMessage');if(!adhSession){status.textContent='Entre com uma conta state_admin para consultar as solicitações.';return}status.textContent='Carregando solicitações do Supabase…';try{adhAccessRequests=await adhFetch('/rest/v1/access_requests?select=id,full_name,email,phone,city,chapter_id,requested_role,justification,status,created_at,review_notes&order=created_at.desc&limit=500');if(!Array.isArray(adhAccessRequests))adhAccessRequests=[];status.textContent='';status.style.display='none';document.getElementById('accessRequestCount').textContent=adhAccessRequests.filter(x=>x.status==='pending').length||'';adhPendingBanner();renderAccessRequests()}catch(e){status.textContent='Falha ao carregar solicitações: '+e.message+' — verifique a política SELECT de access_requests e a função de autorização.'}}
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
   const [rows,munis,regs,pcs]=await Promise.all([
     adhFetch('/rest/v1/chapters?select=*&order=name.asc&limit=1000'),
     adhFetch('/rest/v1/municipalities?select=id,name,ibge_code&limit=1000'),
     adhFetch('/rest/v1/regions?select=*&limit=500'),
     adhFetch('/rest/v1/public_chapter_contacts?select=chapter_id,president_phone&limit=1000').catch(()=>[])
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
       contact:((Array.isArray(pcs)?pcs:[]).find(x=>String(x.chapter_id)===String(c.id))||{}).president_phone||c.contact||c.phone||'',address:c.address||c.address_line||'',
       published:pub,chapter_number:c.chapter_number??c.number??null,raw:c};
   });
   renderAll();
   const n=document.createElement('div');n.id=noteId;n.className='meta';n.style.cssText='padding:6px 10px;margin-top:8px';
   n.textContent='';n.style.display='none';
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
function adhFnMsg(m){m=String(m||'');if(/already (been )?registered|email_exists/i.test(m)&&!/duplicate key|violates/i.test(m))return 'Este e-mail já tem uma conta de login no Supabase (Authentication > Users). Se não aparece na lista, atualize a página do Supabase e procure pelo e-mail.';if(/duplicate key|already exists/i.test(m))return 'Já existe um registro igual no banco: '+m;if(/permission denied for table/i.test(m))return 'O servidor ainda não tem permissão nesta tabela ('+m.replace(/.*table\s+/i,'')+'). Rode o SQL de permissões do service_role no Supabase.';if(/invalid login|jwt|token/i.test(m)&&/expired|invalid/i.test(m))return 'Sessão vencida. Saia, entre de novo e tente outra vez.';return m}
async function adhUserFn(body){let res;try{res=await fetch(ADH_SUPABASE_URL+'/functions/v1/'+ADH_USER_FN,{method:'POST',headers:adhHeaders(),body:JSON.stringify(body)})}catch(e){throw new Error('Sem conexão com a função de criar contas. Verifique a internet e, se persistir, se a função está publicada com Verify JWT desligado.')}const out=await res.json().catch(()=>({}));if(!res.ok||!out.ok)throw new Error(adhFnMsg(out.error)||('Erro '+res.status+(res.status===404?' — a função de criar contas ('+ADH_USER_FN+') não foi encontrada no Supabase.':'')));return out}
function nuScope(){const r=document.getElementById('nuRole').value;document.getElementById('nuRegionWrap').style.display=r==='regional_director'||r==='field_representative'?'':'none';document.getElementById('nuChapterWrap').style.display=r==='chapter_president'||r==='member'||r==='youth_coordinator'||r==='women_coordinator'?'':'none'}
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
 const role=document.getElementById('nuRole').value;const body={action:'create',full_name:d.get('full_name'),email:d.get('email'),role,phone,password:d.get('password')||'',region_id:(role==='regional_director'||role==='field_representative')?(d.get('region_id')||null):null,chapter_id:(role==='chapter_president'||role==='member'||role==='youth_coordinator'||role==='women_coordinator')?(d.get('chapter_id')||null):null,redirect_to:location.origin+location.pathname};
 btn.disabled=true;msg.textContent='Criando…';
 try{const out=await adhUserFn(body);closeModal('newUserModal');toast(out.mode==='senha'?'Conta criada com senha provisória.':'Convite enviado ao e-mail informado.');if(document.getElementById('page-members').classList.contains('on'))loadMembers();else loadRealUsers()}
 catch(e){msg.textContent='Não foi possível criar: '+e.message}finally{btn.disabled=false}}
async function adhSetActive(uid,active,after){try{await adhUserFn({action:'set_active',user_id:uid,active});toast(active?'Acesso reativado.':'Acesso desativado.');after()}catch(e){toast('Não foi possível alterar: '+e.message)}}
async function adhDeleteUser(uid,name,after){if(!adhProfile||adhProfile.role!=='state_admin')return;if(!(await adhDialog({title:'Excluir usuário',message:'A conta e as designações de “'+name+'” serão apagadas definitivamente. Para apenas bloquear o acesso, use Desativar.',confirmLabel:'Excluir'})))return;try{await adhUserFn({action:'delete',user_id:uid});toast('Usuário excluído.');after()}catch(e){toast('Não foi possível excluir: '+e.message)}}

renderRealUsers=function(){const el=document.getElementById('userRows');if(!el)return;if(!adhSession){el.innerHTML='<tr><td colspan="6" class="empty">Autentique-se como administrador estadual para consultar os usuários reais.</td></tr>';return}const q=slug(document.getElementById('userSearch')?.value||''),st=document.getElementById('userStatus')?.value||'';const arr=adhRealUsers.filter(u=>(!q||slug(u.name+' '+u.userId+' '+u.role+' '+u.scope).includes(q))&&(!st||u.status===st));const adm=adhProfile&&adhProfile.role==='state_admin';el.innerHTML=arr.map(u=>`<tr><td><strong>${escapeHtml(u.name)}</strong><div class="meta">ID: ${escapeHtml(u.userId)}</div></td><td>${escapeHtml(u.phone||'—')}</td><td>${escapeHtml(u.role)}</td><td>${escapeHtml(u.scope||'—')}</td><td><span class="tag ${u.status==='Ativo'?'active':'inactive'}">${escapeHtml(u.status)}</span></td><td>${adm?`<div class="actions"><button class="btn small" data-u="${escapeHtml(u.userId)}" data-act="${u.status==='Ativo'?'off':'on'}">${u.status==='Ativo'?'Desativar':'Reativar'}</button><button class="btn small danger" data-u="${escapeHtml(u.userId)}" data-n="${escapeHtml(u.name)}" data-act="del">Excluir</button></div>`:'Somente consulta'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhuma designação encontrada para os filtros.</td></tr>'};
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button[data-act][data-u]');if(!b)return;const inMembers=!!b.closest('#memberRows');const after=inMembers?loadMembers:loadRealUsers;if(b.dataset.act==='del')adhDeleteUser(b.dataset.u,b.dataset.n||'usuário',after);else adhSetActive(b.dataset.u,b.dataset.act==='on',after)});

async function loadMembers(){const body=document.getElementById('memberRows'),msg=document.getElementById('memberMsg');if(!adhSession||!body)return;body.innerHTML='<tr><td colspan="5" class="empty">Carregando…</td></tr>';try{const roles=await adhFetch('/rest/v1/user_roles?select=user_id,chapter_id,is_active&role=eq.member&limit=1000');const ids=[...new Set((roles||[]).map(r=>r.user_id))];let profs=[];if(ids.length)profs=await adhFetch('/rest/v1/profiles?select=id,full_name,phone&id=in.('+ids.join(',')+')');const pm=new Map((profs||[]).map(p=>[p.id,p])),cm=new Map(adhDbChapters.map(c=>[String(c.id),c.name]));const adm=adhProfile&&adhProfile.role==='state_admin';body.innerHTML=(roles||[]).map(r=>{const p=pm.get(r.user_id)||{};const nm=p.full_name||'Nome não informado';return `<tr><td><strong>${escapeHtml(nm)}</strong></td><td>${escapeHtml(p.phone||'—')}</td><td>${escapeHtml(cm.get(String(r.chapter_id))||('Capítulo #'+r.chapter_id))}</td><td><span class="tag ${r.is_active?'active':'inactive'}">${r.is_active?'Ativo':'Inativo'}</span></td><td><div class="actions"><button class="btn small" data-u="${escapeHtml(r.user_id)}" data-act="${r.is_active?'off':'on'}">${r.is_active?'Desativar':'Reativar'}</button>${adm?`<button class="btn small danger" data-u="${escapeHtml(r.user_id)}" data-n="${escapeHtml(nm)}" data-act="del">Excluir</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Nenhum sócio cadastrado ainda. Use “+ Novo sócio”.</td></tr>';if(msg)msg.textContent=(roles||[]).length+' sócio(s). Desativar bloqueia o acesso sem apagar o cadastro.'}catch(e){body.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar: '+escapeHtml(e.message)+'</td></tr>'}}

function adhMemberViewOn(on){const mv=document.getElementById('memberView');if(!mv)return;if(on){document.getElementById('publicView').classList.remove('on');document.getElementById('adminView').classList.remove('on')}mv.classList.toggle('on',on)}
async function showMemberArea(){adhMemberViewOn(true);window.scrollTo(0,0);const $=id=>document.getElementById(id);try{const user=await adhFetch('/auth/v1/user');const uid=user.id;const roles=await adhFetch('/rest/v1/user_roles?select=chapter_id&role=in.(member,youth_coordinator,women_coordinator)&is_active=eq.true&user_id=eq.'+encodeURIComponent(uid));const cid=roles&&roles[0]&&roles[0].chapter_id;let ch=null;if(cid){const r=await adhFetch('/rest/v1/chapters?select=name,city&id=eq.'+cid+'&limit=1').catch(()=>[]);ch=r&&r[0]}
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

/* v3.2 · histórico de ações vindo do banco (admin_audit_log) */
async function loadAuditDb(){const el=document.getElementById('auditRows');if(!el)return;if(!adhSession){el.innerHTML='<tr><td colspan="5" class="empty">Entre como administrador para ver o histórico.</td></tr>';return}
 el.innerHTML='<tr><td colspan="5" class="empty">Carregando…</td></tr>';
 try{const rows=await adhFetch('/rest/v1/admin_audit_log?select=id,actor_id,action,entity_type,entity_id,summary,created_at&order=created_at.desc&limit=200');
  const ids=[...new Set((rows||[]).map(r=>r.actor_id).filter(Boolean))];let pm=new Map();
  if(ids.length){try{const ps=await adhFetch('/rest/v1/profiles?select=id,full_name&id=in.('+ids.join(',')+')');pm=new Map((ps||[]).map(p=>[p.id,p.full_name]))}catch(e){}}
  el.innerHTML=(rows||[]).map(r=>`<tr><td>${escapeHtml(new Date(r.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}))}</td><td>${escapeHtml(pm.get(r.actor_id)||(r.actor_id?('ID '+String(r.actor_id).slice(0,8)):'Sistema'))}</td><td><strong>${escapeHtml(r.action)}</strong></td><td>${escapeHtml(r.entity_type+(r.entity_id?' #'+r.entity_id:''))}</td><td>${escapeHtml(r.summary||'—')}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhuma ação registrada ainda.</td></tr>'}
 catch(e){el.innerHTML='<tr><td colspan="5" class="empty">Não foi possível carregar o histórico: '+escapeHtml(e.message)+'</td></tr>'}}

/* v3.2: o administrador estadual sempre enxerga "Solicitações de cadastro", mesmo que o app.js em cache/publicado seja mais antigo */
(function(){const _rp=rolePermissions;rolePermissions=function(r){let p=_rp(r);if(typeof adhProfile!=='undefined'&&adhProfile&&adhProfile.role==='state_admin'&&!p.pages.includes('access-requests')){p={pages:[...p.pages,'access-requests'],edit:p.edit}}return p}})();

/* ====================================================================
   v3.2 — Andamento mensal do capítulo, Ranking interno e nova ficha de cadastro
   ==================================================================== */

/* ---- permissões das páginas novas (sobre o que já existe) ---- */
(function(){const _rp=rolePermissions;rolePermissions=function(r){let p=_rp(r);const role=(typeof adhProfile!=='undefined'&&adhProfile)?adhProfile.role:null;const add=role==='state_admin'||role==='state_director'||role==='regional_director'?['monthly','ranking']:role==='chapter_president'?['monthly']:[];const miss=add.filter(x=>!p.pages.includes(x));return miss.length?{pages:[...p.pages,...miss],edit:p.edit}:p}})();

let adhMonthly=[],adhRankData=null,adhRankSettings=[];
const MR_ST={'Entregue':'Aguardando aprovação','Reenviado':'Aguardando aprovação','Correções solicitadas':'Correções solicitadas','Aprovado':'Aprovado'};
const MR_TAG={'Entregue':'activation','Reenviado':'activation','Correções solicitadas':'inactive','Aprovado':'active'};
const mrRole=()=>adhProfile&&adhProfile.role;
const mrIsAdmin=()=>mrRole()==='state_admin',mrIsPres=()=>mrRole()==='chapter_president',mrIsRD=()=>mrRole()==='regional_director';
const mrCanSubmit=()=>mrIsAdmin()||mrIsPres(),mrCanReview=()=>mrIsAdmin()||mrIsRD();
function mrErr(e){const m=String((e&&e.message)||e||'');if(/failed to fetch|networkerror|load failed/i.test(m))return 'sem conexão com o servidor. Verifique a internet e tente de novo.';if(/relation .* does not exist|schema cache|adh_ranking|chapter_monthly_reports/i.test(m)&&/exist|cache|find/i.test(m))return 'a migração v3.2 ainda não foi aplicada no Supabase (supabase/migracao-v3.2-andamento-ranking.sql).';return m}
function mrKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'}
function mrMonths(n){const out=[],now=new Date();for(let i=0;i<n;i++)out.push(mrKey(new Date(now.getFullYear(),now.getMonth()-i,1)));return out}
function mrLabel(k){const [y,m]=String(k).slice(0,10).split('-');const s=new Date(Date.UTC(+y,+m-1,1,12)).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});return s.charAt(0).toUpperCase()+s.slice(1)}
function mrDeadline(k){const [y,m]=String(k).slice(0,10).split('-');return new Date(+y,+m,5,23,59,59)}
function mrDefaultMonth(){const d=new Date();return mrKey(new Date(d.getFullYear(),d.getMonth()-(d.getDate()<=5?1:0),1))}
function mrChStatus(c){return String(c.status??c.situation??c.situacao??'').toLowerCase()}
function mrChapters(){const all=adhDbChapters||[];if(mrIsPres()){const ids=(adhProfile.chapterIds||[]).map(String);return all.filter(c=>ids.includes(String(c.id)))}return all.filter(c=>mrChStatus(c)==='active')}
function mrChName(id){const c=(adhDbChapters||[]).find(x=>String(x.id)===String(id));return c?c.name:('Capítulo '+id)}
function mrRegionName(id){const r=(adhDbRegions||[]).find(x=>String(x.id)===String(id));return r?(r.name||r.nome||''):''}
function mrFillMonthSelect(sel,n,keep){if(!sel)return;const cur=keep&&sel.value;sel.innerHTML=mrMonths(n).map(k=>`<option value="${k}">${escapeHtml(mrLabel(k))}</option>`).join('');sel.value=cur&&[...sel.options].some(o=>o.value===cur)?cur:(sel.id==='rankingMonth'?mrKey(new Date()):mrDefaultMonth())}

async function loadMonthly(silent){
  if(!adhSession||!adhProfile||adhProfile.role==='member')return;
  const note=document.getElementById('monthlyNotice');
  try{
    if(!(adhDbChapters||[]).length){try{await loadChaptersAdmin()}catch(e){}}
    const rows=await adhFetch('/rest/v1/chapter_monthly_reports?select=*&order=ref_month.desc,chapter_id.asc&limit=3000');
    adhMonthly=Array.isArray(rows)?rows:[];
    mrFillMonthSelect(document.getElementById('monthlyMonth'),12,true);
    const nb=document.getElementById('monthlyNewBtn');if(nb)nb.style.display=mrCanSubmit()?'':'none';
    mrNavCount();if(!silent||document.getElementById('page-monthly')?.classList.contains('on'))renderMonthly();
  }catch(e){if(note&&!silent)note.textContent='Não foi possível carregar os relatórios: '+mrErr(e)}
}
function mrNavCount(){const el=document.getElementById('monthlyNavCount');if(!el)return;let n=0;
  if(mrCanReview())n=adhMonthly.filter(r=>r.status==='Entregue'||r.status==='Reenviado').length;
  else if(mrIsPres()){const prev=mrKey(new Date(new Date().getFullYear(),new Date().getMonth()-1,1));n=mrChapters().filter(c=>!adhMonthly.some(r=>String(r.chapter_id)===String(c.id)&&String(r.ref_month).slice(0,10)===prev)).length+adhMonthly.filter(r=>r.status==='Correções solicitadas').length}
  el.textContent=n?String(n):'';el.style.display=n?'':'none'}
function mrTagHtml(s){return `<span class="tag ${MR_TAG[s]||'activation'}">${escapeHtml(MR_ST[s]||s)}</span>`}
function renderMonthly(){
  const body=document.getElementById('monthlyRows');if(!body)return;
  const month=document.getElementById('monthlyMonth').value||mrDefaultMonth(),st=document.getElementById('monthlyStatus').value,q=(document.getElementById('monthlySearch').value||'').toLowerCase();
  const inMonth=adhMonthly.filter(r=>String(r.ref_month).slice(0,10)===month);
  const rows=inMonth.filter(r=>(st==='all'||(st==='review'&&(r.status==='Entregue'||r.status==='Reenviado'))||(st==='fix'&&r.status==='Correções solicitadas')||(st==='done'&&r.status==='Aprovado'))&&mrChName(r.chapter_id).toLowerCase().includes(q));
  body.innerHTML=rows.map(r=>{const canEdit=mrIsAdmin()||(mrIsPres()&&(r.status==='Entregue'||r.status==='Correções solicitadas'));
    return `<tr><td><strong>${escapeHtml(mrChName(r.chapter_id))}</strong>${r.on_time===false?'<div class="meta">entregue fora do prazo</div>':''}</td><td>${r.chapter_meetings} · ${r.women_meetings} · ${r.youth_meetings}</td><td>${r.visitors}</td><td>${r.chapter_events} · ${r.women_events} · ${r.youth_events}</td><td>${r.prison_ministry_active?'Ativo'+(r.prison_activities?' ('+r.prison_activities+')':''):'—'}</td><td>${mrTagHtml(r.status)}${r.status==='Correções solicitadas'&&r.reviewer_notes?'<div class="meta">'+escapeHtml(r.reviewer_notes)+'</div>':''}</td><td><div class="actions"><button class="btn small" onclick="openMonthlyView('${r.id}')">Ver</button>${canEdit?`<button class="btn small" onclick="openMonthlyForm('${r.id}')">${r.status==='Correções solicitadas'?'Corrigir':'Editar'}</button>`:''}</div></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">Nenhum relatório neste filtro.</td></tr>';
  // avisos e capítulos sem relatório
  const note=document.getElementById('monthlyNotice'),chs=mrChapters(),missing=chs.filter(c=>!inMonth.some(r=>String(r.chapter_id)===String(c.id)));
  const late=new Date()>mrDeadline(month);
  const box=document.getElementById('monthlyMissingBox'),list=document.getElementById('monthlyMissing');
  if(mrIsPres()){const fix=adhMonthly.filter(r=>r.status==='Correções solicitadas').length;
    note.textContent=(missing.length?`Falta enviar o relatório de ${mrLabel(month)} (${missing.map(c=>c.name).join(', ')}). Prazo: ${mrDeadline(month).toLocaleDateString('pt-BR')}${late?' — já passou; envie assim mesmo, mas ele não conta como entregue no prazo.':'.'}`:`Relatório de ${mrLabel(month)} enviado.`)+(fix?` Há ${fix} relatório(s) com correções solicitadas.`:'');box.hidden=true}
  else{const aw=adhMonthly.filter(r=>r.status==='Entregue'||r.status==='Reenviado').length;
    note.textContent=`${mrLabel(month)}: ${inMonth.length} relatório(s) recebido(s)${chs.length?' de '+chs.length+' capítulo(s) ativo(s)':''}.`+(aw&&mrCanReview()?` ${aw} aguardando sua aprovação (todos os meses).`:'');
    box.hidden=!missing.length;list.innerHTML=missing.map(c=>escapeHtml(c.name)).join(' · ')+(late?'':'<div class="meta" style="margin-top:6px">O prazo deste mês ainda não terminou ('+mrDeadline(month).toLocaleDateString('pt-BR')+').</div>')}
}

function openMonthlyForm(id){
  if(!mrCanSubmit()){toast('Somente o presidente do capítulo envia o relatório mensal.');return}
  const f=document.querySelector('#monthlyModal form');f.reset();
  const chs=mrChapters();if(!chs.length){toast('Nenhum capítulo disponível para este perfil.');return}
  const cs=document.getElementById('mrChapter');cs.innerHTML=(chs.length>1?'<option value="">Selecione o capítulo</option>':'')+chs.map(c=>`<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.name)}</option>`).join('');
  const ms=document.getElementById('mrMonth');ms.innerHTML=mrMonths(mrIsAdmin()?12:3).map(k=>`<option value="${k}">${escapeHtml(mrLabel(k))}</option>`).join('');ms.value=mrDefaultMonth();
  const fb=document.getElementById('monthlyFeedback');fb.hidden=true;
  window.adhMrEditing=null;cs.disabled=false;ms.disabled=false;
  document.getElementById('monthlyTitle').textContent='Relatório de andamento';document.getElementById('monthlySubmit').textContent='Enviar relatório';
  document.getElementById('mrPrisonWrap').style.display='none';
  if(id){const r=adhMonthly.find(x=>String(x.id)===String(id));if(!r)return;window.adhMrEditing=r;
    if(![...cs.options].some(o=>o.value===String(r.chapter_id)))cs.insertAdjacentHTML('beforeend',`<option value="${escapeHtml(String(r.chapter_id))}">${escapeHtml(mrChName(r.chapter_id))}</option>`);
    cs.value=String(r.chapter_id);const mk=String(r.ref_month).slice(0,10);if(![...ms.options].some(o=>o.value===mk))ms.insertAdjacentHTML('beforeend',`<option value="${mk}">${escapeHtml(mrLabel(mk))}</option>`);ms.value=mk;cs.disabled=true;ms.disabled=true;
    ['chapter_meetings','women_meetings','youth_meetings','avg_attendance','visitors','visitors_notes','chapter_events','women_events','youth_events','events_notes','prison_activities','considerations'].forEach(k=>{if(f.elements[k])f.elements[k].value=r[k]??''});
    f.elements.prison_ministry_active.checked=!!r.prison_ministry_active;document.getElementById('mrPrisonWrap').style.display=r.prison_ministry_active?'':'none';
    document.getElementById('monthlyTitle').textContent='Relatório de '+mrLabel(mk)+' — '+mrChName(r.chapter_id);
    document.getElementById('monthlySubmit').textContent=r.status==='Correções solicitadas'?'Reenviar para aprovação':'Salvar alterações';
    if(r.status==='Correções solicitadas'&&r.reviewer_notes){fb.hidden=false;fb.innerHTML='<strong>Correções pedidas pelo diretor:</strong> '+escapeHtml(r.reviewer_notes)}
  }else if(chs.length===1)cs.value=String(chs[0].id);
  document.getElementById('monthlyMsg').textContent='Depois de enviado, o relatório segue para aprovação do diretor regional. Enquanto não for revisado, você pode corrigi-lo.';
  document.getElementById('monthlyModal').classList.add('open');
}
async function submitMonthly(ev){
  ev.preventDefault();const f=ev.target,d=new FormData(f),btn=document.getElementById('monthlySubmit'),msg=document.getElementById('monthlyMsg');
  const num=k=>{const v=parseInt(d.get(k),10);return Number.isFinite(v)&&v>=0?v:0};
  const prison=f.elements.prison_ministry_active.checked;
  const body={chapter_meetings:num('chapter_meetings'),women_meetings:num('women_meetings'),youth_meetings:num('youth_meetings'),avg_attendance:d.get('avg_attendance')===''?null:num('avg_attendance'),visitors:num('visitors'),visitors_notes:String(d.get('visitors_notes')||'').trim()||null,chapter_events:num('chapter_events'),women_events:num('women_events'),youth_events:num('youth_events'),events_notes:String(d.get('events_notes')||'').trim()||null,prison_ministry_active:prison,prison_activities:prison?num('prison_activities'):0,considerations:String(d.get('considerations')||'').trim()||null};
  const ed=window.adhMrEditing;btn.disabled=true;msg.textContent='Enviando…';
  try{
    if(ed){if(ed.status==='Correções solicitadas')body.status='Reenviado';await adhFetch('/rest/v1/chapter_monthly_reports?id=eq.'+encodeURIComponent(ed.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)})}
    else{const cid=document.getElementById('mrChapter').value,mk=document.getElementById('mrMonth').value;if(!cid){msg.textContent='Selecione o capítulo.';btn.disabled=false;return}
      const dup=adhMonthly.find(r=>String(r.chapter_id)===String(cid)&&String(r.ref_month).slice(0,10)===mk);if(dup){btn.disabled=false;closeModal('monthlyModal');toast('Já existe o relatório deste mês. Abrindo para edição.');openMonthlyForm(dup.id);return}
      await adhFetch('/rest/v1/chapter_monthly_reports',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({...body,chapter_id:Number(cid),ref_month:mk,status:'Entregue'})})}
    closeModal('monthlyModal');toast(ed?'Relatório atualizado.':'Relatório enviado. Obrigado!');await loadMonthly();
  }catch(e){msg.textContent='Não foi possível enviar: '+mrErr(e)}finally{btn.disabled=false}
}
function openMonthlyView(id){
  const r=adhMonthly.find(x=>String(x.id)===String(id));if(!r)return;const mk=String(r.ref_month).slice(0,10);
  document.getElementById('mvTitle').textContent=mrChName(r.chapter_id)+' — '+mrLabel(mk);
  const row=(a,b)=>`<div class="detail"><strong>${a}</strong><p>${b}</p></div>`;
  document.getElementById('mvBody').innerHTML=`<p>${mrTagHtml(r.status)} ${r.on_time===false?'<span class="meta">entregue fora do prazo</span>':r.on_time?'<span class="meta">entregue no prazo</span>':''}</p>`+
   row('Reuniões',`Capítulo: <b>${r.chapter_meetings}</b> · Apoio Feminino: <b>${r.women_meetings}</b> · Apoio Jovem: <b>${r.youth_meetings}</b>${r.avg_attendance!=null?' · Média de participantes: <b>'+r.avg_attendance+'</b>':''}`)+
   row('Visitantes (não sócios)',`<b>${r.visitors}</b>${r.visitors_notes?' — '+escapeHtml(r.visitors_notes):''}`)+
   row('Eventos',`Capítulo: <b>${r.chapter_events}</b> · Apoio Feminino: <b>${r.women_events}</b> · Apoio Jovem: <b>${r.youth_events}</b>${r.events_notes?'<br>'+escapeHtml(r.events_notes):''}`)+
   row('Ministério de Prisões',r.prison_ministry_active?`Ativo${r.prison_activities?' — '+r.prison_activities+' atividade(s) no mês':''}`:'Não ativo')+
   (r.considerations?row('Considerações',escapeHtml(r.considerations).replace(/\n/g,'<br>')):'')+
   (r.reviewer_notes?row('Orientações do diretor',escapeHtml(r.reviewer_notes)):'');
  const act=document.getElementById('mvActions');act.innerHTML='';
  if(mrCanReview()&&(r.status==='Entregue'||r.status==='Reenviado'||(mrIsAdmin()&&r.status!=='Aprovado'))){
    act.innerHTML=`<button class="btn danger" onclick="reviewMonthly('${r.id}','Correções solicitadas')">Pedir correções</button><button class="btn primary" onclick="reviewMonthly('${r.id}','Aprovado')">Aprovar</button>`}
  document.getElementById('monthlyViewModal').classList.add('open');
}
async function reviewMonthly(id,status){
  let notes=null;
  if(status==='Correções solicitadas'){notes=await adhDialog({title:'Pedir correções',message:'Diga ao presidente o que precisa ser corrigido:',input:true,confirmLabel:'Enviar pedido'});if(!notes||notes.trim().length<3){if(notes!==null)toast('Informe o que precisa ser corrigido.');return}}
  else if(!(await adhDialog({title:'Aprovar relatório',message:'Ao aprovar, o relatório passa a valer no ranking e o capítulo não poderá mais editá-lo.'})))return;
  try{await adhFetch('/rest/v1/chapter_monthly_reports?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,reviewer_notes:notes?notes.trim():null})});closeModal('monthlyViewModal');toast(status==='Aprovado'?'Relatório aprovado.':'Correções solicitadas ao capítulo.');await loadMonthly()}
  catch(e){toast('A decisão não foi concluída: '+mrErr(e))}
}

/* ---- Ranking (interno) ---- */
async function loadRanking(){
  const note=document.getElementById('rankingNotice');if(!adhSession||!adhProfile)return;
  const sel=document.getElementById('rankingMonth');if(sel&&!sel.options.length)mrFillMonthSelect(sel,12,false);
  const month=(sel&&sel.value)||mrKey(new Date());note.textContent='Calculando…';
  try{
    const data=await adhFetch('/rest/v1/rpc/adh_ranking',{method:'POST',body:JSON.stringify({p_month:month})});
    adhRankData=data;renderRanking();
    const box=document.getElementById('rankingSettingsBox');
    if(mrIsAdmin()){try{adhRankSettings=await adhFetch('/rest/v1/ranking_settings?select=*&order=sort_order.asc')||[];box.hidden=false;document.getElementById('rankingSettings').innerHTML=adhRankSettings.map(s=>`<label class="flabel">${escapeHtml(s.label)}<input class="field" type="number" step="1" min="0" data-k="${escapeHtml(s.key)}" data-orig="${s.value}" value="${s.value}"></label>`).join('')}catch(e){box.hidden=true}}else box.hidden=true;
  }catch(e){note.textContent='Não foi possível carregar o ranking: '+mrErr(e)}
}
function mrRank(list){let last=null,pos=0;return list.map((x,i)=>{if(x.points!==last){pos=i+1;last=x.points}return pos})}
function renderRanking(){
  const d=adhRankData;if(!d)return;const ch=d.chapters||[],rg=d.regions||[];
  const pill=n=>`<span class="pillnum" style="${n<=3?'background:#c9a45c;color:#102b4e;font-weight:800':''}">${n}º</span>`;
  const pts=v=>(v>0?'+':'')+v;
  const rc=mrRank(ch);document.getElementById('rankingChapters').innerHTML=ch.map((c,i)=>{
    const st=!c.report_status?'<div class="meta" style="color:#a83c42">sem relatório</div>':(c.report_status==='Aprovado'?'':'<div class="meta">relatório '+escapeHtml((MR_ST[c.report_status]||c.report_status).toLowerCase())+' — ainda não pontua</div>');
    return `<tr><td>${pill(rc[i])}</td><td><strong>${escapeHtml(c.name)}</strong>${st}</td><td>${escapeHtml(c.region_name||'—')}</td><td>${c.p_meetings}</td><td>${c.p_events}</td><td>${pts(Number(c.p_prison)+Number(c.p_ontime)+Number(c.p_missing))}</td><td>${c.p_members}</td><td><strong>${c.points}</strong></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">Nenhum capítulo ativo neste mês.</td></tr>';
  const rr=mrRank(rg);document.getElementById('rankingRegions').innerHTML=rg.map((r,i)=>`<tr><td>${pill(rr[i])}</td><td><strong>${escapeHtml(r.name)}</strong></td><td>${r.active_chapters}</td><td>${r.avg_points}</td><td>${r.opened?pts(r.opened):'—'}</td><td>${r.reactivated?pts(r.reactivated):'—'}</td><td>${r.inactivated?pts(r.inactivated):'—'}</td><td><strong>${r.points}</strong></td></tr>`).join('')||'<tr><td colspan="8" class="empty">Sem regiões para exibir.</td></tr>';
  const aw=ch.filter(c=>c.report_status&&c.report_status!=='Aprovado').length,nr=ch.filter(c=>!c.report_status).length;
  document.getElementById('rankingNotice').textContent=`${mrLabel(d.month)} · ${ch.length} capítulo(s) ativo(s) · ${nr} sem relatório · ${aw} aguardando aprovação. Só relatórios aprovados pontuam; sócios novos entram automaticamente.`;
}
async function saveRankingSettings(){
  const inputs=[...document.querySelectorAll('#rankingSettings input[data-k]')].filter(i=>i.value!==i.dataset.orig);if(!inputs.length){toast('Nenhuma alteração para salvar.');return}
  try{for(const i of inputs){const v=Number(i.value);if(!Number.isFinite(v)||v<0)throw new Error('Valor inválido em: '+i.closest('label').firstChild.textContent);await adhFetch('/rest/v1/ranking_settings?key=eq.'+encodeURIComponent(i.dataset.k),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({value:v})})}toast('Pontuação salva.');await loadRanking()}
  catch(e){toast('Não foi possível salvar: '+mrErr(e))}
}
function exportRanking(){const d=adhRankData;if(!d){toast('Abra o ranking primeiro.');return}const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const lines=[['Ranking de capítulos — '+mrLabel(d.month)],['Posição','Capítulo','Região','Reuniões','Eventos','Outros','Sócios novos','Total'],...(()=>{const rc=mrRank(d.chapters);return d.chapters.map((c,i)=>[rc[i],c.name,c.region_name,c.p_meetings,c.p_events,Number(c.p_prison)+Number(c.p_ontime)+Number(c.p_missing),c.p_members,c.points])})(),[],['Ranking de regiões'],['Posição','Região','Capítulos ativos','Média','Abertos','Reativados','Inativados','Total'],...(()=>{const rr=mrRank(d.regions);return d.regions.map((r,i)=>[rr[i],r.name,r.active_chapters,r.avg_points,r.opened,r.reactivated,r.inactivated,r.points])})()];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+lines.map(l=>l.map(q).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download='ranking-adhonep-'+String(d.month).slice(0,7)+'.csv';document.body.appendChild(a);a.click();a.remove()}

/* carrega as pendências assim que o perfil é aplicado (contador no menu) */
(function(){const ap=adhApplyProfile;adhApplyProfile=function(p){const r=ap.apply(this,arguments);if(p&&p.role!=='member')setTimeout(()=>{try{loadMonthly(true)}catch(e){}},1200);return r}})();

/* ====================================================================
   v3.2 — Ficha pública de solicitação de cadastro (revisada)
   ==================================================================== */
function prMask(el){let d=el.value.replace(/\D/g,'');if(d.length>11&&d.startsWith('55'))d=d.slice(2);d=d.slice(0,11);let o=d;if(d.length>10)o='('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);else if(d.length>6)o='('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);else if(d.length>2)o='('+d.slice(0,2)+') '+d.slice(2);else if(d.length)o='('+d;el.value=o}
function prRoleChanged(){const f=document.querySelector('#publicRequestModal form'),r=f.elements.requested_role.value,j=f.elements.justification,lab=document.getElementById('prJustLabel');const member=r==='member'||r==='';j.required=!member;lab.firstChild.textContent=member?'Quer nos contar algo? (opcional)':'Qual é a sua função e por que precisa de acesso?';j.placeholder=member?'Ex.: sou sócio desde 2024 no capítulo de…':'Informe sua função, o capítulo/região e por que precisa de acesso.'}
function prChapterChanged(){const f=document.querySelector('#publicRequestModal form'),sel=f.elements.chapter_id,o=sel.options[sel.selectedIndex];if(o&&o.dataset.city&&!f.elements.city.value)f.elements.city.value=o.dataset.city}
async function loadRequestChapters(){const sel=document.getElementById('publicRequestChapter');if(!sel)return;try{const H={headers:{Authorization:'Bearer '+ADH_SUPABASE_KEY}};const [rows,ms]=await Promise.all([adhFetch('/rest/v1/chapters?select=id,name,municipality_id&order=name.asc&limit=1000',H),adhFetch('/rest/v1/municipalities?select=id,name&order=name.asc&limit=1000',H).catch(()=>[])]);if(!Array.isArray(rows))return;const mm=new Map((ms||[]).map(m=>[String(m.id),m.name]));
  const list=rows.map(c=>({id:String(c.id).replace(/[^0-9]/g,''),name:c.name||'Capítulo',city:mm.get(String(c.municipality_id))||''})).sort((a,b)=>(a.city||a.name).localeCompare(b.city||b.name,'pt-BR'));
  sel.innerHTML='<option value="">Ainda não sei / não tenho capítulo</option>'+list.map(c=>`<option value="${c.id}" data-city="${escapeHtml(c.city)}">${escapeHtml(c.city&&!c.name.includes(c.city)?c.city+' — '+c.name:c.name)}</option>`).join('');
  const dl=document.getElementById('prCities');if(dl&&Array.isArray(ms))dl.innerHTML=ms.map(m=>`<option value="${escapeHtml(m.name)}">`).join('')}catch{/* a lista é opcional; o formulário funciona sem ela */}}
function openPublicRequest(){const m=document.getElementById('publicRequestModal'),f=m.querySelector('form');document.getElementById('prDone').hidden=true;document.getElementById('prFields').hidden=false;f.reset();prRoleChanged();document.getElementById('publicRequestMessage').textContent='Seus dados são usados apenas para analisar o pedido.';m.classList.add('open');m.querySelector('.modalbox').scrollTop=0;loadRequestChapters()}
async function submitPublicAccessRequest(ev){
  ev.preventDefault();const f=ev.target,msg=document.getElementById('publicRequestMessage'),btn=document.getElementById('publicRequestSubmit');
  if(f.elements.website&&f.elements.website.value){document.getElementById('prFields').hidden=true;document.getElementById('prDone').hidden=false;return}
  if(Date.now()-adhPageT0<5000){msg.textContent='Só um instante… tente enviar de novo em alguns segundos.';return}
  const name=f.elements.full_name.value.trim().replace(/\s+/g,' '),email=f.elements.email.value.trim().toLowerCase(),city=f.elements.city.value.trim();
  let ph=f.elements.phone.value.replace(/\D/g,'');if(ph.length>11&&ph.startsWith('55'))ph=ph.slice(2);
  const role=f.elements.requested_role.value;
  if(name.split(' ').length<2){msg.textContent='Informe seu nome e sobrenome.';f.elements.full_name.focus();return}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)){msg.textContent='Confira o e-mail: ele precisa estar no formato nome@exemplo.com.';f.elements.email.focus();return}
  if(ph.length<10||ph.length>11){msg.textContent='Informe o WhatsApp com DDD, por exemplo (47) 99999-9999.';f.elements.phone.focus();return}
  if(!role){msg.textContent='Escolha o seu vínculo com a ADHONEP.';f.elements.requested_role.focus();return}
  if(!f.elements.privacy_consent.checked){msg.textContent='Para enviar, marque a caixa de concordância com os Termos e a Política de Privacidade.';return}
  let just=f.elements.justification.value.trim();
  if(role!=='member'&&just.length<10){msg.textContent='Descreva sua função e o motivo do pedido (mínimo de 10 caracteres).';f.elements.justification.focus();return}
  const sel=f.elements.chapter_id,chLabel=sel.value?sel.options[sel.selectedIndex].text:'';
  if(role==='member'){just=('Solicitação de cadastro como sócio'+(chLabel?' — '+chLabel:'')+(just?'. '+just:'')).slice(0,2000)}
  const body={full_name:name,email,phone:'+55'+ph,city,requested_role:role,chapter_id:sel.value?Number(sel.value):null,justification:just,status:'pending'};
  btn.disabled=true;btn.textContent='Enviando…';msg.textContent='Enviando o seu pedido…';
  try{await adhFetch('/rest/v1/access_requests',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});f.reset();document.getElementById('prFields').hidden=true;document.getElementById('prDone').hidden=false;document.querySelector('#publicRequestModal .modalbox').scrollTop=0}
  catch(e){const m=String(e.message||'');msg.textContent=/failed to fetch|networkerror|load failed/i.test(m)?'Sem conexão com o servidor. Verifique a internet e tente novamente.':(/invalid input value for enum|violates check constraint/i.test(m)?'Este tipo de vínculo ainda não está liberado no sistema. Escolha outro ou fale com a diretoria.':m||'Não foi possível enviar agora. Tente novamente em instantes.')}
  finally{btn.disabled=false;btn.textContent='Enviar solicitação'}}

/* ---- Solicitações: lista com WhatsApp e "Aprovar e criar conta" ---- */
const adhReqStatusPt={pending:'Pendente',approved:'Aprovada',rejected:'Rejeitada',cancelled:'Cancelada'};
function renderAccessRequests(){const body=document.getElementById('accessRequestRows');if(!body)return;const q=(document.getElementById('accessRequestSearch')?.value||'').toLowerCase(),st=document.getElementById('accessRequestStatus')?.value||'pending';
  const rows=adhAccessRequests.filter(r=>(st==='all'||r.status===st)&&[r.full_name,r.email,r.city,r.phone].some(v=>String(v||'').toLowerCase().includes(q)));
  body.innerHTML=rows.map(r=>{const digits=String(r.phone||'').replace(/\D/g,'');const wa=digits.length>=10?'https://wa.me/'+(digits.startsWith('55')?digits:'55'+digits):'';const ch=r.chapter_id?mrChName(r.chapter_id):'';
    return `<tr><td><strong>${escapeHtml(r.full_name)}</strong><div class="meta">${escapeHtml(r.email)}</div>${r.phone?`<div class="meta">${wa?`<a href="${wa}" target="_blank" rel="noopener">${escapeHtml(r.phone)} · abrir WhatsApp</a>`:escapeHtml(r.phone)}</div>`:''}<div class="meta">${escapeHtml(r.justification||'')}</div></td><td>${escapeHtml(adhRoleNames[r.requested_role]||r.requested_role)}${ch?'<div class="meta">'+escapeHtml(ch)+'</div>':''}</td><td>${escapeHtml(r.city||'—')}</td><td>${escapeHtml(r.created_at?new Date(r.created_at).toLocaleDateString('pt-BR'):'—')}</td><td><span class="tag ${r.status==='approved'?'active':r.status==='rejected'?'inactive':'activation'}">${escapeHtml(adhReqStatusPt[r.status]||r.status)}</span>${r.review_notes?'<div class="meta">'+escapeHtml(r.review_notes)+'</div>':''}</td><td>${r.status==='pending'?`<div class="actions"><button class="btn small primary" onclick="approveAndCreate('${r.id}')">Aprovar e criar conta</button><button class="btn small danger" onclick="decideAccessRequest('${r.id}','rejected')">Rejeitar</button></div>`:'—'}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty">Nenhuma solicitação encontrada.</td></tr>'}
function approveAndCreate(id){const r=adhAccessRequests.find(x=>String(x.id)===String(id));if(!r)return;
  openNewUser();const f=document.querySelector('#newUserModal form'),role=document.getElementById('nuRole');
  f.elements.full_name.value=r.full_name||'';f.elements.email.value=r.email||'';let ph=String(r.phone||'').replace(/\D/g,'');if(ph.length>11&&ph.startsWith('55'))ph=ph.slice(2);f.elements.phone.value=ph;
  if([...role.options].some(o=>o.value===r.requested_role))role.value=r.requested_role;nuScope();
  if(r.chapter_id){const cs=document.getElementById('nuChapter');if([...cs.options].some(o=>o.value===String(r.chapter_id)))cs.value=String(r.chapter_id);const c=(adhDbChapters||[]).find(x=>String(x.id)===String(r.chapter_id));if(c&&c.region_id!=null){const rs=document.getElementById('nuRegion');if([...rs.options].some(o=>o.value===String(c.region_id)))rs.value=String(c.region_id)}}
  document.querySelector('#newUserModal h2').textContent='Aprovar e criar conta';
  document.getElementById('nuMsg').textContent='Pedido de '+(r.full_name||'')+' ('+(adhRoleNames[r.requested_role]||r.requested_role)+(r.city?', '+r.city:'')+'). Confira os dados, escolha capítulo/região quando faltar e crie a conta: o pedido será marcado como aprovado em seguida. Dica: defina uma senha provisória e envie por WhatsApp.';
  window.adhApprovingReq=r}
(function(){const snu=submitNewUser;submitNewUser=async function(ev){const req=window.adhApprovingReq;await snu.apply(this,arguments);if(!req)return;
  if(document.getElementById('newUserModal').classList.contains('open'))return; /* falhou: o modal continua aberto com a mensagem de erro */
  window.adhApprovingReq=null;
  try{await adhFetch('/rest/v1/rpc/review_access_request',{method:'POST',body:JSON.stringify({p_request_id:req.id,p_decision:'approved',p_notes:'Conta criada pelo painel'})})}
  catch(e){try{await adhFetch('/rest/v1/access_requests?id=eq.'+encodeURIComponent(req.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'approved',review_notes:'Conta criada pelo painel'})})}catch(e2){toast('Conta criada, mas o pedido não foi marcado como aprovado: '+(e2.message||e.message))}}
  try{await loadAccessRequests()}catch(e){}}})();
(function(){const cl=closeModal;closeModal=function(id){if(id==='newUserModal')window.adhApprovingReq=null;return cl.apply(this,arguments)}})();
(function(){const on=openNewUser;openNewUser=function(){window.adhApprovingReq=null;return on.apply(this,arguments)}})();


/* ===== v3.12 — Biblioteca de documentos + login de coordenadores ===== */
const ADH_LIB_CATS=['Apoio Jovem','Apoio Feminino','Regimento e estatuto','Manuais','Formulários','Atas e relatórios','Outros'];
const ADH_LIB_MAX=20*1024*1024;
let adhLibDocs=[];
(function(){const _r=adhResolveProfile;adhResolveProfile=function(roles,se){const p=_r(roles,se);if(p)return p;const act=(Array.isArray(roles)?roles:[]).filter(r=>r.is_active!==false);const lab={youth_coordinator:'Coordenador de apoio jovem',women_coordinator:'Coordenador de apoio feminino',field_representative:'Representante de campo'};const co=act.filter(r=>r.role==='youth_coordinator'||r.role==='women_coordinator');if(co.length)return {role:'coordinator',label:lab[co[0].role],speakerEditor:!!se,regionIds:[],chapterIds:[...new Set(co.map(r=>r.chapter_id).filter(x=>x!=null))]};const c=act.find(r=>lab[r.role]);return c?{role:'member',label:lab[c.role],speakerEditor:!!se,regionIds:[],chapterIds:[]}:null}})();
(function(){const _p=rolePermissions;rolePermissions=function(r){let p=_p(r);const role=(typeof adhProfile!=='undefined'&&adhProfile)?adhProfile.role:null;if(['state_admin','state_director','regional_director','chapter_president','coordinator'].includes(role)&&!p.pages.includes('library'))p={pages:[...p.pages,'library'],edit:p.edit};return p}})();
function libFmtSize(n){n=Number(n)||0;return n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(n/1024))+' KB'}
function libFmtDate(d){try{return new Date(d).toLocaleDateString('pt-BR')}catch(e){return ''}}
function libCanPublish(){return !!adhProfile&&['state_admin','state_director','regional_director','chapter_president','coordinator'].includes(adhProfile.role)}
function libCanDirectors(){return !!adhProfile&&['state_admin','state_director','regional_director'].includes(adhProfile.role)}
async function adhLibUid(){try{return (await adhFetch('/auth/v1/user')).id}catch(e){return null}}
async function loadLibrary(target){
 const notice=document.getElementById('libNotice');
 try{adhLibDocs=(await adhFetch('/rest/v1/library_docs?select=*&order=created_at.desc&limit=500'))||[];adhLibMe=await adhLibUid()}
 catch(e){adhLibDocs=[];const m=/relation .*library_docs|does not exist|schema cache/i.test(e.message)?'A biblioteca ainda não foi ativada no banco: rode a migracao-v3.12-biblioteca.sql no Supabase.':'Não foi possível carregar os documentos: '+e.message;if(notice)notice.textContent=m;const mb=document.getElementById('mbLib');if(mb)mb.innerHTML='<p class="sub">'+escapeHtml(m)+'</p>';return}
 renderLibrary();
}
let adhLibMe=null;
function libItemHtml(d,canDel){
 const aud=d.audience==='directors'?'<span class="tag inactive">Somente diretoria</span>':'<span class="tag active">Todos os sócios</span>';
 const who=d.uploaded_by_name?('Publicado por '+escapeHtml(d.uploaded_by_name)+' em '+libFmtDate(d.created_at)):('Publicado em '+libFmtDate(d.created_at));
 const del=canDel&&(adhProfile&&(adhProfile.role==='state_admin'||d.uploaded_by===adhLibMe))?`<button class="btn small" data-lib-del="${escapeHtml(d.id)}" style="color:#a83c42">Excluir</button>`:'';
 return `<div class="libitem"><div><h4>${escapeHtml(d.title)}</h4><div>${aud} <span class="tag activation">${escapeHtml(d.category||'Outros')}</span></div>${d.description?'<p>'+escapeHtml(d.description)+'</p>':''}<div class="meta">${who} · ${escapeHtml(libFmtSize(d.size_bytes))}</div></div><div class="libbtns"><button class="btn small primary" data-lib-open="${escapeHtml(d.id)}">Abrir</button><button class="btn small" data-lib-dl="${escapeHtml(d.id)}">Baixar</button>${del}</div></div>`}
function renderLibrary(){
 const q=(document.getElementById('libSearch')?.value||'').toLowerCase(),cat=document.getElementById('libCat')?.value||'';
 const sel=document.getElementById('libCat');if(sel&&sel.options.length<2){sel.innerHTML='<option value="">Todas as categorias</option>'+ADH_LIB_CATS.map(c=>`<option>${escapeHtml(c)}</option>`).join('')}
 const btn=document.getElementById('libNewBtn');if(btn)btn.style.display=libCanPublish()?'':'none';
 const list=adhLibDocs.filter(d=>(!cat||d.category===cat)&&(!q||(d.title+' '+(d.description||'')+' '+(d.category||'')).toLowerCase().includes(q)));
 const notice=document.getElementById('libNotice'),box=document.getElementById('libList');
 if(notice)notice.textContent=adhLibDocs.length?(list.length+' documento(s)'):'Nenhum documento publicado ainda.';
 if(box)box.innerHTML=list.map(d=>libItemHtml(d,true)).join('');
 const mb=document.getElementById('mbLib');if(mb)mb.innerHTML=adhLibDocs.length?adhLibDocs.map(d=>libItemHtml(d,false)).join(''):'<p class="sub">Nenhum documento disponível no momento.</p>';
}
async function libSignedUrl(d,download){
 const out=await adhFetch('/storage/v1/object/sign/library/'+d.file_path.split('/').map(encodeURIComponent).join('/'),{method:'POST',body:JSON.stringify({expiresIn:120})});
 const u=out&&(out.signedURL||out.signedUrl);if(!u)throw new Error('Não foi possível gerar o link do arquivo.');
 return ADH_SUPABASE_URL+'/storage/v1'+(u.startsWith('/')?u:'/'+u)+(download?'&download='+encodeURIComponent(d.file_name||'documento'):'');
}
async function libOpen(id,download){
 const d=adhLibDocs.find(x=>x.id===id);if(!d)return;
 const w=download?null:window.open('','_blank');
 try{const url=await libSignedUrl(d,download);if(w){w.location.href=url}else{const a=document.createElement('a');a.href=url;a.rel='noopener';if(download)a.download=d.file_name||'';document.body.appendChild(a);a.click();a.remove()}}
 catch(e){if(w)w.close();toast('Não foi possível abrir: '+adhFnMsg(e.message))}
}
function openLibraryForm(){
 if(!libCanPublish()){toast('Sem permissão para publicar documentos.');return}
 const f=document.querySelector('#libraryModal form');f.reset();
 document.getElementById('libFormCat').innerHTML=ADH_LIB_CATS.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
 document.getElementById('libOptDir').style.display=libCanDirectors()?'':'none';
 document.getElementById('libMsg').textContent='Ficará registrado o seu nome e a data da publicação.';
 document.getElementById('libraryModal').classList.add('open');
}
function libSafeName(n){const dot=n.lastIndexOf('.');const ext=dot>0?n.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g,''):'';const base=(dot>0?n.slice(0,dot):n).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'documento';return base+ext}
async function submitLibrary(ev){
 ev.preventDefault();const f=ev.target,d=new FormData(f),file=document.getElementById('libFile').files[0],btn=document.getElementById('libSubmit'),msg=document.getElementById('libMsg');
 if(!file){msg.textContent='Escolha o arquivo.';return}
 if(file.size>ADH_LIB_MAX){msg.textContent='O arquivo tem '+libFmtSize(file.size)+'. O limite é 20 MB.';return}
 const audience=d.get('audience')==='directors'&&libCanDirectors()?'directors':'members';
 const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));
 const path=id+'/'+libSafeName(file.name);
 btn.disabled=true;msg.textContent='Enviando arquivo…';let uploaded=false;
 try{
  const up=await fetch(ADH_SUPABASE_URL+'/storage/v1/object/library/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:adhHeaders({'Content-Type':file.type||'application/octet-stream','x-upsert':'false'}),body:file});
  const raw=await up.text();let j=null;try{j=JSON.parse(raw)}catch(e){}
  if(!up.ok)throw new Error((j&&(j.message||j.error))||('HTTP '+up.status));
  uploaded=true;msg.textContent='Registrando…';
  await adhFetch('/rest/v1/library_docs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,title:String(d.get('title')).trim(),description:String(d.get('description')||'').trim()||null,category:String(d.get('category')||'Outros'),audience,file_path:path,file_name:file.name,mime_type:file.type||null,size_bytes:file.size})});
  closeModal('libraryModal');toast('Documento publicado.');await loadLibrary();
 }catch(e){
  if(uploaded){try{await fetch(ADH_SUPABASE_URL+'/storage/v1/object/library/'+path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',headers:adhHeaders()})}catch(x){}}
  let m=e.message;if(/mime|not supported|invalid_mime/i.test(m))m='Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint ou imagem.';else if(/row-level security|violates|permission/i.test(m))m='Sem permissão para publicar este documento (ou a migração v3.12 ainda não foi rodada).';
  msg.textContent='Não foi possível publicar: '+m;
 }finally{btn.disabled=false}
}
async function libDelete(id){
 const d=adhLibDocs.find(x=>x.id===id);if(!d)return;
 if(!(await adhDialog({title:'Excluir documento',message:'“'+d.title+'” será apagado para todos. Esta ação não pode ser desfeita.',confirmLabel:'Excluir'})))return;
 try{await adhFetch('/rest/v1/library_docs?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{Prefer:'return=representation'}}).then(r=>{if(Array.isArray(r)&&!r.length)throw new Error('Sem permissão para excluir este documento.')});
  try{await fetch(ADH_SUPABASE_URL+'/storage/v1/object/library/'+d.file_path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',headers:adhHeaders()})}catch(x){}
  toast('Documento excluído.');await loadLibrary()}catch(e){toast('Não foi possível excluir: '+e.message)}
}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-lib-open],[data-lib-dl],[data-lib-del]');if(!b)return;if(b.dataset.libOpen)libOpen(b.dataset.libOpen,false);else if(b.dataset.libDl)libOpen(b.dataset.libDl,true);else if(b.dataset.libDel)libDelete(b.dataset.libDel)});
(function(){const _s=showMemberArea;showMemberArea=async function(){await _s();loadLibrary().catch(()=>{})}})();


/* ===== v3.13 — permissões revistas, contato do presidente, mapa em tela cheia ===== */
let adhChapterContacts={};
(function(){const _l=loadChaptersAdmin;loadChaptersAdmin=async function(){await _l();const r=adhProfile&&adhProfile.role;
 if(r==='chapter_president'||r==='regional_director'){const ids=(adhProfile.chapterIds||[]).map(String),rg=(adhProfile.regionIds||[]).map(String);chapters=chapters.filter(c=>r==='chapter_president'?ids.includes(String(c.id)):rg.includes(String(c.region_id)));adhDbChapters=adhDbChapters.filter(c=>r==='chapter_president'?ids.includes(String(c.id)):rg.includes(String(c.region_id)))}
 try{const rows=await adhFetch('/rest/v1/chapter_contacts?select=chapter_id,president_phone,show_public&limit=2000');adhChapterContacts={};(rows||[]).forEach(x=>{adhChapterContacts[String(x.chapter_id)]=x})}catch(e){adhChapterContacts={}}
 try{renderAll()}catch(e){}}})();
(function(){const _o=openChapter;openChapter=function(id){if(!id&&!(adhProfile&&['state_admin','state_director'].includes(adhProfile.role))){toast('Somente a administração estadual cadastra novos capítulos.');return}return _o(id)}})();
function openChapterContact(id){
 const c=(chapters||[]).find(x=>String(x.id)===String(id));if(!c)return;
 const f=document.querySelector('#contactModal form'),cc=adhChapterContacts[String(id)]||{};
 f.reset();f.elements.chapter_id.value=id;
 const n=String(cc.president_phone||'').replace(/^55/,'');f.elements.phone.value=n;if(n)prMask(f.elements.phone);
 f.elements.show_public.value=cc.show_public?'yes':'no';
 document.getElementById('contactTitle').textContent='Contato — '+c.name;
 document.getElementById('contactMsg').textContent=c.president?'Presidente cadastrado: '+c.president+'.':'';
 document.getElementById('contactModal').classList.add('open');
}
async function saveChapterContact(ev){
 ev.preventDefault();const f=ev.target,btn=document.getElementById('contactSubmit'),msg=document.getElementById('contactMsg');
 const digits=String(f.elements.phone.value||'').replace(/\D/g,'');const show=f.elements.show_public.value==='yes';
 if(digits&&(digits.length<10||digits.length>11)){msg.textContent='Informe DDD + número (10 ou 11 dígitos).';return}
 if(show&&!digits){msg.textContent='Para mostrar no site, informe o telefone.';return}
 const id=Number(f.elements.chapter_id.value);btn.disabled=true;msg.textContent='Salvando…';
 try{await adhFetch('/rest/v1/chapter_contacts?on_conflict=chapter_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({chapter_id:id,president_phone:digits?'55'+digits:null,show_public:show})});
  adhChapterContacts[String(id)]={chapter_id:id,president_phone:digits?'55'+digits:null,show_public:show};closeModal('contactModal');toast(show?'Contato salvo e liberado no site público.':'Contato salvo (não aparece no site).')}
 catch(e){msg.textContent='Não foi possível salvar: '+(/row-level security|permission/i.test(e.message)?'sem permissão para este capítulo (ou a migração v3.13 ainda não foi rodada).':e.message)}
 finally{btn.disabled=false}
}
function adhMapFull(on){
 const p=document.getElementById('adminMapPanel');if(!p)return;
 const want=on===undefined?!p.classList.contains('adh-full'):!!on;
 p.classList.toggle('adh-full',want);document.body.classList.toggle('adh-noscroll',want);
 const b=document.getElementById('adminMapFullBtn');if(b)b.textContent='⛶ Tela cheia';
 try{if(want){if(p.requestFullscreen&&!document.fullscreenElement)p.requestFullscreen().catch(()=>{})}else if(document.fullscreenElement){document.exitFullscreen()}}catch(e){}
 if(want)p.scrollTop=0;
 [80,300,700].forEach(t=>setTimeout(()=>window.dispatchEvent(new Event('resize')),t));
}
document.addEventListener('fullscreenchange',()=>{const p=document.getElementById('adminMapPanel');if(!document.fullscreenElement&&p&&p.classList.contains('adh-full'))adhMapFull(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const p=document.getElementById('adminMapPanel');if(p&&p.classList.contains('adh-full')&&!document.fullscreenElement)adhMapFull(false)}});
