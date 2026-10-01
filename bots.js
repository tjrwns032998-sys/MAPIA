/* 월광 살롱 - AI 참가자 두뇌 (판단 makeAi + 대사 botPlan). engine.js 뒤에 불러온다. */
const SUS_WORDS=['마피아','의심','수상','찍','범인','거짓','가짜','처형'];
const CLAIM_RE=/(제가|저는|내가|난)\s*경찰/;

function srand(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}let a=h;
 return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* 최근 대화에서 누가 누구를 의심하는지, 누가 경찰을 자처했는지 읽어낸다. */
function chatInfo(s,names,chat,since){
 const alive=aliveOf(s),sus={},claims={};
 chat.forEach(m=>{
  if(m.ch!=='day'||m.t<since)return;
  const claim=CLAIM_RE.test(m.text);if(claim)claims[m.uid]=true;
  if(!SUS_WORDS.some(w=>m.text.includes(w)))return;
  alive.forEach(id=>{if(id!==m.uid&&names[id]&&m.text.includes(names[id]))sus[id]=(sus[id]||0)+(claims[m.uid]?2:1)})});
 return{sus,claims}}

function wpick(ids,wf,rr){
 if(!ids.length)return null;
 const ws=ids.map(wf),tot=ws.reduce((a,b)=>a+b,0);let x=rr()*tot;
 for(let i=0;i<ids.length;i++){x-=ws[i];if(x<=0)return ids[i]}
 return ids[ids.length-1]}

/* 판단: 밤 행동, 투표, 찬반. 같은 판에서 같은 질문엔 같은 답을 내도록 mem.choice에 기억한다. */
function makeAi(s,roles,sec,chat,names,now,mem){
 const alive=aliveOf(s),info=chatInfo(s,names,chat,now-6*60000),sus=info.sus,claims=info.claims;
 const probes=id=>(sec&&sec.gid===s.gid&&sec.inv&&sec.inv[id])||[];
 const knownMafia=id=>probes(id).filter(p=>p.mafia&&alive.includes(p.target)).map(p=>p.target);
 const knownClear=id=>probes(id).filter(p=>!p.mafia).map(p=>p.target);
 if(mem.cgid!==s.gid){mem.cgid=s.gid;mem.choice={}}
 const ch=mem.choice;
 const memo=(k,f)=>{if(ch[k]!==undefined&&(ch[k]===null||alive.includes(ch[k])))return ch[k];return(ch[k]=f())};
 const sr=k=>srand(s.gid+':'+k+':'+s.day);
 const focus=(key)=>memo(key+s.day,()=>{
  const rr=sr(key),c=alive.filter(x=>roles[x]!=='mafia');
  return wpick(c,x=>1+(claims[x]?4:0)+(sus[x]||0)*.6,rr)});
 const ai={
  info,knownMafia,knownClear,
  kill:m=>focus('k'),
  heal:d=>memo('h'+d+s.day,()=>wpick(alive,x=>1+(x===d?.6:0)+(claims[x]?3:0),sr('h'+d))),
  probe:p=>memo('p'+p+s.day,()=>{const done=new Set(probes(p).map(x=>x.target));
   return wpick(alive.filter(x=>x!==p&&!done.has(x)),x=>1+(sus[x]||0)*1.5,sr('p'+p))}),
  vote:id=>memo('v'+id+s.day,()=>{
   const rm=roles[id];
   if(rm==='mafia')return focus('v');
   if(rm==='police'){const km=knownMafia(id);if(km.length)return km[0]}
   const clear=new Set(rm==='police'?knownClear(id):[]);
   return wpick(alive.filter(x=>x!==id&&!clear.has(x)),x=>1+3*(sus[x]||0),sr('v'+id))}),
  judge:(id,acc)=>{
   const rr=sr('j'+id),rm=roles[id];
   if(rm==='mafia')return roles[acc]==='mafia'?rr()<.15:rr()<.88;
   if(rm==='police'){if(knownMafia(id).includes(acc))return true;if(knownClear(id).includes(acc))return false}
   return rr()<.35+.15*Math.min(sus[acc]||0,3)}};
 return ai}

