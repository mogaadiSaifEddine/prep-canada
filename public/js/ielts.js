// IELTS General Training coach (module). Prompts live on the server; this file drives the UI.
export function createIELTS(ctx){
"use strict";
const EXAM='ielts';
let ACTIVE=false;
/* ---------- constants ---------- */
const SK={L:'Listening',R:'Reading',W:'Writing',S:'Speaking'};
const ORDER=['L','R','W','S'];
const TARGETS={7:{L:6,R:6,W:6,S:6},8:{L:7.5,R:6.5,W:6.5,S:6.5},9:{L:8,R:7,W:7,S:7},10:{L:8.5,R:8,W:7.5,S:7.5}};
let TARGET=TARGETS[9],STRETCH=TARGETS[10];
const CLBT=()=>S.profile.clbTarget||9;
function setTargets(){TARGET=TARGETS[CLBT()]||TARGETS[9];STRETCH=TARGETS[Math.min(10,CLBT()+1)]}
const SKCOL={L:'var(--cL)',R:'var(--cR)',W:'var(--cW)',S:'var(--cS)',G:'var(--muted)',V:'var(--muted)'};
const SEC={
  L:{mins:32,note:'4 parts · 40 questions · 30 min listening + 2 min to check answers (computer-delivered format)'},
  R:{mins:60,note:'3 sections · 40 questions · 60 min, no extra transfer time'},
  W:{mins:60,note:'Task 1 letter (150+ words, about 20 min) · Task 2 essay (250+ words, about 40 min)'},
  S:{mins:14,note:'Part 1 interview 4–5 min · Part 2 long turn (1 min prep, up to 2 min talk) · Part 3 discussion 4–5 min'}
};
const RSEC=[
  {start:1,count:14,desc:'Section 1: two or three short everyday texts (notices, adverts, timetables, leaflets), about 550–650 words in total'},
  {start:15,count:13,desc:'Section 2: two workplace texts (job descriptions, staff policies, training material, contracts), about 600–700 words in total'},
  {start:28,count:13,desc:'Section 3: one long general-interest text of 850–950 words with paragraphs labelled A to G'}
];
const LPART=[
  {start:1,desc:'Part 1: a conversation between two people in an everyday social context (a booking, enquiry or registration)',words:650},
  {start:11,desc:'Part 2: a monologue in an everyday social context (a guide or officer describing a local facility, service or event)',words:700},
  {start:21,desc:'Part 3: a conversation between two to four people in an educational or training context (students and a tutor discussing an assignment)',words:750},
  {start:31,desc:'Part 4: a lecture-style monologue on an academic subject',words:800}
];
const DIFF={
  foundation:{label:'Foundation',text:'the accessible end of real IELTS difficulty: clear texts, fewer traps, aimed at moving a candidate from band 5.5 to 6.5'},
  exam:{label:'Exam standard',text:'exactly real IELTS exam difficulty, as in Cambridge IELTS 17–19'},
  advanced:{label:'Advanced',text:'the upper end of real IELTS difficulty: dense texts, subtle paraphrase, strong distractors and tricky NOT GIVEN items, aimed at pushing a candidate from 7.5 to 8.5+'}
};
const TYPE_NAMES={tfng:'True / False / Not Given',ynng:'Yes / No / Not Given',mcq:'Multiple choice',matching:'Matching',headings:'Matching headings',completion:'Completion',short:'Short answer'};
const L_TABLE=[[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[2,2],[0,1]];
const R_TABLE=[[39,9],[37,8.5],[36,8],[34,7.5],[32,7],[30,6.5],[27,6],[23,5.5],[19,5],[15,4.5],[12,4],[9,3.5],[6,3],[4,2.5],[2,2],[0,1]];
const CLB={
  L:[[8.5,10],[8,9],[7.5,8],[6,7],[5.5,6],[5,5],[4.5,4]],
  R:[[8,10],[7,9],[6.5,8],[6,7],[5,6],[4,5],[3.5,4]],
  W:[[7.5,10],[7,9],[6.5,8],[6,7],[5.5,6],[5,5],[4,4]],
  S:[[7.5,10],[7,9],[6.5,8],[6,7],[5.5,6],[5,5],[4,4]]
};
const DEFAULT_PROFILE=()=>({v:1,setupDone:false,clbTarget:9,examDate:'',about:'',studyTime:'1 hour a day',bands:{L:null,R:null,W:null,S:null},bandNote:{},placementDone:false,qtypeStats:{},usedTopics:[],history:[],activeAttemptId:null,errorPatterns:[]});

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const toArr=a=>Array.isArray(a)?a:(a==null||a===''?[]:[a]);
const norm=s=>String(s??'').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/^[\s"'(]+|[\s.,;:!?"')]+$/g,'').trim();
const words=s=>(String(s||'').trim().match(/\S+/g)||[]).length;
const fmtBand=b=>b==null?'–':Number(b).toFixed(1);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toISOString().slice(0,10);
function roundBand(x){const f=Math.floor(x),r=x-f;return r<0.25?f:(r<0.75?f+0.5:f+1)}
function bandFrom(k,raw40){const t=k==='L'?L_TABLE:R_TABLE;for(const[min,b]of t)if(raw40>=min)return b;return 1}
function clbOf(k,b){if(b==null)return null;for(const[min,c]of CLB[k])if(b>=min)return c;return b>=3?'<4':null}
function stripLetter(c,L){return String(c).replace(new RegExp('^\\(?'+L+'[\\).:\\s-]+'),'').trim()}
function fmtTime(ms){ms=Math.max(0,ms);const s=Math.round(ms/1000);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function daysLeft(){if(!S.profile.examDate)return null;const d=new Date(S.profile.examDate+'T09:00:00');return Math.max(0,Math.ceil((d-new Date())/86400000))}
const toast=ctx.toast;
const errCopy=ctx.errCopy;

/* ---------- storage ---------- */
const Store={
  get:(key)=>ctx.getDoc(EXAM,key),
  set:(key,val)=>ctx.putDoc(EXAM,key,val),
  getAttempt:(id)=>ctx.getDoc(EXAM,'attempt_'+id),
  saveAttempt:(a)=>ctx.putDoc(EXAM,'attempt_'+a.id,a),
  getLesson:(id)=>ctx.getDoc(EXAM,'lesson_'+id),
  setLesson:(id,v)=>ctx.putDoc(EXAM,'lesson_'+id,v)
};
const chains={};
function serial(key,fn){const p=(chains[key]||Promise.resolve()).then(fn,fn);chains[key]=p.catch(()=>{});return p}
function saveProfile(){return serial('profile',()=>Store.set('profile',S.profile).catch(()=>toast('Progress could not be saved. Check your connection.')))}
function saveCourse(){return serial('course',()=>Store.set('course',S.course).catch(()=>toast('Course could not be saved.')))}
function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}
function saveRunNow(run){return serial('a'+run.id,()=>Store.saveAttempt(run))}
let saveT=null;
function scheduleSave(){clearTimeout(saveT);saveT=setTimeout(()=>saveRun(S.run),8000)}

/* ---------- AI (server) ---------- */
const SAMPLE=true;
const ai=(task,params)=>ctx.ai(EXAM,task,params);
function weakTypes(skill){
  const st=S.profile.qtypeStats||{};const out=[];
  for(const key in st){const[k,t]=key.split(':');if(skill&&k!==skill)continue;const v=st[key];if(v.t>=3)out.push({skill:k,type:t,pct:Math.round(100*v.c/v.t),t:v.t})}
  return out.sort((a,b)=>a.pct-b.pct).slice(0,4);
}
function diffFor(run,k){return run.kind==='placement'?'exam':(run.diff==='auto'?autoDiff(k):run.diff)}
function autoDiff(k){const b=S.profile.bands[k];if(b==null)return'exam';if(b<6)return'foundation';if(b>=7.5)return'advanced';return'exam'}

function fixGroups(groups,start){
  let n=start;const out=[];
  for(const g of toArr(groups)){
    if(!g||!Array.isArray(g.questions))continue;
    const type=TYPE_NAMES[g.type]?g.type:'short';
    const qs=g.questions.map(q=>({n:n++,prompt:String(q.prompt||''),choices:Array.isArray(q.choices)?q.choices.map(String):undefined,answer:toArr(q.answer).map(String),evidence:String(q.evidence||''),explain:String(q.explain||'')}));
    const opts=Array.isArray(g.options)?g.options.map((o,i)=>typeof o==='string'?{label:String.fromCharCode(65+i),text:o}:{label:String(o.label??String.fromCharCode(65+i)),text:String(o.text??'')}):undefined;
    out.push({type,instructions:String(g.instructions||''),options:opts,questions:qs});
  }
  return out;
}
function fixContent(j,data){
  if(!data||typeof data!=='object')throw{code:'invalid_json'};
  if(j.k==='R'){const groups=fixGroups(data.groups,RSEC[j.i].start);if(!groups.length||!Array.isArray(data.texts))throw{code:'invalid_json'};return{_pool:data._pool,title:String(data.title||'Reading'),texts:data.texts.map(t=>({label:String(t.label||''),heading:String(t.heading||''),body:String(t.body||'')})),groups}}
  if(j.k==='L'){const groups=fixGroups(data.groups,LPART[j.i].start);if(!groups.length||!Array.isArray(data.script))throw{code:'invalid_json'};return{_pool:data._pool,title:String(data.title||'Listening'),context:String(data.context||''),speakers:toArr(data.speakers),script:data.script.map(l=>({speaker:String(l.speaker||''),text:String(l.text||'')})).filter(l=>l.text),groups}}
  if(j.k==='W'){if(!data.task1||!data.task2)throw{code:'invalid_json'};return data}
  if(j.k==='S'){if(!Array.isArray(data.part1)||!data.part2||!Array.isArray(data.part3))throw{code:'invalid_json'};return data}
}

/* ---------- state ---------- */
const S={view:'home',profile:DEFAULT_PROFILE(),course:null,run:null,gen:{},timer:null,reportId:null,lessonUnit:null,lesson:null,ready:false,dbOk:false,resumeInfo:null};

/* ---------- generation queue ---------- */
function jobsFor(run){
  const jobs=[];
  for(const k of run.sections){
    const n=k==='L'?4:k==='R'?3:1;
    for(let i=0;i<n;i++)if(!(run.content[k]&&run.content[k][i]))jobs.push({k,i});
  }
  return jobs;
}
function jobCount(k){return k==='L'?4:k==='R'?3:1}
function sectionReady(run,k){for(let i=0;i<jobCount(k);i++)if(!(run.content[k]&&run.content[k][i]))return false;return true}
async function generateAll(run){
  const jobs=jobsFor(run).filter(j=>S.gen[j.k+j.i]!=='busy');
  let idx=0;
  const worker=async()=>{while(idx<jobs.length){const j=jobs[idx++];await genJob(run,j)}};
  await Promise.all([worker(),worker(),worker()]);
}
async function genJob(run,j){
  const key=j.k+j.i;S.gen[key]='busy';refreshPrep();
  try{
    const data=await ai('gen',{attemptId:run.id,k:j.k,i:j.i});
    if(S.run!==run)return;
    run.content[j.k]=run.content[j.k]||{};
    run.content[j.k][j.i]=fixContent(j,data);
    S.gen[key]='ok';saveRun(run);
  }catch(e){S.gen[key]={err:errCopy(e)}}
  refreshPrep();
}
function refreshPrep(){if(S.view==='intro')render();else if(S.view==='section'&&S.run&&(S.sec==='L'||S.sec==='R')&&S.run.content[S.sec]&&S.run.content[S.sec][S.tab]&&document.getElementById('waitpart'))render()}

/* ---------- runs ---------- */
function newRun(kind,sections,diff,label,unitId){
  return{id:'a'+uid(),kind,sections,diff:diff||'exam',label,unitId:unitId||null,startedAt:Date.now(),date:today(),content:{},answers:{L:{},R:{},W:{t1:'',t2:''},S:{}},state:{},results:{},status:'active'};
}
async function startRun(run){
  if(S.starting)return;S.starting=true;
  try{const r=await ctx.api('POST','/api/attempts/start',{exam:EXAM,kind:run.unitId?'checkpoint':run.kind,sections:run.sections,diff:run.diff});run.id=r.id}
  catch(e){S.starting=false;ctx.handleError(e);return}
  S.starting=false;
  S.run=run;S.gen={};S.profile.activeAttemptId=run.id;saveProfile();saveRun(run);
  S.view='intro';render();generateAll(run);
}
function nextSection(run){return run.sections.find(k=>!run.results[k])}
function goIntro(){S.view='intro';stopTimer();stopSpeech();render();window.scrollTo(0,0)}
function startSection(k){
  const run=S.run;
  if(k==='S'){run.state.S=run.state.S||{pos:0,partDeadline:null,started:Date.now()}}
  else run.state[k]={deadline:Date.now()+SEC[k].mins*60000,started:Date.now()};
  if(k==='L')run.state.L.played={};
  saveRun(run);openSection(k);
}
function openSection(k){
  S.view='section';S.sec=k;S.tab=0;render();window.scrollTo(0,0);startTimer();
  if(k==='S')enterSpeakStep();
}
function startTimer(){
  stopTimer();
  S.timer=setInterval(()=>{
    const run=S.run;if(!run||S.view!=='section')return;
    const k=S.sec;
    if(k==='S'){speakTick();return}
    const left=run.state[k].deadline-Date.now();
    const el=$('#timer');if(el){el.textContent=fmtTime(left);el.classList.toggle('low',left<5*60000)}
    if(left<=0){stopTimer();submitSection(k,true)}
  },1000);
}
function stopTimer(){if(S.timer){clearInterval(S.timer);S.timer=null}}
async function submitSection(k,auto){
  const run=S.run;stopTimer();stopSpeech();
  if(auto)toast('Time is up. Your answers were submitted.');
  if(k==='L'||k==='R'){
    const units=[];for(let i=0;i<jobCount(k);i++)units.push(run.content[k][i]);
    run.results[k]=autoMark(run,k,units);
    saveRun(run);afterSection();
  }else{
    run.state[k].submitted=true;saveRun(run);
    await markProduction(k);
  }
}
async function markProduction(k){
  const run=S.run;
  S.view='marking';S.markErr=null;render();
  try{
    const res=k==='W'?await markWriting(run):await markSpeaking(run);
    run.results[k]=res;saveRun(run);afterSection();
  }catch(e){S.markErr=errCopy(e);render()}
}
function afterSection(){
  const run=S.run;
  if(nextSection(run)){goIntro();return}
  finishRun(run);
}
function finishRun(run){
  run.status='done';run.finishedAt=Date.now();
  const p=S.profile;const bands={};
  for(const k of run.sections){const r=run.results[k];if(r&&r.band!=null){bands[k]=r.band;p.bands[k]=r.band;if(p.bandNote)delete p.bandNote[k]}}
  const all=ORDER.every(k=>bands[k]!=null);
  run.overall=all?roundBand(ORDER.reduce((a,k)=>a+bands[k],0)/4):null;
  for(const k of ['L','R']){const r=run.results[k];if(!r)continue;for(const t in r.per){const key=k+':'+t;const s=p.qtypeStats[key]||(p.qtypeStats[key]={c:0,t:0});s.c+=r.per[t].c;s.t+=r.per[t].t}}
  const pats=[];for(const k of ['W','S']){const r=run.results[k];if(r&&Array.isArray(r.patterns))pats.push(...r.patterns.map(String))}
  if(pats.length)p.errorPatterns=[...new Set([...pats,...p.errorPatterns])].slice(0,10);
  const topics=[];for(const k of run.sections){const c=run.content[k]||{};for(const i in c){const x=c[i];if(!x)continue;if(x.title)topics.push(x.title);if(x.task2&&x.task2.topic)topics.push(x.task2.topic);if(x.part2&&x.part2.topic)topics.push(x.part2.topic)}}
  p.usedTopics=[...(p.usedTopics||[]),...topics].slice(-40);
  p.history=[...(p.history||[]),{id:run.id,date:run.date,kind:run.kind,label:run.label,bands,overall:run.overall}].slice(-60);
  if(run.kind==='placement')p.placementDone=true;
  p.activeAttemptId=null;
  if(run.unitId&&S.course){S.course.progress=S.course.progress||{};S.course.progress[run.unitId]={done:true,score:null,band:Object.values(bands)[0]??null};saveCourse()}
  saveProfile();saveRun(run);
  S.reportRun=run;S.run=null;S.view='report';render();window.scrollTo(0,0);
}
function autoMark(run,k,units){
  const items=[];const per={};const ans=run.answers[k]||{};
  units.forEach(u=>(u?u.groups:[]).forEach(g=>g.questions.forEach(q=>{
    const given=ans[q.n]||'';const acc=q.answer;const ok=isRight(g.type,given,acc);
    items.push({n:q.n,type:g.type,prompt:q.prompt,choices:q.choices||null,options:g.options||null,given,correct:acc[0]??'',alts:acc.slice(1),ok,evidence:q.evidence,explain:q.explain});
    const t=per[g.type]||(per[g.type]={c:0,t:0});t.t++;if(ok)t.c++;
  })));
  items.sort((a,b)=>a.n-b.n);
  const raw=items.filter(i=>i.ok).length,total=items.length;
  const scaled=Math.round(raw*40/Math.max(total,1));
  return{raw,total,band:bandFrom(k,scaled),per,items};
}
function isRight(type,given,acc){
  const g=String(given||'').trim();if(!g)return false;
  if(type==='mcq')return acc.some(a=>String(a).trim().toUpperCase().charAt(0)===g.toUpperCase());
  if(type==='tfng'||type==='ynng')return acc.some(a=>String(a).trim().toUpperCase()===g.toUpperCase());
  return acc.some(a=>norm(a)===norm(g));
}

/* ---------- marking W/S ---------- */
async function markWriting(run){
  const c=run.content.W[0];const a=run.answers.W;
  const t1=c.task1,t2=c.task2;
  await saveRunNow(run);
  const r=await ai('markW',{attemptId:run.id});
  const b1=Number(r.task1&&r.task1.band),b2=Number(r.task2&&r.task2.band);
  if(!isFinite(b1)||!isFinite(b2))throw{code:'invalid_json'};
  return{band:roundBand((b1+2*b2)/3),t1:r.task1,t2:r.task2,errors:toArr(r.errors),patterns:toArr(r.patterns),model:r.model||null,next:toArr(r.next),wc:{t1:words(a.t1),t2:words(a.t2)}};
}
async function markSpeaking(run){
  const c=run.content.S[0];const A=run.answers.S;
  await saveRunNow(run);
  const r=await ai('markS',{attemptId:run.id});
  const fc=Number(r.FC),lr=Number(r.LR),gra=Number(r.GRA);
  if(![fc,lr,gra].every(isFinite))throw{code:'invalid_json'};
  return{band:roundBand((fc+lr+gra)/3),crit:{FC:fc,LR:lr,GRA:gra},summary:r.summary||'',errors:toArr(r.errors),patterns:toArr(r.patterns),model:r.model||null,next:toArr(r.next)};
}

/* ---------- speech (TTS) ---------- */
const TTS='speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
let speakToken=0;
function stopSpeech(){speakToken++;ctx.stopAudio();if(TTS)try{speechSynthesis.cancel()}catch(e){}}
function voiceRank(v){let s=0;const n=v.name||'';if(/natural|neural|online|premium|enhanced|siri|wavenet|studio/i.test(n))s+=20;if(/google/i.test(n))s+=6;if(/en[-_](GB|AU)/i.test(v.lang))s+=4;else if(/en[-_](CA|IE|NZ)/i.test(v.lang))s+=3;else if(/en[-_]US/i.test(v.lang))s+=2;if(v.localService===false)s+=1;if(/compact|espeak|novelty|bad news|bells|bubbles|cellos|jester|organ|whisper|zarvox|trinoids|superstar|albert|boing|wobble|good news/i.test(n))s-=40;return s}
function engVoices(){if(!TTS)return[];return speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang)||/^en$/i.test(v.lang)).sort((a,b)=>voiceRank(b)-voiceRank(a))}
const FEM=/female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|susan|hazel|libby|sonia|natasha|aria|jenny|serena|kate|allison|ava|joanna|salli|kimberly|emma|amy|olivia|catherine/i;
const MAL=/\bmale\b|daniel|alex|fred|oliver|george|ryan|guy|david|mark|james|thomas|arthur|rishi|aaron|matthew|brian|william|lee/i;
function pickVoices(speakers){
  const vs=engVoices();const map={};if(!vs.length)return map;
  const used=new Set();
  speakers.forEach((sp,i)=>{
    const want=String(sp.gender||'').toLowerCase().startsWith('f')?FEM:String(sp.gender||'').toLowerCase().startsWith('m')?MAL:null;
    let v=vs.find(x=>!used.has(x.name)&&want&&want.test(x.name)&&!(want===FEM&&/\bmale\b/i.test(x.name)&&!/female/i.test(x.name)));
    if(!v)v=vs.find(x=>!used.has(x.name))||vs[i%vs.length];
    used.add(v.name);map[sp.name]=v;
  });
  return map;
}
function chunks(text){const parts=String(text).match(/[^.!?]+[.!?]*\s*/g)||[text];const out=[];let cur='';for(const p of parts){if((cur+p).length>200&&cur){out.push(cur);cur=p}else cur+=p}if(cur.trim())out.push(cur);return out}
function speakLines(lines,voiceMap,onProgress,onDone,shared){
  const tok=shared!=null?shared:++speakToken;
  const queue=[];lines.forEach((l,li)=>chunks(l.text).forEach(c=>queue.push({li,text:c,speaker:l.speaker})));
  let i=0;
  const next=()=>{
    if(tok!==speakToken)return;
    if(i>=queue.length){onDone&&onDone();return}
    const item=queue[i++];
    const u=new SpeechSynthesisUtterance(item.text);
    const v=voiceMap[item.speaker];if(v){u.voice=v;u.lang=v.lang}else u.lang='en-GB';
    u.rate=0.97;
    u.onend=()=>{onProgress&&onProgress(i/queue.length);setTimeout(next,queue[i]&&queue[i].li!==item.li?350:60)};
    u.onerror=u.onend;
    window.__utt=u;speechSynthesis.speak(u);
  };
  next();
}
if(TTS){try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>{}}catch(e){}}

