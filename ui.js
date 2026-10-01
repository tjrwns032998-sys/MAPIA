/* 월광 살롱 - 화면 그리기와 입력 처리 */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ROLE={
 mafia:{n:'마피아',ic:'i-mafia',c:'var(--blood)',team:'마피아 팀',d:'밤마다 동료와 상의해 한 명을 죽여요. 생존자의 절반 이상이 되면 승리해요.'},
 doctor:{n:'의사',ic:'i-doctor',c:'var(--green)',team:'시민 팀',d:'밤마다 한 명을 지목해 마피아의 공격에서 살려요. 자신도 지킬 수 있어요.'},
 police:{n:'경찰',ic:'i-police',c:'var(--blue)',team:'시민 팀',d:'밤마다 한 명을 조사해 마피아인지 시민인지 알아내요.'},
 citizen:{n:'시민',ic:'i-citizen',c:'var(--brass)',team:'시민 팀',d:'특별한 능력은 없어요. 토론과 투표로 마피아를 찾아내요.'}};
const PH={lobby:['i-candle','대기실','모두 모이면 준비 완료를 눌러요.'],night:['i-moon','밤','도시가 잠들고, 마피아가 움직여요.'],day:['i-sun','낮 · 토론','대화로 마피아를 가려내 보세요.'],vote:['i-ballot','투표','처형 후보를 골라요.'],defense:['i-speech','최후 발언','지목된 사람이 마지막으로 말해요.'],judge:['i-ballot','찬반 투표','이 사람을 처형할까요?'],over:['i-cup','게임 종료','']};
const KIND={mafia:'kill',doctor:'heal',police:'probe'};
const ico=(id,cls)=>`<svg class="ic ${cls||''}"><use href="#${id}"/></svg>`;
const fmt=ms=>{ms=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(ms/60)).padStart(2,'0')+':'+String(ms%60).padStart(2,'0')};
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

function logText(e){
 switch(e.k){
 case'start':return`게임이 시작됐어요. 마피아 ${e.m}명 · 의사 1명 · 경찰 1명 · 시민 ${e.c}명이에요.`;
 case'death':return`${esc(nm(e.id))} 님이 밤사이 마피아에게 살해당했어요. ${e.camp}이었어요.`;
 case'peace':return'간밤에는 아무도 죽지 않았어요.';
 case'voteStart':return'투표가 시작됐어요.';
 case'accuse':return`${esc(nm(e.id))} 님이 ${e.v}표로 과반을 얻어 최후 발언을 해요.`;
 case'noMaj':return'과반 득표자가 없어서 오늘은 처형이 없어요.';
 case'verdict':return e.exec?`${esc(nm(e.id))} 님이 찬성 ${e.y} · 반대 ${e.no}으로 처형됐어요. ${e.camp}이었어요.`:`찬성 ${e.y} · 반대 ${e.no}. ${esc(nm(e.id))} 님은 살아남았어요.`;
 case'end':return e.w==='mafia'?'마피아가 생존자의 절반 이상이 되어 마피아가 승리했어요.':'마피아를 모두 찾아내 시민이 승리했어요.'}
 return''}
function dawn(){
 if(!S||S.phase!=='day')return'';
 const e=[...(S.log||[])].reverse().find(x=>x.n===S.day&&(x.k==='death'||x.k==='peace'));
 return e?logText(e):''}
const roomSize=()=>S&&S.phase!=='lobby'?S.order.length:lobbyHumans().length+BOTS.length;

/* ---------- 그리기 ---------- */
let rq=0,lastChatSig='',infoSig='',lastBgm='';
function render(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;draw()})}
function bgm(){
 const ph=!room?'lobby':phase(),m={lobby:'lobby',night:'night',day:'day',vote:'tense',defense:'tense',judge:'tense',over:'over'}[ph]||'lobby';
 const key=m+(S&&S.winner||'');if(key===lastBgm)return;lastBgm=key;
 Snd.mode(m,S&&S.winner==='citizen'?'citizen':'mafia')}

