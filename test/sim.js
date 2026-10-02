// 규칙 엔진 + AI 대사 시뮬레이션: node test/sim.js
const E=require('../engine.js');Object.assign(globalThis,E); // 브라우저에서는 전역으로 공유되는 함수들
const B=require('../bots.js');
let seed=11;const rnd=()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296};
let bad=0,res={mafia:0,citizen:0},maxTicks=0,msgs=0,maxLen=0,kinds={fakePolice:0,agitate:0,counter:0,frame:0,final:0,ghost:0,mafiaCh:0},sizes={};
const fp=new RegExp(Object.values(B.L.fakePolice).flat().map(t=>t.split('{t}')[0].slice(0,8)).join('|'));
for(let g=0;g<(+process.env.GAMES||600);g++){
 const n=E.MIN+Math.floor(rnd()*(E.MAX-E.MIN+1)),ids=[...Array(n)].map((_,i)=>'bot_'+i),bots={},names={};
 ids.forEach((i,k)=>{if(k>0)bots[i]='봇'+k;names[i]='봇'+k});
 const roles=E.dealRoles(ids,rnd),d=E.dist(n),cnt={};
 Object.values(roles).forEach(r=>cnt[r]=(cnt[r]||0)+1);
 if(cnt.mafia!==d.mafia||cnt.doctor!==1||cnt.police!==1||(cnt.citizen||0)!==d.citizen||2*d.mafia>=n){bad++;console.log('dist bad',n,cnt)}
 sizes[n]=d;
 let s={gid:'g'+g,seq:1,phase:'night',day:1,endsAt:E.NIGHT_MS,dur:E.NIGHT_MS,order:E.shuffle(ids,rnd),bots,dead:[],accused:null,winner:null,log:[]};
 let sec={gid:s.gid,inv:{}},chat=[],mem={},now=0,ticks=0,cid=1;
 while(s.phase!=='over'&&ticks<60000){
  ticks++;now+=1000;
  const ai=B.makeAi(s,roles,sec,chat,names,now,mem);
  const o=E.stepEngine(s,roles,{},now,()=>true,rnd,ai);
  if(o){if(o.inv){const cur=sec.inv[o.inv.police]||[];sec.inv[o.inv.police]=[...cur,{n:o.inv.n,target:o.inv.target,mafia:o.inv.mafia}]}
   s={...s,...o.patch,seq:s.seq+1};if(s.dead.length>n){bad++;break}}
  const ms=B.botPlan(s,roles,sec,chat,names,now,rnd,mem,B.makeAi(s,roles,sec,chat,names,now,mem));
  ms.forEach(m=>{
   msgs++;maxLen=Math.max(maxLen,m.text.length);if(m.text.length>200)bad++;if(m.text.includes('{')||m.text.includes('undefined'))bad++;
   if(m.ch==='mafia'){kinds.mafiaCh++;if(roles[m.uid]!=='mafia')bad++}
   if(m.ch==='dead'){kinds.ghost++;if(!s.dead.includes(m.uid))bad++}
   if(m.ch==='day'&&s.dead.includes(m.uid)&&s.phase!=='over'&&!(s.phase==='judge'))bad++;
   if(fp.test(m.text)&&roles[m.uid]==='mafia')kinds.fakePolice++;
   if(/경찰입니다|경찰 조사 결과|경찰인 제가|내가 경찰이야|경찰 조사 결과야|경찰인 내가/.test(m.text)&&roles[m.uid]==='police')kinds.agitate++;
   if(/진짜 경찰|가짜 경찰|가짜야/.test(m.text)&&roles[m.uid]==='mafia')kinds.counter++;
   chat.push({id:cid++,uid:m.uid,ch:m.ch,text:m.text,t:now});if(chat.length>150)chat.shift()})
 }
 maxTicks=Math.max(maxTicks,ticks);
 if(s.phase!=='over'){bad++;console.log('no end',n)}else{res[s.winner]++;if(E.winnerOf(s,roles,s.dead)!==s.winner)bad++}
}
console.log('dist 20:',JSON.stringify(sizes[20]),'dist 4:',JSON.stringify(sizes[4]));
console.log('games ok; bad=',bad,res,'maxTicks',maxTicks,'msgs',msgs,'avg/game',(msgs/600).toFixed(1),'maxLen',maxLen);
console.log(kinds);
if(bad)process.exit(1);
