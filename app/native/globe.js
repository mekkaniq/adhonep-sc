/* ADHONEP-SC · globo interativo da tela inicial (pontos de terra, rotas a partir de Santa Catarina). Arraste para girar. */
(function(){
 var RAD=Math.PI/180,SC=[-50.3,-27.2];
 var G={lon:-52,lat:-12,inertia:null,drag:null,run:false,ripple:null,ready:false};
 var cv,cx,DOTS=null,ROUTES=null,dpr=1,raf=0,t0=0;
 function size(){var r=cv.getBoundingClientRect(),w=Math.max(200,r.width),h=Math.max(200,r.height);dpr=Math.min(window.devicePixelRatio||1,2);
  var W=Math.round(w*dpr),H=Math.round(h*dpr);if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}return [w,h]}
 function prj(lo,la){var l=(lo-G.lon)*RAD,f=la*RAD,p0=G.lat*RAD,cl=Math.cos(l);
  return {X:Math.cos(f)*Math.sin(l),Y:Math.cos(p0)*Math.sin(f)-Math.sin(p0)*Math.cos(f)*cl,Z:Math.sin(p0)*Math.sin(f)+Math.cos(p0)*Math.cos(f)*cl}}
 function gcp(a,b,u){var v=function(p){return [Math.cos(p[1]*RAD)*Math.cos(p[0]*RAD),Math.cos(p[1]*RAD)*Math.sin(p[0]*RAD),Math.sin(p[1]*RAD)]},
  A=v(a),B=v(b),d=Math.acos(Math.max(-1,Math.min(1,A[0]*B[0]+A[1]*B[1]+A[2]*B[2])))||1e-6,s=Math.sin(d),x=Math.sin((1-u)*d)/s,y=Math.sin(u*d)/s,
  P=[x*A[0]+y*B[0],x*A[1]+y*B[1],x*A[2]+y*B[2]];return [Math.atan2(P[1],P[0])/RAD,Math.asin(Math.max(-1,Math.min(1,P[2])))/RAD]}
 function build(j){
  var d=j.d,n=d.length/3;DOTS={lo:new Float32Array(n),sf:new Float32Array(n),cf:new Float32Array(n),g:new Uint8Array(n),n:n};
  for(var i=0;i<n;i++){var lo=d[i*3]/10,la=d[i*3+1]/10;DOTS.lo[i]=lo;DOTS.sf[i]=Math.sin(la*RAD);DOTS.cf[i]=Math.cos(la*RAD);DOTS.g[i]=d[i*3+2]}
  ROUTES=(j.r||[]).map(function(p,k){var pts=[];for(var t=0;t<=40;t++)pts.push(gcp(SC,p,t/40));return {pts:pts,off:(k*0.137)%1}});
  G.ready=true}
 function draw(ts){
  var s=size(),w=s[0],h=s[1];cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,w,h);
  var R=Math.min(w*.47,h*.47),cxp=w/2,cyp=h*.52;
  var g=cx.createRadialGradient(cxp,cyp,R*.92,cxp,cyp,R*1.28);g.addColorStop(0,'rgba(90,150,230,.30)');g.addColorStop(1,'rgba(90,150,230,0)');
  cx.fillStyle=g;cx.beginPath();cx.arc(cxp,cyp,R*1.28,0,7);cx.fill();
  cx.fillStyle='rgba(16,44,86,.72)';cx.beginPath();cx.arc(cxp,cyp,R,0,7);cx.fill();
  if(G.ready){
   var cs=Math.cos(G.lat*RAD),sn=Math.sin(G.lat*RAD),lo0=G.lon,ds=Math.max(.8,R*.0042);
   for(var pass=0;pass<3;pass++){
    cx.fillStyle=pass===0?'rgba(150,180,220,.5)':pass===1?'rgba(214,178,106,.8)':'rgba(240,206,122,1)';
    var dd=pass===2?ds*1.25:ds;cx.beginPath();
    for(var i=0;i<DOTS.n;i++){if(DOTS.g[i]!==pass)continue;var l=(DOTS.lo[i]-lo0)*RAD,cl=Math.cos(l),Z=sn*DOTS.sf[i]+cs*DOTS.cf[i]*cl;if(Z<=0)continue;
     var X=DOTS.cf[i]*Math.sin(l),Y=cs*DOTS.sf[i]-sn*DOTS.cf[i]*cl;cx.rect(cxp+X*R-dd,cyp-Y*R-dd,dd*2,dd*2)}
    cx.fill()}
   cx.lineWidth=1;
   ROUTES.forEach(function(rt){var on=false,P=rt.pts;cx.strokeStyle='rgba(230,207,156,.32)';cx.beginPath();
    for(var i=0;i<P.length;i++){var q=prj(P[i][0],P[i][1]);if(q.Z<=0){on=false;continue}var lift=1+.1*Math.sin(Math.PI*i/(P.length-1)),x=cxp+q.X*R*lift,y=cyp-q.Y*R*lift;on?cx.lineTo(x,y):cx.moveTo(x,y);on=true}
    cx.stroke();
    var u=((ts/4200)+rt.off)%1,k=Math.min(P.length-1,Math.floor(u*(P.length-1))),q2=prj(P[k][0],P[k][1]);
    if(q2.Z>0){var lf=1+.1*Math.sin(Math.PI*k/(P.length-1));cx.fillStyle='rgba(255,236,190,.95)';cx.beginPath();cx.arc(cxp+q2.X*R*lf,cyp-q2.Y*R*lf,1.8,0,7);cx.fill()}});
   var m=prj(SC[0],SC[1]);
   if(m.Z>0){var x=cxp+m.X*R,y=cyp-m.Y*R,p=(ts/1400)%1;cx.strokeStyle='rgba(240,206,122,'+(1-p)*.8+')';cx.lineWidth=1.5;cx.beginPath();cx.arc(x,y,3+p*13,0,7);cx.stroke();
    cx.fillStyle='#fff4d0';cx.beginPath();cx.arc(x,y,3.2,0,7);cx.fill();cx.strokeStyle='#c9a45c';cx.lineWidth=1.6;cx.stroke()}}
  if(G.ripple){var rp=(ts-G.ripple.t)/700;if(rp>=1)G.ripple=null;else{cx.strokeStyle='rgba(240,206,122,'+(1-rp)*.7+')';cx.lineWidth=2;cx.beginPath();cx.arc(G.ripple.x,G.ripple.y,6+rp*34,0,7);cx.stroke()}}
 }
 function frame(ts){
  if(!G.run){raf=0;return}
  var dt=Math.min(50,ts-(t0||ts));t0=ts;
  if(G.inertia&&!G.drag){G.lon+=G.inertia.x;G.lat=Math.max(-70,Math.min(70,G.lat+G.inertia.y));G.inertia.x*=.94;G.inertia.y*=.94;if(Math.abs(G.inertia.x)<.01&&Math.abs(G.inertia.y)<.01)G.inertia=null}
  else if(!G.drag){G.lon+=dt*.0075;G.lat+=(-12-G.lat)*.004}
  G.lon=((G.lon+540)%360)-180;draw(ts);raf=requestAnimationFrame(frame)}
 var AG=window.AdhGlobe={
  init:function(canvas){if(cv)return;cv=canvas;cx=cv.getContext('2d');
   fetch('data/globe.json').then(function(r){return r.json()}).then(build).catch(function(){});
   cv.addEventListener('pointerdown',function(e){try{cv.setPointerCapture(e.pointerId)}catch(x){}G.drag={x:e.clientX,y:e.clientY,m:0};G.inertia=null});
   cv.addEventListener('pointermove',function(e){if(!G.drag)return;var dx=e.clientX-G.drag.x,dy=e.clientY-G.drag.y;G.drag.m+=Math.abs(dx)+Math.abs(dy);var k=.3;G.lon-=dx*k;G.lat=Math.max(-70,Math.min(70,G.lat+dy*k));G.inertia={x:-dx*k*.7,y:dy*k*.7};G.drag.x=e.clientX;G.drag.y=e.clientY});
   var up=function(e){if(G.drag&&G.drag.m<6){var r=cv.getBoundingClientRect();G.ripple={x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()};G.inertia={x:.9,y:0}}G.drag=null};
   cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',function(){G.drag=null})},
  start:function(){if(G.run||!cv)return;G.run=true;t0=0;raf=requestAnimationFrame(frame)},
  stop:function(){G.run=false}
 };
 document.addEventListener('visibilitychange',function(){if(document.hidden)AG.stop()});
})();
