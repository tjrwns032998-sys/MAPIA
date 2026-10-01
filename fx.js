/* 월광 살롱 - 이벤트 연출: 밤낮 전환, 사망, 처형, 최후 발언, 직업 공개, 승패 (화면 효과 + 효과음 + 파티클) */
let fxQ=[],fxBusy=false,pendingRole=null,freshDead=new Set(),fxRaf=0;
const REDUCED=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function fxPush(o){fxQ.push(o);if(fxQ.length>5)fxQ=fxQ.slice(-4);if(!fxBusy)fxNext()}
function fxNext(){
 const o=fxQ.shift(),el=document.getElementById('fx');
 if(!o){fxBusy=false;return}
 fxBusy=true;
 el.className='';void el.offsetWidth;el.className='on '+o.kind;
 if(o.rc)el.style.setProperty('--rc',o.rc);
 document.getElementById('fxcard').innerHTML=`<svg class="ic fi"><use href="#${o.icon}"/></svg><h2>${esc(o.title)}</h2>${o.sub?`<p>${o.sub}</p>`:''}${o.camp?`<span class="camp">${esc(o.camp)}</span>`:''}${o.extra||''}`;
 if(o.kind==='night')el.insertAdjacentHTML('beforeend','');
 if(o.kind==='dawn'&&!el.querySelector('.rays'))el.querySelector('.veil').insertAdjacentHTML('afterend','<div class="rays"></div>');
 if(o.snd)o.snd.forEach(s=>Snd.sfx(s));
 if(o.shake&&!REDUCED){const m=document.getElementById('room');m.classList.remove('shake');void m.offsetWidth;m.classList.add('shake')}
 particles(o.kind,o.ms);
 setTimeout(()=>{el.classList.remove('on');const r=el.querySelector('.rays');if(r)r.remove();setTimeout(fxNext,380)},o.ms)}

/* ---- 파티클 ---- */
function particles(kind,ms){
 const cv=document.getElementById('fxc'),c=cv.getContext('2d');
 cv.width=innerWidth;cv.height=innerHeight;cancelAnimationFrame(fxRaf);c.clearRect(0,0,cv.width,cv.height);
 if(REDUCED||!['night','dawn','death','exec','spare','win','lose','role'].includes(kind))return;
 const W=cv.width,H=cv.height,N={night:90,dawn:60,death:70,exec:70,spare:60,win:160,lose:60,role:50}[kind],ps=[];
 const col={night:['#dfe8ff','#9db4ff','#fff'],dawn:['#ffd28a','#ffb36b','#fff3d0'],death:['#d0566a','#7d2433','#ff8da0'],exec:['#d0566a','#7d2433','#ff8da0'],spare:['#8fe0b8','#d7ffe9','#fff'],win:['#ffd36a','#ff8da0','#8fe0b8','#9db4ff','#fff'],lose:['#6b5a66','#d0566a','#3a2a30'],role:['#c9a45c','#fff3d0']}[kind];
 for(let i=0;i<N;i++){
  const up=kind==='dawn'||kind==='role'||kind==='spare',fall=kind==='win'||kind==='lose';
  ps.push({x:Math.random()*W,y:kind==='night'?Math.random()*H:fall?-20-Math.random()*H*.4:up?H+Math.random()*60:H*.4+Math.random()*H*.5,
   vx:(Math.random()-.5)*(kind==='win'?4:1.2),vy:fall?1.5+Math.random()*3.5:up?-(.6+Math.random()*1.8):kind==='night'?0:-(.2+Math.random()*1.2),
   r:kind==='win'?4+Math.random()*5:1+Math.random()*2.6,c:col[Math.floor(Math.random()*col.length)],ph:Math.random()*6,rot:Math.random()*6,sq:kind==='win'})}
 const t0=performance.now();
 (function loop(t){
  const k=t-t0;if(k>ms+300){c.clearRect(0,0,W,H);return}
  c.clearRect(0,0,W,H);
  ps.forEach(p=>{
   p.x+=p.vx;p.y+=p.vy;p.rot+=.08;
   let a=Math.min(1,k/400)*Math.min(1,(ms+300-k)/500);
   if(kind==='night')a*=.35+.65*Math.abs(Math.sin(p.ph+k/500));
   c.globalAlpha=Math.max(0,a);c.fillStyle=p.c;
   if(p.sq){c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.fillRect(-p.r,-p.r/2,p.r*2,p.r);c.restore()}
   else{c.beginPath();c.arc(p.x,p.y,p.r,0,7);c.fill()}});
  c.globalAlpha=1;fxRaf=requestAnimationFrame(loop)})(t0)}

