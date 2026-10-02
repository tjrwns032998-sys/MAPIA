/* 월광 살롱 - AI 참가자 두뇌 (판단 makeAi + 대사 botPlan). engine.js 뒤에 불러온다. */
const SUS_WORDS=['마피아','의심','수상','찍','범인','거짓','가짜','처형'];
const CLAIM_RE=/(제가|저는|내가|난|나)\s*(진짜\s*)?경찰/;

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


/* ---- 대사: 의도(intent)별로 말투 3종(p=해요체, b=반말, f=합니다체)을 따로 둔다. 없는 말투는 p로 대신한다. ----
   주의: 의심하는 말에만 '의심/수상/마피아' 같은 낱말을 쓴다(다른 AI가 그 말을 읽고 의심 점수를 올리기 때문). */
const L={
 openDeath:{
  good:{p:['{d}님이 밤사이 당했어요… 마피아는 우리 중에 있어요. 침착하게 얘기해 봐요.','아침부터 마음이 무겁네요. {d}님의 몫까지 제대로 투표해요.','{d}님이 떠났네요. 오늘은 꼭 마피아를 찾아야 해요.'],
   b:['헐 {d}님 죽었네. 오늘 진짜 제대로 잡아야 돼.','{d}님이 당했네… 누가 했는지 감 오는 사람?','아침부터 {d}님이라니. 마피아 이 사람들 가만 안 둔다.'],
   f:['{d}님이 희생되었군요. 오늘은 신중하게 판단해야 합니다.','유감입니다. {d}님의 죽음을 헛되이 하지 않도록 마피아를 찾읍시다.']},
  mafia:{p:['{d}님이 죽다니… 마피아는 정말 악질이에요. 저는 {d}님 편이었는데.','어젯밤 {d}님이 당했네요. 다들 너무 흥분하지 말고 차근차근 가요.','{d}님… 억울하게 가셨네요. 범인은 반드시 찾아낼 거예요.'],
   b:['와 {d}님 죽었네; 누가 이런 짓을… 일단 다들 진정하고.','{d}님 불쌍해서 어쩌냐. 범인 꼭 찾자 진짜.','{d}님이라니 ㅡㅡ 마피아 누구야 진짜.'],
   f:['{d}님이 가셨군요. 애도를 표합니다. 범인을 반드시 찾아야 합니다.']}},
 openPeace:{
  good:{p:['아무도 안 죽었어요! 의사님이 살려주신 걸까요?','평화로운 밤이었네요. 마피아가 방심한 걸까요, 아니면 의사가 막은 걸까요?'],
   b:['오 아무도 안 죽었네? 의사 일 잘했나 본데.','평화롭네… 이거 의사가 막은 거지? 아님 마피아가 쉰 거?'],f:['아무도 희생되지 않았군요. 의사의 활약일 수 있겠습니다.']},
  mafia:{p:['의사가 성공한 모양이네요. 의사님 감사해요! 오늘은 마피아를 찾아봐요.','조용한 밤이었어요. 오히려 더 불안한데요, 다들 어떻게 생각해요?'],
   b:['오 의사 굿~ 덕분에 살았네. 근데 마피아는 아직 있다는 거잖아.','조용하네 이상하게… 다들 어떻게 생각해?'],f:['다행히 희생자가 없었군요. 하지만 방심은 금물입니다.']}},
 suspect:{
  p:['{t}님, 아까부터 말이 너무 적은데 왜 그러세요? 수상해요.','{t}님이 좀 수상해요. 해명 부탁드려요.','제 감으로는 {t}님이 마피아예요. 느낌이 와요.','{t}님, 솔직히 말해 보세요. 어젯밤 뭐 하셨어요? 의심스러워요.','저만 그런가요? {t}님 반응이 어딘가 어색했어요. 수상해요.'],
  b:['{t}님 좀 수상한데? 해명해봐.','솔직히 {t}님 마피아 같아. 말하는 게 어색해.','{t}님 너 왜 이렇게 조용해? 의심된다 진짜.','아 {t}님 반응이 이상했어. 나만 그래? 수상함.'],
  f:['{t}님의 행동이 수상합니다. 해명을 요청합니다.','제 판단으로는 {t}님이 마피아일 가능성이 높습니다.']},
 chat:{
  p:['지금까지 의심되는 사람 있으면 이유와 함께 말해 주세요.','근거 없는 몰아가기는 마피아에게 유리해요. 침착하게 가요.','발언이 적은 사람부터 한 명씩 들어봐요.','저는 평범한 시민이에요. 믿고 싶은 사람부터 정해 볼까요?'],
  b:['다들 누구 찍고 있어? 이유도 같이 말해줘.','말 없는 사람들 뭐함? 한마디씩 해봐.','지금 분위기 좀 이상한데 나만 그렇게 느끼나','일단 나는 시민이야. 믿을 사람부터 추려보자.','다들 눈치만 보네'],
  f:['모든 분의 의견을 듣고 싶습니다.','침묵하는 분들이 오히려 신경 쓰입니다. 발언을 부탁드립니다.']},
 frame:{
  p:['{t}님이 마피아예요. 어제 행동이 너무 수상했어요.','{t}님, 솔직히 말해 보세요. 마피아죠?','{t}님 말이 앞뒤가 안 맞아요. 다들 잘 들어보세요. 수상해요.','제가 보기엔 {t}님이 제일 위험해요. 오늘 투표는 {t}님으로 가요.'],
  b:['{t}님 마피아잖아. 어제부터 계속 수상했어.','야 {t}님 말 앞뒤가 안 맞는데? 다들 들어봐. 수상해.','오늘 투표는 {t}님으로 가자. 제일 수상해.','{t}님 마피아지? 솔직히 말해.'],
  f:['{t}님이 마피아라고 판단합니다. 오늘 투표를 제안합니다.','{t}님의 발언에는 모순이 있습니다. 수상합니다.']},
 fakePolice:{
  p:['사실 말씀드릴게요. 제가 경찰이에요. 어젯밤 {t}님을 조사했는데… 마피아였어요! 믿어주세요!','제가 경찰입니다! {t}님이 마피아로 나왔어요. 오늘 {t}님을 처형해야 해요!'],
  b:['이제 말할게. 내가 경찰이야. 어젯밤 {t}님 조사했는데 마피아 나왔어!','내가 경찰이라고! {t}님 마피아 맞아, 오늘 무조건 처형이야!'],
  f:['밝히겠습니다. 저는 경찰입니다. {t}님을 조사했고 마피아로 확인되었습니다.']},
 counter:{
  p:['{c}님이 경찰이라고요? 제가 진짜 경찰이에요! {c}님이 마피아예요, 경찰 흉내를 내는 거라고요!','{c}님은 가짜 경찰이에요. 진짜는 저예요. 속지 마세요!'],
  b:['{c}님이 경찰이라고? 웃기네, 내가 진짜 경찰이야. {c}님 마피아야!','{c}님 가짜야. 내가 진짜 경찰이라고 속지 마!'],
  f:['{c}님은 가짜 경찰입니다. 제가 진짜 경찰이고, {c}님은 마피아입니다.']},
 defendMate:{
  p:['{m}님은 계속 협조적이었어요. 저는 {m}님은 아니라고 봐요.','{m}님을 몰아가는 건 좀 성급해요. 근거가 부족하잖아요.'],
  b:['{m}님은 아닌 것 같은데? 근거가 너무 약해.','{m}님 몰아가는 거 좀 성급하지 않아? 증거 있어?'],f:['{m}님을 몰아가기엔 근거가 부족합니다.']},
 sacrifice:{
  p:['{m}님, 의심받을 만하긴 하네요… 저는 다수 의견을 따를게요.','{m}님이 계속 몰리네요. 해명을 못 하면 저도 어쩔 수 없어요. 수상하긴 해요.'],
  b:['{m}님 솔직히 좀 수상하긴 해. 해명 못하면 나도 어쩔 수 없다.','{m}님 계속 몰리는데… 다수 의견 따라갈게.'],f:['{m}님은 해명이 부족합니다. 다수 의견에 따르겠습니다.']},
 agitate:{
  p:['제가 경찰입니다! 어젯밤 {t}님을 조사했는데 마피아였어요. 오늘 {t}님을 처형하세요!','경찰 조사 결과예요. {t}님은 100% 마피아입니다. 제발 믿어주세요!'],
  b:['내가 경찰이야! 어젯밤에 {t}님 조사했는데 마피아였어. 오늘 {t}님 처형해!','경찰 조사 결과야. {t}님 100% 마피아라니까 제발 믿어줘!'],
  f:['저는 경찰입니다. {t}님을 조사한 결과 마피아였습니다. 처형을 요청합니다.']},
 agitate2:{
  p:['{t}님 마피아 맞아요! 경찰인 제가 보증해요. 다른 데 시간 낭비하지 마세요!','왜 아무도 안 믿어요? {t}님을 처형해야 시민이 이겨요!'],
  b:['{t}님 마피아 맞다니까! 경찰인 내가 보증해, 시간 낭비하지 마!','왜 아무도 안 믿어줘? {t}님 처형해야 시민이 이겨!'],
  f:['거듭 말씀드립니다. {t}님은 마피아입니다. 경찰인 제가 보증합니다.']},
 clear:{p:['참고로 {t}님은 제가 확인했는데 시민이에요. 의심 거두셔도 돼요.'],b:['참고로 {t}님은 내가 확인했는데 시민이야. 의심 거둬.'],f:['참고로 {t}님은 제가 조사했고 시민입니다.']},
 react:{
  good:{p:['저요?! 아니에요, 저는 진짜 시민이에요. {a}님은 왜 저를 몰아가죠?','억울해요… 저는 시민이에요. 증거도 없이 찍지 마세요!','{a}님, 저를 의심하는 이유가 뭔가요? 근거를 대 보세요.'],
   b:['나?! 아닌데 나 시민이야. {a}님 왜 날 몰아?','억울하다… 증거도 없이 찍지 마.','{a}님 나 의심하는 이유 뭐야? 근거 대봐.'],f:['저를 지목하셨군요. 저는 시민이며, {a}님의 근거를 듣고 싶습니다.']},
  mafia:{p:['어이없네요. 오히려 {a}님이 더 마피아 같아요. 저를 몰아서 이득 보려는 거 아닌가요?','저 마피아 아니에요! {a}님이 선동하고 있어요, 속지 마세요.','…웃기네요. 제가 마피아면 이렇게 대놓고 말하겠어요?'],
   b:['어이없네. 오히려 {a}님이 더 마피아 같은데? 나 몰아서 이득 보려는 거 아냐?','나 마피아 아니야! {a}님이 선동하는 거야, 속지 마.','내가 마피아면 이렇게 대놓고 말하겠냐?'],f:['저를 지목하시다니 억울합니다. 오히려 {a}님이 수상합니다.']},
  police:{p:['저 경찰이에요! 마피아가 경찰을 먼저 없애려는 거예요, {a}님이 수상해요!'],b:['나 경찰이야! 마피아가 경찰부터 없애려는 거지, {a}님 수상해!'],f:['저는 경찰입니다. 경찰을 먼저 제거하려는 {a}님이 수상합니다.']}},
 reactMore:{
  p:['또 저예요? 정말 억울하네요…','아니라니까요, 계속 저만 찍으시네요.','그만 몰아가세요, 저 진짜 아니에요.'],
  b:['또 나야? 진짜 억울하다.','아니라니까, 왜 자꾸 나만 찍어.','그만 몰아, 나 진짜 아니야.'],f:['거듭 말씀드리지만 저는 아닙니다.']},
 vote:{
  good:{p:['저는 {t}님에게 투표할게요.','{t}님이 제일 수상해서 {t}님으로 갑니다.'],b:['난 {t}님으로 간다.','{t}님이 제일 수상해서 {t}님한테 던질게.'],f:['저는 {t}님께 투표하겠습니다.']},
  mafia:{p:['{t}님으로 갈게요. 다들 같이 가요!','저는 {t}님에게 투표해요. 이유는 아시죠?'],b:['{t}님으로 간다. 다들 같이 가자!','난 {t}님한테 투표. 이유는 알지?'],f:['{t}님께 투표하겠습니다. 동참해 주시길 바랍니다.']}},
 final:{
  good:{p:['제발 믿어주세요… 저는 시민입니다. 저를 처형하면 마피아만 웃어요.','억울해요! 저는 시민이에요. 오늘 저를 보내면 후회하실 거예요.'],
   b:['제발 믿어줘… 난 시민이야. 나 보내면 마피아만 웃는다.','억울해! 난 시민이라고. 나 보내면 후회한다 진짜.'],f:['저는 시민입니다. 저를 처형하면 마피아만 이득을 봅니다.']},
  mafia:{p:['억울합니다… 저는 시민이에요. 진짜 마피아는 {x}님이에요, 두고 보세요!','저를 처형해도 마피아는 계속 남아요. 다들 잘 생각하세요.'],
   b:['억울하다… 난 시민이야. 진짜 마피아는 {x}님이야, 두고 봐!','나 보내도 마피아는 남아있어. 잘 생각해.'],f:['억울합니다. 진짜 마피아는 {x}님입니다.']},
  police:{p:['저는 경찰이에요! 조사 기록도 있어요. 저를 보내면 시민이 불리해져요!'],b:['나 경찰이야! 조사 기록도 있어. 나 보내면 시민만 불리해져!'],f:['저는 경찰입니다. 저를 보내면 시민이 불리해집니다.']}},
 nightOpen:{p:['오늘 밤은 {t}님 어때요?','{t}님이 눈에 띄네요. 오늘은 {t}님으로 해요.'],b:['오늘 밤은 {t}님 어때?','{t}님 눈에 띄네. {t}님으로 하자.'],f:['오늘 밤은 {t}님이 좋겠습니다.']},
 nightReply:{p:['좋아요, {t}님으로 가요.','동의해요. 조용히 처리해요.','네, 저도 {t}님이 낫겠어요.'],b:['ㅇㅋ {t}님으로 가자.','동의. 조용히 처리하자.','나도 {t}님 쪽이 낫겠다.'],f:['동의합니다. {t}님으로 진행하죠.']},
 ghost:{p:['아 억울하다… 누가 마피아인지 알 것 같은데.','살아있는 분들, 제발 정신 차리세요!','여기서 지켜보니 다 보이네요.','다들 투표 신중하게 하세요…','저 없이도 잘 해야 해요, 시민 팀 파이팅.'],
  b:['아 억울해… 누가 마피아인지 보이는데 말을 못 해.','산 사람들 제발 정신 좀 차려!','여기서 보니까 다 보인다 진짜.','투표 신중하게 해라…','나 없어도 잘해라 시민 팀.'],f:['지켜보고 있겠습니다. 부디 신중하시길.']},
 agree:{p:['저도 {x}님 좀 수상하다고 생각했어요. {a}님 말에 동의해요.','{a}님 말 일리 있어요. {x}님 마피아 같아요.','어, 저도 {x}님 수상했어요. 뭔가 걸려요.'],
  b:['나도 {x}님 수상하다고 생각했어. {a}님 말 맞는 듯.','{a}님 말 일리 있네. {x}님 마피아 같아.','어 나도 {x}님 수상했는데. 뭔가 걸려.'],f:['{a}님의 의견에 동의합니다. {x}님은 수상합니다.']},
 doubt:{p:['{a}님, {x}님이라는 근거가 있나요? 너무 성급해요.','{x}님은 아닌 것 같은데요… {a}님 지금 몰아가는 거 아니에요?','잠깐만요, {x}님을 그렇게 단정할 이유가 있어요?'],
  b:['{a}님 {x}님이라는 근거 있어? 너무 성급해.','{x}님은 아닌 것 같은데… {a}님 지금 몰아가는 거 아냐?','잠깐, {x}님을 그렇게 단정할 이유가 있어?'],f:['{x}님이라고 단정할 근거가 부족합니다, {a}님.']},
 ack:{p:['{h}님 말도 일리 있어요. 다른 분들은 어떻게 생각하세요?','{h}님은 누구를 제일 먼저 보세요? 이유가 궁금해요.','{h}님 의견 잘 들었어요. 저도 비슷하게 생각했어요.'],
  b:['{h}님 말 일리 있네. 다들 어때?','{h}님은 누구 제일 먼저 봐? 이유 궁금.','{h}님 말에 공감. 나도 비슷하게 봤어.'],f:['{h}님의 의견을 경청했습니다. 다른 분들은 어떻게 보십니까?']},
 urge:{p:['슬슬 투표할 때가 된 것 같아요.','시간이 얼마 안 남았어요. 의견 모아봐요.'],b:['슬슬 투표해야 하지 않아? 시간 별로 없어.','시간 없다 의견 모으자.'],f:['시간이 많지 않습니다. 의견을 모읍시다.']}};
