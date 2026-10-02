/* 월광 살롱 - 배경음악과 효과음 (외부 파일 없이 웹 오디오로 즉석 연주) */
const Snd=(()=>{
 let ac=null,master,send,noiseBuf,mode='lobby',outcome='mafia',on=true,vol=.55,timer=null,nextT=0,beat=0,started=false;
 const BPM={lobby:52,night:58,day:70,tense:92,over:48};
 const hz=m=>440*Math.pow(2,(m-69)/12);
 const AM=[57,60,64,67,59,62],PENT=[69,72,74,76,79,81];
 function init(){
  if(ac)return true;
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
  ac=new C();master=ac.createGain();master.gain.value=on?vol:0;
  const comp=ac.createDynamicsCompressor();master.connect(comp);comp.connect(ac.destination);
  const d=ac.createDelay(1);d.delayTime.value=.41;const fb=ac.createGain();fb.gain.value=.42;
  const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1700;
  d.connect(lp);lp.connect(fb);fb.connect(d);const wet=ac.createGain();wet.gain.value=.55;lp.connect(wet);wet.connect(master);
  send=ac.createGain();send.gain.value=.5;send.connect(d);
  noiseBuf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);
  const ch=noiseBuf.getChannelData(0);for(let i=0;i<ch.length;i++)ch[i]=Math.random()*2-1;
  return true}
 /* 한 음: 오실레이터 + 엔벨로프 + (선택) 로우패스 */
 function note(f,t,dur,o={}){
  const osc=ac.createOscillator(),g=ac.createGain();osc.type=o.type||'sine';osc.frequency.setValueAtTime(f,t);
  if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t+dur);
  if(o.detune)osc.detune.value=o.detune;
  const a=o.a||.01,v=o.v||.1;
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  let out=osc;if(o.lp){const fl=ac.createBiquadFilter();fl.type='lowpass';fl.frequency.value=o.lp;osc.connect(fl);out=fl}
  out.connect(g);g.connect(master);if(o.wet!==0){const w=ac.createGain();w.gain.value=o.wet||.4;g.connect(w);w.connect(send)}
  osc.start(t);osc.stop(t+dur+.05)}
 function noise(t,dur,v,freq,type){
  const s=ac.createBufferSource();s.buffer=noiseBuf;const f=ac.createBiquadFilter();f.type=type||'bandpass';f.frequency.value=freq||1200;
  const g=ac.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random());s.stop(t+dur+.05)}
 const pad=(t,dur,midis,v)=>midis.forEach((m,i)=>{
  note(hz(m),t,dur,{type:'sawtooth',v:v||.025,a:dur*.4,lp:700,detune:i%2?7:-7,wet:.3});
  note(hz(m)/2,t,dur,{type:'sine',v:(v||.025)*1.2,a:dur*.35,wet:.1})});
 const heart=(t,v)=>{note(70,t,.22,{type:'sine',to:38,v:v||.32,a:.005,wet:0});note(68,t+.19,.2,{type:'sine',to:36,v:(v||.32)*.7,a:.005,wet:0})};
 /* 한 박자 연주 */
 function play(b,t,spb){
  const m=mode;
  if(m==='lobby'){
   if(b%8===0)pad(t,spb*8,[57,60,64]);
   if(b%2===1&&Math.random()<.45)note(hz(PENT[Math.floor(Math.random()*PENT.length)]),t,2.4,{type:'triangle',v:.05,a:.02,wet:.7})}
  else if(m==='night'){
   if(b%8===0)pad(t,spb*8,[50,53,57],.03);
   if(b%2===0)heart(t,.28);
   if(b%4===3&&Math.random()<.6)note(hz(PENT[Math.floor(Math.random()*PENT.length)]-12+(Math.random()<.25?1:0)),t,3,{type:'sine',v:.04,a:.4,wet:.8});
   if(b%16===9)noise(t,2.5,.03,300,'lowpass')}
  else if(m==='day'){
   if(b%8===0)pad(t,spb*8,[57,60,64],.03);
   const bass=[45,45,48,43,45,45,47,40];
   if(b%2===0)note(hz(bass[(b/2)%8]),t,spb*1.8,{type:'sawtooth',v:.07,a:.03,lp:520,wet:.15});
   noise(t,.03,.035,4200,'highpass');
   if(b%8===5)note(hz(AM[(b>>3)%AM.length]+12),t,2,{type:'triangle',v:.04,a:.1,wet:.6})}
  else if(m==='tense'){
   if(b%4===0)pad(t,spb*4,[57,60,63],.034);
   heart(t,.36);
   for(let k=0;k<2;k++)note(hz(AM[(b*2+k)%4]+12),t+k*spb/2,spb*.45,{type:'sawtooth',v:.035,a:.005,lp:1400+(b%8)*150,wet:.25});
   if(b%8===7){noise(t,spb*1.2,.07,2000+b*40,'bandpass')}}
  else if(m==='over'){
   if(b%8===0){const chord=outcome==='citizen'?[57,61,64,69]:[57,60,63,66];pad(t,spb*8,chord,.04)}
   if(b%4===2)note(hz(PENT[(b>>2)%PENT.length]),t,3,{type:'triangle',v:.045,a:.02,wet:.8})}}
 function tick(){
  if(!ac||!on)return;
  const spb=60/BPM[mode];
  while(nextT<ac.currentTime+.7){play(beat,Math.max(nextT,ac.currentTime+.02),spb);beat++;nextT+=spb}}
 function ensure(){
  if(!init())return false;
  if(ac.state==='suspended')ac.resume();
  if(!timer){nextT=ac.currentTime+.1;timer=setInterval(tick,150)}
  started=true;return true}
 return{
  start(){ensure()},
  mode(m,o){if(o)outcome=o;if(m===mode)return;mode=m;beat=0;if(ac)nextT=ac.currentTime+.2},
  toggle(){on=!on;if(!ac){if(on)ensure();return on}master.gain.setTargetAtTime(on?vol:0,ac.currentTime,.15);if(on)ensure();return on},
  isOn:()=>on,
  /* 장난감 소리: 펜타토닉 음계라 아무렇게나 눌러도 듣기 좋다 */
  plink(i,big){if(!ac||!on)return;const t=ac.currentTime+.005,m=PENT[((i%6)+6)%6]+(Math.floor(i/6)%2?12:0);
   note(hz(m),t,big?1.6:.9,{type:'triangle',v:big?.09:.06,a:.003,wet:.6});if(big)[0,4,7].forEach((d,k)=>note(hz(m-12+d),t+k*.05,1.8,{type:'sine',v:.05,a:.01,wet:.7}))},
  volume(v){vol=v;if(ac&&on)master.gain.setTargetAtTime(v,ac.currentTime,.1)},
  /* 효과음 */
  sfx(name){
   if(!ac||!on)return;const t=ac.currentTime+.01;
   if(name==='bell'){[1,2.76,5.4].forEach((r,i)=>note(220*r,t,2.2/(i+1),{type:'sine',v:.14/(i+1),a:.003,wet:.6}))}
   else if(name==='night'){note(hz(45),t,2.8,{type:'sine',v:.2,a:.6,wet:.4});noise(t,2.4,.05,400,'lowpass');note(hz(81),t+.2,2.5,{type:'sine',v:.05,a:.3,wet:.8})}
   else if(name==='dawn'){[69,73,76,81].forEach((m,i)=>note(hz(m),t+i*.22,2.2,{type:'triangle',v:.07,a:.01,wet:.6}))}
   else if(name==='death'){note(90,t,.9,{type:'sine',to:30,v:.5,a:.005,wet:.2});noise(t,.5,.25,200,'lowpass');note(hz(46),t+.1,2.5,{type:'sawtooth',v:.07,a:.05,lp:300,wet:.5});note(hz(47),t+.1,2.5,{type:'sawtooth',v:.06,a:.05,lp:300,wet:.5})}
   else if(name==='gavel'){noise(t,.1,.4,1800);note(160,t,.3,{type:'sine',to:60,v:.45,a:.002,wet:.1});noise(t+.28,.1,.35,1800);note(150,t+.28,.35,{type:'sine',to:55,v:.4,a:.002,wet:.1})}
   else if(name==='spare'){[72,76,79].forEach((m,i)=>note(hz(m),t+i*.12,1.6,{type:'triangle',v:.08,a:.01,wet:.6}))}
   else if(name==='spot'){note(hz(40),t,1.6,{type:'sawtooth',v:.08,a:.8,lp:400,wet:.4});noise(t,1.4,.04,3000)}
   else if(name==='reveal'){note(300,t,.9,{type:'sine',to:900,v:.05,a:.4,wet:.6});note(hz(69),t+.8,2,{type:'triangle',v:.08,a:.01,wet:.7})}
   else if(name==='win'){[57,61,64,69,73,76].forEach((m,i)=>note(hz(m),t+i*.13,2.4,{type:'triangle',v:.08,a:.01,wet:.6}))}
   else if(name==='lose'){[69,66,63,57].forEach((m,i)=>note(hz(m),t+i*.3,2.6,{type:'sawtooth',v:.05,a:.02,lp:900,wet:.6}))}
   else if(name==='click'){note(880,t,.08,{type:'sine',v:.04,a:.002,wet:0})}}}})();