/* ---- 상태 변화 -> 연출 ---- */
function newLogs(prev,cur){
 const a=prev.log||[],b=cur.log||[];if(!b.length)return[];
 const last=a.length?JSON.stringify(a[a.length-1]):null;
 if(last){for(let i=b.length-1;i>=0;i--)if(JSON.stringify(b[i])===last)return b.slice(i+1)}
 return a.length?[]:b.slice(-2)}
function fxOnState(prev,cur){
 if(!cur||cur.phase==='lobby'){return}
 const fresh=Date.now()-(cur.endsAt-cur.dur)<9000;
 // 게임 시작: 직업 공개 후 밤
 if((!prev||prev.gid!==cur.gid)&&cur.phase==='night'&&cur.day===1){
  if(fresh&&cur.order.includes(uid)){pendingRole=cur.gid}return}
 if(!prev||prev.gid!==cur.gid)return;
 cur.dead.filter(id=>!prev.dead.includes(id)).forEach(id=>{freshDead.add(id);setTimeout(()=>{freshDead.delete(id);render()},1300)});
 const logs=newLogs(prev,cur);
 // 밤 -> 낮: 아침과 간밤의 결과
 if(prev.phase==='night'&&cur.phase!=='night'){
  fxPush({kind:'dawn',icon:'i-sun',title:'아침이 밝았습니다',ms:1700,snd:['dawn']});
  const e=logs.find(x=>x.k==='death');
  if(e)fxPush({kind:'death',icon:'i-skull',title:`${nm(e.id)} 님이 살해당했습니다`,sub:'마피아의 습격이 있었어요',camp:`${e.camp}이었습니다`,ms:3600,shake:true,snd:['death']});
  else if(logs.find(x=>x.k==='peace'))fxPush({kind:'spare',icon:'i-cup',title:'평화로운 밤이었습니다',sub:'아무도 죽지 않았어요',ms:2400,snd:['spare']})}
 if(cur.phase==='defense'&&prev.phase!=='defense'){
  fxPush({kind:'spot',icon:'i-speech',title:`${nm(cur.accused)} 님이 지목되었습니다`,sub:'과반수 득표 · 최후 발언을 시작합니다',ms:2400,snd:['spot']})}
 logs.filter(x=>x.k==='verdict').forEach(e=>{
  if(e.exec)fxPush({kind:'exec',icon:'i-gavel',title:`${nm(e.id)} 님이 처형되었습니다`,sub:`찬성 ${e.y} · 반대 ${e.no}`,camp:`${e.camp}이었습니다`,ms:3600,shake:true,snd:['gavel','death']});
  else fxPush({kind:'spare',icon:'i-cup',title:`${nm(e.id)} 님이 살아남았습니다`,sub:`찬성 ${e.y} · 반대 ${e.no}`,ms:2600,snd:['spare']})});
 if(cur.phase==='night'&&prev.phase!=='night'){
  fxPush({kind:'night',icon:'i-moon',title:'밤이 되었습니다',sub:`${cur.day}일차 · 도시가 잠들고 마피아가 깨어납니다`,ms:2400,snd:['night']})}
 if(cur.phase==='over'&&prev.phase!=='over'){
  const c=ctx(),mafiaWin=cur.winner==='mafia',mine=c.myRole==='mafia';
  const won=!c.inGame?true:(mafiaWin===mine);
  fxPush({kind:won?'win':'lose',icon:won?'i-cup':'i-skull',title:mafiaWin?'마피아의 승리':'시민의 승리',sub:c.inGame?(won?'당신의 팀이 이겼습니다':'당신의 팀이 패배했습니다'):'게임이 끝났습니다',ms:4200,snd:[won?'win':'lose']})}}

/* 직업 공개 카드: 직업 정보가 도착하면 한 번 보여 준다 */
function fxTryRole(){
 if(!pendingRole||!S||S.gid!==pendingRole||!R||R.gid!==pendingRole)return;
 const c=ctx();if(!c.myRole)return;
 pendingRole=null;const rm=ROLE[c.myRole];
 const mates=c.myRole==='mafia'?S.order.filter(id=>R.roles[id]==='mafia'&&id!==uid).map(nm):[];
 fxPush({kind:'role',icon:rm.ic,rc:rm.c,title:`당신은 ${rm.n}입니다`,sub:esc(rm.d)+(mates.length?`<br>동료: ${mates.map(esc).join(', ')}`:''),camp:rm.team,ms:4200,snd:['reveal']});
 fxPush({kind:'night',icon:'i-moon',title:'첫 번째 밤이 되었습니다',sub:'도시가 잠들고 마피아가 깨어납니다',ms:2200,snd:['night']})}