function drawStage(){
 const ph=phase(),[ic,title,sub]=PH[ph]||PH.lobby;
 document.body.dataset.ph=ph;
 let t=title,s=sub;
 if(ph==='lobby'){t=`대기실 · ${room}`;s=`지금 ${roomSize()}명 · 모두 준비하면 시작할 수 있어요.`}
 else if(ph==='night')t=`밤 · ${S.day}일차`;
 else if(ph==='day')t=`낮 · ${S.day}일차 토론`;
 else if(ph==='defense'||ph==='judge')s=`${esc(nm(S.accused))} 님 · ${sub}`;
 else if(ph==='over')s=S.winner==='mafia'?'마피아의 승리':'시민의 승리';
 const res=ph==='day'?`<div class="res">${dawn()}</div>`:'';
 const timed=S&&S.endsAt&&ph!=='lobby'&&ph!=='over';
 $('stage').innerHTML=`<svg class="ic big"><use href="#${ic}"/></svg><div class="txt"><h2>${esc(t)}</h2><p>${s}</p>${res}</div>${timed?`<div class="clock"><b id="tm">--:--</b><div class="bar"><i id="bar"></i></div></div>`:''}`;
 tickUI()}
function tickUI(){
 const tm=$('tm');if(!tm||!S)return;
 const left=S.endsAt-Date.now();tm.textContent=fmt(left);
 const b=$('bar');if(b&&S.dur)b.style.width=Math.max(0,Math.min(100,left/S.dur*100))+'%'}
setInterval(tickUI,500);

function voteCounts(){
 const o={};if(!S||S.phase!=='vote')return o;
 aliveOf(S).forEach(id=>{const a=ACT[id];if(a&&a.gid===S.gid&&a.n===S.day&&a.ph==='vote'&&a.kind==='vote'&&a.target)o[a.target]=(o[a.target]||0)+1});return o}
function seat(id,o){
 const c=ctx(),me=id===uid,bot=isBot(id),r=R&&S&&R.gid===S.gid?R.roles[id]:null,over=phase()==='over';
 let tag='';
 if(!o.game)tag=o.ready?`<span class="tag ok">준비 완료</span>`:`<span class="tag">대기 중</span>`;
 else if(o.dead){const camp=r==='mafia'?'마피아':'시민';tag=over&&r?`<span class="tag bad">${ico(ROLE[r].ic)}${ROLE[r].n}</span>`:`<span class="tag bad">${ico('i-tomb')}${camp}</span>`}
 else if(over&&r)tag=`<span class="tag" style="color:${ROLE[r].c}">${ico(ROLE[r].ic)}${ROLE[r].n}</span>`;
 else if(c.myRole==='mafia'&&r==='mafia'&&!me)tag=`<span class="tag bad">${ico('i-mafia')}동료</span>`;
 else tag=`<span class="tag">${isOn(id)||bot?'생존':'자리 비움'}</span>`;
 const vc=o.votes?`<span class="votes">${o.votes}표</span>`:'';
 const tg=S&&(S.phase==='defense'||S.phase==='judge')&&S.accused===id?' target':'';
 return`<div class="seat ${me?'me':''} ${o.dead?'dead':''} ${freshDead.has(id)?'fresh':''}${tg}">${bot?'<span class="ai">AI</span>':''}${vc}<div class="av" style="--c:${colorOf(id)}">${o.dead?ico('i-tomb'):esc(nm(id).trim().charAt(0)||'?')}</div><div class="who"><div class="nm">${esc(nm(id))}${me?' · 나':''}</div>${tag}</div></div>`}
function drawSeats(){
 const c=ctx();let h='';
 if(!c.playing){
  h=lobbyHumans().map(id=>seat(id,{ready:!!(PL[id]&&PL[id].ready)})).join('')+BOTS.map(b=>seat(b.id,{ready:true})).join('');
  if(!h)h='<p class="sub">아직 아무도 없어요.</p>'}
 else{const vc=voteCounts();h=S.order.map(id=>seat(id,{game:1,dead:S.dead.includes(id),votes:vc[id]})).join('')}
 $('seats').innerHTML=h}

function tgBtns(ids,sel,act){
 return`<div class="tgs">${ids.map(id=>`<button class="${sel===id?'sel':''}" data-a="${act}" data-v="${id}"><span class="av" style="--c:${colorOf(id)}">${esc(nm(id).charAt(0))}</span><span class="t">${esc(nm(id))}</span></button>`).join('')}</div>`}
