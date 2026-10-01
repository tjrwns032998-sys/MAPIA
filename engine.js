/* 월광 살롱 - 게임 규칙 엔진 (화면과 서버에 의존하지 않는 순수 함수) */
const MIN=4,MAX=20,NIGHT_MS=40000,DAY_MS=300000,VOTE_MS=30000,DEF_MS=30000,BOT_DEF_MS=7000,JUDGE_MS=20000,MIN_NIGHT_MS=10000;

function dist(n){const m=Math.max(1,Math.floor((n+1)/5));return{mafia:m,doctor:1,police:1,citizen:n-m-2}}
function shuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function dealRoles(ids,r){
 const d=dist(ids.length),deck=[...Array(d.mafia).fill('mafia'),'doctor','police',...Array(d.citizen).fill('citizen')],sh=shuffle(ids,r),out={};
 sh.forEach((id,i)=>{out[id]=deck[i]});return out}
const aliveOf=s=>s.order.filter(id=>!s.dead.includes(id));
const isBotOf=(s,id)=>!!(s.bots&&s.bots[id]);
function winnerOf(s,roles,dead){
 const al=s.order.filter(id=>!dead.includes(id)),m=al.filter(id=>roles[id]==='mafia').length;
 if(m===0)return'citizen';if(m*2>=al.length)return'mafia';return null}
function pickR(a,r){return a.length?a[Math.floor(r()*a.length)]:null}
function topOf(counts,r){
 let best=0,ids=[];
 for(const k in counts){if(counts[k]>best){best=counts[k];ids=[k]}else if(counts[k]===best)ids.push(k)}
 return ids.length?{id:pickR(ids,r),n:best,tie:ids.length>1}:null}

/* ai: bots.js의 makeAi() 결과. 없으면 무작위로 행동한다. */
function stepEngine(s,roles,acts,now,isOn,r,ai){
 const alive=aliveOf(s),human=id=>!isBotOf(s,id),on=alive.filter(id=>human(id)&&isOn(id));
 const va=(id,ph)=>{const a=acts[id];return a&&a.gid===s.gid&&a.n===s.day&&a.ph===ph?a:null};
 const log=(s.log||[]).slice(-39);
 const toNight=(dead,extra)=>({phase:'night',day:s.day+1,endsAt:now+NIGHT_MS,dur:NIGHT_MS,dead,accused:null,log:[...log,...extra]});
 const finish=(dead,extra,w)=>({phase:'over',winner:w,dead,endsAt:0,dur:0,accused:null,log:[...log,...extra,{n:s.day,k:'end',w}]});
 switch(s.phase){
 case'night':{
  const need=on.filter(id=>roles[id]!=='citizen');
  if(!((need.every(id=>va(id,'night'))&&now>=s.endsAt-s.dur+MIN_NIGHT_MS)||now>=s.endsAt))return null; // 직업이 없는 시민도 같은 시간이 걸려야 직업이 드러나지 않는다
  const mafs=alive.filter(id=>roles[id]==='mafia'),targets=alive.filter(id=>roles[id]!=='mafia'),votes={};
  mafs.forEach(m=>{
   let t=null;
   if(!human(m))t=ai?ai.kill(m):pickR(targets,r);
   else{const a=va(m,'night');if(a&&a.kind==='kill'&&targets.includes(a.target))t=a.target}
   if(t)votes[t]=(votes[t]||0)+1});
  const kill=(topOf(votes,r)||{}).id||null;
  const dc=alive.find(id=>roles[id]==='doctor');let save=null;
  if(dc){
   if(!human(dc))save=ai?ai.heal(dc):pickR(alive,r);
   else{const a=va(dc,'night');if(a&&a.kind==='heal'&&alive.includes(a.target))save=a.target}}
  const pc=alive.find(id=>roles[id]==='police');let inv=null;
  if(pc){
   let t=null;
   if(!human(pc))t=ai?ai.probe(pc):pickR(alive.filter(x=>x!==pc),r);
   else{const a=va(pc,'night');if(a&&a.kind==='probe'&&alive.includes(a.target)&&a.target!==pc)t=a.target}
   if(t)inv={police:pc,n:s.day,target:t,mafia:roles[t]==='mafia'}}
  const died=kill&&kill!==save?kill:null,dead=died?[...s.dead,died]:s.dead;
  const extra=[died?{n:s.day,k:'death',id:died,camp:roles[died]==='mafia'?'마피아':'시민'}:{n:s.day,k:'peace'}];
  const w=winnerOf(s,roles,dead);
  return{patch:w?finish(dead,extra,w):{phase:'day',endsAt:now+DAY_MS,dur:DAY_MS,dead,log:[...log,...extra]},inv}}
 case'day':{
  const skips=on.filter(id=>{const a=va(id,'day');return a&&a.kind==='skip'}).length;
  if(!(now>=s.endsAt||(on.length>0&&skips*2>on.length)))return null;
  return{patch:{phase:'vote',endsAt:now+VOTE_MS,dur:VOTE_MS,log:[...log,{n:s.day,k:'voteStart'}]}}}
 case'vote':{
  if(!(on.every(id=>va(id,'vote'))||now>=s.endsAt))return null;
  const counts={};
  alive.forEach(id=>{
   let t=null;
   if(!human(id)){
    t=ai?ai.vote(id):pickR(alive.filter(x=>x!==id&&!(roles[id]==='mafia'&&roles[x]==='mafia')),r)}
   else{const a=va(id,'vote');if(a&&a.kind==='vote'&&a.target&&a.target!==id&&alive.includes(a.target))t=a.target}
   if(t)counts[t]=(counts[t]||0)+1});
  const top=topOf(counts,r);
  if(top&&!top.tie&&top.n*2>alive.length){
   const ms=human(top.id)?DEF_MS:BOT_DEF_MS;
   return{patch:{phase:'defense',accused:top.id,endsAt:now+ms,dur:ms,log:[...log,{n:s.day,k:'accuse',id:top.id,v:top.n}]}}}
  return{patch:toNight(s.dead,[{n:s.day,k:'noMaj'}])}}
 case'defense':{
  const a=va(s.accused,'defense');
  if(!(now>=s.endsAt||(a&&a.kind==='done')))return null;
  return{patch:{phase:'judge',endsAt:now+JUDGE_MS,dur:JUDGE_MS}}}
 case'judge':{
  const elig=alive.filter(id=>id!==s.accused),onE=elig.filter(id=>human(id)&&isOn(id));
  if(!(onE.every(id=>va(id,'judge'))||now>=s.endsAt))return null;
  let y=0,n=0;
  elig.forEach(id=>{
   if(!human(id)){const yes=ai?ai.judge(id,s.accused):r()<.5;if(yes)y++;else n++}
   else{const a=va(id,'judge');if(a&&a.kind==='yes')y++;else if(a&&a.kind==='no')n++}});
  const exec=y*2>elig.length,camp=roles[s.accused]==='mafia'?'마피아':'시민';
  const ev={n:s.day,k:'verdict',id:s.accused,y,no:n,exec,camp};
  if(!exec)return{patch:toNight(s.dead,[ev])};
  const dead=[...s.dead,s.accused],w=winnerOf(s,roles,dead);
  return{patch:w?finish(dead,[ev],w):toNight(dead,[ev])}}
 }
 return null}

if(typeof module!=='undefined')module.exports={MIN,MAX,MIN_NIGHT_MS,NIGHT_MS,DAY_MS,VOTE_MS,DEF_MS,BOT_DEF_MS,JUDGE_MS,dist,shuffle,dealRoles,aliveOf,isBotOf,winnerOf,pickR,topOf,stepEngine};
