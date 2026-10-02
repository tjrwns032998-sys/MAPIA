/* 월광 살롱 - 통신 계층: Supabase 연결, 방(코드), 실시간 문서, 채팅, 진행자(엔진) 역할 */
const CFG=window.MAFIA_CONFIG||{};
let sb=null,db=null,uid=null,room=null,chatCh=null,presCh=null,authErr='';
let S=null,R=null,SEC=null,PL={},ACT={},BOTS=[],CHAT=[],online=null,mode='init',chatKey=null,roomErr='';
let seenGid=null,isEng=false,engUntil=0,starting=false,claimN=0,claimSeq=-1,lastAcq=0,eBusy=false,lastSeq=-1,chain=Promise.resolve();
const botMem={};
const isOn=id=>id===uid||online===null||online.has(id);
const phase=()=>S?S.phase:'lobby';
const isBot=id=>!!(S&&S.bots&&S.bots[id])||BOTS.some(b=>b.id===id);
function nm(id){
 if(S&&S.bots&&S.bots[id])return S.bots[id];
 const b=BOTS.find(x=>x.id===id);if(b)return b.name;
 return(PL[id]&&PL[id].nick)||'플레이어'}
function colorOf(id){let h=0;for(const ch of String(id))h=(h*31+ch.charCodeAt(0))%360;return`hsl(${h} 42% 64%)`}
function w(fn){chain=chain.then(fn).catch(e=>{console.error(e)});return chain}

/* ---------- 실시간 문서 저장소 (방마다 분리) ---------- */
const deepMerge=(a,b)=>{const o={...a};for(const k in b){const v=b[k];o[k]=(v&&typeof v==='object'&&!Array.isArray(v)&&a&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))?deepMerge(a[k],v):v}return o};
function makeDb(sb,room){
 const KV=new Map(),DL=new Map(),CL=[],pre0=room+'/';let loaded=false,ch=null;
 const abs=p=>pre0+p,rel=p=>p.slice(pre0.length);
 const par=p=>p.slice(0,p.lastIndexOf('/')),leaf=p=>p.slice(p.lastIndexOf('/')+1);
 const sd=p=>({exists:KV.has(p),id:leaf(p),data:()=>KV.get(p)});
 const sc=pre=>{const docs=[];KV.forEach((v,p)=>{if(par(p)===pre)docs.push({id:leaf(p),data:()=>v})});return{docs}};
 const notify=p=>{if(!loaded)return;(DL.get(p)||[]).slice().forEach(f=>f(sd(p)));CL.slice().forEach(c=>{if(c.pre===par(p))c.fn(sc(c.pre))})};
 const apply=(p,d)=>{if(d==null)KV.delete(p);else KV.set(p,d);notify(p)};
 return{
  async start(){
   ch=sb.channel('kv-'+room).on('postgres_changes',{event:'*',schema:'public',table:'kv',filter:'room=eq.'+room},pl=>{
    if(pl.eventType==='DELETE'){if(pl.old.path&&pl.old.path.startsWith(pre0))apply(rel(pl.old.path),null)}
    else if(pl.new.path&&pl.new.path.startsWith(pre0))apply(rel(pl.new.path),pl.new.data)});
   await new Promise(res=>{const t=setTimeout(res,8000);ch.subscribe(st=>{if(st==='SUBSCRIBED'){clearTimeout(t);res()}})});
   const r=await sb.from('kv').select('path,data').eq('room',room);if(r.error)throw r.error;
   r.data.forEach(x=>KV.set(rel(x.path),x.data));loaded=true;
   DL.forEach((fs,p)=>fs.slice().forEach(f=>f(sd(p))));CL.slice().forEach(c=>c.fn(sc(c.pre)))},
  stop(){if(ch){sb.removeChannel(ch);ch=null}DL.clear();CL.length=0;loaded=false},
  doc(p){const ref={
   async get(){return sd(p)},
   async set(d){const r=await sb.from('kv').upsert({path:abs(p),room,data:d,updated_at:new Date().toISOString()});if(r.error)throw r.error;apply(p,d)},
   async update(d){return ref.set(deepMerge(KV.get(p)||{},d))},
   /* 이미 있으면 실패하는 쓰기. 여러 명이 동시에 시도해도 딱 한 명만 true 를 받는다. */
   async create(d){const r=await sb.from('kv').insert({path:abs(p),room,data:d,updated_at:new Date().toISOString()});
    if(r.error){if(r.error.code==='23505')return false;throw r.error}apply(p,d);return true},
   async acquire(o){const r=await sb.rpc('acquire_lease',{p_path:abs(p),p_ttl:o.ttlMs});if(r.error)throw r.error;return{acquired:!!r.data}},
   onSnapshot(fn){if(!DL.has(p))DL.set(p,[]);DL.get(p).push(fn);if(loaded)fn(sd(p));return()=>{DL.set(p,(DL.get(p)||[]).filter(f=>f!==fn))}}};return ref},
  collection(pre){return{onSnapshot(fn){const c={pre,fn};CL.push(c);if(loaded)fn(sc(pre));return()=>{const i=CL.indexOf(c);if(i>=0)CL.splice(i,1)}}}}}}