/* ---- 대사 ---- */
const T={
 openDeath:{
  good:['{d}님이 밤사이 당했어요… 마피아는 우리 중에 있어요. 침착하게 얘기해 봐요.','{d}님이 떠났네요. 오늘은 꼭 마피아를 찾아야 해요.','아침부터 마음이 무겁네요. {d}님의 몫까지 제대로 투표해요.'],
  mafia:['{d}님이 죽다니… 마피아는 정말 악질이에요. 저는 {d}님 편이었는데.','어젯밤 {d}님이 당했네요. 다들 너무 흥분하지 말고 차근차근 가요.','{d}님… 억울하게 가셨네요. 범인은 반드시 찾아낼 거예요.']},
 openPeace:{
  good:['아무도 안 죽었어요! 의사님이 살려주신 걸까요?','평화로운 밤이었네요. 마피아가 방심한 걸까요, 아니면 의사가 막은 걸까요?'],
  mafia:['의사가 성공한 모양이네요. 의사님 감사해요! 오늘은 마피아를 찾아봐요.','조용한 밤이었어요. 오히려 더 불안한데요, 다들 어떻게 생각해요?']},
 suspect:['{t}님, 아까부터 말이 너무 적은데 왜 그러세요?','{t}님이 좀 수상해요. 해명 부탁드려요.','제 감으로는 {t}님이 마피아예요. 느낌이 와요.','{t}님, 솔직히 말해 보세요. 어젯밤 뭐 하셨어요?','다들 {t}님 한번 의심해 보세요. 반응이 어딘가 어색했어요.'],
 chat:['지금까지 의심되는 사람 있으면 이유와 함께 말해 주세요.','근거 없는 몰아가기는 마피아에게 유리해요. 침착하게 가요.','발언이 적은 사람부터 한 명씩 들어봐요.','저는 평범한 시민이에요. 믿고 싶은 사람부터 정해 볼까요?'],
 frame:['{t}님이 마피아예요. 어제 행동이 너무 수상했어요.','{t}님, 솔직히 말해 보세요. 마피아죠?','{t}님 말이 앞뒤가 안 맞아요. 다들 잘 들어보세요.','제가 보기엔 {t}님이 제일 위험해요. 오늘 투표는 {t}님으로 가요.'],
 fakePolice:['사실 말씀드릴게요. 제가 경찰이에요. 어젯밤 {t}님을 조사했는데… 마피아였어요! 믿어주세요!','제가 경찰입니다! {t}님이 마피아로 나왔어요. 오늘 {t}님을 처형해야 해요!'],
 counter:['{c}님이 경찰이라고요? 저야말로 진짜 경찰이에요! {c}님이 마피아예요, 경찰 흉내를 내는 거라고요!','{c}님은 가짜 경찰이에요. 진짜는 저예요. 속지 마세요!'],
 defendMate:['{m}님은 계속 협조적이었어요. 저는 {m}님은 아니라고 봐요.','{m}님을 의심하는 건 좀 성급해요. 근거가 부족하잖아요.'],
 sacrifice:['{m}님, 의심받을 만하긴 하네요… 저는 다수 의견을 따를게요.','{m}님이 계속 몰리네요. 해명을 못 하면 저도 어쩔 수 없어요.'],
 agitate:['제가 경찰입니다! 어젯밤 {t}님을 조사했는데 마피아였어요. 오늘 {t}님을 처형하세요!','경찰 조사 결과예요. {t}님은 100% 마피아입니다. 제발 믿어주세요!'],
 agitate2:['{t}님 마피아 맞아요! 경찰인 제가 보증해요. 다른 데 시간 낭비하지 마세요!','왜 아무도 안 믿어요? {t}님을 처형해야 시민이 이겨요!'],
 clear:['참고로 {t}님은 제가 확인했는데 시민이에요. 의심 거두셔도 돼요.'],
 react:{
  good:['저요?! 아니에요, 저는 진짜 시민이에요. {a}님은 왜 저를 몰아가죠?','억울해요… 저는 시민이에요. 증거도 없이 찍지 마세요!','{a}님, 저를 의심하는 이유가 뭔가요? 근거를 대 보세요.'],
  mafia:['어이없네요. 오히려 {a}님이 더 마피아 같아요. 저를 몰아서 이득 보려는 거 아닌가요?','저 마피아 아니에요! {a}님이 선동하고 있어요, 속지 마세요.','…웃기네요. 제가 마피아면 이렇게 대놓고 말하겠어요?'],
  police:['저 경찰이에요! 마피아가 경찰을 먼저 없애려는 거예요, {a}님이 수상해요!']},
 vote:{
  good:['저는 {t}님에게 투표할게요.','{t}님이 제일 수상해서 {t}님으로 갑니다.'],
  mafia:['{t}님으로 갈게요. 다들 같이 가요!','저는 {t}님에게 투표해요. 이유는 아시죠?']},
 final:{
  good:['제발 믿어주세요… 저는 시민입니다. 저를 처형하면 마피아만 웃어요.','억울해요! 저는 시민이에요. 오늘 저를 보내면 후회하실 거예요.'],
  mafia:['억울합니다… 저는 시민이에요. 진짜 마피아는 {x}님이에요, 두고 보세요!','저를 처형해도 마피아는 계속 남아요. 다들 잘 생각하세요.'],
  police:['저는 경찰이에요! 조사 기록도 있어요. 저를 보내면 시민이 불리해져요!']},
 night:{open:['오늘 밤은 {t}님 어때?','{t}님이 눈에 띄네. 오늘은 {t}님으로 하자.'],reply:['좋아, {t}님으로 가자.','동의해. 조용히 처리하자.']},
 ghost:['아 억울하다… 누가 마피아인지 알 것 같은데.','살아있는 분들, 제발 정신 차리세요!','여기서 지켜보니 다 보이네요.','다들 투표 신중하게 하세요…']};

