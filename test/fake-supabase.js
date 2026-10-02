/* 브라우저 테스트용 가짜 Supabase (메모리 안에서만 동작). 실제 서비스에는 쓰이지 않는다. */
(function(){
 const tables={kv:new Map(),chat:[]};let chatId=1;const listeners=[];
 const uidOf=window.__TEST_UID||'u_test1';
 const emit=(table,ev,row,old)=>listeners.slice().forEach(l=>{
  if(l.table!==table)return;
  if(l.filter){const m=/^(\w+)=eq\.(.*)$/.exec(l.filter);if(m&&String(row[m[1]])!==m[2])return}
  setTimeout(()=>l.cb({eventType:ev,new:row,old:old||{}}),0)});
 function builder(table){
  const q={cols:null,f:[],ord:null,lim:null,single:false,maybe:false,op:'select',rows:null};
  const run=()=>{
   if(q.op==='upsert'){const r=q.rows;const had=tables.kv.has(r.path);tables.kv.set(r.path,{...r});emit('kv',had?'UPDATE':'INSERT',{...r});return{data:null,error:null}}
   if(q.op==='insert'&&table==='kv'){const r=q.rows[0];if(tables.kv.has(r.path))return{data:null,error:{code:'23505',message:'duplicate'}};tables.kv.set(r.path,{...r});emit('kv','INSERT',{...r});return{data:null,error:null}}
   if(q.op==='insert'){
    const out=q.rows.map(r=>{const row={id:chatId++,...r};tables.chat.push(row);emit('chat','INSERT',row);return row});
    return{data:q.single?out[0]:out,error:null}}
   let rows=table==='kv'?[...tables.kv.values()]:[...tables.chat];
   q.f.forEach(([c,v])=>{rows=rows.filter(r=>String(r[c])===String(v))});
   if(q.ord)rows.sort((a,b)=>(a[q.ord[0]]-b[q.ord[0]])*(q.ord[1]?1:-1));
   if(q.lim)rows=rows.slice(0,q.lim);
   if(q.single)return{data:rows[0]||null,error:null};
   return{data:rows,error:null}};
  const api={
   select(){if(q.op==='select'||q.op==='insert')q.cols=1;return api},
   eq(c,v){q.f.push([c,v]);return api},
   order(c,o){q.ord=[c,!!(o&&o.ascending)];return api},
   limit(n){q.lim=n;return api},
   single(){q.single=true;return api},
   maybeSingle(){q.single=true;return api},
   upsert(r){q.op='upsert';q.rows=r;return api},
   insert(r){q.op='insert';q.rows=Array.isArray(r)?r:[r];q.single=false;return api},
   then(res,rej){return Promise.resolve().then(run).then(res,rej)}};
  return api}
 const channels=new Set();
 function channel(name,opts){
  const key=opts&&opts.config&&opts.config.presence&&opts.config.presence.key;
  const ch={name,pres:[],mine:null,
   on(type,o,cb){if(type==='postgres_changes')listeners.push({table:o.table,filter:o.filter,cb,ch});else if(type==='presence')ch.pres.push(cb);return ch},
   subscribe(cb){setTimeout(()=>{if(cb)cb('SUBSCRIBED');ch.pres.forEach(f=>f())},0);return ch},
   presenceState(){return key?{[key]:[{}]}:{}},
   track(){return Promise.resolve()}};
  channels.add(ch);return ch}
 const client={
  auth:{getSession:async()=>({data:{session:null}}),signInAnonymously:async()=>({data:{session:{user:{id:uidOf}}},error:null})},
  from:builder,channel,
  removeChannel(ch){for(let i=listeners.length-1;i>=0;i--)if(listeners[i].ch===ch)listeners.splice(i,1);channels.delete(ch)},
  rpc(name){return Promise.resolve({data:name==='acquire_lease'?true:null,error:null})}};
 window.supabase={createClient:()=>client};
 window.__fakeDb=tables;
})();
