/* 월광 살롱 - 심심풀이 장난감: 상단의 반딧불 버튼을 누르면 빛 알갱이가 흩어지고 음이 울린다. 빨리 누르면 콤보! */
(()=>{
 const btn=document.getElementById('btnToy'),cv=document.getElementById('toyc'),nEl=document.getElementById('toyN');
 if(!btn||!cv)return;
 const c=cv.getContext('2d'),RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let ps=[],raf=0,combo=0,last=0,total=0,hotT=0,dpr=Math.min(2,window.devicePixelRatio||1);
 try{total=+localStorage.getItem('mafia_toy')||0}catch(e){}
 nEl.textContent=total;
 const cb=document.createElement('span');cb.className='cb';btn.appendChild(cb);
 const COL=['#ffe9a8','#ffd36a','#fff6d8','#ffb36b','#cfe3ff'];
 function size(){cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;c.setTransform(dpr,0,0,dpr,0,0)}
 size();addEventListener('resize',size);
 function burst(x,y,n,big){
  for(let i=0;i<n;i++){
   const a=Math.random()*Math.PI*2,sp=(big?2.5:1)+Math.random()*(big?5:2.6);
   ps.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.6,life:0,max:70+Math.random()*60,r:1.2+Math.random()*(big?3:2),c:COL[Math.floor(Math.random()*COL.length)],tw:Math.random()*6})}
  if(ps.length>400)ps=ps.slice(-400);
  if(!raf)raf=requestAnimationFrame(loop)}
 function loop(){
  c.clearRect(0,0,innerWidth,innerHeight);
  ps=ps.filter(p=>p.life<p.max);
  ps.forEach(p=>{
   p.life++;p.x+=p.vx;p.y+=p.vy;p.vx*=.985;p.vy=p.vy*.985-.012;p.tw+=.25;
   const k=1-p.life/p.max,a=Math.max(0,k)*(.55+.45*Math.sin(p.tw));
   c.globalAlpha=a;c.fillStyle=p.c;c.shadowColor=p.c;c.shadowBlur=10;
   c.beginPath();c.arc(p.x,p.y,p.r*(.6+k*.6),0,7);c.fill()});
  c.globalAlpha=1;c.shadowBlur=0;
  raf=ps.length?requestAnimationFrame(loop):0;if(!raf)c.clearRect(0,0,innerWidth,innerHeight)}
 btn.addEventListener('click',()=>{
  const now=performance.now();combo=now-last<650?combo+1:1;last=now;total++;nEl.textContent=total;
  try{if(total%5===0)localStorage.setItem('mafia_toy',total)}catch(e){}
  const r=btn.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,big=combo>0&&combo%10===0;
  if(typeof Snd!=='undefined')Snd.plink(combo+Math.floor(Math.random()*3),big);
  if(!RM){burst(x,y,big?70:7+Math.min(combo,14),big)}
  btn.classList.toggle('hot',combo>=3);cb.textContent=combo>=3?combo+' 콤보':'';
  clearTimeout(hotT);hotT=setTimeout(()=>{btn.classList.remove('hot');combo=0},900)});
})();