function lobbyPanel(){
 const hs=lobbyHumans(),n=hs.length+BOTS.length,rdy=hs.filter(id=>PL[id]&&PL[id].ready).length,all=hs.length>0&&rdy===hs.length;
 const ok=all&&n>=MIN&&n<=MAX,d=n>=MIN&&n<=MAX?dist(n):null,mineR=!!(PL[uid]&&PL[uid].ready);
 const hint=n<MIN?`${MIN}명 이상 모여야 시작할 수 있어요. 지금 ${n}명이에요.`:n>MAX?`최대 ${MAX}명까지 입장할 수 있어요.`:!all?`준비 완료 ${rdy}/${hs.length}명. 모두 준비하면 시작 버튼이 켜져요.`:'모두 준비됐어요. 시작할 수 있어요!';
 return`<h2>대기실</h2><p class="sub">${hint}</p>
 ${d?`<div class="chips"><span class="chip">마피아 ${d.mafia}</span><span class="chip p">의사 ${d.doctor}</span><span class="chip p">경찰 ${d.police}</span><span class="chip p">시민 ${d.citizen}</span></div>`:''}
 <div class="cols2" style="margin-bottom:8px"><button class="${mineR?'sel':''}" data-a="ready">${mineR?'준비 취소':'준비 완료'}</button></div>
 <p class="sub" style="margin-bottom:4px">AI 참가자 (${BOTS.length}명)</p>
 <div class="cols2" style="margin-bottom:8px"><button data-a="addbot" data-v="1" ${n>=MAX?'disabled':''}>+1</button><button data-a="addbot" data-v="5" ${n>=MAX?'disabled':''}>+5</button><button data-a="rmbot" ${BOTS.length?'':'disabled'}>-1</button><button data-a="rmall" ${BOTS.length?'':'disabled'}>모두 제거</button></div>
 <button class="main" style="width:100%" data-a="start" ${ok?'':'disabled'}>게임 시작</button>
 <p class="sub" style="margin-top:8px">상단의 방 코드 <b class="chip-code">${esc(room)}</b> 버튼을 누르면 초대 링크가 복사돼요.</p>`}