const T={fakePolice:L.fakePolice.p}; // 테스트용 호환

/* ---- 말투(성격): 같은 뜻도 사람마다 다르게 말한다 ---- */
const PERS=[
 {nm:'차분',reg:'p',pre:['음, ','일단 ','그러니까 '],preP:.2},
 {nm:'직설',reg:'b',pre:['아 ','근데 ','잠깐, '],preP:.3,dot:true},
 {nm:'장난',reg:'b',pre:['ㅋㅋ ','아 ㅋㅋ ','헐 '],preP:.35,suf:['ㅋㅋ','ㅋㅋㅋ','ㅎㅎ'],sufP:.6},
 {nm:'소심',reg:'p',pre:['저기… ','음… ','아, 그게… '],preP:.45,suf:['…','..'],sufP:.55},
 {nm:'격식',reg:'f',pre:['','실례지만 ','제 생각에는 '],preP:.2},
 {nm:'다혈질',reg:'b',pre:['아 진짜 ','야 ','헐 '],preP:.4,suf:['!!','!','?!'],sufP:.6,bang:true},
 {nm:'츤데레',reg:'b',pre:['흥, ','뭐 ','아니 뭐 '],preP:.4,suf:[' 알아서 해','… 뭐 아님 말고'],sufP:.3,dot:true},
 {nm:'줄임말',reg:'b',pre:['ㅇㅋ ','헐 ','ㅁㅊ '],preP:.4,suf:[' ㅇㅇ',' ㄹㅇ',' ㅋㅋ'],sufP:.5,slang:true}];