/* ---------- speaking flow ---------- */
function speakSteps(c){
  const st=[];
  toArr(c.part1).forEach(t=>toArr(t.questions).forEach(q=>st.push({part:1,label:'Part 1 · '+t.topic,q})));
  const p2=c.part2||{};
  const card=p2.card+'\nYou should say:\n'+toArr(p2.bullets).map(b=>'• '+b).join('\n')+'\n'+(p2.final||'');
  st.push({part:2,phase:'prep',label:'Part 2 · preparation',q:card});
  st.push({part:2,phase:'talk',label:'Part 2 · long turn',q:card});
  if(p2.followup)st.push({part:2,phase:'follow',label:'Part 2 · rounding off',q:p2.followup});
  toArr(c.part3).forEach(q=>st.push({part:3,label:'Part 3 · discussion',q}));
  return st;
}
const PART_MS={1:5*60000,3:5*60000};
function enterSpeakStep(){
  const run=S.run;const c=run.content.S[0];const steps=speakSteps(c);const st=run.state.S;const step=steps[st.pos];
  if(!step){submitSection('S');return}
  const prev=steps[st.pos-1];
  if(step.phase==='prep'){st.stepDeadline=Date.now()+60000}
  else if(step.phase==='talk'){st.stepDeadline=Date.now()+120000}
  else st.stepDeadline=null;
  if(!prev||prev.part!==step.part){st.partDeadline=PART_MS[step.part]?Date.now()+PART_MS[step.part]:null}
  saveRun(run);render();
  if(step.phase!=='talk'){say(step.phase==='prep'?'Now I\'m going to give you a topic, and I\'d like you to talk about it for one to two minutes. You have one minute to think about what you\'re going to say. You can make some notes if you wish.':step.q)}
  else say('All right? Remember you have one to two minutes for this. Please start speaking now.');
}
function speakTick(){
  const run=S.run;if(!run)return;const st=run.state.S;const steps=speakSteps(run.content.S[0]);const step=steps[st.pos];if(!step)return;
  const el=$('#timer');
  const dl=step.phase==='prep'||step.phase==='talk'?st.stepDeadline:st.partDeadline;
  if(el)el.textContent=dl?fmtTime(dl-Date.now()):'--:--';
  if(el&&dl)el.classList.toggle('low',dl-Date.now()<30000);
  if(dl&&Date.now()>=dl){
    if(step.phase==='prep'){advanceSpeak(1);return}
    if(step.phase==='talk'){toast('Two minutes are up.');advanceSpeak(1);return}
    let i=st.pos;while(steps[i]&&steps[i].part===step.part)i++;
    toast('Time for Part '+step.part+' is up.');
    st.pos=i;stopSpeech();enterSpeakStep();
  }
}
function advanceSpeak(d){const run=S.run;stopSpeech();ctx.stopDictation();run.state.S.pos+=d;enterSpeakStep()}