function drawMe(){
 const c=ctx(),ph=phase(),el=$('me');
 if(!c.playing){el.innerHTML=lobbyPanel();return}
 if(!c.inGame){el.innerHTML='<h2>관전 중</h2><p class="sub">진행 중인 게임에는 들어갈 수 없어요. 끝나면 대기실에서 함께해요. 사망자 채팅은 사용할 수 있어요.</p>';return}
 const r=c.myRole,rm=r&&ROLE[r];let h='';
 if(rm){
  h+=`<div class="role" style="--rc:${rm.c}"><div class="disc">${ico(rm.ic)}</div><div><h3>${rm.n}</h3>${['vote','defense','judge'].includes(ph)?'':`<p>${rm.d}</p>`}</div></div>`;
  if(r==='mafia'){const mates=S.order.filter(id=>R.roles[id]==='mafia'&&id!==uid);h+=mates.length?`<div class="chips">${mates.map(id=>`<span class="chip">동료 · ${esc(nm(id))}${S.dead.includes(id)?' (사망)':''}</span>`).join('')}</div>`:'<p class="sub">당신이 유일한 마피아예요.</p>'}
  if(r==='police'&&SEC&&SEC.gid===S.gid&&SEC.inv&&SEC.inv[uid]&&SEC.inv[uid].length)
   h+=`<h2 style="margin-top:4px">조사 결과</h2><ul class="found">${SEC.inv[uid].map(x=>`<li>${x.n}일차 밤 · ${esc(nm(x.target))} 님은 <b style="color:${x.mafia?'var(--blood)':'var(--green)'}">${x.mafia?'마피아':'시민'}</b></li>`).join('')}</ul>`}
 else h+='<p class="sub">직업을 불러오는 중이에요…</p>';
 h+='<hr style="border:0;border-top:1px solid var(--line);margin:10px 0">';
 if(ph==='over'){
  h+=`<h3 style="margin-bottom:6px">${S.winner==='mafia'?'마피아':'시민'} 팀 승리</h3><div class="rl">${S.order.map(id=>{const rr=R.roles[id],m=ROLE[rr];return`<div style="color:${m.c}">${ico(m.ic)}<span style="color:var(--ink)">${esc(nm(id))}</span> · ${m.n}</div>`}).join('')}</div><div class="cols2"><button class="main" data-a="again">대기실로 돌아가기</button></div>`;
  el.innerHTML=h;return}
 if(c.dead){h+='<p class="sub">당신은 사망했어요. 생존자의 대화는 진한 글씨로 보이고, 사망자끼리만 흐린 글씨로 대화할 수 있어요.</p>';el.innerHTML=h;return}
 const alive=c.alive;
 if(ph==='night'){
  const a=myAct('night'),sel=a&&a.target;
  if(r==='mafia'){
   h+=`<h2>오늘 밤, 누구를 노릴까요?</h2>`+tgBtns(alive.filter(id=>R.roles[id]!=='mafia'),sel,'pick');
   const votes=S.order.filter(id=>R.roles[id]==='mafia'&&!S.dead.includes(id)&&!isBot(id)).map(id=>{const x=ACT[id];return x&&x.gid===S.gid&&x.n===S.day&&x.ph==='night'&&x.kind==='kill'?`${esc(nm(id))} → ${esc(nm(x.target))}`:null}).filter(Boolean);
   if(votes.length)h+=`<div class="chips">${votes.map(v=>`<span class="chip">${v}</span>`).join('')}</div>`}
  else if(r==='doctor')h+=`<h2>누구를 살릴까요?</h2>`+tgBtns(alive,sel,'pick');
  else if(r==='police')h+=`<h2>누구를 조사할까요?</h2>`+tgBtns(alive.filter(id=>id!==uid),sel,'pick');
  else h+='<p class="sub">밤이 깊었어요. 조용히 아침을 기다려요.</p>';
  if(r!=='citizen'&&sel)h+='<p class="sub">선택했어요. 시간 안에는 바꿀 수 있어요.</p>'}
 else if(ph==='day'){
  const hu=alive.filter(id=>!isBot(id)&&isOn(id)),need=Math.floor(hu.length/2)+1,sk=hu.filter(id=>{const x=ACT[id];return x&&x.gid===S.gid&&x.n===S.day&&x.ph==='day'&&x.kind==='skip'}).length,mine=myAct('day'),req=mine&&mine.kind==='skip';
  h+=`<h2>토론</h2><p class="sub">5분 토론 후 투표해요. 과반이 원하면 바로 투표로 넘어가요.</p><button class="${req?'sel':''}" style="width:100%" data-a="skip">${req?'요청 취소':'투표 시작 요청'} (${sk}/${need})</button>`}
 else if(ph==='vote'){
  const a=myAct('vote'),sel=a?(a.target||'none'):null;
  h+=`<h2>누구를 처형할까요?</h2><p class="sub">과반수 표를 얻으면 최후 발언 후 찬반 투표를 받아요.</p><button class="${sel==='none'?'sel':''}" style="width:100%;margin-bottom:8px" data-a="vote" data-v="">기권</button>`+tgBtns(alive.filter(id=>id!==uid),sel,'vote')}
 else if(ph==='defense'){
  h+=S.accused===uid?`<h2>최후 발언</h2><p class="sub">대화창에 마지막 말을 남겨요. 시간이 지나면 찬반 투표가 열려요.</p><button class="main" style="width:100%" data-a="done">발언 마치기</button>`:`<h2>최후 발언</h2><p class="sub">${esc(nm(S.accused))} 님의 말을 들어요.</p>`}
 else if(ph==='judge'){
  if(S.accused===uid)h+='<h2>찬반 투표 중</h2><p class="sub">다른 사람들이 당신의 운명을 정하고 있어요.</p>';
  else{const a=myAct('judge');h+=`<h2>${esc(nm(S.accused))} 님을 처형할까요?</h2><p class="sub">찬성이 투표자의 과반이면 처형돼요.</p><div class="cols2"><button class="danger ${a&&a.kind==='yes'?'sel':''}" data-a="yes">찬성 (처형)</button><button class="${a&&a.kind==='no'?'sel':''}" data-a="no">반대 (살려요)</button></div>`}}
 el.innerHTML=h}