/* ---------- 접속 / 방 ---------- */
async function connect(){
 try{
  if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY||/YOUR/.test(CFG.SUPABASE_URL))throw new Error('config.js에 Supabase 주소와 키를 넣어 주세요.');
  sb=supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
  let s=(await sb.auth.getSession()).data.session;
  if(!s){const r=await sb.auth.signInAnonymously();if(r.error)throw r.error;s=r.data.session}
  uid=s.user.id;mode='home';
  sb.rpc('cleanup_old').then(()=>{},()=>{});
 }catch(e){console.error(e);authErr=String(e&&e.message||e);mode='solo'}
 render();
 const code=roomFromHash();if(mode==='home'&&code)joinRoom(code)}
const CODE_RE=/^[A-Z2-9]{4,6}$/;
function roomFromHash(){const c=decodeURIComponent((location.hash||'').slice(1)).toUpperCase();return CODE_RE.test(c)?c:''}
function newCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<5;i++)c+=a[Math.floor(Math.random()*a.length)];return c}
function resetRoomState(){
 S=null;R=null;SEC=null;PL={};ACT={};BOTS=[];CHAT=[];online=null;chatKey=null;seenGid=null;isEng=false;engUntil=0;starting=false;lastSeq=-1;eBusy=false;
 Object.keys(botMem).forEach(k=>delete botMem[k])}
async function joinRoom(code,create){
 code=String(code||'').trim().toUpperCase();roomErr='';
 if(!CODE_RE.test(code)){roomErr='방 코드는 영문 대문자와 숫자 4~6자리예요.';render();return}
 if(room)await leaveRoom(true);
 mode='joining';render();
 try{
  const d=makeDb(sb,code);await d.start();
  const meta=await d.doc('meta').get();
  if(!meta.exists&&!create){d.stop();roomErr=`'${code}' 방을 찾을 수 없어요. 코드를 다시 확인해 주세요.`;mode='home';render();return}
  if(!meta.exists)await d.doc('meta').set({created:Date.now(),host:uid});
  db=d;room=code;resetRoomState();mode='play';
  history.replaceState(null,'','#'+code);
  subscribe();await join();
  presCh=sb.channel('mafia-'+code,{config:{presence:{key:uid}}});
  presCh.on('presence',{event:'sync'},()=>{online=new Set(Object.keys(presCh.presenceState()));render()});
  presCh.subscribe(st=>{if(st==='SUBSCRIBED')presCh.track({uid,t:Date.now()})});
 }catch(e){console.error(e);roomErr='방에 들어가지 못했어요. 잠시 후 다시 시도해 주세요.';mode='home';db=null;room=null}
 render()}
const createRoom=()=>joinRoom(newCode(),true);
async function leaveRoom(silent){
 if(db){db.stop();db=null}
 if(chatCh){sb.removeChannel(chatCh);chatCh=null}
 if(presCh){sb.removeChannel(presCh);presCh=null}
 room=null;resetRoomState();mode='home';
 if(!silent){history.replaceState(null,'',location.pathname+location.search);Snd.mode('lobby');render()}}
addEventListener('hashchange',()=>{const c=roomFromHash();if(mode!=='init'&&mode!=='solo'&&c&&c!==room)joinRoom(c);else if(!c&&room)leaveRoom()});

function subscribe(){
 const er=()=>{};
 db.collection('players').onSnapshot(sn=>{PL={};sn.docs.forEach(d=>{PL[d.id]=d.data()});render()},er);
 db.doc('game/state').onSnapshot(sn=>{const prev=S,nx=sn.exists?sn.data():null;
  if(prev&&nx&&nx.gid===prev.gid&&nx.seq<prev.seq)return; /* 늦게 도착한 옛 상태는 무시 */
  S=nx;onState(prev);render()},er);
 db.doc('game/roles').onSnapshot(sn=>{R=sn.exists?sn.data():null;render()},er);
 db.doc('game/secret').onSnapshot(sn=>{SEC=sn.exists?sn.data():null;render()},er);
 db.collection('actions').onSnapshot(sn=>{ACT={};sn.docs.forEach(d=>{ACT[d.id]=d.data()});render()},er);
 db.doc('lobby/bots').onSnapshot(sn=>{BOTS=sn.exists?(sn.data().list||[]):[];render()},er)}