/* ---------- course ---------- */
async function buildCourse(){
  S.courseBusy=true;S.courseErr=null;render();
  try{
    const r=await ai('course',{});
    if(!r||!Array.isArray(r.phases))throw{code:'invalid_json'};
    r.phases.forEach(ph=>{ph.units=toArr(ph.units).map((u,i)=>({id:String(u.id||('u'+i)),skill:['L','R','W','S'].includes(u.skill)?u.skill:'W',title:String(u.title||''),goal:String(u.goal||''),checkpoint:!!u.checkpoint}))});
    S.course={title:String(r.title||'Your course'),summary:String(r.summary||''),phases:r.phases,createdAt:Date.now(),basedOn:clone(S.profile.bands),progress:{},version:uid()};
    saveCourse();
  }catch(e){S.courseErr=errCopy(e);S.courseErrCode=e&&e.code}
  S.courseBusy=false;render();
}
function allUnits(){return S.course?S.course.phases.flatMap(p=>p.units):[]}
async function openUnit(id){
  const u=allUnits().find(x=>x.id===id);if(!u)return;
  S.view='lesson';S.lessonUnit=u;S.lesson=null;S.lessonErr=null;S.quizChecked=false;S.taskFb=null;render();window.scrollTo(0,0);
  if(u.checkpoint)return;
  const key=S.course.version+'_'+u.id;
  let l=null;try{l=await Store.getLesson(key)}catch(e){}
  if(l){S.lesson=l;render();return}
  await genLesson(u,key);
}
async function genLesson(u,key){
  S.lessonBusy=true;render();
  try{
    const r=await ai('lesson',{unitId:u.id});
    if(!r||!Array.isArray(r.quiz))throw{code:'invalid_json'};
    S.lesson=r;await Store.setLesson(key,r).catch(()=>{});
  }catch(e){S.lessonErr=errCopy(e)}
  S.lessonBusy=false;render();
}
function checkQuiz(){
  const l=S.lesson;let c=0;
  l.quiz.forEach((q,i)=>{
    const el=document.querySelector('[name="lq'+i+'"]:checked')||document.getElementById('lq'+i);
    const v=el?el.value:'';q._given=v;
    q._ok=q.type==='mcq'?String(q.answer).trim().toUpperCase().charAt(0)===String(v).toUpperCase():toArr(q.answer).some(a=>norm(a)===norm(v));
    if(q._ok)c++;
  });
  const pct=Math.round(100*c/l.quiz.length);S.quizChecked=true;S.quizScore=pct;
  const u=S.lessonUnit;S.course.progress=S.course.progress||{};
  const prev=S.course.progress[u.id];
  S.course.progress[u.id]={done:pct>=70||(prev&&prev.done),score:Math.max(pct,prev&&prev.score||0)};
  saveCourse();render();
}
async function taskFeedback(){
  const txt=($('#taskans')||{}).value||'';
  if(words(txt)<20){toast('Write at least 20 words first.');return}
  S.taskAns=txt;S.taskBusy=true;S.taskFb=null;render();
  try{
    const l=S.lesson,u=S.lessonUnit;
    const r=await ai('taskfb',{unitId:u.id,answer:txt});
    S.taskFb=r;
  }catch(e){S.taskFb={err:errCopy(e)}}
  S.taskBusy=false;render();
}