function drawChat(){
 const ch=myChannel(),inp=$('chatin'),ph=phase(),c=ctx();
 inp.disabled=!ch;$('chatgo').disabled=!ch;
 inp.placeholder=ch==='mafia'?'마피아에게만 보이는 비밀 대화':ch==='dead'?'사망자 전용 대화 (생존자에게는 안 보여요)':ch==='day'?'메시지를 입력해요':(ph==='night'?'밤에는 대화할 수 없어요':ph==='judge'?'찬반 투표 중에는 대화할 수 없어요':'지금은 말할 수 없어요');
 $('chatTitle').textContent=ch==='mafia'?'대화 · 마피아 밀담':ch==='dead'?'대화 · 사망자 채팅':'대화';
 $('chatHint').textContent=c.dead?'생존자 대화는 진하게 보여요':'';
 const asDead=c.dead||(c.playing&&!c.inGame);
 $('chatlog').classList.toggle('asdead',asDead);
 const list=CHAT.filter(visible),sig=list.length+'|'+(list.length?list[list.length-1].id:0)+'|'+asDead+'|'+ph;
 if(sig===lastChatSig)return;lastChatSig=sig;
 const box=$('chatlog'),stick=box.scrollTop+box.clientHeight>=box.scrollHeight-60;
 box.innerHTML=list.length?list.map(m=>`<div class="msg ${m.ch} ${m.uid===uid?'mine':''}"><small>${esc(nm(m.uid))}${m.ch==='mafia'?' · 마피아':m.ch==='dead'?' · 사망자':''}</small>${esc(m.text)}</div>`).join(''):'<div class="chatempty">아직 대화가 없어요. 먼저 인사해 보세요.</div>';
 if(stick||list.length<3)box.scrollTop=box.scrollHeight}

function logHtml(){
 const l=S&&S.log?S.log:[];
 return l.length?[...l].reverse().slice(0,20).map(e=>{const t=logText(e);return t?`<li class="${e.k==='death'||(e.k==='verdict'&&e.exec)?'d':''}">${t}</li>`:''}).join(''):'<li class="dim">게임이 시작되면 여기에 기록돼요.</li>'}
function infoHtml(){
 const n=roomSize();
 const cards=['mafia','doctor','police','citizen'].map(k=>{const m=ROLE[k];return`<div class="card" style="--rc:${m.c}"><div class="disc">${ico(m.ic)}</div><h3>${m.n}</h3><span class="team">${m.team}</span><p>${m.d}</p></div>`}).join('');
 let rows='';for(let i=MIN;i<=MAX;i++){const d=dist(i);rows+=`<tr class="${i===n?'now':''}"><td>${i}명</td><td>${d.mafia}</td><td>${d.doctor}</td><td>${d.police}</td><td>${d.citizen}</td></tr>`}
 return`<div class="cards">${cards}</div><div class="tw"><table><thead><tr><th>인원</th><th>마피아</th><th>의사</th><th>경찰</th><th>시민</th></tr></thead><tbody>${rows}</tbody></table></div>
 <ul class="rules"><li>밤: 마피아는 함께 한 명을 고르고, 의사는 살릴 사람, 경찰은 조사할 사람을 골라요.</li><li>아침: 죽은 사람은 마피아였는지 시민이었는지만 공개돼요.</li><li>낮: 5분간 토론하고, 과반이 원하면 먼저 투표해요. 과반 득표자는 30초 최후 발언 뒤 찬반 투표를 받아요.</li><li>마피아가 생존자의 절반 이상이면 마피아 승리, 마피아를 모두 찾아내면 시민 승리예요.</li><li>사망자는 생존자의 대화를 볼 수 있고, 사망자끼리만 따로 대화할 수 있어요.</li></ul>`}
function drawSide(){
 const sig=(S&&S.phase!=='lobby'?'g'+(S.log||[]).length+S.phase:'l'+roomSize())+(S?S.day:0);
 if(sig===infoSig)return;infoSig=sig;
 $('side2').innerHTML=phase()==='lobby'?infoHtml():`<h2>진행 기록</h2><ol class="log">${logHtml()}</ol>`}

