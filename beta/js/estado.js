/* ADHONEP · contexto de estado (claude v2.0). ?uf=XX troca o estado da plataforma; sem parâmetro = SC (comportamento de sempre). */
(function(){
  var N={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
  var uf='SC';try{var q=(new URLSearchParams(location.search).get('uf')||'').toUpperCase();if(N[q])uf=q}catch(e){}
  window.ADH_UF=uf;window.ADH_UF_NAME=N[uf];window.ADH_UF_NAMES=N;window.ADH_BRAND='ADHONEP-'+uf;
  /* Filtra as consultas do banco pelo estado atual (regiões, municípios, capítulos, vínculos, comunicados) */
  var LISTS={municipalities:1,regions:1,chapters:1,region_municipalities:1,statewide_announcements:1,public_announcements:1};
  window.adhScopePath=function(p){
    try{var m=/^\/rest\/v1\/([a-z_]+)\?(.*)$/.exec(p);if(!m||!LISTS[m[1]])return p;
      if(/(^|&)(id|municipality_id|chapter_id)=eq\./.test(m[2])&&m[1]!=='municipalities')return p;
      if(/(^|&)id=eq\./.test(m[2]))return p;
      if(/(^|&)state_code=/.test(m[2]))return p;
      return p+'&state_code=eq.'+uf}catch(e){return p}};
  window.adhScopeBody=function(p,opt){
    try{if(uf==='SC'||!opt||opt.method!=='POST'||!/^\/rest\/v1\/(regions|statewide_announcements)(\?|$)/.test(p)||typeof opt.body!=='string')return opt;
      var b=JSON.parse(opt.body);var f=function(o){if(o&&typeof o==='object'&&!o.state_code)o.state_code=uf;return o};
      b=Array.isArray(b)?b.map(f):f(b);return Object.assign({},opt,{body:JSON.stringify(b)})}catch(e){return opt}};
  /* Troca o nome do estado nos textos fixos da página (SC permanece igual) */
  function swap(s){return s.replace(/Santa Catarina/gi,function(m){return m===m.toUpperCase()?N[uf].toUpperCase():N[uf]}).replace(/ADHONEP-SC/gi,function(m){return m===m.toUpperCase()?'ADHONEP-'+uf:'ADHONEP-'+uf})}
  window.adhSwapText=swap;
  if(uf!=='SC'){
    document.addEventListener('DOMContentLoaded',function(){
      try{document.title=swap(document.title);document.querySelectorAll('meta[content]').forEach(function(m){m.setAttribute('content',swap(m.getAttribute('content')))});
        var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);var n;while((n=w.nextNode())){if(/Santa Catarina|ADHONEP-SC/i.test(n.nodeValue))n.nodeValue=swap(n.nodeValue)}
        document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(function(e){['aria-label','placeholder','title'].forEach(function(a){var v=e.getAttribute(a);if(v&&/Santa Catarina|ADHONEP-SC/i.test(v))e.setAttribute(a,swap(v))})});
        var b=document.createElement('div');b.setAttribute('role','status');b.style.cssText='background:#f5e7c5;color:#102b4e;padding:8px 16px;font:600 13px Inter,system-ui,sans-serif;text-align:center';b.textContent='Ambiente de teste · '+N[uf]+' · os dados deste estado ainda estão sendo montados.';document.body.insertBefore(b,document.body.firstChild)}catch(e){}});
  }
})();