function botPlan(s,roles,sec,chat,names,now,r,mem,ai){
 if(mem.gid!==s.gid){Object.assign(mem,{gid:s.gid,next:{},cnt:{},used:{},react:{},pending:{},lastAny:0,voted:{},final:{},night:{},ghost:{},tgt:{}})}
 const out=[],alive=aliveOf(s),bots=s.order.filter(id=>isBotOf(s,id)),N=id=>names[id]||'누군가';
 const R=a=>a[Math.floor(r()*a.length)],fill=(t,o)=>t.replace(/\{(\w)\}/g,(_,k)=>o[k]!==undefined?o[k]:'');
 const push=(uid,ch,text)=>{out.push({uid,ch,text:text.slice(0,200)});mem.lastAny=now};
 const phaseStart=s.endsAt-s.dur,elapsed=now-phaseStart,info=ai.info,claims=info.claims,sus=info.sus;
 const grp=b=>roles[b]==='mafia'?'mafia':'good';
 const tgt=(b)=>{const k=b+':'+s.day;
  if(mem.tgt[k]&&alive.includes(mem.tgt[k]))return mem.tgt[k];
  const others=alive.filter(x=>x!==b&&!(roles[b]==='mafia'&&roles[x]==='mafia'));
  const t=roles[b]==='mafia'?ai.vote(b):wpick(others,x=>1+3*(sus[x]||0),r);
  return(mem.tgt[k]=t)};
 if(s.phase==='day'){
  const night=[...(s.log||[])].reverse().find(e=>e.n===s.day&&(e.k==='death'||e.k==='peace'));
  // 최근 발언 중 나를 지목한 사람
  chat.forEach(m=>{
   if(m.ch!=='day'||m.t<phaseStart||mem.react[m.id])return;mem.react[m.id]=1;
   if(!SUS_WORDS.some(w=>m.text.includes(w)))return;
   bots.forEach(b=>{if(b!==m.uid&&alive.includes(b)&&names[b]&&m.text.includes(names[b])&&!mem.pending[b])mem.pending[b]={a:m.uid,at:now+1800+r()*3200}})});
  bots.filter(b=>alive.includes(b)).forEach((b,i)=>{
   if(now-mem.lastAny<2200)return;
   const ck=b+':'+s.day,c=mem.cnt[ck]||0;if(c>=5)return;
   if(mem.next[ck]===undefined)mem.next[ck]=phaseStart+3500+i*1100+r()*7000;
   const pend=mem.pending[b],rm=roles[b];
   let text=null;
   if(pend&&now>=pend.at){
    mem.pending[b]=null;
    const key=rm==='police'&&ai.knownMafia(b).length?'police':grp(b);
    text=fill(R(T.react[key]),{a:N(pend.a)})}
   else if(now>=mem.next[ck]){
    mem.next[ck]=now+14000+r()*16000;
    if(c===0){
     const grpK=grp(b);
     text=night&&night.k==='death'?fill(R(T.openDeath[grpK]),{d:N(night.id)}):R(T.openPeace[grpK])}
    else if(rm==='mafia'){
     const claimants=Object.keys(claims).filter(x=>x!==b&&alive.includes(x));
     const mates=alive.filter(x=>roles[x]==='mafia'&&x!==b),hot=mates.find(m=>(sus[m]||0)>=3);
     if(claimants.length&&!mem.used[ck+'cn']){mem.used[ck+'cn']=1;text=fill(R(T.counter),{c:N(claimants[0])})}
     else if(s.day>=2&&!claimants.length&&!mem.used[b+'fp']&&r()<.45){mem.used[b+'fp']=1;text=fill(R(T.fakePolice),{t:N(tgt(b))})}
     else if(hot&&r()<.5)text=fill(R(T.sacrifice),{m:N(hot)});
     else if(mates.length&&r()<.2)text=fill(R(T.defendMate),{m:N(R(mates))});
     else text=fill(R(T.frame),{t:N(tgt(b))})}
    else if(rm==='police'&&ai.knownMafia(b).length){
     const t=ai.knownMafia(b)[0];
     text=fill(R(mem.used[b+'ag']?T.agitate2:T.agitate),{t:N(t)});mem.used[b+'ag']=1}
    else if(rm==='police'&&ai.knownClear(b).length&&r()<.3)text=fill(R(T.clear),{t:N(R(ai.knownClear(b)))});
    else text=r()<.75?fill(R(T.suspect),{t:N(tgt(b))}):R(T.chat)}
   if(text){mem.cnt[ck]=c+1;push(b,'day',text)}});}
 else if(s.phase==='vote'){
  bots.filter(b=>alive.includes(b)).forEach((b,i)=>{
   const k=b+':'+s.day;if(mem.voted[k]||elapsed<1500+i*900+r()*3000||now-mem.lastAny<900)return;
   mem.voted[k]=1;const t=ai.vote(b);
   if(t)push(b,'day',fill(R(T.vote[grp(b)]),{t:N(t)}))})}
 else if(s.phase==='defense'&&isBotOf(s,s.accused)&&!mem.final[s.day]){
  mem.final[s.day]=1;const b=s.accused,rm=roles[b];
  const key=rm==='police'&&ai.knownMafia(b).length?'police':grp(b);
  const x=rm==='mafia'?N(wpick(alive.filter(y=>roles[y]!=='mafia'&&y!==b),()=>1,r)):'';
  push(b,'day',fill(R(T.final[key]),{x}))}
 else if(s.phase==='night'){
  const ms=bots.filter(b=>alive.includes(b)&&roles[b]==='mafia');
  ms.forEach((b,i)=>{
   const k=b+':'+s.day;if(mem.night[k]||elapsed<3000+i*2500+r()*4000||now-mem.lastAny<1500)return;
   mem.night[k]=1;const t=ai.kill(b);
   push(b,'mafia',fill(R(i===0?T.night.open:T.night.reply),{t:N(t)}))})}
 // 사망한 AI의 유령 채팅
 if(s.phase==='day'||s.phase==='night'){
  bots.filter(b=>s.dead.includes(b)).forEach(b=>{
   const g=mem.ghost[b]||{n:0,at:now+25000+r()*20000};mem.ghost[b]=g;
   if(g.n<3&&now>=g.at&&now-mem.lastAny>2200){g.n++;g.at=now+40000+r()*30000;push(b,'dead',R(T.ghost))}})}
 return out}

if(typeof module!=='undefined')module.exports={srand,chatInfo,makeAi,botPlan,T,SUS_WORDS,CLAIM_RE};