async function join(){
 const sn=await db.doc('players/'+uid).get();
 if(!sn.exists){let n='';try{n=localStorage.getItem('mafia_nick')||''}catch(e){}await db.doc('players/'+uid).set({nick:n||'손님'+Math.floor(1000+Math.random()*9000),ready:false,t:Date.now()})}}
function onState(prev){
 if(S&&S.gid&&S.gid!==seenGid){seenGid=S.gid;if(PL[uid]&&PL[uid].ready)setReady(false)}
 const key=room+':'+((S&&S.phase!=='lobby'&&S.gid)?S.gid:'lobby');
 if(key!==chatKey&&sb){chatKey=key;chatSubscribe(key)}
 if(typeof fxOnState==='function')fxOnState(prev,S)}

/* ---------- 채팅 ---------- */
function mergeChat(rows){
 const m=new Map(CHAT.map(x=>[x.id,x]));rows.forEach(x=>m.set(x.id,x));
 CHAT=[...m.values()].sort((a,b)=>a.t-b.t||a.id-b.id).slice(-150);render()}
async function chatSubscribe(key){
 if(chatCh){sb.removeChannel(chatCh);chatCh=null}
 CHAT=[];
 chatCh=sb.channel('chat-'+key).on('postgres_changes',{event:'INSERT',schema:'public',table:'chat',filter:'rk=eq.'+key},pl=>{if(chatKey===key)mergeChat([pl.new])}).subscribe();
 const r=await sb.from('chat').select('id,uid,ch,text,t').eq('rk',key).order('t',{ascending:false}).limit(150);
 if(chatKey===key&&r.data)mergeChat(r.data)}
function sendChat(text){
 const ch=myChannel(),t=String(text||'').trim().slice(0,200);
 if(!ch||!t||!chatKey)return false;
 const key=chatKey;
 w(async()=>{const r=await sb.from('chat').insert({rk:key,uid,ch,text:t,t:Date.now()}).select().single();if(r.error)throw r.error;mergeChat([r.data])});
 return true}

/* ---------- 파생 상태 ---------- */
function ctx(){
 const playing=!!S&&S.phase!=='lobby',inGame=playing&&S.order.includes(uid);
 const myRole=inGame&&R&&R.gid===S.gid?R.roles[uid]:null;
 const dead=inGame&&S.dead.includes(uid),alive=playing?aliveOf(S):[];
 return{playing,inGame,myRole,dead,alive}}
function myAct(ph){const a=ACT[uid];return a&&S&&a.gid===S.gid&&a.n===S.day&&a.ph===ph?a:null}
function lobbyHumans(){return Object.keys(PL).filter(isOn)}
/* 보낼 수 있는 채팅 채널: 낮=전체, 밤=마피아끼리, 사망자와 관전자='dead' */
function myChannel(){
 const c=ctx(),ph=phase();
 if(mode!=='play')return null;
 if(!c.playing||ph==='over')return'day';
 if(!c.inGame||c.dead)return'dead';
 if(ph==='night')return c.myRole==='mafia'?'mafia':null;
 if(ph==='day'||ph==='vote')return'day';
 if(ph==='defense')return S.accused===uid?'day':null;
 return null}
/* 볼 수 있는 메시지: 사망자는 생존자 대화와 사망자 대화, 생존자는 사망자 대화를 못 본다. */
function visible(m){
 const c=ctx();
 if(!c.playing||phase()==='over'||m.ch==='day')return true;
 if(m.ch==='mafia')return c.myRole==='mafia';
 if(m.ch==='dead')return !c.inGame||c.dead;
 return false}

/* ---------- 내 상태, 행동 ---------- */
function setMine(p){const cur=PL[uid]||{nick:'',ready:false};PL[uid]={...cur,...p};const v=PL[uid];w(()=>db.doc('players/'+uid).set({nick:v.nick||'',ready:!!v.ready,t:Date.now()}));render()}
const setReady=v=>setMine({ready:v});
function setAct(o){if(!S||!uid||!db)return;const gid=S.gid,n=S.day;w(()=>db.doc('actions/'+uid).set({gid,n,t:Date.now(),target:null,...o}))}

