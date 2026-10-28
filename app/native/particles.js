/* ADHONEP-SC · Início: partículas se reúnem no mapa de Santa Catarina; o dedo as afasta e elas voltam. Municípios com capítulo em ouro. */
(function(){
 var cv,cx,P=[],W=0,H=0,dpr=1,run=false,raf=0,t0=0,px=-9999,py=-9999,ready=false,GOLD=null,POLYS=null,bb=null;
 function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()}
 function inR(r,x,y){var ins=false;for(var i=0,j=r.length-1;i<r.length;j=i++){var xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins}return ins}
 function size(){var r=cv.getBoundingClientRect();W=Math.max(200,r.width);H=Math.max(200,r.height);dpr=Math.min(window.devicePixelRatio||1,2);
  var w=Math.round(W*dpr),h=Math.round(H*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;layout()}}
 function layout(){if(!ready)return;var k=Math.min(W*.9/(bb[2]-bb[0]),H*.88/(bb[3]-bb[1])),ox=W/2-(bb[0]+bb[2])/2*k,oy=H/2+(bb[1]+bb[3])/2*k;
  P.forEach(function(p){p.hx=ox+p.lon*k;p.hy=oy-p.lat*k})}
 function build(d){
  var M=d.map(function(m){var rings=m.p.map(function(r){return r.map(function(q){return [q[0]/1000,q[1]/1000]})}),b=[1e9,1e9,-1e9,-1e9];
   rings.forEach(function(r){r.forEach(function(q){if(q[0]<b[0])b[0]=q[0];if(q[0]>b[2])b[2]=q[0];if(q[1]<b[1])b[1]=q[1];if(q[1]>b[3])b[3]=q[1]})});return {n:norm(m.n),rings:rings,b:b}});
  bb=[1e9,1e9,-1e9,-1e9];M.forEach(function(m){if(m.b[0]<bb[0])bb[0]=m.b[0];if(m.b[1]<bb[1])bb[1]=m.b[1];if(m.b[2]>bb[2])bb[2]=m.b[2];if(m.b[3]>bb[3])bb[3]=m.b[3]});
  POLYS=M;var step=.048,pts=[];
  for(var la=bb[1];la<=bb[3];la+=step){for(var lo=bb[0];lo<=bb[2];lo+=step){
   var jx=lo+(Math.random()-.5)*step*.6,jy=la+(Math.random()-.5)*step*.6;
   for(var i=0;i<M.length;i++){var m=M[i];if(jx<m.b[0]||jx>m.b[2]||jy<m.b[1]||jy>m.b[3])continue;
    var hit=false;for(var r=0;r<m.rings.length&&!hit;r++)if(inR(m.rings[r],jx,jy))hit=true;
    if(hit){pts.push({lon:jx,lat:jy,mi:i});break}}}}
  P=pts.map(function(q){return {lon:q.lon,lat:q.lat,mi:q.mi,x:Math.random()*400-100,y:Math.random()*800-100,vx:0,vy:0,k:.04+Math.random()*.05,ph:Math.random()*6.28,hx:0,hy:0}});
  ready=true;paintGold();size();layout()}
 function paintGold(){if(!ready||!GOLD)return;P.forEach(function(p){p.g=!!GOLD[POLYS[p.mi].n]})}
 function frame(ts){
  if(!run){raf=0;return}raf=requestAnimationFrame(frame);
  size();cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,H);if(!ready)return;
  var s=ts/1000,R2=90*90;
  for(var i=0;i<P.length;i++){var p=P[i],tx=p.hx+Math.sin(s*.9+p.ph)*.5,ty=p.hy+Math.cos(s*.8+p.ph)*.5;
   p.vx=(p.vx+(tx-p.x)*p.k)*.8;p.vy=(p.vy+(ty-p.y)*p.k)*.8;
   var dx=p.x-px,dy=p.y-py,d2=dx*dx+dy*dy;if(d2<R2&&d2>1){var f=(1-d2/R2)*8/Math.sqrt(d2);p.vx+=dx*f;p.vy+=dy*f}
   p.x+=p.vx;p.y+=p.vy;
   if(p.g){var pu=.65+.35*Math.sin(s*2+p.ph);cx.globalAlpha=.55+.45*pu;cx.fillStyle='#e8c97e';cx.fillRect(p.x-1.5,p.y-1.5,3,3)}
   else{cx.globalAlpha=.55;cx.fillStyle='#a9c4ec';cx.fillRect(p.x-.9,p.y-.9,1.8,1.8)}}
  cx.globalAlpha=1}
 function pt(e){var r=cv.getBoundingClientRect();px=e.clientX-r.left;py=e.clientY-r.top}
 window.AdhSC={
  init:function(c){if(cv)return;cv=c;cx=cv.getContext('2d');
   fetch('data/mun/SC.json').then(function(r){return r.json()}).then(build).catch(function(){});
   cv.addEventListener('pointerdown',function(e){try{cv.setPointerCapture(e.pointerId)}catch(x){}pt(e)});
   cv.addEventListener('pointermove',pt);
   var off=function(){px=py=-9999};cv.addEventListener('pointerup',off);cv.addEventListener('pointercancel',off);cv.addEventListener('pointerleave',off)},
  gold:function(names){GOLD={};(names||[]).forEach(function(n){GOLD[norm(n)]=1});paintGold()},
  regather:function(){P.forEach(function(p){p.x=Math.random()*W;p.y=Math.random()*H})},
  start:function(){if(run||!cv)return;run=true;raf=requestAnimationFrame(frame)},
  stop:function(){run=false}
 };
})();