function draw(){
 const nt=$('notice');let msg='';
 if(mode==='init')msg='접속 중…';
 else if(mode==='joining')msg='방에 들어가는 중…';
 else if(mode==='solo')msg='서버에 연결하지 못했어요. 새로고침하거나 Supabase 설정(config.js)과 익명 로그인 허용 여부를 확인해 주세요.';
 nt.hidden=!msg;nt.textContent=msg;
 $('home').hidden=mode!=='home';$('room').hidden=mode!=='play';
 $('btnLeave').hidden=mode!=='play';$('btnCode').hidden=mode!=='play';if(room)$('codeTxt').textContent=room;
 $('nickbox').hidden=!(mode==='home'||(mode==='play'&&phase()==='lobby'));
 $('roomErr').textContent=roomErr;
 if(mode==='play'&&document.activeElement!==$('nick'))$('nick').value=(PL[uid]&&PL[uid].nick)||'';
 else if(mode==='home'&&document.activeElement!==$('nick'))$('nick').value=store.get('mafia_nick')||'';
 bgm();
 if(mode!=='play'){document.body.dataset.ph='lobby';return}
 fxTryRole();
 drawStage();drawSeats();drawMe();drawChat();drawSide();
 if($('dlg').open){$('info').innerHTML=infoHtml();$('log').innerHTML=logHtml()}}

/* ---------- 입력 ---------- */
document.body.addEventListener('click',e=>{
 const b=e.target.closest('[data-a]');if(!b||b.disabled)return;
 const a=b.dataset.a,v=b.dataset.v;
 if(a==='ready')setReady(!(PL[uid]&&PL[uid].ready));
 else if(a==='addbot')addBot(+v||1);else if(a==='rmbot')rmBot();else if(a==='rmall')rmBot(true);
 else if(a==='start')startGame();
 else if(a==='pick'){const r=ctx().myRole;setAct({ph:'night',kind:KIND[r],target:v})}
 else if(a==='skip'){const cur=myAct('day');setAct({ph:'day',kind:cur&&cur.kind==='skip'?'none':'skip'})}
 else if(a==='vote')setAct({ph:'vote',kind:'vote',target:v||null});
 else if(a==='yes'||a==='no')setAct({ph:'judge',kind:a});
 else if(a==='done')setAct({ph:'defense',kind:'done'});
 else if(a==='again')backToLobby()});
$('chatform').addEventListener('submit',e=>{e.preventDefault();if(sendChat($('chatin').value))$('chatin').value=''});
$('btnCreate').addEventListener('click',()=>createRoom());
$('joinForm').addEventListener('submit',e=>{e.preventDefault();joinRoom($('codeIn').value)});
$('btnLeave').addEventListener('click',()=>{if(confirm('방을 나갈까요?'))leaveRoom()});
$('btnCode').addEventListener('click',async()=>{
 const url=location.origin+location.pathname+'#'+room,b=$('btnCode');
 try{await navigator.clipboard.writeText(url);b.title='복사됐어요!'}catch(e){prompt('초대 링크를 복사하세요',url)}
 const t=$('codeTxt'),old=t.textContent;t.textContent='복사됨';setTimeout(()=>{t.textContent=old},1200)});
$('btnGuide').addEventListener('click',()=>{$('info').innerHTML=infoHtml();$('log').innerHTML=logHtml();$('dlg').showModal()});
$('dlgClose').addEventListener('click',()=>$('dlg').close());
$('nick').addEventListener('change',()=>{
 const v=$('nick').value.trim().slice(0,10);store.set('mafia_nick',v);
 if(mode==='play'&&v)setMine({nick:v})});
function sndIcon(){$('sndIc').innerHTML=`<use href="#${Snd.isOn()?'i-vol':'i-mute'}"/>`}
$('btnSnd').addEventListener('click',()=>{Snd.toggle();store.set('mafia_snd',Snd.isOn()?'1':'0');sndIcon()});
if(store.get('mafia_snd')==='0'){Snd.toggle();sndIcon()}
// 브라우저 정책상 첫 클릭/터치 뒤에 음악이 시작된다.
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{if(Snd.isOn())Snd.start()},{once:true}));
addEventListener('pointerdown',e=>{if(e.target.closest('button'))Snd.sfx('click')});

draw();connect();