/* ---------- 시작 / 종료 / AI ---------- */
function startGame(){
 if(mode!=='play'||phase()!=='lobby'||starting)return;
 const hs=lobbyHumans(),ids=[...hs,...BOTS.map(b=>b.id)];
 if(ids.length<MIN||ids.length>MAX||!hs.every(id=>PL[id]&&PL[id].ready))return;
 const roles=dealRoles(ids,Math.random),order=shuffle(ids,Math.random),gid='g'+Date.now()+Math.floor(Math.random()*1000),d=dist(ids.length),bots={};
 BOTS.forEach(b=>{bots[b.id]=b.name});
 const seq=(S&&S.seq||0)+1,now=Date.now();starting=true;
 /* 여러 명이 동시에 시작을 눌러도 이번 차례(seq)의 시작권은 한 명만 얻는다. 못 얻은 사람은 아무것도 쓰지 않는다. */
 w(async()=>{
  try{
   if(claimSeq!==seq){claimSeq=seq;claimN=0}
   const won=await db.doc('game/start_'+seq+(claimN?'_'+claimN:'')).create({by:uid,gid,t:now});
   if(!won){ /* 다른 사람이 시작 중. 5초 안에 게임이 안 열리면 다음 시도는 새 시작권을 쓴다. */
    setTimeout(()=>{if(phase()==='lobby'&&(S&&S.seq||0)+1===seq)claimN++},5000);return}
   await db.doc('game/roles').set({gid,roles});
   await db.doc('game/secret').set({gid,inv:{}});
   await db.doc('game/state').set({seq,gid,phase:'night',day:1,endsAt:now+NIGHT_MS,dur:NIGHT_MS,order,bots,dead:[],accused:null,winner:null,log:[{n:0,k:'start',m:d.mafia,c:d.citizen}]})
  }finally{starting=false}})}
function backToLobby(){
 if(mode!=='play')return;const seq=(S&&S.seq||0)+1;
 w(()=>db.doc('game/state').set({seq,gid:S?S.gid:'',phase:'lobby',day:0,endsAt:0,dur:0,order:[],bots:{},dead:[],accused:null,winner:null,log:[]}))}
const BNAMES=['말론','루시아','빈센트','카밀라','엔조','로사','가브리','미아','루카','소피아','토니','엘레나','마르코','지나','레오','클라라','다니엘','비비안','사무엘','아델'];
function addBot(n){
 if(mode!=='play'||phase()!=='lobby')return;
 const list=[...BOTS];let left=Math.min(n||1,MAX-lobbyHumans().length-list.length);
 while(left-->0){
  const used=new Set(list.map(b=>b.name)),name=BNAMES.find(x=>!used.has(x))||('AI'+(list.length+1));
  let i=1;while(list.some(b=>b.id==='bot_'+i))i++;list.push({id:'bot_'+i,name})}
 BOTS=list;w(()=>db.doc('lobby/bots').set({list}));render()}
function rmBot(all){
 if(mode!=='play'||phase()!=='lobby'||!BOTS.length)return;
 const list=all?[]:BOTS.slice(0,-1);BOTS=list;w(()=>db.doc('lobby/bots').set({list}));render()}

/* ---------- 진행자: 임대를 잡은 접속자의 브라우저가 규칙과 AI를 돌린다 ---------- */
function namesMap(){const o={};if(S)S.order.forEach(id=>{o[id]=nm(id)});return o}
async function runEngine(){
 if(eBusy||!R||!S||R.gid!==S.gid||S.seq<=lastSeq)return;
 const s=S,now=Date.now(),ai=makeAi(s,R.roles,SEC,CHAT,namesMap(),now,botMem);
 const out=stepEngine(s,R.roles,ACT,now,isOn,Math.random,ai);
 if(!out)return;
 eBusy=true;lastSeq=s.seq;
 try{
  if(out.inv){const cur=(SEC&&SEC.gid===s.gid&&SEC.inv&&SEC.inv[out.inv.police])||[];
   await db.doc('game/secret').update({inv:{[out.inv.police]:[...cur,{n:out.inv.n,target:out.inv.target,mafia:out.inv.mafia}]}})}
  if(S.seq===s.seq)await db.doc('game/state').set({...s,...out.patch,seq:s.seq+1});else lastSeq=-1;
 }catch(e){lastSeq=-1}
 eBusy=false}
async function runBots(){
 if(!R||!S||R.gid!==S.gid||!chatKey||!chatKey.endsWith(S.gid))return;
 const now=Date.now(),ai=makeAi(S,R.roles,SEC,CHAT,namesMap(),now,botMem);
 const msgs=botPlan(S,R.roles,SEC,CHAT,namesMap(),now,Math.random,botMem,ai);
 if(!msgs.length)return;
 const key=chatKey,rows=msgs.map((m,i)=>({rk:key,uid:m.uid,ch:m.ch,text:m.text,t:now+i}));
 const r=await sb.from('chat').insert(rows).select();if(r.data)mergeChat(r.data)}
setInterval(async()=>{
 if(!db||!uid||mode!=='play'||!S||S.phase==='lobby'||S.phase==='over'){isEng=false;return}
 const now=Date.now();
 if(now-lastAcq>3500){lastAcq=now;try{const r=await db.doc('game/engine').acquire({holder:uid,ttlMs:12000});isEng=!!r.acquired;engUntil=isEng?now+8000:0}catch(e){isEng=false}}
 if(isEng&&Date.now()<engUntil){runEngine();w(runBots)}},1000);