/* ---------- rendering ---------- */
function render(){
  const app=$('#app');
  if(!S.ready){app.innerHTML='<div class="row"><span class="spinner"></span><span class="muted">Loading your coach…</span></div>';return}
  const inTest=['intro','section','marking'].includes(S.view);
  let body='';
  if(S.view==='home')body=viewHome();
  else if(S.view==='tests')body=viewTests();
  else if(S.view==='course')body=viewCourse();
  else if(S.view==='lesson')body=viewLesson();
  else if(S.view==='history')body=viewHistory();
  else if(S.view==='report')body=viewReport();
  else if(S.view==='intro')body=viewIntro();
  else if(S.view==='section')body=viewSection();
  else if(S.view==='marking')body=viewMarking();
  else if(S.view==='real')body=viewReal();
  if(!ACTIVE)return;
  app.innerHTML=(inTest?'':topBar())+body;
  ctx.afterRender&&ctx.afterRender();
  if(S.view==='section'&&S.sec==='S'){const el=$('#spk');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}
}
function topBar(){
  const nav=[['home','Dashboard'],['tests','Tests'],['course','Course'],['history','Results']];
  return ctx.header(EXAM,nav,S.view==='lesson'?'course':S.view==='real'?'tests':S.view,'General Training · target CLB '+CLBT());
}
function skillCard(k){
  const b=S.profile.bands[k];const t=TARGET[k];const c=clbOf(k,b);
  const pct=b==null?0:Math.min(100,Math.max(0,(b-4)/5*100));const tp=(t-4)/5*100;
  const gap=b==null?null:t-b;
  const status=b==null?'<span class="pill">Not tested</span>':gap<=0?'<span class="pill good">On target</span>':gap<=0.5?'<span class="pill warn">'+gap.toFixed(1)+' to go</span>':'<span class="pill bad">'+gap.toFixed(1)+' to go</span>';
  const note=S.profile.bandNote&&S.profile.bandNote[k];
  return '<div class="panel skill"><div class="head"><div class="row"><span class="letter" style="background:'+SKCOL[k]+'">'+k+'</span><b>'+SK[k]+'</b></div>'+status+'</div>'+
  '<div class="band mono">'+fmtBand(b)+'<small>'+(c?'CLB '+c:'')+'</small></div>'+
  '<div class="scale" role="img" aria-label="Band '+fmtBand(b)+' of target '+t.toFixed(1)+'"><div class="fill" style="width:'+pct+'%;background:'+SKCOL[k]+'"></div><div class="tick" style="left:'+tp+'%"></div></div>'+
  '<div class="scale-labels"><span>4</span><span>target '+t.toFixed(1)+' · stretch '+STRETCH[k].toFixed(1)+'</span><span>9</span></div>'+(note?'<p class="small muted">Estimate '+h(note)+'.</p>':'')+'</div>';
}
function overallNow(){const b=S.profile.bands;if(ORDER.some(k=>b[k]==null))return null;return roundBand(ORDER.reduce((a,k)=>a+b[k],0)/4)}
function clbOverall(){const b=S.profile.bands;if(ORDER.some(k=>b[k]==null))return null;return Math.min(...ORDER.map(k=>{const c=clbOf(k,b[k]);return typeof c==='number'?c:3}))}
function viewHome(){
  const p=S.profile;const ov=overallNow();const clb=clbOverall();
  let hero='';
  if(p.activeAttemptId){
    hero='<div class="panel"><p class="eyebrow">Unfinished test</p><h2>You have a test in progress</h2><p class="muted">Pick up where you stopped. Any section that was running keeps its original timer.</p><div class="row"><button class="btn primary" data-act="resume">Resume test</button><button class="btn" data-act="discard">Discard it</button></div>'+(S.confirmDiscard?'<div class="banner">Discard this attempt? Its answers will not count. <button class="btn sm" data-act="discard-yes">Yes, discard</button> <button class="btn sm" data-act="discard-no">Keep it</button></div>':'')+'</div>';
  }else if(!p.placementDone){
    hero='<div class="panel"><p class="eyebrow">Step 1 · Placement test</p><h1>Find your real starting level</h1><p style="max-width:62ch">A full General Training paper in all four skills with real exam timings. Your results set the level of your course and every mock test after it. You can take a break between sections; each timer starts only when you press Start.</p>'+
    '<div class="tablewrap"><table><thead><tr><th>Section</th><th>Format</th><th class="mono">Time</th></tr></thead><tbody>'+ORDER.map(k=>'<tr><td><b>'+SK[k]+'</b></td><td>'+h(SEC[k].note)+'</td><td class="mono">'+(k==='S'?'11–14 min':SEC[k].mins+' min')+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="row"><button class="btn primary" data-act="placement" '+(SAMPLE?'':'disabled')+'>Start placement test</button><span class="small muted">About 2 h 50 min in total, plus breaks.</span></div></div>';
  }else{
    const next=S.course?allUnits().find(u=>!(S.course.progress||{})[u.id]?.done):null;
    hero='<div class="panel"><div class="row between"><div class="stack" style="gap:6px"><p class="eyebrow">Overall</p><div class="row" style="align-items:baseline"><span class="bigband mono">'+fmtBand(ov)+'</span><span class="pill ink">'+(clb?'CLB '+clb:'CLB –')+'</span></div><p class="muted small">Your CLB level is set by your lowest skill. Target: CLB '+CLBT()+' in every skill.</p></div>'+
    '<div class="stack" style="gap:8px;align-items:flex-start">'+(S.course?(next?'<button class="btn primary" data-unit="'+next.id+'">Continue course: '+h(next.title)+'</button>':'<span class="pill good">Course complete</span>'):'<button class="btn primary" data-act="build">Build my course</button>')+'<button class="btn" data-nav="tests">New mock test</button></div></div></div>';
  }
  const weak=weakTypes();
  const pats=(p.errorPatterns||[]).slice(0,6);
  return '<div class="row between"><div><p class="eyebrow">'+new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+'</p><h2>Hi '+h(ctx.firstName())+'</h2></div><div class="row">'+(daysLeft()!=null?'<span class="pill"><span class="mono">'+daysLeft()+'</span> days to exam</span>':'')+ctx.planPill(EXAM)+'</div></div>'+
  (S.profile.setupDone?'':setupPanel(true))+hero+'<div class="grid">'+ORDER.map(skillCard).join('')+'</div>'+
  '<div class="grid"><div class="panel"><h3>Errors to watch</h3>'+(pats.length?'<ul class="stack" style="gap:6px;margin:0;padding-left:18px">'+pats.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>':'<p class="muted">Appears after your first Writing or Speaking test.</p>')+'</div>'+
  '<div class="panel"><h3>Weakest question types</h3>'+(weak.length?'<div class="stack" style="gap:8px">'+weak.map(w=>'<div class="row between"><span>'+SK[w.skill]+' · '+h(TYPE_NAMES[w.type]||w.type)+'</span><span class="pill '+(w.pct<50?'bad':w.pct<70?'warn':'good')+' mono">'+w.pct+'% of '+w.t+'</span></div>').join('')+'</div>':'<p class="muted">Appears after your first Listening or Reading test.</p>')+'</div></div>'+
  trendChart()+
  (S.profile.setupDone?setupPanel(false):'');
}
function setupPanel(first){
  const p=S.profile;
  return '<div class="panel'+(first?'':' flat')+'"><p class="eyebrow">'+(first?'Before you start':'Settings')+'</p>'+(first?'<h2>Set up your IELTS coach</h2><p class="muted" style="max-width:62ch">These details shape your tests, marking and course. You can change them later.</p>':'')+
  '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">'+
  '<label class="stack" style="gap:6px"><span class="small muted">Target level</span><select id="set-target">'+[7,8,9,10].map(x=>'<option value="'+x+'" '+(CLBT()===x?'selected':'')+'>CLB '+x+' · L '+TARGETS[x].L+' R '+TARGETS[x].R+' W '+TARGETS[x].W+' S '+TARGETS[x].S+'</option>').join('')+'</select></label>'+
  '<label class="stack" style="gap:6px"><span class="small muted">Exam date (if booked)</span><input type="date" id="set-date" value="'+h(p.examDate)+'"></label>'+
  '<label class="stack" style="gap:6px"><span class="small muted">Study time</span><select id="set-time">'+['30 minutes a day','1 hour a day','1.5 hours a day','2+ hours a day'].map(x=>'<option '+(p.studyTime===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
  '<label class="stack" style="gap:6px"><span class="small muted">About you (optional): job, country, languages. Used to make examples relevant.</span><input type="text" id="set-about" maxlength="280" style="width:100%" value="'+h(p.about)+'" placeholder="e.g. Software developer in Tunisia, speaks Arabic and French"></label>'+
  '<div class="row"><button class="btn '+(first?'primary':'sm')+'" data-act="savesettings">'+(first?'Save and continue':'Save settings')+'</button>'+(first?'':'<span class="small muted">'+(S.confirmReset?'Erase all IELTS progress, results and your course? <button class="btn sm" data-act="reset-yes">Erase everything</button> <button class="btn sm" data-act="reset-no">Cancel</button>':'<button class="link" data-act="reset">Reset IELTS progress</button>')+'</span>')+'</div></div>';
}
function trendChart(){
  const hist=(S.profile.history||[]);if(!hist.length)return '';
  const W=640,H=220,pl=36,pr=14,pt=14,pb=28;
  const n=hist.length;const x=i=>n===1?pl+(W-pl-pr)/2:pl+i*(W-pl-pr)/(n-1);const y=b=>pt+(9-b)/5*(H-pt-pb);
  let g='';for(let b=4;b<=9;b++)g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(b)+'" y2="'+y(b)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(pl-8)+'" y="'+(y(b)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">'+b+'</text>';
  let lines='';
  for(const k of ORDER){
    const pts=hist.map((e,i)=>e.bands&&e.bands[k]!=null?[x(i),y(e.bands[k])]:null).filter(Boolean);
    if(!pts.length)continue;
    if(pts.length>1)lines+='<polyline fill="none" stroke="'+SKCOL[k]+'" stroke-width="2.5" stroke-linejoin="round" points="'+pts.map(p=>p.join(',')).join(' ')+'"/>';
    pts.forEach((p,i)=>{lines+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(i===pts.length-1?4.5:3)+'" fill="'+SKCOL[k]+'"/>'});
  }
  const labels=hist.map((e,i)=>(n<=8||i===0||i===n-1)?'<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">'+h(e.date.slice(5))+'</text>':'').join('');
  return '<div class="panel chart"><div class="row between"><h3>Band trend</h3><div class="legend">'+ORDER.map(k=>'<span><i style="background:'+SKCOL[k]+'"></i>'+SK[k]+'</span>').join('')+'</div></div><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Band scores over time">'+g+lines+labels+'</svg></div>';
}
function viewTests(){
  const p=S.profile;const busy=!!p.activeAttemptId;
  const sel=S.mock||(S.mock={type:'full',diff:'auto'});
  const recommend=ORDER.filter(k=>p.bands[k]!=null).map(k=>({k,gap:TARGET[k]-p.bands[k]})).sort((a,b)=>b.gap-a.gap)[0];
  const types=[['full','Full test','All four skills · about 2 h 50 min'],['L','Listening','30 + 2 min · 40 questions'],['R','Reading','60 min · 40 questions'],['W','Writing','60 min · letter + essay'],['S','Speaking','11–14 min · 3 parts']];
  const diffs=[['auto','Auto','Matches your current band per skill'],['foundation','Foundation',''],['exam','Exam standard',''],['advanced','Advanced','']];
  return (!p.placementDone&&!busy?'<div class="banner">Take the placement test first so mock tests can match your level. <button class="btn sm primary" data-act="placement" '+(SAMPLE?'':'disabled')+'>Start placement test</button></div>':'')+
  (busy?'<div class="banner">A test is in progress. <button class="btn sm primary" data-act="resume">Resume it</button></div>':'')+
  (ctx.ent(EXAM).paid?usageLine():'<div class="banner small">Free plan: 1 mock test per month and 1 placement test. <a href="#/plans">See plans</a> for unlimited tests and natural voices.</div>')+'<div class="panel"><p class="eyebrow">Mock test generator</p><h2>Build a new mock test</h2><p class="muted" style="max-width:64ch">Every mock is newly written. Auto difficulty follows your latest band in each skill, and Listening and Reading mocks lean on the question types you miss most.'+(recommend&&recommend.gap>0?' Your biggest gap right now is <b>'+SK[recommend.k]+'</b> ('+fmtBand(p.bands[recommend.k])+' → '+TARGET[recommend.k].toFixed(1)+').':'')+'</p>'+
  '<div class="stack"><span class="eyebrow">Test</span><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">'+types.map(([v,l,d])=>'<label class="choice"><input type="radio" name="mtype" value="'+v+'" '+(sel.type===v?'checked':'')+'><span class="mono">'+(v==='full'?'4':v)+'</span><span><b>'+l+'</b><br><span class="small muted">'+d+'</span></span></label>').join('')+'</div></div>'+
  '<div class="stack"><span class="eyebrow">Difficulty</span><div class="opts">'+diffs.map(([v,l])=>'<label class="opt"><input type="radio" name="mdiff" value="'+v+'" '+(sel.diff===v?'checked':'')+'><span>'+l+'</span></label>').join('')+'</div><p class="small muted">'+(sel.diff==='auto'?'Auto sets '+(sel.type==='full'?ORDER:[sel.type]).map(k=>SK[k]+': '+DIFF[autoDiff(k)].label).join(' · '):'Every section at '+DIFF[sel.diff].label+': '+DIFF[sel.diff].text+'.')+'</p></div>'+
  '<div class="row"><button class="btn primary" data-act="mock" '+(busy||!SAMPLE?'disabled':'')+'>Create and start</button><span class="small muted">Content is written while you read the instructions; each part takes up to a minute.</span></div></div>'+
  '<div class="panel flat"><p class="eyebrow">Real recordings</p><h3>Practise with a real IELTS recording</h3><p class="muted" style="max-width:64ch">Load a recording from a Cambridge IELTS book or official practice test (like the MP3s you have), answer on the sheet while it plays once, then paste the answer key to get your score and band. Questions come from the book, so have the question paper open.</p><div class="row"><button class="btn dark" data-nav="real">Open real-recording mode</button></div></div>'+
  voicePanel();
}
function usageLine(){
  const u=S.usage;if(!u||!u.sectionsLimit)return '';
  const left=Math.max(0,u.sectionsLimit-u.sectionsUsed);
  return '<div class="banner small'+(left<8?'':' good')+'">This month: '+u.sectionsUsed+' of '+u.sectionsLimit+' test sections used ('+left+' left). A full test uses 4, a single-skill test uses 1. Resets on the 1st.</div>';
}
function loadUsage(){ctx.api('GET','/api/usage/'+EXAM).then(u=>{S.usage=u;if(S.view==='tests')render()}).catch(()=>{})}
function voicePanel(){
  if(ctx.ent(EXAM).tts)return '<div class="panel flat"><h3>Voices</h3><p class="small muted" style="max-width:68ch">Your plan reads Listening tests and speaking questions with natural studio voices in British accents. If they can\'t load, the app falls back to your device\'s voices.</p><div class="row"><button class="btn sm" data-act="voicetest">Hear a sample</button></div></div>';
  if(!TTS)return '<div class="panel flat"><h3>Voices</h3><p class="muted">This browser has no speech voices, so generated Listening tests show the script once instead. Upgrade for natural studio voices, or use Chrome or Edge.</p></div>';
  const vs=engVoices();const top=vs.slice(0,4);
  return '<div class="panel flat"><h3>Voices</h3><p class="small muted" style="max-width:68ch">The free plan uses your device\'s voices: '+(top.length?h(top.map(v=>v.name.replace(/\s*\(.*\)/,'')).join(', ')):'none found yet')+'. <a href="#/plans">Solo and Duo</a> use natural studio voices that sound like the real exam.</p><div class="row"><button class="btn sm" data-act="voicetest">Hear a sample</button></div></div>';
}
function parseKey(txt){const key={};String(txt||'').split(/\n+/).forEach(line=>{const m=line.match(/^\s*(\d{1,2})\s*[.):\-]?\s+(.+?)\s*$/);if(m)key[Number(m[1])]=m[2].split(/\s*(?:\/|\||\bOR\b)\s*/i).map(x=>x.trim()).filter(Boolean)});return key}
function viewReal(){
  const R=S.real||(S.real={files:[],answers:{},count:40,from:1,played:false,key:'',transcript:''});
  const nums=[];for(let n=R.from;n<R.from+R.count;n++)nums.push(n);
  const sheet='<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">'+nums.map(n=>'<div class="q" style="align-items:center"><span class="qn mono">'+n+'</span><input type="text" id="ra'+n+'" data-ra="'+n+'" value="'+h(R.answers[n]||'')+'" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:100%"></div>').join('')+'</div>';
  let res='';
  if(R.result){const r=R.result;res='<div class="panel"><div class="row between"><h2>Your result</h2><div class="row" style="align-items:baseline"><span class="bigband mono" style="font-size:2.4rem">'+fmtBand(r.band)+'</span><span class="pill">'+r.raw+' / '+r.total+'</span></div></div>'+
    '<div class="tablewrap"><table><thead><tr><th class="mono">Q</th><th>Your answer</th><th>Key</th><th>Likely cause</th></tr></thead><tbody>'+r.items.filter(i=>!i.ok).map(i=>'<tr><td class="mono">'+i.n+'</td><td style="color:var(--bad)">'+(i.given?h(i.given):'<span class="muted">blank</span>')+'</td><td style="color:var(--good)">'+h(i.correct)+(i.alts.length?' <span class="muted">/ '+h(i.alts.join(' / '))+'</span>':'')+'</td><td>'+h(i.cause||'')+'</td></tr>').join('')+'</tbody></table></div>'+
    (r.patterns?'<p><b>Patterns:</b> '+h(r.patterns.join('; '))+'</p>':'')+
    '<div class="row"><button class="btn" data-act="realexplain" '+(S.realBusy||!SAMPLE?'disabled':'')+'>'+(S.realBusy?'Analysing…':'Explain my mistakes')+'</button>'+(S.realBusy?'<span class="spinner"></span>':'')+'<button class="btn" data-act="realreset">New recording</button></div><p class="small muted">Paste the transcript below first for a precise analysis; without it, causes are inferred from your answers.</p></div>'}
  return '<div class="row"><button class="btn sm" data-nav="tests">← Tests</button></div><div class="panel"><p class="eyebrow">Real recording</p><h2>Listening with a real recording</h2>'+
  '<div class="stack"><label class="eyebrow" for="rfiles">1 · Audio files (played in order)</label><input type="file" id="rfiles" accept="audio/*,.mp3,.m4a,.wav" multiple '+(R.played?'disabled':'')+'><p class="small muted">'+(R.files.length?h(R.files.map(f=>f.name).join(' → ')):'Add the instruction file first if you have one, then the test.')+'</p>'+
  '<div class="row"><label class="small muted" for="rfrom">Questions</label><input type="text" id="rfrom" value="'+R.from+'" style="width:70px" inputmode="numeric"><span class="small muted">to</span><input type="text" id="rto" value="'+(R.from+R.count-1)+'" style="width:70px" inputmode="numeric"><button class="btn sm" data-act="realrange" '+(R.played?'disabled':'')+'>Set</button></div></div>'+
  '<div class="player"><button class="btn primary" data-act="realplay" '+(!R.files.length||R.played?'disabled':'')+'>'+(R.played==='done'?'Played':R.played?'Playing…':'Play once')+'</button><div class="meter" aria-hidden="true"><i id="rmeter" style="width:'+(R.played==='done'?100:0)+'%"></i></div><span class="small muted mono" id="rtime"></span></div>'+
  '<div class="stack"><span class="eyebrow">2 · Answer sheet</span><p class="small muted">Spelling counts, as in the exam.</p>'+sheet+'</div>'+
  '<div class="stack"><label class="eyebrow" for="rkey">3 · Answer key</label><p class="small muted">One line per question. Separate accepted alternatives with a slash, e.g. <span class="mono">7 15 / fifteen</span>.</p><textarea id="rkey" spellcheck="false" placeholder="1 Hartley&#10;2 15 / fifteen&#10;3 B">'+h(R.key)+'</textarea>'+
  '<label class="eyebrow" for="rtrans">Transcript (optional)</label><textarea id="rtrans" placeholder="Paste the audioscript from the book for a precise mistake analysis">'+h(R.transcript)+'</textarea>'+
  '<div class="row"><button class="btn primary" data-act="realmark">Mark my answers</button></div></div></div>'+res;
}
function realAudioPlay(){
  const R=S.real;if(!R.files.length||R.played)return;R.played='playing';render();
  const urls=R.files.map(f=>URL.createObjectURL(f));let idx=0;const au=new Audio();S.realAudio=au;
  const go=()=>{if(idx>=urls.length){R.played='done';render();toast('Recording finished. Check your answers, then paste the key.');return}au.src=urls[idx++];au.play().catch(()=>{R.played=false;render();toast('This file could not be played. Try an MP3.')})};
  au.ontimeupdate=()=>{const m=$('#rmeter');const t=$('#rtime');if(au.duration){if(m)m.style.width=Math.round(100*au.currentTime/au.duration)+'%';if(t)t.textContent=fmtTime(au.currentTime*1000)+' / '+fmtTime(au.duration*1000)+(urls.length>1?' · file '+idx+' of '+urls.length:'')}};
  au.onended=go;go();
}
function realMark(){
  const R=S.real;const key=parseKey(R.key);const items=[];
  for(let n=R.from;n<R.from+R.count;n++){const acc=key[n];if(!acc)continue;const given=R.answers[n]||'';const ok=!!given.trim()&&acc.some(a=>a.length===1&&/[a-h]/i.test(a)?a.toUpperCase()===given.trim().toUpperCase():norm(a)===norm(given));items.push({n,type:'completion',prompt:'Question '+n,given,correct:acc[0],alts:acc.slice(1),ok,evidence:'',explain:''})}
  if(!items.length){toast('Paste the answer key first: one line per question, like "1 Hartley".');return}
  const raw=items.filter(i=>i.ok).length,total=items.length;
  const band=bandFrom('L',Math.round(raw*40/total));
  R.result={raw,total,band,items};
  const id='r'+uid();const run={id,kind:'real',sections:['L'],label:'Real recording · '+(R.files.map(f=>f.name).join(', ')||'Listening'),date:today(),startedAt:Date.now(),status:'done',content:{},answers:{},state:{},results:{L:{raw,total,band,per:{},items}}};
  saveRun(run);S.profile.bands.L=band;if(S.profile.bandNote)delete S.profile.bandNote.L;
  S.profile.history=[...(S.profile.history||[]),{id,date:run.date,kind:'real',label:run.label,bands:{L:band},overall:null}].slice(-60);saveProfile();
  R.runId=id;render();
}
async function realExplain(){
  const R=S.real;const wrong=R.result.items.filter(i=>!i.ok);if(!wrong.length){toast('No mistakes to explain.');return}
  S.realBusy=true;render();
  try{
    const r=await ai('real',{wrong:wrong.map(i=>({n:i.n,given:i.given,key:[i.correct,...i.alts].join(' / ')})),transcript:R.transcript});
    toArr(r.items).forEach(x=>{const it=R.result.items.find(i=>i.n===Number(x.n));if(it)it.cause=String(x.cause||'')});
    R.result.patterns=toArr(r.patterns).map(String);
  }catch(e){toast(errCopy(e))}
  S.realBusy=false;render();
}
function viewIntro(){
  const run=S.run;const k=nextSection(run);
  const done=run.sections.filter(x=>run.results[x]);
  const inProg=k&&run.state[k]&&(k==='S'?run.state.S.pos>0||run.state.S.started:true)&&!run.state[k].submitted;
  const prep=[];
  for(const s of run.sections){for(let i=0;i<jobCount(s);i++){const key=s+i;const ok=run.content[s]&&run.content[s][i];const g=S.gen[key];const name=s==='L'?'Listening Part '+(i+1):s==='R'?'Reading Section '+(i+1):SK[s]+' paper';prep.push('<div class="prep">'+(ok?'<span class="pill good">Ready</span>':g&&g.err?'<span class="pill bad">Failed</span>':'<span class="spinner"></span>')+'<span>'+name+'</span></div>')}}
  const failed=Object.values(S.gen).some(g=>g&&g.err);
  const errMsg=(Object.values(S.gen).find(g=>g&&g.err)||{}).err;
  const ready=k&&((k==='L'||k==='R')?!!(run.content[k]&&run.content[k][0]):sectionReady(run,k));
  const busyGen=Object.values(S.gen).some(g=>g==='busy');
  return '<div class="panel"><div class="row between"><div><p class="eyebrow">'+h(run.label)+'</p><h2>'+(k?(inProg?'Resume ':'Next: ')+SK[k]:'All sections done')+'</h2></div><button class="btn sm" data-act="leave">Save and exit</button></div>'+
  (k?'<p>'+h(SEC[k].note)+'.</p>'+sectionTips(k)+(inProg&&k!=='S'?'<p class="banner">This section was already started. The timer kept running: '+fmtTime(run.state[k].deadline-Date.now())+' left.</p>':''):'')+
  (done.length?'<p class="small muted">Completed: '+done.map(x=>SK[x]+' '+fmtBand(run.results[x].band)).join(' · ')+'</p>':'')+
  '<div class="row">'+(k?(ready?'<button class="btn primary" data-act="start" data-k="'+k+'">'+(inProg?'Continue':'Start '+SK[k])+' · '+(k==='S'?'11–14':SEC[k].mins)+' min</button>':'<button class="btn primary" disabled>Preparing '+SK[k]+'…</button>'):'')+(failed&&!busyGen?'<button class="btn" data-act="regen">Try again</button>':'')+'</div>'+
  (failed&&!busyGen?'<p class="banner bad small">'+h(errMsg)+'</p>':'')+
  '<div class="stack" style="gap:8px"><span class="eyebrow">Paper preparation</span><div class="prepgrid">'+prep.join('')+'</div></div></div>';
}
function sectionTips(k){
  const t={
    L:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Each part plays <b>once</b>, read aloud by '+(ctx.ent(EXAM).tts?'natural studio voices':'your device\'s voice')+'. Use headphones and turn the volume up.</li><li>Read the questions before pressing Play, as you would in the 30 seconds the real test gives you.</li><li>Spelling and word limits count, exactly as in the exam.</li>'+(TTS?'':'<li><b>This browser has no speech voice.</b> Each script will be shown once for about the time it takes to hear it, then hidden.</li>')+'</ul>',
    R:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Three sections, 40 questions. Aim for about 15, 20 and 25 minutes.</li><li>Answers are marked as in the exam: spelling counts, and completion answers must fit the word limit.</li></ul>',
    W:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Spend about 20 minutes on Task 1 and 40 on Task 2. Task 2 counts twice as much.</li><li>Write at least 150 and 250 words. The word counter is shown, as in the computer test.</li></ul>',
    S:'<ul class="small muted" style="margin:0;padding-left:18px"><li>The examiner\'s questions are spoken aloud'+(TTS?'':' (no voice in this browser, so read them)')+'.</li><li>'+(ctx.canDictate?'Press <b>Speak</b> and answer out loud: your words are written as you talk.':'Answer out loud using your keyboard\'s dictation microphone, so your words are typed as you speak.')+' Don\'t edit afterwards; the marking ignores punctuation.</li><li>Part 1 and Part 3 have about 5 minutes each. Part 2 gives you 1 minute to prepare and 2 minutes to talk.</li><li>Pronunciation can\'t be judged from text, so your band covers fluency, vocabulary and grammar only.</li></ul>'
  };return t[k];
}
function viewMarking(){
  const k=S.sec;
  return '<div class="panel"><p class="eyebrow">'+SK[k]+'</p>'+(S.markErr?'<h2>Marking didn\'t finish</h2><p>'+h(S.markErr)+' Your answers are saved.</p><div class="row"><button class="btn primary" data-act="remark">Try marking again</button><button class="btn" data-act="leave">Save and exit</button></div>':'<div class="row"><span class="spinner"></span><h2>Marking your '+SK[k].toLowerCase()+'</h2></div><p class="muted">An examiner-style marking against the four official criteria. This usually takes under a minute.</p>')+'</div>';
}
function timerNow(){const run=S.run;if(!run)return'--:--';const k=S.sec;const st=run.state[k]||{};let dl=st.deadline;if(k==='S'){const step=speakSteps(run.content.S[0])[st.pos];dl=step&&(step.phase==='prep'||step.phase==='talk')?st.stepDeadline:st.partDeadline}return dl?fmtTime(dl-Date.now()):'--:--'}
function reportBox(k,i){
  const key=k+i;const st=(S.reports||{})[key];
  if(st==='sent')return '<p class="small muted">Thanks, your report was sent.</p>';
  if(st!=='open')return '<p class="small"><button class="link" data-act="report-open" data-k="'+k+'" data-i="'+i+'">Report a problem with this part</button></p>';
  return '<div class="row small"><label for="rep-'+key+'" class="muted">What\'s wrong?</label><select id="rep-'+key+'"><option>Wrong answer key</option><option>Question unclear or ambiguous</option><option>Text or audio doesn\'t match the questions</option><option>Other</option></select><button class="btn sm" data-act="report-send" data-k="'+k+'" data-i="'+i+'">Send</button></div>';
}
function examBar(k,extra){
  return '<div class="exambar"><div><div class="small" style="opacity:.75">'+h(S.run.label)+'</div><b>'+SK[k]+'</b>'+(extra||'')+'</div><div class="row"><span class="timer mono" id="timer" aria-live="off">'+timerNow()+'</span>'+(k==='S'?'':'<button class="btn sm" data-act="ask-submit">Submit '+SK[k]+'</button>')+'</div></div>'+
  (S.confirmSubmit?'<div class="banner">Submit '+SK[k]+' now? You can\'t come back to it. '+unansweredNote(k)+' <button class="btn sm primary" data-act="submit">Submit</button> <button class="btn sm" data-act="cancel-submit">Keep working</button></div>':'');
}
function unansweredNote(k){
  if(k==='W'){const a=S.run.answers.W;return 'Task 1: '+words(a.t1)+' words, Task 2: '+words(a.t2)+' words.'}
  const ans=S.run.answers[k]||{};const c=S.run.content[k];let t=0,u=0;for(const i in c)(c[i].groups||[]).forEach(g=>g.questions.forEach(q=>{t++;if(!String(ans[q.n]||'').trim())u++}));return u?u+' of '+t+' questions are unanswered.':'All questions answered.';
}
function viewSection(){
  const k=S.sec;
  if(k==='L')return viewListening();
  if(k==='R')return viewReading();
  if(k==='W')return viewWriting();
  if(k==='S')return viewSpeaking();
}
function tabs(n,label){let s='<div class="tabs" role="tablist">';for(let i=0;i<n;i++)s+='<button role="tab" data-tab="'+i+'" aria-selected="'+(S.tab===i)+'">'+label+' '+(i+1)+'</button>';return s+'</div>'}
function renderGroups(k,groups,ans){
  return groups.map(g=>'<div class="group"><p class="instr">'+h(g.instructions)+'</p>'+(g.options&&g.options.length?'<ul class="optlist">'+g.options.map(o=>'<li><b class="mono">'+h(o.label)+'</b>&nbsp; '+h(o.text)+'</li>').join('')+'</ul>':'')+g.questions.map(q=>renderQ(k,g,q,ans[q.n])).join('')+'</div>').join('');
}
function renderQ(k,g,q,val){
  const name=k+'-q'+q.n;let ctl='';const t=g.type;val=val||'';
  if(t==='tfng'||t==='ynng'){const vals=t==='tfng'?['TRUE','FALSE','NOT GIVEN']:['YES','NO','NOT GIVEN'];ctl='<div class="opts">'+vals.map(v=>'<label class="opt"><input type="radio" name="'+name+'" value="'+v+'" data-n="'+q.n+'" '+(val===v?'checked':'')+'><span>'+v+'</span></label>').join('')+'</div>'}
  else if(t==='mcq'){ctl='<div class="mcq">'+toArr(q.choices).map((c,i)=>{const L='ABCDEFGH'[i];return '<label class="choice"><input type="radio" name="'+name+'" value="'+L+'" data-n="'+q.n+'" '+(val===L?'checked':'')+'><span class="mono">'+L+'</span><span>'+h(stripLetter(c,L))+'</span></label>'}).join('')+'</div>'}
  else if(t==='matching'||t==='headings'){ctl='<select id="'+name+'" data-n="'+q.n+'" aria-label="Answer to question '+q.n+'"><option value="">Choose…</option>'+toArr(g.options).map(o=>'<option value="'+h(o.label)+'" '+(val===o.label?'selected':'')+'>'+h(o.label)+'</option>').join('')+'</select>'}
  else ctl='<input type="text" id="'+name+'" data-n="'+q.n+'" value="'+h(val)+'" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Answer to question '+q.n+'">';
  return '<div class="q"><span class="qn mono">'+q.n+'</span><div class="qbody"><p>'+h(q.prompt)+'</p>'+ctl+'</div></div>';
}
function viewReading(){
  const run=S.run;const sec=run.content.R[S.tab];
  if(!sec)return examBar('R')+tabs(3,'Section')+waitPanel('Section');
  const text=sec.texts.map(t=>'<div><h3>'+h(t.heading)+'</h3>'+String(t.body).split(/\n\s*\n/).map(p=>{const m=p.match(/^\s*([A-H])[\).:\s]\s*/);return '<p>'+(m?'<span class="plabel">'+m[1]+'</span>'+h(p.slice(m[0].length)):h(p))+'</p>'}).join('')+'</div>').join('<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">');
  return examBar('R')+'<div class="row between">'+tabs(3,'Section')+'<span class="small muted">Questions '+RSEC[S.tab].start+'–'+(RSEC[S.tab].start+RSEC[S.tab].count-1)+'</span></div>'+
  '<div class="split"><div class="panel textcol"><div class="passage">'+text+'</div></div><div class="panel">'+renderGroups('R',sec.groups,run.answers.R)+reportBox('R',S.tab)+'<div class="row">'+(S.tab<2?'<button class="btn dark" data-tab="'+(S.tab+1)+'">Next section</button>':'<button class="btn primary" data-act="ask-submit">Submit Reading</button>')+'</div></div></div>';
}
function viewListening(){
  const run=S.run;const part=run.content.L[S.tab];
  if(!part)return examBar('L')+tabs(4,'Part')+waitPanel('Part');
  const played=run.state.L.played||{};
  const st=played[S.tab];
  let player;
  if(TTS||ctx.ent(EXAM).tts){player='<div class="player"><button class="btn primary" data-act="play" '+(st?'disabled':'')+'>'+(st==='done'?'Played':st==='playing'?'Playing…':'Play Part '+(S.tab+1))+'</button><div class="meter" aria-hidden="true"><i id="lmeter" style="width:'+(st==='done'?100:0)+'%"></i></div><span class="small muted" id="lstatus">'+(st==='done'?'Finished':st?'Playing once only':'Plays once, with 30 s to read the questions first, as in the exam.')+'</span></div>'}
  else{player='<div class="player"><button class="btn primary" data-act="readonce" '+(st?'disabled':'')+'>'+(st?'Script shown':'Show script once')+'</button><span class="small muted">No speech voice in this browser: the script shows once, then hides.</span></div><div id="readonce" class="panel flat" hidden></div>'}
  return examBar('L')+'<div class="row between">'+tabs(4,'Part')+'<span class="small muted">Questions '+LPART[S.tab].start+'–'+(LPART[S.tab].start+9)+'</span></div>'+
  '<div class="panel"><p class="muted">'+h(part.context)+'</p>'+player+renderGroups('L',part.groups,run.answers.L)+reportBox('L',S.tab)+'<div class="row">'+(S.tab<3?'<button class="btn dark" data-tab="'+(S.tab+1)+'">Next part</button>':'<button class="btn primary" data-act="ask-submit">Submit Listening</button>')+'</div></div>';
}
function waitPanel(w){const g=S.gen[S.sec+S.tab];return '<div class="panel" id="waitpart">'+(g&&g.err?'<p class="banner bad">'+h(g.err)+'</p><button class="btn" data-act="regen">Try again</button>':'<div class="row"><span class="spinner"></span><b>'+w+' '+(S.tab+1)+' is still being written.</b></div><p class="muted">It appears here as soon as it\'s ready. Keep working on the earlier '+w.toLowerCase()+'s meanwhile.</p>')+'</div>'}
function viewWriting(){
  const run=S.run;const c=run.content.W[0];const a=run.answers.W;const t=S.tab;
  const task=t===0?'<p class="eyebrow">Task 1 · '+h(c.task1.tone)+' letter · about 20 minutes</p><p>'+h(c.task1.situation)+'</p><p>'+h(c.task1.instruction)+'</p><ul>'+toArr(c.task1.bullets).map(b=>'<li>'+h(b)+'</li>').join('')+'</ul><p class="small muted">Write at least 150 words. You do NOT need to write any addresses. Begin your letter: <b>'+h(c.task1.salutation||'Dear …,')+'</b></p>'
  :'<p class="eyebrow">Task 2 · essay · about 40 minutes</p><p>Write about the following topic:</p><p style="font-weight:600;max-width:64ch">'+h(c.task2.prompt)+'</p><p class="small muted">Write at least 250 words.</p>';
  const val=t===0?a.t1:a.t2;const min=t===0?150:250;const wc=words(val);
  return examBar('W')+tabs(2,'Task')+'<div class="split"><div class="panel textcol">'+task+reportBox('W',0)+'</div><div class="panel"><label for="wtext" class="eyebrow">Your answer</label><textarea id="wtext" class="big" data-w="'+(t===0?'t1':'t2')+'" spellcheck="false">'+h(val)+'</textarea><div class="row between"><span class="wc'+(wc>=min?' ok':'')+'" id="wc">'+wc+' words</span>'+(t===0?'<button class="btn dark" data-tab="1">Go to Task 2</button>':'<button class="btn primary" data-act="ask-submit">Submit Writing</button>')+'</div></div></div>';
}
function viewSpeaking(){
  const run=S.run;const c=run.content.S[0];const steps=speakSteps(c);const st=run.state.S;const step=steps[st.pos];if(!step)return'';
  const val=run.answers.S[st.pos]||'';
  const partNames={1:'Part 1 · Interview',2:'Part 2 · Long turn',3:'Part 3 · Discussion'};
  let q;
  if(step.phase==='prep'||step.phase==='talk'){const p2=c.part2;q='<div class="cue"><p style="font-weight:700">'+h(p2.card)+'</p><p>You should say:</p><ul>'+toArr(p2.bullets).map(b=>'<li>'+h(b)+'</li>').join('')+'</ul><p>'+h(p2.final)+'</p></div>'}
  else q='<p class="examiner">'+h(step.q)+'</p>';
  const lbl=step.phase==='prep'?'Notes (1 minute to prepare)':step.phase==='talk'?'Speak for up to 2 minutes (dictate here)':'Your answer (dictate here)';
  const box=step.phase==='prep'?'<textarea id="spk" data-s="notes" placeholder="Short notes…">'+h(run.answers.S.notes||'')+'</textarea>':'<textarea id="spk" data-s="'+st.pos+'" class="'+(step.phase==='talk'?'big':'')+'" placeholder="'+(ctx.canDictate?'Press Speak and answer out loud, or type…':'Tap your keyboard\'s microphone and answer out loud…')+'">'+h(val)+'</textarea>';
  const nextLbl=step.phase==='prep'?'Start speaking now':st.pos===steps.length-1?'Finish speaking test':'Next question';
  const qNum=steps.filter(x=>x.part===step.part&&x.phase!=='prep').indexOf(step)+1;
  return examBar('S',' · '+partNames[step.part])+
  '<div class="panel"><div class="row between"><p class="eyebrow">'+h(step.label)+(step.phase?'':' · question '+qNum)+'</p>'+((TTS||ctx.ent(EXAM).tts)&&step.phase!=='talk'?'<button class="btn sm" data-act="repeatq">Hear it again</button>':'')+'</div>'+q+
  '<label for="spk" class="eyebrow">'+lbl+'</label>'+box+'<div class="row between"><div class="row">'+(step.phase!=='prep'&&ctx.canDictate?ctx.micButton('mic'):'')+'<span class="wc" id="wc">'+(step.phase==='prep'?'':words(val)+' words')+'</span></div><button class="btn primary" data-act="snext">'+nextLbl+'</button></div></div>';
}

/* ---------- report ---------- */
function reviewList(r){
  const wrong=r.items.filter(i=>!i.ok);
  const itemHtml=i=>'<div class="ritem"><span class="qn mono '+(i.ok?'ok':'')+'">'+i.n+'</span><div class="stack" style="gap:4px"><p>'+h(i.prompt)+'</p><p class="small">Your answer: <b>'+(i.given?h(i.given):'<span class="muted">blank</span>')+'</b> · Correct: <b style="color:var(--good)">'+h(i.correct)+'</b>'+(i.alts&&i.alts.length?' <span class="muted">(also: '+h(i.alts.join(', '))+')</span>':'')+' · <span class="muted">'+h(TYPE_NAMES[i.type]||i.type)+'</span></p>'+(i.evidence?'<p class="quote small">'+h(i.evidence)+'</p>':'')+(i.explain?'<p class="small">'+h(i.explain)+'</p>':'')+'</div></div>';
  return '<details '+(wrong.length<=12?'open':'')+'><summary>'+wrong.length+' wrong or blank answers</summary><div class="review">'+wrong.map(itemHtml).join('')+'</div></details><details><summary>All '+r.total+' answers</summary><div class="review">'+r.items.map(itemHtml).join('')+'</div></details>';
}
function errTable(errs){
  if(!errs||!errs.length)return'';
  return '<div class="tablewrap"><table><thead><tr><th>You wrote</th><th>Better</th><th>Why</th></tr></thead><tbody>'+errs.map(e=>'<tr><td style="color:var(--bad)">'+h(e.quote)+'</td><td style="color:var(--good)">'+h(e.fix)+'</td><td>'+h(e.reason)+'</td></tr>').join('')+'</tbody></table></div>';
}
function sectionReport(k,r){
  const clb=clbOf(k,r.band);
  let body='';
  if(k==='L'||k==='R'){
    body='<p class="mono">'+r.raw+' / '+r.total+' correct</p><div class="tablewrap"><table><thead><tr><th>Question type</th><th class="mono">Correct</th></tr></thead><tbody>'+Object.entries(r.per).map(([t,v])=>'<tr><td>'+h(TYPE_NAMES[t]||t)+'</td><td class="mono">'+v.c+' / '+v.t+'</td></tr>').join('')+'</tbody></table></div>'+reviewList(r);
  }else if(k==='W'){
    const c1=r.t1||{},c2=r.t2||{};
    body='<div class="tablewrap"><table><thead><tr><th></th><th>Task achievement / response</th><th>Coherence & cohesion</th><th>Lexical resource</th><th>Grammar</th><th>Task band</th></tr></thead><tbody><tr><td><b>Task 1</b> <span class="small muted">'+r.wc.t1+' w</span></td><td class="mono">'+fmtBand(c1.TA)+'</td><td class="mono">'+fmtBand(c1.CC)+'</td><td class="mono">'+fmtBand(c1.LR)+'</td><td class="mono">'+fmtBand(c1.GRA)+'</td><td class="mono"><b>'+fmtBand(c1.band)+'</b></td></tr><tr><td><b>Task 2</b> <span class="small muted">'+r.wc.t2+' w</span></td><td class="mono">'+fmtBand(c2.TR)+'</td><td class="mono">'+fmtBand(c2.CC)+'</td><td class="mono">'+fmtBand(c2.LR)+'</td><td class="mono">'+fmtBand(c2.GRA)+'</td><td class="mono"><b>'+fmtBand(c2.band)+'</b></td></tr></tbody></table></div>'+
    '<p><b>Task 1.</b> '+h(c1.summary)+'</p><p><b>Task 2.</b> '+h(c2.summary)+'</p>';
  }else{
    const c=r.crit||{};
    body='<div class="tablewrap"><table><thead><tr><th>Fluency & coherence</th><th>Lexical resource</th><th>Grammar</th><th>Pronunciation</th></tr></thead><tbody><tr><td class="mono">'+fmtBand(c.FC)+'</td><td class="mono">'+fmtBand(c.LR)+'</td><td class="mono">'+fmtBand(c.GRA)+'</td><td class="small muted">Not assessed from text</td></tr></tbody></table></div><p>'+h(r.summary)+'</p>';
  }
  if(k==='W'||k==='S'){
    body+=(r.errors&&r.errors.length?'<h3>Errors, quoted</h3>'+errTable(r.errors):'')+
    (r.patterns&&r.patterns.length?'<h3>Patterns</h3><ul style="margin:0;padding-left:18px">'+r.patterns.map(p=>'<li>'+h(p)+'</li>').join('')+'</ul>':'')+
    (r.model&&r.model.band8?'<h3>Band 8 version</h3><p class="small muted">'+h(r.model.task||'')+'</p><p class="quote">'+h(r.model.original||'')+'</p><div class="model">'+h(r.model.band8)+'</div>':'')+
    (r.next&&r.next.length?'<h3>Next priorities</h3><ol style="margin:0;padding-left:20px">'+r.next.map(p=>'<li>'+h(p)+'</li>').join('')+'</ol>':'');
  }
  return '<div class="panel"><div class="row between"><div class="row"><span class="letter mono" style="background:'+SKCOL[k]+';color:#fff;width:28px;height:28px;border-radius:6px;display:grid;place-items:center">'+k+'</span><h2>'+SK[k]+'</h2></div><div class="row" style="align-items:baseline"><span class="bigband mono" style="font-size:2.4rem">'+fmtBand(r.band)+'</span><span class="pill '+(r.band>=TARGET[k]?'good':r.band>=TARGET[k]-0.5?'warn':'bad')+'">'+(clb?'CLB '+clb:'below CLB 4')+' · target '+TARGET[k].toFixed(1)+'</span></div></div>'+body+'</div>';
}
function viewReport(){
  const run=S.reportRun;if(!run)return '<div class="panel"><p class="muted">Loading report…</p></div>';
  const ks=run.sections.filter(k=>run.results[k]);
  const allPats=[];ks.forEach(k=>{const r=run.results[k];if(r.patterns)allPats.push(...r.patterns)});
  const weak=[];['L','R'].forEach(k=>{const r=run.results[k];if(r)for(const t in r.per){const v=r.per[t];if(v.t&&v.c/v.t<0.7)weak.push(SK[k]+' · '+(TYPE_NAMES[t]||t)+' ('+v.c+'/'+v.t+')')}});
  const onTrack=ks.every(k=>run.results[k].band>=TARGET[k]);
  return '<div class="row"><button class="btn sm" data-nav="history">← All results</button></div>'+
  '<div class="panel"><p class="eyebrow">Progress card · '+h(run.date)+'</p><h1>'+h(run.label)+'</h1>'+
  '<div class="row">'+ks.map(k=>'<span class="pill"><b>'+SK[k]+'</b>&nbsp;<span class="mono">'+fmtBand(run.results[k].band)+'</span></span>').join('')+(run.overall!=null?'<span class="pill ink">Overall <span class="mono">'+fmtBand(run.overall)+'</span></span>':'')+'</div>'+
  '<p>'+(onTrack?'These results meet your CLB '+CLBT()+' targets. Keep the level steady and push toward the stretch bands.':'Honest verdict: not yet at CLB '+CLBT()+' in '+ks.filter(k=>run.results[k].band<TARGET[k]).map(k=>SK[k]+' (needs '+TARGET[k].toFixed(1)+')').join(', ')+'.')+'</p>'+
  (weak.length?'<p><b>Question types to fix:</b> '+h(weak.join(', '))+'</p>':'')+
  (allPats.length?'<p><b>Errors to watch:</b> '+h(allPats.slice(0,4).join('; '))+'</p>':'')+
  '<div class="row">'+(run.kind==='placement'&&!S.course?'<button class="btn primary" data-act="build">Build my course from these results</button>':'')+(run.kind==='placement'&&S.course?'<button class="btn primary" data-act="build">Rebuild my course from these results</button>':'')+'<button class="btn" data-nav="tests">Take another mock</button></div></div>'+
  ks.map(k=>sectionReport(k,run.results[k])).join('');
}
function viewHistory(){
  const hist=[...(S.profile.history||[])].reverse();
  return '<div class="panel"><h2>Results</h2>'+(hist.length?'<div class="tablewrap"><table><thead><tr><th>Date</th><th>Test</th>'+ORDER.map(k=>'<th class="mono">'+k+'</th>').join('')+'<th>Overall</th><th></th></tr></thead><tbody>'+hist.map(e=>'<tr><td class="mono">'+h(e.date)+'</td><td>'+h(e.label)+'</td>'+ORDER.map(k=>'<td class="mono">'+(e.bands&&e.bands[k]!=null?fmtBand(e.bands[k]):'–')+'</td>').join('')+'<td class="mono">'+fmtBand(e.overall)+'</td><td><button class="btn sm" data-report="'+h(e.id)+'">Open</button></td></tr>').join('')+'</tbody></table></div>':'<p class="muted">No results yet. Your placement test will appear here.</p>')+'</div>';
}

/* ---------- course views ---------- */
function viewCourse(){
  if(!ctx.ent(EXAM).course)return ctx.upsell(EXAM,'Your personal course','A 12-unit course built on your placement results, with lessons, quizzes, marked tasks and timed checkpoints.');
  if(S.courseBusy)return '<div class="panel"><div class="row"><span class="spinner"></span><h2>Building your course</h2></div><p class="muted">Planning 12 units around your bands and error patterns. This takes up to a minute.</p></div>';
  if(!S.course)return '<div class="panel"><p class="eyebrow">Personal course</p><h2>A course built on your results</h2><p style="max-width:64ch">Twelve units, each one focused point with short teaching, a 10-question quiz and a task marked by your AI coach. Units 4, 8 and 12 are timed checkpoint tests. '+(S.profile.placementDone?'It uses your placement results.':'Take the placement test first for the best plan; you can also start now from your known weaknesses.')+'</p>'+(S.courseErr?'<p class="banner bad">'+h(S.courseErr)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="build" '+(SAMPLE?'':'disabled')+'>Build my course</button>'+(!S.profile.placementDone?'<button class="btn" data-act="placement" '+(SAMPLE?'':'disabled')+'>Placement test first</button>':'')+'</div></div>';
  const c=S.course;const prog=c.progress||{};const units=allUnits();const done=units.filter(u=>prog[u.id]&&prog[u.id].done).length;
  return '<div class="panel"><div class="row between"><div><p class="eyebrow">Your course · '+done+' of '+units.length+' units done</p><h2>'+h(c.title)+'</h2></div><button class="btn sm" data-act="build">Rebuild from latest results</button></div><p class="muted" style="max-width:68ch">'+h(c.summary)+'</p>'+(S.courseErr?'<p class="banner bad">'+h(S.courseErr)+'</p>':'')+'</div>'+
  c.phases.map(ph=>'<div class="phase"><h3>'+h(ph.name)+'</h3>'+ph.units.map(u=>{const p=prog[u.id];const pill=p&&p.done?'<span class="pill good">'+(p.band!=null?'Band '+fmtBand(p.band):p.score!=null?p.score+'%':'Done')+'</span>':p&&p.score!=null?'<span class="pill warn">'+p.score+'% · retry</span>':u.checkpoint?'<span class="pill ink">Checkpoint test</span>':'<span class="pill">Not started</span>';return '<button class="unit" data-unit="'+h(u.id)+'"><span class="sk" style="background:'+SKCOL[u.skill]+'">'+u.skill+'</span><span><b>'+h(u.title)+'</b><br><span class="small muted">'+h(u.goal)+'</span></span>'+pill+'</button>'}).join('')+'</div>').join('');
}
function viewLesson(){
  const u=S.lessonUnit;
  const head='<div class="row"><button class="btn sm" data-nav="course">← Course</button></div><div class="panel"><p class="eyebrow">'+SK[u.skill]+(u.checkpoint?' · checkpoint':'')+'</p><h1>'+h(u.title)+'</h1><p class="muted">'+h(u.goal)+'</p></div>';
  if(u.checkpoint){
    return head+'<div class="panel"><h2>Checkpoint: timed '+SK[u.skill]+' test</h2><p>'+h(SEC[u.skill].note)+'. Newly written, at your current level. The result updates your '+SK[u.skill]+' band and completes this unit.</p><div class="row"><button class="btn primary" data-act="checkpoint" '+(S.profile.activeAttemptId||!SAMPLE?'disabled':'')+'>Start checkpoint</button>'+(S.profile.activeAttemptId?'<span class="small muted">Finish or discard your test in progress first.</span>':'')+'</div></div>';
  }
  if(S.lessonBusy)return head+'<div class="panel"><div class="row"><span class="spinner"></span><b>Writing your lesson…</b></div></div>';
  if(S.lessonErr)return head+'<div class="panel"><p class="banner bad">'+h(S.lessonErr)+'</p><button class="btn primary" data-act="relesson">Try again</button></div>';
  const l=S.lesson;if(!l)return head;
  const teach=toArr(l.teach).map(t=>'<div class="stack" style="gap:8px"><h3>'+h(t.heading)+'</h3><p>'+h(t.body)+'</p>'+toArr(t.examples).map(e=>'<div class="ex">'+(e.wrong?'<span class="w">'+h(e.wrong)+'</span>':'')+'<span class="r">'+h(e.right)+'</span></div>').join('')+'</div>').join('');
  const phrases=toArr(l.phrases).length?'<div class="panel"><h3>Phrases to use</h3><div class="tablewrap"><table><tbody>'+l.phrases.map(p=>'<tr><td><b>'+h(p.phrase)+'</b></td><td class="muted">'+h(p.use)+'</td></tr>').join('')+'</tbody></table></div></div>':'';
  const quiz='<div class="panel"><div class="row between"><h3>Quiz · '+l.quiz.length+' questions</h3>'+(S.quizChecked?'<span class="pill '+(S.quizScore>=70?'good':'bad')+' mono">'+S.quizScore+'%'+(S.quizScore>=70?' · unit passed':' · 70% to pass')+'</span>':'')+'</div>'+
    l.quiz.map((q,i)=>{let ctl;if(q.type==='mcq'){ctl='<div class="mcq">'+toArr(q.choices).map((c,ci)=>{const L='ABCDEFGH'[ci];return '<label class="choice"><input type="radio" name="lq'+i+'" value="'+L+'" '+(q._given===L?'checked':'')+'><span class="mono">'+L+'</span><span>'+h(stripLetter(c,L))+'</span></label>'}).join('')+'</div>'}else ctl='<input type="text" id="lq'+i+'" value="'+h(q._given||'')+'" autocomplete="off">';
      const fb=S.quizChecked?'<p class="small" style="color:'+(q._ok?'var(--good)':'var(--bad)')+'">'+(q._ok?'Correct. ':'Answer: '+h(toArr(q.answer).join(' / '))+'. ')+'<span class="muted">'+h(q.explain||'')+'</span></p>':'';
      return '<div class="q"><span class="qn mono">'+(i+1)+'</span><div class="qbody"><p>'+h(q.prompt)+'</p>'+ctl+fb+'</div></div>'}).join('')+
    '<div class="row"><button class="btn primary" data-act="checkquiz">'+(S.quizChecked?'Check again':'Check answers')+'</button></div></div>';
  let task='';
  if(l.task){
    const fb=S.taskFb;
    task='<div class="panel"><h3>Your turn · '+(l.task.kind==='speak'?'speak (dictate)':'write')+'</h3><p>'+h(l.task.prompt)+'</p><textarea id="taskans" placeholder="'+(l.task.kind==='speak'?'Use your keyboard\'s microphone and answer out loud…':'Write here…')+'">'+h(S.taskAns||'')+'</textarea><div class="row">'+(ctx.canDictate?ctx.micButton('mictask'):'')+'<button class="btn primary" data-act="taskfb" '+(S.taskBusy?'disabled':'')+'>'+(S.taskBusy?'Marking…':'Get feedback')+'</button>'+(S.taskBusy?'<span class="spinner"></span>':'')+'</div>'+
    (fb?(fb.err?'<p class="banner bad">'+h(fb.err)+'</p>':'<div class="stack"><div class="row"><span class="pill ink">Band '+fmtBand(fb.band)+'</span></div><p>'+h(fb.verdict)+'</p><p class="small">'+h(fb.used_point||'')+'</p>'+errTable(toArr(fb.errors))+(fb.better?'<h3>Band 8 version</h3><div class="model">'+h(fb.better)+'</div>':'')+'</div>'):'')+'</div>';
  }
  return head+'<div class="panel lesson"><p>'+h(l.intro)+'</p>'+teach+'</div>'+phrases+quiz+task;
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  if(!ACTIVE)return;
  const t=e.target.closest('[data-nav],[data-act],[data-tab],[data-unit],[data-report]');if(!t)return;
  if(t.dataset.nav){if(S.run&&['intro','section','marking'].includes(S.view))return;S.view=t.dataset.nav;if(S.view==='tests')loadUsage();S.confirmReset=false;render();window.scrollTo(0,0);return}
  if(t.dataset.unit){openUnit(t.dataset.unit);return}
  if(t.dataset.report){const id=t.dataset.report;S.view='report';S.reportRun=null;render();try{S.reportRun=await Store.getAttempt(id)}catch(err){}if(!S.reportRun)toast('That result could not be loaded.');render();window.scrollTo(0,0);return}
  if(t.dataset.tab!=null&&S.view==='section'){S.tab=Number(t.dataset.tab);saveRun(S.run);render();window.scrollTo(0,0);return}
  const a=t.dataset.act;
  if(a==='report-open'){S.reports=S.reports||{};S.reports[t.dataset.k+t.dataset.i]='open';render();return}
  if(a==='report-send'){const k=t.dataset.k,i=t.dataset.i;const reason=($('#rep-'+k+i)||{}).value||'';S.reports[k+i]='sent';render();try{await saveRunNow(S.run);await ctx.api('POST','/api/pool/report',{exam:EXAM,attemptId:S.run.id,k,i:Number(i),reason})}catch(err){}return}
  if(a==='realplay'){realAudioPlay();return}
  if(a==='realmark'){const R=S.real;R.key=($('#rkey')||{}).value||'';R.transcript=($('#rtrans')||{}).value||'';realMark();return}
  if(a==='realexplain'){S.real.transcript=($('#rtrans')||{}).value||S.real.transcript;realExplain();return}
  if(a==='realreset'){if(S.realAudio)try{S.realAudio.pause()}catch(err){}S.real=null;render();return}
  if(a==='realrange'){const R=S.real;const f=parseInt(($('#rfrom')||{}).value,10),t2=parseInt(($('#rto')||{}).value,10);if(f>0&&t2>=f&&t2-f<60){R.from=f;R.count=t2-f+1;render()}else toast('Enter a range like 1 to 40.');return}
  if(a==='voicetest'&&ctx.ent(EXAM).tts){stopSpeech();say('Good morning, Riverside Sports Centre. How can I help you? This is how your Listening tests will sound.');return}
  if(a==='voicetest'){const vm=pickVoices([{name:'a',gender:'female'},{name:'b',gender:'male'}]);speakLines([{speaker:'a',text:'Good morning, Riverside Sports Centre. How can I help you?'},{speaker:'b',text:'Hi, I\'d like to book a badminton court for Saturday, please.'}],vm);return}
  if(a==='placement'){await startRun(newRun('placement',ORDER.slice(),'exam','Placement test'));return}
  if(a==='mock'){const m=S.mock;const secs=m.type==='full'?ORDER.slice():[m.type];await startRun(newRun('mock',secs,m.diff,(m.type==='full'?'Full mock test':SK[m.type]+' mock')+' · '+(m.diff==='auto'?'auto level':DIFF[m.diff].label)));return}
  if(a==='checkpoint'){const u=S.lessonUnit;await startRun(newRun('mock',[u.skill],'auto',SK[u.skill]+' checkpoint · '+u.title,u.id));return}
  if(a==='resume'){await resume();return}
  if(a==='discard'){S.confirmDiscard=true;render();return}
  if(a==='discard-no'){S.confirmDiscard=false;render();return}
  if(a==='discard-yes'){const id=S.profile.activeAttemptId;S.profile.activeAttemptId=null;S.confirmDiscard=false;saveProfile();try{const r=await Store.getAttempt(id);if(r){r.status='discarded';await Store.saveAttempt(r)}}catch(err){}S.run=null;render();return}
  if(a==='start'){startSection(t.dataset.k);return}
  if(a==='regen'){for(const k in S.gen)if(S.gen[k]&&S.gen[k].err)delete S.gen[k];render();generateAll(S.run);return}
  if(a==='leave'){saveRun(S.run);stopTimer();stopSpeech();S.run=null;S.view='home';render();return}
  if(a==='ask-submit'){S.confirmSubmit=true;render();window.scrollTo(0,0);return}
  if(a==='cancel-submit'){S.confirmSubmit=false;render();return}
  if(a==='submit'){S.confirmSubmit=false;submitSection(S.sec,false);return}
  if(a==='remark'){markProduction(S.sec);return}
  if(a==='play'){playListening();return}
  if(a==='readonce'){readOnce();return}
  if(a==='repeatq'){const run=S.run;const step=speakSteps(run.content.S[0])[run.state.S.pos];if(step){stopSpeech();say(step.q)}return}
  if(a==='mic'){const el=$('#spk');if(el)ctx.toggleDictation(()=>$('#spk'),'en-GB',v=>{const x=$('#spk');if(!x||!S.run)return;const key=x.dataset.s;if(key==='notes')S.run.answers.S.notes=v;else S.run.answers.S[key]=v;const wc=$('#wc');if(wc&&key!=='notes')wc.textContent=words(v)+' words';scheduleSave()});render();return}
  if(a==='mictask'){ctx.toggleDictation(()=>$('#taskans'),'en-GB',v=>{S.taskAns=v});render();return}
  if(a==='snext'){advanceSpeak(1);return}
  if(a==='build'){S.view='course';buildCourse();return}
  if(a==='relesson'){const u=S.lessonUnit;genLesson(u,S.course.version+'_'+u.id);return}
  if(a==='checkquiz'){checkQuiz();return}
  if(a==='taskfb'){taskFeedback();return}
  if(a==='savesettings'){const p=S.profile;p.clbTarget=Number(($('#set-target')||{}).value)||9;p.examDate=($('#set-date')||{}).value||'';p.studyTime=($('#set-time')||{}).value||p.studyTime;p.about=(($('#set-about')||{}).value||'').slice(0,280);const first=!p.setupDone;p.setupDone=true;setTargets();saveProfile();toast(first?'Saved. Start with the placement test.':'Settings saved.');render();return}
  if(a==='reset'){S.confirmReset=true;render();return}
  if(a==='reset-no'){S.confirmReset=false;render();return}
  if(a==='reset-yes'){try{await ctx.api('DELETE','/api/docs/'+EXAM)}catch(err){ctx.handleError(err);return}S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;setTargets();toast('IELTS progress erased.');render();return}
});
document.addEventListener('change',e=>{
  if(!ACTIVE)return;
  const t=e.target;
  if(t.id==='rfiles'){S.real.files=[...t.files];render();return}
  if(t.name==='mtype'){S.mock.type=t.value;render();return}
  if(t.name==='mdiff'){S.mock.diff=t.value;render();return}
  if(S.view==='section'&&t.dataset.n){S.run.answers[S.sec][t.dataset.n]=t.value;scheduleSave()}
});
document.addEventListener('input',e=>{
  if(!ACTIVE)return;
  const t=e.target;
  if(t.dataset&&t.dataset.ra&&S.real){S.real.answers[t.dataset.ra]=t.value;return}
  if(t.id==='rkey'&&S.real){S.real.key=t.value;return}
  if(t.id==='rtrans'&&S.real){S.real.transcript=t.value;return}if(S.view!=='section')return;
  if(t.dataset.n&&t.tagName==='INPUT'){S.run.answers[S.sec][t.dataset.n]=t.value;scheduleSave();return}
  if(t.dataset.w){S.run.answers.W[t.dataset.w]=t.value;const min=t.dataset.w==='t1'?150:250;const n=words(t.value);const wc=$('#wc');if(wc){wc.textContent=n+' words';wc.classList.toggle('ok',n>=min)}scheduleSave();return}
  if(t.dataset.s){if(t.dataset.s==='notes')S.run.answers.S.notes=t.value;else{S.run.answers.S[t.dataset.s]=t.value;const wc=$('#wc');if(wc)wc.textContent=words(t.value)+' words'}scheduleSave()}
});

function playListening(){
  const run=S.run;const i=S.tab;const part=run.content.L[i];
  run.state.L.played=run.state.L.played||{};
  if(run.state.L.played[i])return;
  run.state.L.played[i]='playing';render();
  if(ctx.ent(EXAM).tts)runPartNatural(run,i,part);else{saveRun(run);runPart(run,i,part)}
}
async function runPartNatural(run,i,part){
  const tok=++speakToken;
  const status=t=>{const el=$('#lstatus');if(el&&S.tab===i)el.textContent=t};
  status('Loading the recording…');
  let plan;
  try{await saveRunNow(run);plan=await ctx.api('POST','/api/tts/plan',{exam:EXAM,attemptId:run.id,part:i})}
  catch(e){if(tok!==speakToken)return;status('Studio voices unavailable, using device voices.');return runPart(run,i,part)}
  if(tok!==speakToken)return;
  const q=ctx.audioSeries('/api/tts/chunk?exam='+EXAM+'&attemptId='+encodeURIComponent(run.id)+'&part='+i,plan.chunks.length);
  const idx=k=>plan.chunks.map((c,n)=>c.kind===k?n:-1).filter(n=>n>=0);
  const scriptIdx=idx('script');
  const vm=pickVoices(toArr(part.speakers).length?part.speakers:[{name:'Speaker',gender:'female'}]);
  const playOr=async(n,lines)=>{const ok=await q.play(n,()=>tok!==speakToken);if(!ok&&tok===speakToken&&lines)await speakP(lines,vm,null,tok)};
  const a=LPART[i].start,b=a+9;
  q.prefetch(0);q.prefetch(1);if(scriptIdx.length)q.prefetch(scriptIdx[0]);
  status('Introduction');
  await playOr(idx('intro')[0]);
  if(tok!==speakToken)return;
  scriptIdx.slice(1,3).forEach(n=>q.prefetch(n));
  if(!await waitFor(30000,tok,l=>status('Read questions '+a+' to '+b+': '+Math.ceil(l/1000)+' s')))return;
  await playOr(idx('go')[0]);
  status('Recording playing');
  for(let n=0;n<scriptIdx.length;n++){
    if(tok!==speakToken)return;
    if(scriptIdx[n+1]!=null)q.prefetch(scriptIdx[n+1]);if(scriptIdx[n+2]!=null)q.prefetch(scriptIdx[n+2]);
    await playOr(scriptIdx[n]);
    const m=$('#lmeter');if(m&&S.tab===i)m.style.width=Math.round((n+1)/scriptIdx.length*100)+'%';
  }
  if(tok!==speakToken)return;
  await playOr(idx('outro')[0]);
  if(tok!==speakToken)return;
  if(!await waitFor(30000,tok,l=>status('Check your answers: '+Math.ceil(l/1000)+' s')))return;
  q.dispose();
  run.state.L.played[i]='done';saveRun(run);if(S.view==='section'&&S.sec==='L'&&S.tab===i)render();toast('Part '+(i+1)+' finished.'+(i<3?' Go to Part '+(i+2)+'.':''));
}
function say(text){
  if(ctx.ent(EXAM).tts){const tok=speakToken;ctx.say(EXAM,text,{},()=>tok!==speakToken).then(ok=>{if(!ok&&tok===speakToken&&TTS)speakLines([{speaker:'ex',text}],{ex:pickVoices([{name:'ex',gender:'female'}]).ex})});return}
  if(TTS)speakLines([{speaker:'ex',text}],{ex:pickVoices([{name:'ex',gender:'female'}]).ex});
}
function waitFor(ms,tok,onTick){return new Promise(res=>{const end=Date.now()+ms;const iv=setInterval(()=>{if(tok!==speakToken){clearInterval(iv);res(false);return}const left=end-Date.now();onTick&&onTick(left);if(left<=0){clearInterval(iv);res(true)}},250)})}
function speakP(lines,vm,onProg,tok){return new Promise(res=>speakLines(lines,vm,onProg,()=>res(true),tok))}
async function runPart(run,i,part){
  const tok=++speakToken;
  const vm=pickVoices(toArr(part.speakers).length?part.speakers:[{name:'Speaker',gender:'female'}]);
  const nar={__n:pickVoices([{name:'n',gender:'male'}]).n};
  const status=t=>{const el=$('#lstatus');if(el&&S.tab===i)el.textContent=t};
  const a=LPART[i].start,b=a+9;
  status('Introduction');
  await speakP([{speaker:'__n',text:'Part '+(i+1)+'. '+part.context+' First, you have some time to look at questions '+a+' to '+b+'.'}],nar,null,tok);
  if(tok!==speakToken)return;
  if(!await waitFor(30000,tok,l=>status('Read questions '+a+' to '+b+': '+Math.ceil(l/1000)+' s')))return;
  status('Now listen carefully.');
  await speakP([{speaker:'__n',text:'Now listen carefully and answer questions '+a+' to '+b+'.'}],nar,null,tok);
  if(tok!==speakToken)return;
  status('Recording playing');
  await speakP(part.script,vm,p=>{const m=$('#lmeter');if(m&&S.tab===i)m.style.width=Math.round(p*100)+'%'},tok);
  if(tok!==speakToken)return;
  await speakP([{speaker:'__n',text:'That is the end of Part '+(i+1)+'. You now have 30 seconds to check your answers.'}],nar,null,tok);
  if(tok!==speakToken)return;
  if(!await waitFor(30000,tok,l=>status('Check your answers: '+Math.ceil(l/1000)+' s')))return;
  run.state.L.played[i]='done';saveRun(run);if(S.view==='section'&&S.sec==='L'&&S.tab===i)render();toast('Part '+(i+1)+' finished.'+(i<3?' Go to Part '+(i+2)+'.':''));
}
function readOnce(){
  const run=S.run;const i=S.tab;const part=run.content.L[i];
  run.state.L.played=run.state.L.played||{};if(run.state.L.played[i])return;
  run.state.L.played[i]='done';saveRun(run);
  const box=$('#readonce');const btn=document.querySelector('[data-act="readonce"]');if(btn){btn.disabled=true;btn.textContent='Script shown'}
  box.innerHTML=part.script.map(l=>'<p><b>'+h(l.speaker)+':</b> '+h(l.text)+'</p>').join('');box.hidden=false;
  const ms=Math.max(30000,words(part.script.map(l=>l.text).join(' '))/2.6*1000);
  setTimeout(()=>{box.innerHTML='';box.hidden=true},ms);
}
async function resume(){
  const id=S.profile.activeAttemptId;if(!id)return;
  let run=null;try{run=await Store.getAttempt(id)}catch(e){}
  if(!run){toast('That test could not be loaded.');S.profile.activeAttemptId=null;saveProfile();render();return}
  run.content=run.content||{};run.answers=run.answers||{L:{},R:{},W:{t1:'',t2:''},S:{}};run.state=run.state||{};run.results=run.results||{};
  S.run=run;S.gen={};
  const k=nextSection(run);
  if(k&&run.state[k]&&run.state[k].submitted){S.sec=k;markProduction(k);return}
  if(k&&k!=='S'&&run.state[k]&&run.state[k].deadline){
    if(Date.now()>=run.state[k].deadline){S.sec=k;submitSection(k,true);return}
    S.view='intro';render();generateAll(run);return;
  }
  S.view='intro';render();generateAll(run);
}
// "Continue" on an already-started section opens it without resetting the timer
const _start=startSection;
startSection=function(k){const run=S.run;const st=run.state[k];if(st&&(k==='S'?st.started:st.deadline)&&!st.submitted){openSection(k);return}_start(k)};
window.addEventListener('beforeunload',()=>{if(S.run)saveRun(S.run)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.run)saveRun(S.run)});

/* ---------- boot ---------- */
async function boot(){
  render();
  try{const p=await Store.get('profile');if(p)S.profile=Object.assign(DEFAULT_PROFILE(),p)}catch(e){ctx.handleError(e)}
  try{const c=await Store.get('course');if(c&&Array.isArray(c.phases))S.course=c}catch(e){}
  setTargets();S.ready=true;render();
}
function mount(){ACTIVE=true;if(!S.ready&&!S.booting){S.booting=true;boot()}else render()}
function unmount(){ACTIVE=false;stopSpeech();ctx.stopDictation()}
return {mount,unmount,isBusy:()=>!!S.run};
}