function hashStr(s){let h=7;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h}
function personaOf(s,id){
 const bots=s.order.filter(x=>isBotOf(s,x)),i=Math.max(0,bots.indexOf(id));
 return PERS[(i*3+hashStr(s.gid))%PERS.length]}
function decorate(t,p,r){
 let x=t;
 if(p.slang&&!x.includes('경찰')){x=x.replace(/진짜/g,()=>r()<.6?'ㄹㅇ':'진짜').replace(/맞아/g,()=>r()<.5?'ㅇㅈ':'맞아').replace(/동의/g,()=>r()<.5?'ㅇㅈ':'동의')}
 if(p.bang)x=x.replace(/\.(?=\s|$)/g,'!');
 if(p.dot)x=x.replace(/\.$/,'');
 if(p.suf&&r()<p.sufP)x=x.replace(/[.!?…]+$/,'')+p.suf[Math.floor(r()*p.suf.length)];
 if(p.pre&&r()<p.preP&&!/^(아|어|뭐|흥|헐|음|야|근데|잠깐|저기|ㅇㅋ|ㅋㅋ)/.test(x))x=p.pre[Math.floor(r()*p.pre.length)]+x;
 return x}

function botPlan(s,roles,sec,chat,names,now,r,mem,ai){
 if(mem.gid!==s.gid){Object.assign(mem,{gid:s.gid,next:{},cnt:{},used:{},seen:{},pending:{},lastAny:0,voted:{},final:{},night:{},nightAt:{},ghost:{},tgt:{},recent:[],open:{}})}
 const out=[],alive=aliveOf(s),bots=s.order.filter(id=>isBotOf(s,id)),N=id=>names[id]||'누군가';
 const R=a=>a[Math.floor(r()*a.length)],fill=(t,o)=>t.replace(/\{(\w)\}/g,(_,k)=>o[k]!==undefined?o[k]:'');
 const push=(uid,ch,text)=>{out.push({uid,ch,text:text.slice(0,200)});mem.lastAny=now};
 /* 말하기: 의도, 하위 구분, 채울 값. 최근에 쓴 문장은 피하고, 그 AI의 말투를 입힌다. */
 const say=(b,intent,sub,o)=>{
  let node=L[intent];if(sub)node=node[sub];
  const p=personaOf(s,b),list=node[p.reg]||node.p;
  let line=R(list);for(let k=0;k<6&&mem.recent.includes(fill(line,o||{}));k++)line=R(list);
  const base=fill(line,o||{});mem.recent.push(base);if(mem.recent.length>40)mem.recent.shift();
  return decorate(base,p,r)};
 const phaseStart=s.endsAt-s.dur,elapsed=now-phaseStart,info=ai.info,claims=info.claims,sus=info.sus;
 const grp=b=>roles[b]==='mafia'?'mafia':'good';
 const tgt=(b)=>{const k=b+':'+s.day;
  if(mem.tgt[k]&&alive.includes(mem.tgt[k]))return mem.tgt[k];
  const others=alive.filter(x=>x!==b&&!(roles[b]==='mafia'&&roles[x]==='mafia'));
  const t=roles[b]==='mafia'?ai.vote(b):wpick(others,x=>1+3*(sus[x]||0),r);
  return(mem.tgt[k]=t)};
 const liveBots=bots.filter(b=>alive.includes(b));
 if(s.phase==='day'){
  const night=[...(s.log||[])].reverse().find(e=>e.n===s.day&&(e.k==='death'||e.k==='peace'));
  const left=s.endsAt-now,spd=Math.max(1,liveBots.length/3.5);
  /* 1) 새 발언을 읽고 반응 예약: 지목당한 AI는 해명하고, 다른 AI는 맞장구치거나 반박하고, 사람 발언엔 대꾸한다. */
  const agrees=(b,x)=>{
   const rm=roles[b];
   if(rm==='mafia'){if(roles[x]==='mafia')return false;return r()<.65}
   if(rm==='police'){if(ai.knownClear(b).includes(x))return false;if(ai.knownMafia(b).includes(x))return true}
   return r()<.35+.15*Math.min(sus[x]||0,3)};
  chat.forEach(m=>{
   if(m.ch!=='day'||m.t<phaseStart||mem.seen[m.id])return;mem.seen[m.id]=1;
   const sp=m.uid,human=!isBotOf(s,sp),accuse=SUS_WORDS.some(w=>m.text.includes(w));
   const pendN=()=>Object.values(mem.pending).filter(Boolean).length;
   const free=()=>liveBots.filter(b=>b!==sp&&!mem.pending[b]&&(mem.cnt[b+':'+s.day]||0)<10);
   if(accuse){
    alive.filter(id=>id!==sp&&names[id]&&m.text.includes(names[id])).forEach(x=>{
     if(isBotOf(s,x)&&alive.includes(x)&&!mem.pending[x]&&(mem.used[x+'rc'+s.day]||0)<3)mem.pending[x]={type:'react',a:sp,at:now+500+r()*1300};
     const c=free().filter(b=>b!==x);
     if(c.length&&pendN()<3&&r()<(human?.7:.3)){const b=R(c);mem.pending[b]={type:agrees(b,x)?'agree':'doubt',a:sp,x,at:now+900+r()*2400}}})}
   else if(human&&pendN()<3&&r()<.55){const c=free();if(c.length)mem.pending[R(c)]={type:'ack',h:sp,at:now+700+r()*2000}}});
  /* 2) 각자 말할 차례: 처음엔 빠르게, 이후엔 인원수에 맞춰 활발하게 */
  liveBots.forEach((b,i)=>{
   if(now-mem.lastAny<1300)return;
   const ck=b+':'+s.day,c=mem.cnt[ck]||0;if(c>=10)return;
   if(mem.next[ck]===undefined)mem.next[ck]=phaseStart+1000+i*650+r()*3500;
   const pend=mem.pending[b],rm=roles[b];let text=null;
   if(pend&&now>pend.at+9000)mem.pending[b]=null;
   else if(pend&&now>=pend.at){
    mem.pending[b]=null;
    if(pend.type==='react'){const rk=b+'rc'+s.day;mem.used[rk]=(mem.used[rk]||0)+1;
     text=mem.used[rk]>3?null:mem.used[rk]>1?say(b,'reactMore'):say(b,'react',rm==='police'&&ai.knownMafia(b).length?'police':grp(b),{a:N(pend.a)})}
    else if(pend.type==='agree'||pend.type==='doubt')text=say(b,pend.type,null,{a:N(pend.a),x:N(pend.x)});
    else text=say(b,'ack',null,{h:N(pend.h)});
    mem.next[ck]=Math.max(mem.next[ck],now+3500)}
   else if(!pend&&now>=mem.next[ck]){
    mem.next[ck]=now+(4500+r()*5500)*spd;
    if(left<50000&&!mem.used[ck+'u']&&r()<.5){mem.used[ck+'u']=1;text=say(b,'urge')}
    else if(!mem.open[s.day]||(mem.open[s.day]<3&&c===0)){
     mem.open[s.day]=(mem.open[s.day]||0)+1;
     text=night&&night.k==='death'?say(b,'openDeath',grp(b),{d:N(night.id)}):say(b,'openPeace',grp(b))}
    else if(rm==='mafia'){
     const claimants=Object.keys(claims).filter(x=>x!==b&&alive.includes(x));
     const mates=alive.filter(x=>roles[x]==='mafia'&&x!==b),hot=mates.find(m=>(sus[m]||0)>=3);
     if(claimants.length&&!mem.used[ck+'cn']){mem.used[ck+'cn']=1;text=say(b,'counter',null,{c:N(claimants[0])})}
     else if(s.day>=2&&!claimants.length&&!mem.used[b+'fp']&&r()<.45){mem.used[b+'fp']=1;text=say(b,'fakePolice',null,{t:N(tgt(b))})}
     else if(hot&&r()<.5)text=say(b,'sacrifice',null,{m:N(hot)});
     else if(mates.length&&r()<.2)text=say(b,'defendMate',null,{m:N(R(mates))});
     else text=r()<.8?say(b,'frame',null,{t:N(tgt(b))}):say(b,'chat')}
    else if(rm==='police'&&ai.knownMafia(b).length){
     const t=ai.knownMafia(b)[0];
     text=say(b,mem.used[b+'ag']?'agitate2':'agitate',null,{t:N(t)});mem.used[b+'ag']=1}
    else if(rm==='police'&&ai.knownClear(b).length&&r()<.3)text=say(b,'clear',null,{t:N(R(ai.knownClear(b)))});
    else text=r()<.72?say(b,'suspect',null,{t:N(tgt(b))}):say(b,'chat')}
   if(text){mem.cnt[ck]=c+1;push(b,'day',text)}})}
 else if(s.phase==='vote'){
  liveBots.forEach((b,i)=>{
   const k=b+':'+s.day;if(mem.voted[k]||elapsed<800+i*450+r()*1800||now-mem.lastAny<600)return;
   mem.voted[k]=1;const t=ai.vote(b);
   if(t)push(b,'day',say(b,'vote',grp(b),{t:N(t)}))})}
 else if(s.phase==='defense'&&isBotOf(s,s.accused)&&!mem.final[s.day]){
  mem.final[s.day]=1;const b=s.accused,rm=roles[b];
  const key=rm==='police'&&ai.knownMafia(b).length?'police':grp(b);
  const x=rm==='mafia'?N(wpick(alive.filter(y=>roles[y]!=='mafia'&&y!==b),()=>1,r)):'';
  push(b,'day',say(b,'final',key,{x}))}
 else if(s.phase==='night'){
  const ms=liveBots.filter(b=>roles[b]==='mafia');
  ms.forEach((b,i)=>{
   const k=b+':'+s.day,n=mem.night[k]||0;
   if(n>=2||now-mem.lastAny<1200||elapsed<2000+i*1800+r()*2500||now<(mem.nightAt[k]||0))return;
   mem.night[k]=n+1;mem.nightAt[k]=now+4000+r()*3000;const t=ai.kill(b);
   push(b,'mafia',say(b,(i===0&&n===0)?'nightOpen':'nightReply',null,{t:N(t)}))})}
 // 사망한 AI의 유령 채팅
 if(s.phase==='day'||s.phase==='night'){
  bots.filter(b=>s.dead.includes(b)).forEach(b=>{
   const g=mem.ghost[b]||{n:0,at:now+12000+r()*10000};mem.ghost[b]=g;
   if(g.n<6&&now>=g.at&&now-mem.lastAny>1500){g.n++;g.at=now+20000+r()*15000;push(b,'dead',say(b,'ghost'))}})}
 return out}

if(typeof module!=='undefined')module.exports={srand,chatInfo,makeAi,botPlan,T,L,PERS,personaOf,SUS_WORDS,CLAIM_RE};
