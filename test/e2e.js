// 브라우저 통합 테스트(가짜 Supabase 사용): node test/e2e.js
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),shots=process.env.SHOTS||'/tmp/mafia-shots';fs.mkdirSync(shots,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((q,r)=>{const f=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':types[path.extname(f)]||'text/plain'});r.end(d)})});
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{
 await new Promise(r=>srv.listen(0,r));const url='http://127.0.0.1:'+srv.address().port+'/';
 const br=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 for(const vp of [{name:'desktop',w:1280,h:760},{name:'mobile',w:390,h:780}].filter(v=>!process.env.VP||v.name===process.env.VP)){
  const ctx=await br.newContext({viewport:{width:vp.w,height:vp.h}}),page=await ctx.newPage(),errs=[];
  page.on('pageerror',e=>errs.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_/.test(m.text()))errs.push('console: '+m.text())});
  await page.route(/cdn\.jsdelivr\.net|fonts\.g/,r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
  await page.addInitScript({path:path.join(__dirname,'fake-supabase.js')});
  await page.clock.install({time:Date.now()});
  await page.goto(url);await page.clock.runFor(1500);
  ok(await page.isVisible('#home'),vp.name+': 입구 화면');
  await page.screenshot({path:`${shots}/${vp.name}-1-home.png`});
  // 없는 코드
  await page.fill('#codeIn','ZZZZZ');await page.click('#btnJoin');await page.clock.runFor(500);
  ok(/찾을 수 없어요/.test(await page.textContent('#roomErr')),vp.name+': 없는 방 코드 안내');
  await page.click('#btnCreate');await page.clock.runFor(1500);
  ok(await page.isVisible('#room'),vp.name+': 방 생성 후 대기실');
  const code=await page.evaluate(()=>room);ok(/^[A-Z2-9]{5}$/.test(code),vp.name+': 방 코드 '+code);
  ok(await page.evaluate(()=>location.hash)==='#'+code,vp.name+': 주소에 코드 반영');
  // 대기실: AI 19명까지 (최대 20명)
  await page.click('[data-a=addbot][data-v="5"]');await page.clock.runFor(300);
  for(let i=0;i<3;i++){await page.click('[data-a=addbot][data-v="5"]');await page.clock.runFor(300)}
  ok(await page.evaluate(()=>roomSize())===20,vp.name+': 20명까지 입장 가능 -> '+await page.evaluate(()=>roomSize()));
  await page.click('[data-a=addbot][data-v="1"]',{force:true}).catch(()=>{});await page.clock.runFor(300);
  ok(await page.evaluate(()=>roomSize())===20,vp.name+': 20명 초과 불가');
  ok(await page.isDisabled('[data-a=start]'),vp.name+': 준비 전 시작 버튼 비활성');
  await page.click('[data-a=ready]');await page.clock.runFor(500);
  ok(!(await page.isDisabled('[data-a=start]')),vp.name+': 준비 후 시작 버튼 활성');
  await page.screenshot({path:`${shots}/${vp.name}-2-lobby.png`});
  // 방 두 개 분리: 채팅이 방별로 쌓이는지
  await page.fill('#chatin','안녕하세요');await page.click('#chatgo');await page.clock.runFor(500);
  ok((await page.textContent('#chatlog')).includes('안녕하세요'),vp.name+': 대기실 채팅');
  // 다른 접속자가 먼저 시작권을 잡은 상황: 내 시작은 아무것도 쓰지 않아야 한다
  await page.evaluate(()=>db.doc('game/start_'+((S&&S.seq||0)+1)).create({by:'other'}));
  await page.click('[data-a=start]');await page.clock.runFor(1200);
  ok(await page.evaluate(()=>(S&&S.phase)||'lobby')==='lobby'&&await page.evaluate(()=>!R),vp.name+': 시작권을 못 얻으면 게임을 덮어쓰지 않음');
  await page.clock.runFor(5200);
  // 닉네임이 잘리지 않는지
  await page.evaluate(()=>setMine({nick:'열글자닉네임입니다람'}));await page.clock.runFor(400);
  const nmv=await page.evaluate(()=>{const e=document.querySelector('.seat.me .nm');const cs=getComputedStyle(e);return{t:cs.textOverflow,ws:cs.whiteSpace,clip:e.scrollHeight>e.clientHeight+1,w:e.scrollWidth>e.clientWidth+1,txt:e.textContent}});
  ok(nmv.t!=='ellipsis'&&nmv.ws!=='nowrap'&&!nmv.clip&&!nmv.w,vp.name+': 긴 닉네임이 전부 보임 '+JSON.stringify(nmv));
  // 심심풀이 장난감
  for(let i=0;i<12;i++){await page.click('#btnToy');await page.clock.runFor(60)}
  ok(+(await page.textContent('#toyN'))>=12,vp.name+': 장난감 카운터 '+await page.textContent('#toyN'));
  await page.click('[data-a=start]');await page.clock.runFor(1200);
  ok(await page.evaluate(()=>S&&S.phase)==='night','시작 후 밤');
  ok(await page.evaluate(()=>R&&R.gid===S.gid),vp.name+': 직업 정보와 게임 번호가 일치');
  const dist20=await page.evaluate(()=>JSON.stringify(dist(20)));ok(dist20==='{"mafia":4,"doctor":1,"police":1,"citizen":14}',vp.name+': 20명 직업 분배 '+dist20);
  const rc=await page.evaluate(()=>{const c={};Object.values(R.roles).forEach(r=>c[r]=(c[r]||0)+1);return JSON.stringify(c)});
  ok(JSON.parse(rc).mafia===4&&JSON.parse(rc).doctor===1,vp.name+': 실제 배정 '+rc);
  await page.screenshot({path:`${shots}/${vp.name}-3-rolefx.png`});
  ok(await page.evaluate(()=>document.getElementById('fx').classList.contains('on')),vp.name+': 직업 공개 연출');
  await page.clock.runFor(9800); // 직업 공개 + 밤 + 행동 안내 연출이 끝난 뒤
  // 한 화면 안에 들어오는지(스크롤 왕복 없음)
  const lay=await page.evaluate(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();const v=innerHeight;
   return{docH:document.documentElement.scrollHeight,v,chat:r('chatpn'),me:r('me'),stage:r('stage'),seats:r('seats'),input:r('chatin')}});
  ok(lay.docH<=lay.v+1,`${vp.name}: 문서 스크롤 없음 (${lay.docH}/${lay.v})`);
  ok(lay.chat.height>=120,`${vp.name}: 채팅창 높이 ${Math.round(lay.chat.height)}px`);
  ok(lay.input.bottom<=lay.v&&lay.me.bottom<=lay.v+1,`${vp.name}: 채팅 입력과 행동 패널이 화면 안`);
  let myr=await page.evaluate(()=>R.roles[uid]);
  const dec=await page.evaluate(()=>({hidden:document.getElementById('decide').hidden,btns:document.querySelectorAll('#decide [data-a=pick]').length,r:document.getElementById('decide').getBoundingClientRect()}));
  ok(myr==='citizen'?true:(!dec.hidden&&dec.btns>0),vp.name+': 밤 행동 선택창 ('+myr+') '+JSON.stringify({h:dec.hidden,b:dec.btns}));
  await page.screenshot({path:`${shots}/${vp.name}-4-night.png`});
  if(!dec.hidden){await page.click('#decide [data-a=pick]');await page.clock.runFor(1500);
   ok(await page.evaluate(()=>document.getElementById('decide').hidden),vp.name+': 선택하면 창이 닫힘');
   ok(await page.evaluate(()=>!!myAct('night')&&!!myAct('night').target),vp.name+': 선택이 기록됨')}
  if(process.env.QUICK){console.log(await page.evaluate(()=>JSON.stringify({fxBusy,q:fxQ.length,p:pendingAct()&&pendingAct().key,closed:decideClosed,hidden:document.getElementById('decide').hidden,ph:S.phase,role:R.roles[uid],dead:ctx().dead,inGame:ctx().inGame})));break}
  // 시간 진행: 밤 -> 낮 -> 투표 ...
  const seen=new Set(),chatSnap={};let guard=0;
  while(guard++<9000){
   await page.clock.runFor(4000);
   const st=await page.evaluate(()=>S&&{p:S.phase,d:S.day,dead:S.dead.length,n:CHAT.length});
   if(!st)break;if(process.env.DBG&&guard%25===0)console.log('..',guard,st.p,st.d,'dead',st.dead,'chat',st.n);
   const key=st.p+st.d;
   if(!seen.has(key)){seen.add(key);
    if(key==='vote1'||key==='judge1'){await page.clock.runFor(2600);const d=await page.evaluate(()=>{const c=ctx();return{h:document.getElementById('decide').hidden,alive:c.inGame&&!c.dead&&!(S.phase==='judge'&&S.accused===uid)}});
     if(d.alive){ok(!d.h,vp.name+': '+key+' 선택창이 가운데 표시');await page.screenshot({path:`${shots}/${vp.name}-5b-decide-${key}.png`})}}
    if(['day1','vote1','defense1','judge1','night2','day2'].includes(key)){await page.clock.runFor(1200);await page.screenshot({path:`${shots}/${vp.name}-5-${key}.png`})}}
   if(st.p==='day'&&!chatSnap[st.d]){const el=await page.evaluate(()=>S.endsAt-Date.now());if(el<DAYLEFT()){chatSnap[st.d]=1;await page.screenshot({path:`${shots}/${vp.name}-6-chat-day${st.d}.png`})}}
   if(st.p==='over')break}
  function DAYLEFT(){return 120000}
  const fin=await page.evaluate(()=>({phase:S.phase,w:S.winner,msgs:CHAT.length,bots:CHAT.filter(m=>m.uid.startsWith('bot_')).length,mafia:CHAT.filter(m=>m.ch==='mafia').length,dead:CHAT.filter(m=>m.ch==='dead').length}));
  ok(fin.phase==='over',vp.name+': 게임 종료까지 진행 -> '+JSON.stringify(fin));
  ok(fin.bots>=10,vp.name+': AI가 대화에 참여 ('+fin.bots+'줄)');
  await page.clock.runFor(4000);await page.screenshot({path:`${shots}/${vp.name}-7-over.png`});
  // 사망자 시점 채팅 검사
  const view=await page.evaluate(()=>{
   const ids=S.order.filter(i=>i!==uid);S.phase='day';S.winner=null;
   S.dead=S.dead.filter(i=>i!==uid);CHAT=[{id:9001,uid:ids[0],ch:'day',text:'생존자말',t:1},{id:9002,uid:ids[1],ch:'dead',text:'유령말',t:2},{id:9003,uid:ids[2],ch:'mafia',text:'밀담',t:3}];
   lastChatSig='';const out={};
   out.aliveSees=CHAT.filter(visible).map(m=>m.text);
   S.dead=[...S.dead,uid];lastChatSig='';draw();
   out.deadSees=CHAT.filter(visible).map(m=>m.text);
   out.cls=document.getElementById('chatlog').className;
   out.ch=myChannel();out.isMafia=R.roles[uid]==='mafia';
   const day=document.querySelector('#chatlog .msg.day'),gh=document.querySelector('#chatlog .msg.dead');
   out.dayW=day&&getComputedStyle(day).fontWeight;out.ghostColor=gh&&getComputedStyle(gh).color;out.dayColor=day&&getComputedStyle(day).color;
   return out});
  ok(view.aliveSees.join()==='생존자말'||view.aliveSees.join()==='생존자말,밀담'||view.aliveSees.includes('생존자말')&&!view.aliveSees.includes('유령말'),vp.name+': 생존자는 사망자 대화를 못 봄 '+view.aliveSees);
  ok(view.deadSees.includes('생존자말')&&view.deadSees.includes('유령말')&&view.deadSees.includes('밀담')===view.isMafia,vp.name+': 사망자는 생존자+사망자 대화를 봄(마피아였다면 팀 밀담만 추가) '+view.deadSees+' mafia='+view.isMafia);
  ok(view.ch==='dead'&&/asdead/.test(view.cls),vp.name+': 사망자 채널과 스타일 클래스');
  ok(+view.dayW>=700,vp.name+': 사망자에게 생존자 대화는 진한 글씨('+view.dayW+')');
  ok(view.ghostColor!==view.dayColor,vp.name+': 사망자 대화는 다른(흐린) 색 '+view.ghostColor+' vs '+view.dayColor);
  await page.screenshot({path:`${shots}/${vp.name}-8-deadview.png`});
  ok(errs.length===0,vp.name+': 콘솔 오류 없음 '+errs.slice(0,3).join(' | '));
  await ctx.close()}
 await br.close();srv.close();
 console.log(fails?`\n${fails}건 실패`:'\n모두 통과');process.exit(fails?1:0)})().catch(e=>{console.error(e);process.exit(1)});
