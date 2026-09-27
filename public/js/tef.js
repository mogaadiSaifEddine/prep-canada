// TEF Canada coach (module). Prompts live on the server; this file drives the UI.
export function createTEF(ctx){
"use strict";
const EXAM='tef';
let ACTIVE=false;
/* ---------- who ---------- */

/* ---------- constants ---------- */
const SK={L:'Compréhension orale',R:'Compréhension écrite',W:'Expression écrite',S:'Expression orale'};
const AB={L:'CO',R:'CE',W:'EE',S:'EO'};
const ORDER=['L','R','W','S'];
const SKCOL={L:'var(--cL)',R:'var(--cR)',W:'var(--cW)',S:'var(--cS)'};
const NCLC_T={
  L:[[546,10],[503,9],[462,8],[434,7],[393,6],[352,5],[306,4]],
  R:[[546,10],[503,9],[462,8],[434,7],[393,6],[352,5],[306,4]],
  W:[[558,10],[512,9],[472,8],[428,7],[379,6],[330,5],[268,4]],
  S:[[556,10],[518,9],[494,8],[456,7],[422,6],[387,5],[328,4]]
};
const RAWMAP=[[0,100],[8,230],[14,306],[18,352],[22,393],[25,434],[28,462],[32,503],[36,546],[40,699]];
const SEC={
  L:{mins:40,time:'40 min',note:'4 parties · 40 questions à choix multiple · chaque enregistrement n’est diffusé qu’une seule fois, sans retour en arrière'},
  R:{mins:60,time:'60 min',note:'4 parties · 40 questions à choix multiple · navigation libre'},
  W:{mins:60,time:'60 min',note:'Section A : suite d’un fait divers, 80 mots minimum, 25 min · Section B : défendre un point de vue, 200 mots minimum, 35 min'},
  S:{mins:15,time:'15 min',note:'Section A : obtenir des informations au téléphone, 5 min · Section B : convaincre un(e) ami(e), 10 min'}
};
const LPART=[
  {start:1,type:'messages',name:'Messages et annonces',desc:'short everyday recordings: phone messages, public announcements (station, airport, shop), short radio adverts. 5 or 6 documents, 1 or 2 questions each'},
  {start:11,type:'dialogues',name:'Conversations',desc:'everyday and workplace conversations between two people. 4 documents, 2 or 3 questions each'},
  {start:21,type:'radio',name:'Radio et informations',desc:'radio news items, short reports and cultural programmes. 3 documents, 3 or 4 questions each'},
  {start:31,type:'entretiens',name:'Entretiens et débats',desc:'longer radio interviews or debates with several viewpoints. 2 or 3 documents, 3 to 5 questions each, testing opinions, implicit meaning, tone and nuance'}
];
const RPART=[
  {start:1,type:'pratiques',name:'Documents pratiques',desc:'short practical documents: adverts, notices, timetables, menus, forms, short emails. 5 or 6 documents, 1 or 2 questions each'},
  {start:11,type:'presse',name:'Articles de presse',desc:'short press articles and news items. 3 or 4 documents, 2 or 3 questions each'},
  {start:21,type:'administratifs',name:'Textes administratifs et professionnels',desc:'administrative letters, workplace rules, contract extracts, official information. 3 documents, 3 or 4 questions each'},
  {start:31,type:'argumentatifs',name:'Textes d’opinion',desc:'longer opinion and argumentative texts (editorials, essays, columns) of 350 to 500 words. 2 documents, 5 questions each, testing the author’s viewpoint, implicit meaning and nuance'}
];
const TYPE_NAMES={messages:'CO · messages et annonces',dialogues:'CO · conversations',radio:'CO · radio',entretiens:'CO · entretiens et débats',pratiques:'CE · documents pratiques',presse:'CE · articles de presse',administratifs:'CE · textes administratifs',argumentatifs:'CE · textes d’opinion'};
const DIFF={
  foundation:{label:'Progressif',text:'the accessible end of real TEF Canada difficulty (aimed at moving a candidate from NCLC 5 to NCLC 6–7): clear documents, fewer traps'},
  exam:{label:'Niveau examen',text:'exactly real TEF Canada difficulty, with questions getting harder through the paper as in the real test'},
  advanced:{label:'Avancé',text:'the upper end of real TEF Canada difficulty (aimed at NCLC 9–10): dense documents, implicit meaning, subtle paraphrase and strong distractors'}
};
const DEFAULT_PROFILE=()=>({v:1,setupDone:false,examDate:'',target:7,about:'',studyTime:'1 heure par jour',scores:{L:null,R:null,W:null,S:null},placementDone:false,typeStats:{},usedTopics:[],history:[],activeAttemptId:null,errorPatterns:[]});

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const toArr=a=>Array.isArray(a)?a:(a==null||a===''?[]:[a]);
const norm=s=>String(s??'').toLowerCase().normalize('NFC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').replace(/^[\s"'(«]+|[\s.,;:!?"')»]+$/g,'').trim();
const words=s=>(String(s||'').trim().match(/\S+/g)||[]).length;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toISOString().slice(0,10);
const fmtS=s=>s==null?'–':String(Math.round(s));
function nclcOf(k,s){if(s==null)return null;for(const[m,n]of NCLC_T[k])if(s>=m)return n;return 3}
const nclcTxt=n=>n==null?'–':(n<4?'< 4':String(n));
function minFor(k,n){const r=NCLC_T[k].find(x=>x[1]===n);return r?r[0]:0}
function rawToScore(raw,total){const r=raw*40/Math.max(total,1);for(let i=1;i<RAWMAP.length;i++){const[a,sa]=RAWMAP[i-1],[b,sb]=RAWMAP[i];if(r<=b)return Math.round(sa+(sb-sa)*(r-a)/(b-a))}return 699}
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
function saveProfile(){return serial('profile',()=>Store.set('profile',S.profile).catch(()=>toast('La progression n’a pas pu être enregistrée.')))}
function saveCourse(){return serial('course',()=>Store.set('course',S.course).catch(()=>toast('Le parcours n’a pas pu être enregistré.')))}
function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}
function saveRunNow(run){return serial('a'+run.id,()=>Store.saveAttempt(run))}
let saveT=null;
function scheduleSave(){clearTimeout(saveT);saveT=setTimeout(()=>saveRun(S.run),8000)}

/* ---------- AI (server) ---------- */
const SAMPLE=true;
const ai=(task,params)=>ctx.ai(EXAM,task,params);
function weakTypes(skill){
  const st=S.profile.typeStats||{};const out=[];
  for(const key in st){const[k,t]=key.split(':');if(skill&&k!==skill)continue;const v=st[key];if(v.t>=3)out.push({skill:k,type:t,pct:Math.round(100*v.c/v.t),t:v.t})}
  return out.sort((a,b)=>a.pct-b.pct).slice(0,4);
}
function diffFor(run,k){return run.kind==='placement'?'exam':(run.diff==='auto'?autoDiff(k):run.diff)}
function autoDiff(k){const s=S.profile.scores[k];if(s==null)return'exam';const n=nclcOf(k,s);if(n<6)return'foundation';if(n>=8)return'advanced';return'exam'}
function fixDocs(docs,start){
  let n=start;const out=[];
  for(const d of toArr(docs)){
    if(!d||!Array.isArray(d.questions))continue;
    const qs=d.questions.map(q=>({n:n++,prompt:String(q.prompt||''),choices:toArr(q.choices).map(String),answer:String(toArr(q.answer)[0]||'A').trim().toUpperCase().charAt(0),evidence:String(q.evidence||''),explain:String(q.explain||'')}));
    out.push({kind:String(d.kind||''),heading:String(d.heading||''),body:String(d.body||''),context:String(d.context||''),speakers:toArr(d.speakers),script:toArr(d.script).map(l=>({speaker:String(l.speaker||''),text:String(l.text||'')})).filter(l=>l.text),questions:qs});
  }
  return out;
}
function fixContent(j,data){
  if(!data||typeof data!=='object')throw{code:'invalid_json'};
  if(j.k==='R'||j.k==='L'){const P=j.k==='R'?RPART:LPART;const docs=fixDocs(data.docs,P[j.i].start);if(!docs.length)throw{code:'invalid_json'};if(j.k==='L'&&docs.some(d=>!d.script.length))throw{code:'invalid_json'};return{title:String(data.title||''),type:P[j.i].type,docs}}
  if(j.k==='W'){if(!data.A||!data.B)throw{code:'invalid_json'};return data}
  if(j.k==='S'){if(!data.A||!data.B)throw{code:'invalid_json'};return data}
}

/* ---------- state ---------- */
const S={view:'home',profile:DEFAULT_PROFILE(),course:null,run:null,gen:{},timer:null,ready:false,dbOk:false};

/* ---------- generation ---------- */
const jobCount=k=>(k==='L'||k==='R')?4:1;
function jobsFor(run){const jobs=[];for(const k of run.sections)for(let i=0;i<jobCount(k);i++)if(!(run.content[k]&&run.content[k][i]))jobs.push({k,i});return jobs}
function sectionReady(run,k){for(let i=0;i<jobCount(k);i++)if(!(run.content[k]&&run.content[k][i]))return false;return true}
async function generateAll(run){
  const jobs=jobsFor(run).filter(j=>S.gen[j.k+j.i]!=='busy');let idx=0;
  const worker=async()=>{while(idx<jobs.length){const j=jobs[idx++];await genJob(run,j)}};
  await Promise.all([worker(),worker(),worker()]);
}
async function genJob(run,j){
  const key=j.k+j.i;S.gen[key]='busy';refreshPrep();
  try{
    const data=await ai('gen',{attemptId:run.id,k:j.k,i:j.i});
    if(S.run!==run)return;
    run.content[j.k]=run.content[j.k]||{};run.content[j.k][j.i]=fixContent(j,data);
    S.gen[key]='ok';saveRun(run);
  }catch(e){S.gen[key]={err:errCopy(e)}}
  refreshPrep();
}
function refreshPrep(){if(S.view==='intro')render();else if(S.view==='section'&&document.getElementById('waitpart'))render()}

/* ---------- runs ---------- */
function newRun(kind,sections,diff,label,unitId){return{id:'a'+uid(),kind,sections,diff:diff||'exam',label,unitId:unitId||null,startedAt:Date.now(),date:today(),content:{},answers:{L:{},R:{},W:{A:'',B:''},S:{A:[],B:[]}},state:{},results:{},status:'active'}}
async function startRun(run){
  if(S.starting)return;S.starting=true;
  try{const r=await ctx.api('POST','/api/attempts/start',{exam:EXAM,kind:run.unitId?'checkpoint':run.kind,sections:run.sections,diff:run.diff});run.id=r.id}
  catch(e){S.starting=false;ctx.handleError(e);return}
  S.starting=false;
  S.run=run;S.gen={};S.profile.activeAttemptId=run.id;saveProfile();saveRun(run);
  S.view='intro';render();generateAll(run);
}
const nextSection=run=>run.sections.find(k=>!run.results[k]);
function goIntro(){S.view='intro';stopTimer();stopSpeech();render();window.scrollTo(0,0)}
function started(run,k){const st=run.state[k];return !!(st&&st.started)}
function startSection(k){
  const run=S.run;
  if(!started(run,k)){
    const now=Date.now();
    if(k==='L')run.state.L={started:now,deadline:now+40*60000,pos:{p:0,d:0},played:{}};
    if(k==='R')run.state.R={started:now,deadline:now+60*60000};
    if(k==='W')run.state.W={started:now,phase:'A',deadline:now+25*60000};
    if(k==='S')run.state.S={started:now,phase:'A',deadline:null};
    saveRun(run);
  }
  S.view='section';S.sec=k;S.tab=0;S.confirmSubmit=false;render();window.scrollTo(0,0);startTimer();
}
function startTimer(){
  stopTimer();
  S.timer=setInterval(()=>{
    const run=S.run;if(!run||S.view!=='section')return;const k=S.sec;const st=run.state[k];
    const el=$('#timer');
    if(!st.deadline){if(el)el.textContent='--:--';return}
    const left=st.deadline-Date.now();
    if(el){el.textContent=fmtTime(left);el.classList.toggle('low',left<(k==='S'?60000:5*60000))}
    if(left<=0){
      if(k==='W'&&st.phase==='A'){toast('Fin de la section A. Passez à la section B.');toPhaseB('W');return}
      if(k==='S'&&st.phase==='A'){toast('Fin de la section A.');toPhaseB('S');return}
      stopTimer();submitSection(k,true);
    }
  },1000);
}
function stopTimer(){if(S.timer){clearInterval(S.timer);S.timer=null}}
function toPhaseB(k){
  const st=S.run.state[k];stopSpeech();
  if(k==='W'){st.phase='B';st.deadline=Date.now()+35*60000}
  if(k==='S'){st.phase='Bwait';st.deadline=null}
  S.confirmNext=false;saveRun(S.run);render();window.scrollTo(0,0);
}
async function submitSection(k,auto){
  const run=S.run;stopTimer();stopSpeech();
  if(auto)toast('Temps écoulé. Vos réponses ont été envoyées.');
  if(k==='L'||k==='R'){run.results[k]=autoMark(run,k);saveRun(run);afterSection()}
  else{run.state[k].submitted=true;saveRun(run);await markProduction(k)}
}
async function markProduction(k){
  S.view='marking';S.sec=k;S.markErr=null;render();
  try{const res=k==='W'?await markWriting(S.run):await markSpeaking(S.run);S.run.results[k]=res;saveRun(S.run);afterSection()}
  catch(e){S.markErr=errCopy(e);render()}
}
function afterSection(){if(nextSection(S.run)){goIntro();return}finishRun(S.run)}
function finishRun(run){
  run.status='done';run.finishedAt=Date.now();
  const p=S.profile;const scores={};
  for(const k of run.sections){const r=run.results[k];if(r&&r.score!=null){scores[k]=r.score;p.scores[k]=r.score}}
  const all=ORDER.every(k=>scores[k]!=null);
  run.nclc=all?Math.min(...ORDER.map(k=>nclcOf(k,scores[k]))):null;
  for(const k of ['L','R']){const r=run.results[k];if(!r)continue;for(const t in r.per){const key=k+':'+t;const s=p.typeStats[key]||(p.typeStats[key]={c:0,t:0});s.c+=r.per[t].c;s.t+=r.per[t].t}}
  const pats=[];for(const k of ['W','S']){const r=run.results[k];if(r&&Array.isArray(r.patterns))pats.push(...r.patterns.map(String))}
  if(pats.length)p.errorPatterns=[...new Set([...pats,...p.errorPatterns])].slice(0,10);
  const topics=[];for(const k of run.sections){const c=run.content[k]||{};for(const i in c){const x=c[i];if(!x)continue;if(x.title)topics.push(x.title);if(x.A&&x.A.topic)topics.push(x.A.topic);if(x.B&&x.B.topic)topics.push(x.B.topic)}}
  p.usedTopics=[...(p.usedTopics||[]),...topics].slice(-40);
  p.history=[...(p.history||[]),{id:run.id,date:run.date,kind:run.kind,label:run.label,scores,nclc:run.nclc}].slice(-60);
  if(run.kind==='placement')p.placementDone=true;
  p.activeAttemptId=null;
  if(run.unitId&&S.course){S.course.progress=S.course.progress||{};const k=run.sections[0];S.course.progress[run.unitId]={done:true,score:null,nclc:nclcOf(k,scores[k])};saveCourse()}
  saveProfile();saveRun(run);
  S.reportRun=run;S.run=null;S.view='report';render();window.scrollTo(0,0);
}
function autoMark(run,k){
  const items=[];const per={};const ans=run.answers[k]||{};
  for(let i=0;i<4;i++){const part=run.content[k]&&run.content[k][i];if(!part)continue;
    part.docs.forEach(d=>d.questions.forEach(q=>{
      const given=ans[q.n]||'';const ok=!!given&&given.toUpperCase()===q.answer;
      items.push({n:q.n,type:part.type,prompt:q.prompt,choices:q.choices,given,correct:q.answer,ok,evidence:q.evidence,explain:q.explain});
      const t=per[part.type]||(per[part.type]={c:0,t:0});t.t++;if(ok)t.c++;
    }))}
  items.sort((a,b)=>a.n-b.n);
  const raw=items.filter(i=>i.ok).length,total=items.length;
  return{raw,total,score:rawToScore(raw,total),per,items};
}

/* ---------- marking EE / EO ---------- */
async function markWriting(run){
  const c=run.content.W[0];const a=run.answers.W;
  await saveRunNow(run);
  const r=await ai('markW',{attemptId:run.id});const sc=Number(r.score);if(!isFinite(sc))throw{code:'invalid_json'};
  return{score:Math.max(0,Math.min(699,Math.round(sc))),A:r.A||{},B:r.B||{},criteria:toArr(r.criteria),errors:toArr(r.errors),patterns:toArr(r.patterns),model:r.model||null,next:toArr(r.next),wc:{A:words(a.A),B:words(a.B)}};
}
async function markSpeaking(run){
  const c=run.content.S[0];const A=run.answers.S;
  await saveRunNow(run);
  const r=await ai('markS',{attemptId:run.id});const sc=Number(r.score);if(!isFinite(sc))throw{code:'invalid_json'};
  return{score:Math.max(0,Math.min(699,Math.round(sc))),summary:r.summary||'',criteria:toArr(r.criteria),errors:toArr(r.errors),patterns:toArr(r.patterns),model:r.model||null,next:toArr(r.next),missed:toArr(r.missed_questions),turns:{A:A.A.filter(m=>m.role==='me').length,B:A.B.filter(m=>m.role==='me').length}};
}

/* ---------- speech (French TTS) ---------- */
const TTS='speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
let speakToken=0;
function stopSpeech(){speakToken++;ctx.stopAudio();if(TTS)try{speechSynthesis.cancel()}catch(e){}}
function voiceRank(v){let s=0;const n=v.name||'';if(/natural|neural|online|premium|enhanced|siri|wavenet|studio/i.test(n))s+=20;if(/google/i.test(n))s+=6;if(/fr[-_](FR|CA)/i.test(v.lang))s+=3;if(v.localService===false)s+=1;if(/compact|espeak/i.test(n))s-=40;return s}
function frVoices(){if(!TTS)return[];return speechSynthesis.getVoices().filter(v=>/^fr/i.test(v.lang)).sort((a,b)=>voiceRank(b)-voiceRank(a))}
const FEM=/female|femme|amélie|amelie|audrey|aurélie|aurelie|julie|marie|céline|celine|chantal|sylvie|denise|hortense|virginie|léa|lea|juliette|joana|google français|caroline|brigitte|eloise|vivienne|sylvie/i;
const MAL=/\bmale\b|homme|thomas|nicolas|daniel|henri|paul|claude|jacques|antoine|jean|guillaume|mathieu|remy|rémy|alain|jérôme|jerome|fabrice|gérard|gerard/i;
function pickVoices(speakers){
  const vs=frVoices();const map={};if(!vs.length)return map;const used=new Set();
  speakers.forEach((sp,i)=>{
    const g=String(sp.gender||'').toLowerCase();const want=g.startsWith('f')?FEM:g.startsWith('m')?MAL:null;
    const acc=String(sp.accent||'').toLowerCase();
    let v=vs.find(x=>!used.has(x.name)&&want&&want.test(x.name)&&(!acc||x.lang.toLowerCase().replace('_','-')===acc))||vs.find(x=>!used.has(x.name)&&want&&want.test(x.name))||vs.find(x=>!used.has(x.name))||vs[i%vs.length];
    used.add(v.name);map[sp.name]=v;
  });
  return map;
}
function chunks(text){const parts=String(text).match(/[^.!?…]+[.!?…]*\s*/g)||[text];const out=[];let cur='';for(const p of parts){if((cur+p).length>200&&cur){out.push(cur);cur=p}else cur+=p}if(cur.trim())out.push(cur);return out}
function speakLines(lines,voiceMap,onProgress,onDone){
  const tok=++speakToken;const queue=[];
  lines.forEach((l,li)=>chunks(l.text).forEach(c=>queue.push({li,text:c,speaker:l.speaker})));
  let i=0;
  const next=()=>{
    if(tok!==speakToken)return;
    if(i>=queue.length){onDone&&onDone();return}
    const item=queue[i++];const u=new SpeechSynthesisUtterance(item.text);
    const v=voiceMap[item.speaker];if(v){u.voice=v;u.lang=v.lang}else u.lang='fr-FR';
    u.rate=1;
    u.onend=()=>{onProgress&&onProgress(i/queue.length);setTimeout(next,queue[i]&&queue[i].li!==item.li?350:60)};
    u.onerror=u.onend;window.__utt=u;speechSynthesis.speak(u);
  };
  next();
}
if(TTS){try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>{}}catch(e){}}
const EXV=()=>pickVoices([{name:'ex',gender:'female'}]).ex;
function sayEx(text,role){if(ctx.ent(EXAM).tts){const tok=speakToken;ctx.say(EXAM,text,{role},()=>tok!==speakToken).then(ok=>{if(!ok&&tok===speakToken&&TTS)speakLines([{speaker:'ex',text}],{ex:EXV()})});return}if(TTS)speakLines([{speaker:'ex',text}],{ex:EXV()})}

/* ---------- listening flow ---------- */
function curDoc(run){const pos=run.state.L.pos;const part=run.content.L&&run.content.L[pos.p];if(!part)return{part:null,doc:null};return{part,doc:part.docs[pos.d]}}
function nextDoc(){
  const run=S.run;const pos=run.state.L.pos;const part=run.content.L[pos.p];stopSpeech();
  if(part&&pos.d+1<part.docs.length)pos.d++;else{pos.p++;pos.d=0}
  saveRun(run);
  if(pos.p>=4){submitSection('L',false);return}
  render();window.scrollTo(0,0);
}
function playDoc(){
  const run=S.run;const pos=run.state.L.pos;const key=pos.p+'_'+pos.d;const{doc}=curDoc(run);if(!doc||run.state.L.played[key])return;
  run.state.L.played[key]='playing';render();
  if(ctx.ent(EXAM).tts){playDocNatural(run,pos.p,pos.d,key,doc);return}
  saveRun(run);
  const sp=doc.speakers.length?doc.speakers:[{name:'Voix',gender:'female'}];
  const vm=pickVoices(sp);
  speakLines(doc.script,vm,p=>{const m=$('#lmeter');if(m)m.style.width=Math.round(p*100)+'%'},()=>{run.state.L.played[key]='done';saveRun(run);if(S.view==='section'&&S.sec==='L')render()});
}
function readOnce(){
  const run=S.run;const pos=run.state.L.pos;const key=pos.p+'_'+pos.d;const{doc}=curDoc(run);if(!doc||run.state.L.played[key])return;
  run.state.L.played[key]='done';saveRun(run);
  const box=$('#readonce');const btn=document.querySelector('[data-act="readonce"]');if(btn){btn.disabled=true;btn.textContent='Texte affiché'}
  box.innerHTML=doc.script.map(l=>'<p><b>'+h(l.speaker)+' :</b> '+h(l.text)+'</p>').join('');box.hidden=false;
  const ms=Math.max(15000,words(doc.script.map(l=>l.text).join(' '))/2.6*1000);
  setTimeout(()=>{box.innerHTML='';box.hidden=true},ms);
}

async function playDocNatural(run,p,d,key,doc){
  const tok=++speakToken;
  const status=t=>{const el=$('#lstatus');if(el)el.textContent=t};
  const done=()=>{run.state.L.played[key]='done';saveRun(run);if(S.view==='section'&&S.sec==='L')render()};
  const fallback=()=>{const vm=pickVoices(doc.speakers.length?doc.speakers:[{name:'Voix',gender:'female'}]);speakLines(doc.script,vm,x=>{const m=$('#lmeter');if(m)m.style.width=Math.round(x*100)+'%'},done,tok)};
  status('Chargement de l’enregistrement…');
  let plan;
  try{await saveRunNow(run);plan=await ctx.api('POST','/api/tts/plan',{exam:EXAM,attemptId:run.id,part:p,doc:d})}
  catch(e){if(tok===speakToken){status('Voix de studio indisponibles : voix de l’appareil.');fallback()}return}
  if(tok!==speakToken)return;
  const q=ctx.audioSeries('/api/tts/chunk?exam='+EXAM+'&attemptId='+encodeURIComponent(run.id)+'&part='+p+'&doc='+d,plan.chunks.length);
  for(let n=0;n<Math.min(3,plan.chunks.length);n++)q.prefetch(n);
  status('Écoute en cours');
  for(let n=0;n<plan.chunks.length;n++){
    if(tok!==speakToken)return;
    if(n+2<plan.chunks.length)q.prefetch(n+2);
    const ok=await q.play(n,()=>tok!==speakToken);
    if(!ok&&tok===speakToken){q.dispose();fallback();return}
    const m=$('#lmeter');if(m)m.style.width=Math.round((n+1)/plan.chunks.length*100)+'%';
  }
  q.dispose();if(tok===speakToken)done();
}

/* ---------- speaking flow ---------- */
function beginSpeak(sec){
  const run=S.run;const st=run.state.S;const c=run.content.S[0];
  st.phase=sec;st.deadline=Date.now()+(sec==='A'?5:10)*60000;
  const opening=sec==='A'?c.A.opening:c.B.opening;
  if(!run.answers.S[sec].length)run.answers.S[sec].push({role:'ex',text:String(opening||'Bonjour !')});
  saveRun(run);render();sayEx(run.answers.S[sec][run.answers.S[sec].length-1].text,sec==='B'?'friend':'staff');
}
async function sendSpeak(){
  const run=S.run;const st=run.state.S;const sec=st.phase;if(sec!=='A'&&sec!=='B')return;
  const box=$('#spk');const txt=(box&&box.value||'').trim();if(!txt||S.exBusy)return;
  run.answers.S[sec].push({role:'me',text:txt});S.draft='';S.exBusy=true;render();
  try{
    await saveRunNow(run);
    const reply=String((await ai('examiner',{attemptId:run.id,sec})).text||'').trim();
    if(S.run!==run||st.phase!==sec)return;
    run.answers.S[sec].push({role:'ex',text:reply});sayEx(reply,sec==='B'?'friend':'staff');
  }catch(e){toast(errCopy(e))}
  S.exBusy=false;saveRun(run);render();ctx.stopDictation();
}

/* ---------- course ---------- */
async function buildCourse(){
  S.courseBusy=true;S.courseErr=null;render();
  try{
    const r=await ai('course',{});if(!r||!Array.isArray(r.phases))throw{code:'invalid_json'};
    r.phases.forEach(ph=>{ph.units=toArr(ph.units).map((u,i)=>({id:String(u.id||('u'+i)),skill:ORDER.includes(u.skill)?u.skill:'W',title:String(u.title||''),goal:String(u.goal||''),checkpoint:!!u.checkpoint}))});
    S.course={title:String(r.title||'Votre parcours'),summary:String(r.summary||''),phases:r.phases,createdAt:Date.now(),progress:{},version:uid()};saveCourse();
  }catch(e){S.courseErr=errCopy(e)}
  S.courseBusy=false;render();
}
const allUnits=()=>S.course?S.course.phases.flatMap(p=>p.units):[];
async function openUnit(id){
  const u=allUnits().find(x=>x.id===id);if(!u)return;
  S.view='lesson';S.lessonUnit=u;S.lesson=null;S.lessonErr=null;S.quizChecked=false;S.taskFb=null;S.taskAns='';render();window.scrollTo(0,0);
  if(u.checkpoint)return;
  const key=S.course.version+'_'+u.id;let l=null;try{l=await Store.getLesson(key)}catch(e){}
  if(l){S.lesson=l;render();return}
  await genLesson(u,key);
}
async function genLesson(u,key){
  S.lessonBusy=true;render();
  try{
    const r=await ai('lesson',{unitId:u.id});if(!r||!Array.isArray(r.quiz))throw{code:'invalid_json'};
    S.lesson=r;await Store.setLesson(key,r).catch(()=>{});
  }catch(e){S.lessonErr=errCopy(e)}
  S.lessonBusy=false;render();
}
function checkQuiz(){
  const l=S.lesson;let c=0;
  l.quiz.forEach((q,i)=>{
    const el=document.querySelector('[name="lq'+i+'"]:checked')||document.getElementById('lq'+i);const v=el?el.value:'';q._given=v;
    q._ok=q.type==='mcq'?String(q.answer).trim().toUpperCase().charAt(0)===String(v).toUpperCase():toArr(q.answer).some(a=>norm(a)===norm(v));
    if(q._ok)c++;
  });
  const pct=Math.round(100*c/l.quiz.length);S.quizChecked=true;S.quizScore=pct;
  const u=S.lessonUnit;S.course.progress=S.course.progress||{};const prev=S.course.progress[u.id];
  S.course.progress[u.id]={done:pct>=70||!!(prev&&prev.done),score:Math.max(pct,prev&&prev.score||0)};
  saveCourse();render();
}
async function taskFeedback(){
  const txt=($('#taskans')||{}).value||'';
  if(words(txt)<20){toast('Écrivez au moins 20 mots.');return}
  S.taskAns=txt;S.taskBusy=true;S.taskFb=null;render();
  try{
    const l=S.lesson,u=S.lessonUnit;
    S.taskFb=await ai('taskfb',{unitId:u.id,answer:txt});
  }catch(e){S.taskFb={err:errCopy(e)}}
  S.taskBusy=false;render();
}

/* ---------- views ---------- */
function render(){
  const app=$('#app');
  if(!S.ready){app.innerHTML='<div class="row"><span class="spinner"></span><span class="muted">Chargement de votre coach…</span></div>';return}
  const inTest=['intro','section','marking'].includes(S.view);
  const v={home:viewHome,tests:viewTests,course:viewCourse,lesson:viewLesson,history:viewHistory,report:viewReport,intro:viewIntro,section:viewSection,marking:viewMarking}[S.view];
  if(!ACTIVE)return;
  app.innerHTML=(inTest?'':topBar())+v();
  ctx.afterRender&&ctx.afterRender();
  if(S.view==='section'&&S.sec==='S'){const el=$('#spk');if(el){el.focus()}const ch=$('#chat');if(ch)ch.scrollTop=ch.scrollHeight}
}
function topBar(){
  const nav=[['home','Tableau de bord'],['tests','Tests'],['course','Parcours'],['history','Résultats']];
  return ctx.header(EXAM,nav,S.view==='lesson'?'course':S.view,'TEF Canada · objectif NCLC '+S.profile.target);
}
function skillCard(k){
  const s=S.profile.scores[k];const n=nclcOf(k,s);const tgt=S.profile.target;const tmin=minFor(k,tgt);
  const pct=s==null?0:Math.min(100,s/699*100);const tp=tmin/699*100;
  const status=s==null?'<span class="pill">Pas encore testé</span>':n>=tgt?'<span class="pill good">Objectif atteint</span>':'<span class="pill '+(tmin-s<=30?'warn':'bad')+'">+'+(tmin-s)+' points</span>';
  return '<div class="panel skill"><div class="head"><div class="row"><span class="letter" style="background:'+SKCOL[k]+'">'+AB[k]+'</span><b>'+SK[k]+'</b></div>'+status+'</div>'+
  '<div class="band mono">'+fmtS(s)+'<small>'+(s!=null?'/ 699 · NCLC '+nclcTxt(n):'')+'</small></div>'+
  '<div class="scale" role="img" aria-label="Score '+fmtS(s)+', objectif '+tmin+'"><div class="fill" style="width:'+pct+'%;background:'+SKCOL[k]+'"></div><div class="tick" style="left:'+tp+'%"></div></div>'+
  '<div class="scale-labels"><span>0</span><span>NCLC '+tgt+' = '+tmin+'+</span><span>699</span></div></div>';
}
function nclcNow(){const s=S.profile.scores;if(ORDER.some(k=>s[k]==null))return null;return Math.min(...ORDER.map(k=>nclcOf(k,s[k])))}
function viewHome(){
  const p=S.profile;const n=nclcNow();let hero='';
  if(p.activeAttemptId){
    hero='<div class="panel"><p class="eyebrow">Test non terminé</p><h2>Un test est en cours</h2><p class="muted">Reprenez là où vous vous êtes arrêté. Une épreuve déjà commencée garde son chronomètre d’origine.</p><div class="row"><button class="btn primary" data-act="resume">Reprendre le test</button><button class="btn" data-act="discard">Abandonner</button></div>'+(S.confirmDiscard?'<div class="banner">Abandonner ce test ? Ses réponses ne compteront pas. <button class="btn sm" data-act="discard-yes">Oui, abandonner</button> <button class="btn sm" data-act="discard-no">Non</button></div>':'')+'</div>';
  }else if(!p.placementDone){
    hero='<div class="panel"><p class="eyebrow">Étape 1 · Test de positionnement</p><h1>Trouvez votre vrai niveau de départ</h1><p style="max-width:62ch">Un TEF Canada complet, dans les quatre compétences, avec le format et les durées de l’examen réel. Vos résultats fixent le niveau de votre parcours et de tous les tests blancs suivants. Vous pouvez faire une pause entre les épreuves : chaque chronomètre ne démarre que lorsque vous cliquez sur Commencer.</p>'+
    '<div class="tablewrap"><table><thead><tr><th>Épreuve</th><th>Format</th><th class="mono">Durée</th></tr></thead><tbody>'+ORDER.map(k=>'<tr><td><b>'+SK[k]+'</b></td><td>'+h(SEC[k].note)+'</td><td class="mono">'+SEC[k].time+'</td></tr>').join('')+'</tbody></table></div>'+
    '<div class="row"><button class="btn primary" data-act="placement" '+(SAMPLE?'':'disabled')+'>Commencer le test de positionnement</button><span class="small muted">Environ 2 h 55 au total, plus les pauses.</span></div></div>';
  }else{
    const next=S.course?allUnits().find(u=>!((S.course.progress||{})[u.id]||{}).done):null;
    hero='<div class="panel"><div class="row between"><div class="stack" style="gap:6px"><p class="eyebrow">Niveau global</p><div class="row" style="align-items:baseline"><span class="bigband mono">NCLC '+nclcTxt(n)+'</span></div><p class="muted small">Votre niveau NCLC est fixé par votre compétence la plus faible. Objectif : NCLC '+p.target+' partout.</p></div>'+
    '<div class="stack" style="gap:8px;align-items:flex-start">'+(S.course?(next?'<button class="btn primary" data-unit="'+next.id+'">Continuer : '+h(next.title)+'</button>':'<span class="pill good">Parcours terminé</span>'):'<button class="btn primary" data-act="build">Créer mon parcours</button>')+'<button class="btn" data-nav="tests">Nouveau test blanc</button></div></div></div>';
  }
  const weak=weakTypes();const pats=(p.errorPatterns||[]).slice(0,6);
  return '<div class="row between"><div><p class="eyebrow">'+new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+'</p><h2>Bonjour '+h(ctx.firstName())+'</h2></div><div class="row">'+(daysLeft()!=null?'<span class="pill"><span class="mono">'+daysLeft()+'</span> jours avant l’examen</span>':'')+ctx.planPill(EXAM)+'</div></div>'+
  (S.profile.setupDone?'':setupPanel(true))+hero+'<div class="grid">'+ORDER.map(skillCard).join('')+'</div>'+
  '<div class="grid"><div class="panel"><h3>Erreurs à surveiller</h3>'+(pats.length?'<ul class="stack" style="gap:6px;margin:0;padding-left:18px">'+pats.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>':'<p class="muted">Apparaît après votre première épreuve d’expression.</p>')+'</div>'+
  '<div class="panel"><h3>Types de documents les plus difficiles</h3>'+(weak.length?'<div class="stack" style="gap:8px">'+weak.map(w=>'<div class="row between"><span>'+h(TYPE_NAMES[w.type]||w.type)+'</span><span class="pill '+(w.pct<50?'bad':w.pct<70?'warn':'good')+' mono">'+w.pct+'% sur '+w.t+'</span></div>').join('')+'</div>':'<p class="muted">Apparaît après votre première épreuve de compréhension.</p>')+'</div></div>'+
  trendChart()+
  (S.profile.setupDone?setupPanel(false):'');
}
function setupPanel(first){
  const p=S.profile;
  return '<div class="panel'+(first?'':' flat')+'"><p class="eyebrow">'+(first?'Avant de commencer':'Réglages')+'</p>'+(first?'<h2>Configurez votre coach TEF</h2><p class="muted" style="max-width:62ch">Ces informations adaptent vos tests, la correction et votre parcours. Vous pourrez les modifier plus tard.</p>':'')+
  '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">'+
  '<label class="stack" style="gap:6px"><span class="small muted">Objectif</span><select id="target">'+[5,6,7,8,9,10].map(x=>'<option value="'+x+'" '+(p.target===x?'selected':'')+'>NCLC '+x+'</option>').join('')+'</select></label>'+
  '<label class="stack" style="gap:6px"><span class="small muted">Date de l’examen (si réservée)</span><input type="date" id="examdate" value="'+h(p.examDate)+'"></label>'+
  '<label class="stack" style="gap:6px"><span class="small muted">Temps d’étude</span><select id="set-time">'+['30 minutes par jour','1 heure par jour','1 h 30 par jour','2 heures ou plus par jour'].map(x=>'<option '+(p.studyTime===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div>'+
  '<label class="stack" style="gap:6px"><span class="small muted">À propos de vous (facultatif) : métier, pays, langues. Sert à rendre les exemples pertinents.</span><input type="text" id="set-about" maxlength="280" style="width:100%" value="'+h(p.about)+'" placeholder="ex. Développeur en Tunisie, parle arabe et anglais"></label>'+
  '<p class="small muted">NCLC 7 dans les quatre compétences donne les points bonus pour le français dans l’Entrée express.</p>'+
  '<div class="row"><button class="btn '+(first?'primary':'sm')+'" data-act="savesettings">'+(first?'Enregistrer et continuer':'Enregistrer')+'</button>'+(first?'':'<span class="small muted">'+(S.confirmReset?'Tout effacer (résultats TEF, parcours) ? <button class="btn sm" data-act="reset-yes">Tout effacer</button> <button class="btn sm" data-act="reset-no">Annuler</button>':'<button class="link" data-act="reset">Réinitialiser la progression TEF</button>')+'</span>')+'</div></div>';
}
function trendChart(){
  const hist=S.profile.history||[];if(!hist.length)return '';
  const W=640,H=220,pl=40,pr=14,pt=14,pb=28;const n=hist.length;
  const x=i=>n===1?pl+(W-pl-pr)/2:pl+i*(W-pl-pr)/(n-1);const y=s=>pt+(699-s)/(699-200)*(H-pt-pb);
  let g='';for(const s of [200,300,400,500,600,699])g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y(s)+'" y2="'+y(s)+'" stroke="var(--line)"/><text x="'+(pl-8)+'" y="'+(y(s)+4)+'" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">'+s+'</text>';
  let lines='';
  for(const k of ORDER){const pts=hist.map((e,i)=>e.scores&&e.scores[k]!=null?[x(i),y(Math.max(200,e.scores[k]))]:null).filter(Boolean);if(!pts.length)continue;
    if(pts.length>1)lines+='<polyline fill="none" stroke="'+SKCOL[k]+'" stroke-width="2.5" stroke-linejoin="round" points="'+pts.map(p=>p.join(',')).join(' ')+'"/>';
    pts.forEach((p,i)=>{lines+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(i===pts.length-1?4.5:3)+'" fill="'+SKCOL[k]+'"/>'})}
  const labels=hist.map((e,i)=>(n<=8||i===0||i===n-1)?'<text x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono,monospace">'+h(e.date.slice(5))+'</text>':'').join('');
  return '<div class="panel chart"><div class="row between"><h3>Évolution des scores</h3><div class="legend">'+ORDER.map(k=>'<span><i style="background:'+SKCOL[k]+'"></i>'+AB[k]+'</span>').join('')+'</div></div><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Scores TEF au fil du temps">'+g+lines+labels+'</svg></div>';
}
function viewTests(){
  const p=S.profile;const busy=!!p.activeAttemptId;const sel=S.mock||(S.mock={type:'full',diff:'auto'});
  const types=[['full','Test complet','4 épreuves · environ 2 h 55'],['L','Compréhension orale','40 min · 40 questions'],['R','Compréhension écrite','60 min · 40 questions'],['W','Expression écrite','60 min · sections A et B'],['S','Expression orale','15 min · deux jeux de rôle']];
  const diffs=[['auto','Auto'],['foundation','Progressif'],['exam','Niveau examen'],['advanced','Avancé']];
  const gaps=ORDER.filter(k=>p.scores[k]!=null).map(k=>({k,gap:minFor(k,p.target)-p.scores[k]})).sort((a,b)=>b.gap-a.gap)[0];
  return (!p.placementDone&&!busy?'<div class="banner">Faites d’abord le test de positionnement pour que les tests blancs s’adaptent à votre niveau. <button class="btn sm primary" data-act="placement" '+(SAMPLE?'':'disabled')+'>Commencer</button></div>':'')+
  (busy?'<div class="banner">Un test est en cours. <button class="btn sm primary" data-act="resume">Le reprendre</button></div>':'')+
  (ctx.ent(EXAM).paid?'':'<div class="banner small">Offre gratuite : 1 test blanc par mois et 1 test de positionnement. <a href="#/plans">Voir les offres</a> pour des tests illimités et des voix naturelles.</div>')+'<div class="panel"><p class="eyebrow">Générateur de tests blancs</p><h2>Créer un nouveau test blanc</h2><p class="muted" style="max-width:64ch">Chaque test est inédit. Le mode Auto suit votre dernier score dans chaque compétence, et les épreuves de compréhension insistent sur les types de documents où vous perdez le plus de points.'+(gaps&&gaps.gap>0?' Votre plus grand écart : <b>'+SK[gaps.k]+'</b> ('+p.scores[gaps.k]+' → '+minFor(gaps.k,p.target)+').':'')+'</p>'+
  '<div class="stack"><span class="eyebrow">Test</span><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">'+types.map(([v,l,d])=>'<label class="choice"><input type="radio" name="mtype" value="'+v+'" '+(sel.type===v?'checked':'')+'><span class="mono">'+(v==='full'?'4':AB[v])+'</span><span><b>'+l+'</b><br><span class="small muted">'+d+'</span></span></label>').join('')+'</div></div>'+
  '<div class="stack"><span class="eyebrow">Difficulté</span><div class="opts">'+diffs.map(([v,l])=>'<label class="opt"><input type="radio" name="mdiff" value="'+v+'" '+(sel.diff===v?'checked':'')+'><span>'+l+'</span></label>').join('')+'</div><p class="small muted">'+(sel.diff==='auto'?(sel.type==='full'?ORDER:[sel.type]).map(k=>AB[k]+' : '+DIFF[autoDiff(k)].label).join(' · '):'Toutes les épreuves au niveau « '+DIFF[sel.diff].label+' ».')+'</p></div>'+
  '<div class="row"><button class="btn primary" data-act="mock" '+(busy||!SAMPLE?'disabled':'')+'>Créer et commencer</button><span class="small muted">Le test est écrit pendant que vous lisez les consignes. La première partie est prête en une minute environ.</span></div></div>';
}
function viewIntro(){
  const run=S.run;const k=nextSection(run);const done=run.sections.filter(x=>run.results[x]);
  const inProg=k&&started(run,k)&&!run.state[k].submitted;
  const prep=[];
  for(const s of run.sections)for(let i=0;i<jobCount(s);i++){const ok=run.content[s]&&run.content[s][i];const g=S.gen[s+i];const name=jobCount(s)>1?AB[s]+' · partie '+(i+1):SK[s]+' · sujet';prep.push('<div class="prep">'+(ok?'<span class="pill good">Prêt</span>':g&&g.err?'<span class="pill bad">Échec</span>':'<span class="spinner"></span>')+'<span>'+name+'</span></div>')}
  const busyGen=Object.values(S.gen).some(g=>g==='busy');const failed=Object.values(S.gen).find(g=>g&&g.err);
  const ready=k&&(jobCount(k)>1?!!(run.content[k]&&run.content[k][0]):sectionReady(run,k));
  const tips={
    L:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Chaque document est lu <b>une seule fois</b> par '+(ctx.ent(EXAM).tts?'des voix naturelles de studio':'la voix de votre appareil')+', et vous ne pouvez pas revenir en arrière. Utilisez des écouteurs.</li><li>Lisez les questions avant de cliquer sur Écouter.</li><li>Les questions deviennent plus difficiles au fil des parties, comme à l’examen.</li>'+(TTS?'':'<li><b>Aucune voix française dans ce navigateur :</b> chaque texte s’affiche une seule fois, puis disparaît.</li>')+'</ul>',
    R:'<ul class="small muted" style="margin:0;padding-left:18px"><li>40 questions en 60 minutes : environ 1 min 30 par question. Ne restez pas bloqué.</li><li>Pas de point négatif : répondez à toutes les questions.</li></ul>',
    W:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Section A (25 min) puis section B (35 min), chronométrées séparément : on ne revient pas à la section A.</li><li>Le compteur de mots s’affiche, comme à l’examen sur ordinateur.</li></ul>',
    S:'<ul class="small muted" style="margin:0;padding-left:18px"><li>Votre coach IA joue l’examinateur et vous répond'+(ctx.ent(EXAM).tts?' avec une voix naturelle':', avec la voix de votre appareil si elle existe')+'.</li><li>'+(ctx.canDictate?'Appuyez sur <b>Parler</b> et répondez à voix haute : vos phrases s’écrivent pendant que vous parlez.':'Parlez en utilisant le micro de dictée de votre clavier : vos phrases s’écrivent pendant que vous parlez.')+' Envoyez chaque réplique.</li><li>Section A : vouvoiement, une dizaine de questions. Section B : tutoiement, arguments et réponses aux objections.</li><li>La prononciation ne peut pas être évaluée à partir d’un texte.</li></ul>'
  };
  return '<div class="panel"><div class="row between"><div><p class="eyebrow">'+h(run.label)+'</p><h2>'+(k?(inProg?'Reprendre : ':'Prochaine épreuve : ')+SK[k]:'Toutes les épreuves sont terminées')+'</h2></div><button class="btn sm" data-act="leave">Enregistrer et quitter</button></div>'+
  (k?'<p>'+h(SEC[k].note)+'.</p>'+tips[k]:'')+
  (done.length?'<p class="small muted">Terminé : '+done.map(x=>AB[x]+' '+run.results[x].score).join(' · ')+'</p>':'')+
  '<div class="row">'+(k?(ready?'<button class="btn primary" data-act="start" data-k="'+k+'">'+(inProg?'Continuer':'Commencer · '+SEC[k].time)+'</button>':'<button class="btn primary" disabled>Préparation de l’épreuve…</button>'):'')+(failed&&!busyGen?'<button class="btn" data-act="regen">Réessayer</button>':'')+'</div>'+
  (failed&&!busyGen?'<p class="banner bad small">'+h(failed.err)+'</p>':'')+
  '<div class="stack" style="gap:8px"><span class="eyebrow">Préparation du sujet</span><div class="prepgrid">'+prep.join('')+'</div></div></div>';
}
function viewMarking(){
  const k=S.sec;
  return '<div class="panel"><p class="eyebrow">'+SK[k]+'</p>'+(S.markErr?'<h2>La correction n’a pas abouti</h2><p>'+h(S.markErr)+' Vos réponses sont enregistrées.</p><div class="row"><button class="btn primary" data-act="remark">Relancer la correction</button><button class="btn" data-act="leave">Enregistrer et quitter</button></div>':'<div class="row"><span class="spinner"></span><h2>Correction en cours</h2></div><p class="muted">Correction selon les critères du TEF Canada. Cela prend généralement moins d’une minute.</p>')+'</div>';
}
function timerNow(){const run=S.run;if(!run)return'--:--';const st=run.state[S.sec]||{};return st.deadline?fmtTime(st.deadline-Date.now()):'--:--'}
function examBar(k,extra,noSubmit){
  return '<div class="exambar"><div><div class="small" style="opacity:.75">'+h(S.run.label)+'</div><b>'+SK[k]+'</b>'+(extra||'')+'</div><div class="row"><span class="timer mono" id="timer">'+timerNow()+'</span>'+(noSubmit?'':'<button class="btn sm" data-act="ask-submit">Terminer l’épreuve</button>')+'</div></div>'+
  (S.confirmSubmit?'<div class="banner">Terminer '+SK[k].toLowerCase()+' maintenant ? Vous ne pourrez pas y revenir. '+unanswered(k)+' <button class="btn sm primary" data-act="submit">Terminer</button> <button class="btn sm" data-act="cancel-submit">Continuer</button></div>':'');
}
function unanswered(k){
  if(k==='W'){const a=S.run.answers.W;return 'Section A : '+words(a.A)+' mots, section B : '+words(a.B)+' mots.'}
  if(k==='S')return '';
  const ans=S.run.answers[k]||{};let t=0,u=0;const c=S.run.content[k]||{};for(const i in c)c[i].docs.forEach(d=>d.questions.forEach(q=>{t++;if(!ans[q.n])u++}));return u?u+' question(s) sans réponse sur '+t+'.':'Toutes les questions ont une réponse.';
}
function waitPanel(label){const g=S.gen[S.sec+(S.sec==='L'?S.run.state.L.pos.p:S.tab)];return '<div class="panel" id="waitpart">'+(g&&g.err?'<p class="banner bad">'+h(g.err)+'</p><button class="btn" data-act="regen">Réessayer</button>':'<div class="row"><span class="spinner"></span><b>'+label+' est encore en cours d’écriture.</b></div><p class="muted">Elle apparaîtra ici dès qu’elle sera prête.</p>')+'</div>'}
function renderQs(qs,ans){
  return qs.map(q=>'<div class="q"><span class="qn mono">'+q.n+'</span><div class="qbody"><p>'+h(q.prompt)+'</p><div class="mcq">'+q.choices.map((c,i)=>{const L='ABCD'[i];return '<label class="choice"><input type="radio" name="q'+q.n+'" value="'+L+'" data-n="'+q.n+'" '+(ans[q.n]===L?'checked':'')+'><span class="mono">'+L+'</span><span>'+h(stripLetter(c,L))+'</span></label>'}).join('')+'</div></div></div>').join('');
}
function viewSection(){return({L:viewListening,R:viewReading,W:viewWriting,S:viewSpeaking})[S.sec]()}
function viewReading(){
  const run=S.run;const part=run.content.R[S.tab];
  const tabs='<div class="tabs" role="tablist">'+RPART.map((p,i)=>'<button role="tab" data-tab="'+i+'" aria-selected="'+(S.tab===i)+'">'+(i+1)+' · '+p.name+'</button>').join('')+'</div>';
  if(!part)return examBar('R')+tabs+waitPanel('La partie '+(S.tab+1));
  return examBar('R')+tabs+part.docs.map(d=>'<div class="split"><div class="panel">'+(d.kind?'<span class="dockind">'+h(d.kind)+'</span>':'')+(d.heading?'<h3>'+h(d.heading)+'</h3>':'')+'<div class="doc">'+h(d.body)+'</div></div><div class="panel">'+renderQs(d.questions,run.answers.R)+'</div></div>').join('')+
  '<div class="row">'+(S.tab<3?'<button class="btn dark" data-tab="'+(S.tab+1)+'">Partie suivante</button>':'<button class="btn primary" data-act="ask-submit">Terminer la compréhension écrite</button>')+'</div>';
}
function viewListening(){
  const run=S.run;const pos=run.state.L.pos;const{part,doc}=curDoc(run);
  const head='<p class="small muted">Partie '+(pos.p+1)+' sur 4 · '+LPART[Math.min(pos.p,3)].name+'</p>';
  if(!part)return examBar('L','',true)+head+waitPanel('La partie '+(pos.p+1));
  const key=pos.p+'_'+pos.d;const st=run.state.L.played[key];
  const player=(TTS||ctx.ent(EXAM).tts)?'<div class="player"><button class="btn primary" data-act="play" '+(st?'disabled':'')+'>'+(st==='done'?'Écouté':st==='playing'?'Écoute en cours…':'Écouter le document')+'</button><div class="meter" aria-hidden="true"><i id="lmeter" style="width:'+(st==='done'?100:0)+'%"></i></div><span class="small muted" id="lstatus">Une seule écoute</span></div>'
    :'<div class="player"><button class="btn primary" data-act="readonce" '+(st?'disabled':'')+'>'+(st?'Texte affiché':'Afficher le texte une fois')+'</button><span class="small muted">Aucune voix française : le texte s’affiche une fois, puis disparaît.</span></div><div id="readonce" class="panel flat" hidden></div>';
  const last=pos.p===3&&pos.d===part.docs.length-1;
  return examBar('L','',true)+head+'<div class="panel"><p class="eyebrow">Document '+(pos.d+1)+' sur '+part.docs.length+'</p><p><b>'+h(doc.context)+'</b></p>'+player+renderQs(doc.questions,run.answers.L)+
  '<div class="row"><button class="btn '+(last?'primary':'dark')+'" data-act="nextdoc" '+(st==='playing'?'disabled':'')+'>'+(last?'Terminer la compréhension orale':'Document suivant')+'</button><span class="small muted">Pas de retour en arrière.</span></div></div>';
}
function viewWriting(){
  const run=S.run;const c=run.content.W[0];const st=run.state.W;const a=run.answers.W;const sec=st.phase;
  const task=sec==='A'?'<p class="eyebrow">Section A · 25 minutes · 80 mots minimum</p><div class="ad">'+h(c.A.source)+'</div><p><b>'+h(c.A.consigne)+'</b></p>'
    :'<p class="eyebrow">Section B · 35 minutes · 200 mots minimum</p><div class="ad">'+h(c.B.statement)+'</div><p><b>'+h(c.B.consigne)+'</b></p>';
  const val=a[sec]||'';const min=sec==='A'?80:200;const n=words(val);
  return examBar('W',' · section '+sec,sec==='A')+
  (S.confirmNext?'<div class="banner">Passer à la section B ? Vous ne pourrez pas revenir à la section A ('+words(a.A)+' mots). <button class="btn sm primary" data-act="tob">Passer à la section B</button> <button class="btn sm" data-act="cancel-next">Continuer</button></div>':'')+
  '<div class="split"><div class="panel">'+task+'</div><div class="panel"><label for="wtext" class="eyebrow">Votre texte</label><textarea id="wtext" class="big" data-w="'+sec+'" spellcheck="false" lang="fr">'+h(val)+'</textarea><div class="row between"><span class="wc'+(n>=min?' ok':'')+'" id="wc">'+n+' mots</span>'+(sec==='A'?'<button class="btn dark" data-act="ask-next">Passer à la section B</button>':'<button class="btn primary" data-act="ask-submit">Terminer l’expression écrite</button>')+'</div></div></div>';
}
function viewSpeaking(){
  const run=S.run;const c=run.content.S[0];const st=run.state.S;
  if(st.phase==='Bwait'||(st.phase==='A'&&!run.answers.S.A.length)){
    const sec=st.phase==='A'?'A':'B';const d=c[sec];
    return examBar('S',' · section '+sec,true)+'<div class="panel"><p class="eyebrow">Section '+sec+' · '+(sec==='A'?'5':'10')+' minutes</p><h2>'+(sec==='A'?'Obtenir des informations':'Convaincre un(e) ami(e)')+'</h2><div class="ad">'+h(d.ad)+'</div><p>'+(sec==='A'?'Vous avez lu cette annonce et vous téléphonez pour obtenir plus d’informations. Posez une dizaine de questions. L’examinateur joue le rôle de '+h(d.role)+'. Vouvoiement.':'Vous avez lu cette annonce. Vous essayez de convaincre un(e) ami(e) de '+h(d.goal)+'. L’examinateur joue votre ami(e) : il va faire des objections. Tutoiement.')+'</p><div class="row"><button class="btn primary" data-act="speakstart" data-sec="'+sec+'">Commencer la section '+sec+'</button><span class="small muted">Le chronomètre démarre au clic.</span></div></div>';
  }
  const sec=st.phase;const d=c[sec];const log=run.answers.S[sec];
  return examBar('S',' · section '+sec,true)+'<div class="split"><div class="panel"><p class="eyebrow">Section '+sec+' · '+(sec==='A'?'vouvoiement':'tutoiement')+'</p><div class="ad small">'+h(d.ad)+'</div>'+(sec==='B'?'<p class="small"><b>Objectif :</b> convaincre votre ami(e) de '+h(d.goal)+'.</p>':'')+'</div>'+
  '<div class="panel"><div class="chat" id="chat" aria-live="polite">'+log.map(m=>'<div class="msg '+(m.role==='ex'?'ex':'me')+'">'+h(m.text)+'</div>').join('')+(S.exBusy?'<div class="msg ex"><span class="spinner" style="display:inline-block;vertical-align:middle"></span></div>':'')+'</div>'+
  '<label for="spk" class="eyebrow">Votre réplique (dictée)</label><textarea id="spk" lang="fr" placeholder="'+(ctx.canDictate?'Appuyez sur Parler, ou écrivez…':'Touchez le micro de votre clavier et parlez…')+'">'+h(S.draft||'')+'</textarea><div class="row between"><div class="row">'+(ctx.canDictate?ctx.micButton('mic','Parler'):'')+((TTS||ctx.ent(EXAM).tts)?'<button class="btn sm" data-act="repeat">Réécouter</button>':'')+'<button class="btn sm" data-act="'+(sec==='A'?'endA':'ask-submit')+'">'+(sec==='A'?'Passer à la section B':'Terminer l’oral')+'</button></div><button class="btn primary" data-act="send" '+(S.exBusy?'disabled':'')+'>Envoyer</button></div></div></div>'+
  (S.confirmSubmit&&sec==='B'?'<div class="banner">Terminer l’expression orale ? <button class="btn sm primary" data-act="submit">Terminer</button> <button class="btn sm" data-act="cancel-submit">Continuer</button></div>':'');
}

/* ---------- report ---------- */
function reviewList(r){
  const wrong=r.items.filter(i=>!i.ok);
  const it=i=>'<div class="ritem"><span class="qn mono '+(i.ok?'ok':'')+'">'+i.n+'</span><div class="stack" style="gap:4px"><p>'+h(i.prompt)+'</p><p class="small">Votre réponse : <b>'+(i.given?h(i.given+' · '+stripLetter(i.choices['ABCD'.indexOf(i.given)]||'',i.given)):'<span class="muted">aucune</span>')+'</b><br>Bonne réponse : <b style="color:var(--good)">'+h(i.correct+' · '+stripLetter(i.choices['ABCD'.indexOf(i.correct)]||'',i.correct))+'</b> · <span class="muted">'+h(TYPE_NAMES[i.type]||i.type)+'</span></p>'+(i.evidence?'<p class="quote small">'+h(i.evidence)+'</p>':'')+(i.explain?'<p class="small">'+h(i.explain)+'</p>':'')+'</div></div>';
  return '<details '+(wrong.length<=12?'open':'')+'><summary>'+wrong.length+' réponses fausses ou vides</summary><div class="review">'+wrong.map(it).join('')+'</div></details><details><summary>Les '+r.total+' réponses</summary><div class="review">'+r.items.map(it).join('')+'</div></details>';
}
function errTable(errs){if(!errs||!errs.length)return'';return '<div class="tablewrap"><table><thead><tr><th>Vous avez écrit</th><th>Correction</th><th>Pourquoi</th></tr></thead><tbody>'+errs.map(e=>'<tr><td style="color:var(--bad)">'+h(e.quote)+'</td><td style="color:var(--good)">'+h(e.fix)+'</td><td>'+h(e.reason)+'</td></tr>').join('')+'</tbody></table></div>'}
function sectionReport(k,r){
  const n=nclcOf(k,r.score);const tgt=S.profile.target;let body='';
  if(k==='L'||k==='R'){
    body='<p class="mono">'+r.raw+' / '+r.total+' bonnes réponses</p><p class="small muted">Score estimé à partir du nombre de bonnes réponses. Le vrai TEF pondère chaque question selon sa difficulté.</p><div class="tablewrap"><table><thead><tr><th>Type de document</th><th class="mono">Réussite</th></tr></thead><tbody>'+Object.entries(r.per).map(([t,v])=>'<tr><td>'+h(TYPE_NAMES[t]||t)+'</td><td class="mono">'+v.c+' / '+v.t+'</td></tr>').join('')+'</tbody></table></div>'+reviewList(r);
  }else{
    body=(k==='W'?'<p><b>Section A</b> ('+r.wc.A+' mots). '+h(r.A.summary||'')+'</p><p><b>Section B</b> ('+r.wc.B+' mots). '+h(r.B.summary||'')+'</p>':'<p>'+h(r.summary)+'</p><p class="small muted">Section A : '+r.turns.A+' répliques · section B : '+r.turns.B+' répliques. Prononciation non évaluée.</p>')+
    (r.criteria.length?'<div class="tablewrap"><table><thead><tr><th>Critère</th><th>Niveau</th><th>Commentaire</th></tr></thead><tbody>'+r.criteria.map(c=>'<tr><td>'+h(c.name)+'</td><td class="mono">'+h(c.level)+'</td><td>'+h(c.comment)+'</td></tr>').join('')+'</tbody></table></div>':'')+
    (r.missed&&r.missed.length?'<h3>Questions que vous auriez pu poser</h3><ul style="margin:0;padding-left:18px">'+r.missed.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>':'')+
    (r.errors.length?'<h3>Erreurs relevées</h3>'+errTable(r.errors):'')+
    (r.patterns.length?'<h3>Erreurs récurrentes</h3><ul style="margin:0;padding-left:18px">'+r.patterns.map(p=>'<li>'+h(p)+'</li>').join('')+'</ul>':'')+
    (r.model&&r.model.better?'<h3>Version NCLC 9</h3><p class="small muted">'+h(r.model.task||'')+'</p><p class="quote">'+h(r.model.original||'')+'</p><div class="model">'+h(r.model.better)+'</div>':'')+
    (r.next.length?'<h3>Priorités</h3><ol style="margin:0;padding-left:20px">'+r.next.map(p=>'<li>'+h(p)+'</li>').join('')+'</ol>':'');
  }
  return '<div class="panel"><div class="row between"><div class="row"><span class="letter" style="background:'+SKCOL[k]+'">'+AB[k]+'</span><h2>'+SK[k]+'</h2></div><div class="row" style="align-items:baseline"><span class="bigband mono" style="font-size:2.4rem">'+r.score+'</span><span class="pill '+(n>=tgt?'good':n>=tgt-1?'warn':'bad')+'">NCLC '+nclcTxt(n)+' · objectif '+tgt+'</span></div></div>'+body+'</div>';
}
function viewReport(){
  const run=S.reportRun;if(!run)return '<div class="panel"><p class="muted">Chargement…</p></div>';
  const ks=run.sections.filter(k=>run.results[k]);const tgt=S.profile.target;
  const below=ks.filter(k=>nclcOf(k,run.results[k].score)<tgt);
  const pats=[];ks.forEach(k=>{const r=run.results[k];if(r.patterns)pats.push(...r.patterns)});
  const weak=[];['L','R'].forEach(k=>{const r=run.results[k];if(r)for(const t in r.per){const v=r.per[t];if(v.t&&v.c/v.t<0.6)weak.push((TYPE_NAMES[t]||t)+' ('+v.c+'/'+v.t+')')}});
  return '<div class="row"><button class="btn sm" data-nav="history">← Tous les résultats</button></div>'+
  '<div class="panel"><p class="eyebrow">Bilan · '+h(run.date)+'</p><h1>'+h(run.label)+'</h1><div class="row">'+ks.map(k=>'<span class="pill"><b>'+AB[k]+'</b>&nbsp;<span class="mono">'+run.results[k].score+'</span>&nbsp;· NCLC '+nclcTxt(nclcOf(k,run.results[k].score))+'</span>').join('')+(run.nclc!=null?'<span class="pill ink">Global NCLC '+nclcTxt(run.nclc)+'</span>':'')+'</div>'+
  '<p>'+(below.length?'Verdict honnête : pas encore NCLC '+tgt+' en '+below.map(k=>SK[k].toLowerCase()+' (il faut '+minFor(k,tgt)+')').join(', ')+'.':'Ces résultats atteignent votre objectif NCLC '+tgt+'. Stabilisez ce niveau.')+'</p>'+
  (weak.length?'<p><b>Documents à travailler :</b> '+h(weak.join(', '))+'</p>':'')+(pats.length?'<p><b>Erreurs à surveiller :</b> '+h(pats.slice(0,4).join(' ; '))+'</p>':'')+
  '<div class="row">'+(run.kind==='placement'?'<button class="btn primary" data-act="build">'+(S.course?'Recréer mon parcours avec ces résultats':'Créer mon parcours avec ces résultats')+'</button>':'')+'<button class="btn" data-nav="tests">Nouveau test blanc</button></div></div>'+
  ks.map(k=>sectionReport(k,run.results[k])).join('');
}
function viewHistory(){
  const hist=[...(S.profile.history||[])].reverse();
  return '<div class="panel"><h2>Résultats</h2>'+(hist.length?'<div class="tablewrap"><table><thead><tr><th>Date</th><th>Test</th>'+ORDER.map(k=>'<th class="mono">'+AB[k]+'</th>').join('')+'<th>NCLC</th><th></th></tr></thead><tbody>'+hist.map(e=>'<tr><td class="mono">'+h(e.date)+'</td><td>'+h(e.label)+'</td>'+ORDER.map(k=>'<td class="mono">'+(e.scores&&e.scores[k]!=null?e.scores[k]:'–')+'</td>').join('')+'<td class="mono">'+nclcTxt(e.nclc)+'</td><td><button class="btn sm" data-report="'+h(e.id)+'">Ouvrir</button></td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Aucun résultat pour l’instant. Votre test de positionnement apparaîtra ici.</p>')+'</div>';
}
function viewCourse(){
  if(!ctx.ent(EXAM).course)return ctx.upsell(EXAM,'Votre parcours personnalisé','Un parcours de 12 unités construit sur vos résultats, avec leçons, quiz, tâches corrigées et tests d’étape chronométrés.');
  if(S.courseBusy)return '<div class="panel"><div class="row"><span class="spinner"></span><h2>Création de votre parcours</h2></div><p class="muted">12 unités construites à partir de vos scores et de vos erreurs. Cela prend jusqu’à une minute.</p></div>';
  if(!S.course)return '<div class="panel"><p class="eyebrow">Parcours personnalisé</p><h2>Un parcours construit sur vos résultats</h2><p style="max-width:64ch">Douze unités : chacune travaille un point précis, avec une leçon courte, un quiz de 10 questions et une tâche corrigée par votre coach IA. Les unités 4, 8 et 12 sont des tests chronométrés. '+(S.profile.placementDone?'Le parcours utilise vos résultats au test de positionnement.':'Pour un meilleur parcours, faites d’abord le test de positionnement.')+'</p>'+(S.courseErr?'<p class="banner bad">'+h(S.courseErr)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="build" '+(SAMPLE?'':'disabled')+'>Créer mon parcours</button>'+(!S.profile.placementDone?'<button class="btn" data-act="placement" '+(SAMPLE?'':'disabled')+'>D’abord le test de positionnement</button>':'')+'</div></div>';
  const c=S.course;const prog=c.progress||{};const units=allUnits();const done=units.filter(u=>(prog[u.id]||{}).done).length;
  return '<div class="panel"><div class="row between"><div><p class="eyebrow">Votre parcours · '+done+' unités sur '+units.length+'</p><h2>'+h(c.title)+'</h2></div><button class="btn sm" data-act="build">Recréer avec mes derniers résultats</button></div><p class="muted" style="max-width:68ch">'+h(c.summary)+'</p>'+(S.courseErr?'<p class="banner bad">'+h(S.courseErr)+'</p>':'')+'</div>'+
  c.phases.map(ph=>'<div class="phase"><h3>'+h(ph.name)+'</h3>'+ph.units.map(u=>{const p=prog[u.id];const pill=p&&p.done?'<span class="pill good">'+(p.nclc!=null?'NCLC '+nclcTxt(p.nclc):p.score!=null?p.score+' %':'Fait')+'</span>':p&&p.score!=null?'<span class="pill warn">'+p.score+' % · à refaire</span>':u.checkpoint?'<span class="pill ink">Test d’étape</span>':'<span class="pill">À faire</span>';return '<button class="unit" data-unit="'+h(u.id)+'"><span class="letter" style="background:'+SKCOL[u.skill]+';height:34px">'+AB[u.skill]+'</span><span><b>'+h(u.title)+'</b><br><span class="small muted">'+h(u.goal)+'</span></span>'+pill+'</button>'}).join('')+'</div>').join('');
}
function viewLesson(){
  const u=S.lessonUnit;
  const head='<div class="row"><button class="btn sm" data-nav="course">← Parcours</button></div><div class="panel"><p class="eyebrow">'+SK[u.skill]+(u.checkpoint?' · test d’étape':'')+'</p><h1>'+h(u.title)+'</h1><p class="muted">'+h(u.goal)+'</p></div>';
  if(u.checkpoint)return head+'<div class="panel"><h2>Test d’étape : '+SK[u.skill].toLowerCase()+'</h2><p>'+h(SEC[u.skill].note)+'. Sujet inédit, à votre niveau actuel. Le résultat met à jour votre score et valide cette unité.</p><div class="row"><button class="btn primary" data-act="checkpoint" '+(S.profile.activeAttemptId||!SAMPLE?'disabled':'')+'>Commencer le test d’étape</button>'+(S.profile.activeAttemptId?'<span class="small muted">Terminez ou abandonnez d’abord le test en cours.</span>':'')+'</div></div>';
  if(S.lessonBusy)return head+'<div class="panel"><div class="row"><span class="spinner"></span><b>Écriture de la leçon…</b></div></div>';
  if(S.lessonErr)return head+'<div class="panel"><p class="banner bad">'+h(S.lessonErr)+'</p><button class="btn primary" data-act="relesson">Réessayer</button></div>';
  const l=S.lesson;if(!l)return head;
  const teach=toArr(l.teach).map(t=>'<div class="stack" style="gap:8px"><h3>'+h(t.heading)+'</h3><p style="max-width:68ch">'+h(t.body)+'</p>'+toArr(t.examples).map(e=>'<div class="ex">'+(e.wrong?'<span class="w">'+h(e.wrong)+'</span>':'')+'<span class="r">'+h(e.right)+'</span></div>').join('')+'</div>').join('');
  const phrases=toArr(l.phrases).length?'<div class="panel"><h3>Expressions à utiliser</h3><div class="tablewrap"><table><tbody>'+l.phrases.map(p=>'<tr><td><b>'+h(p.phrase)+'</b></td><td class="muted">'+h(p.use)+'</td></tr>').join('')+'</tbody></table></div></div>':'';
  const quiz='<div class="panel"><div class="row between"><h3>Quiz · '+l.quiz.length+' questions</h3>'+(S.quizChecked?'<span class="pill '+(S.quizScore>=70?'good':'bad')+' mono">'+S.quizScore+' %'+(S.quizScore>=70?' · unité validée':' · 70 % pour valider')+'</span>':'')+'</div>'+
    l.quiz.map((q,i)=>{const ctl=q.type==='mcq'?'<div class="mcq">'+toArr(q.choices).map((c,ci)=>{const L='ABCD'[ci];return '<label class="choice"><input type="radio" name="lq'+i+'" value="'+L+'" '+(q._given===L?'checked':'')+'><span class="mono">'+L+'</span><span>'+h(stripLetter(c,L))+'</span></label>'}).join('')+'</div>':'<input type="text" id="lq'+i+'" value="'+h(q._given||'')+'" autocomplete="off" lang="fr">';
      const fb=S.quizChecked?'<p class="small" style="color:'+(q._ok?'var(--good)':'var(--bad)')+'">'+(q._ok?'Exact. ':'Réponse : '+h(toArr(q.answer).join(' / '))+'. ')+'<span class="muted">'+h(q.explain||'')+'</span></p>':'';
      return '<div class="q"><span class="qn mono">'+(i+1)+'</span><div class="qbody"><p>'+h(q.prompt)+'</p>'+ctl+fb+'</div></div>'}).join('')+
    '<div class="row"><button class="btn primary" data-act="checkquiz">'+(S.quizChecked?'Vérifier à nouveau':'Vérifier mes réponses')+'</button></div></div>';
  let task='';
  if(l.task){const fb=S.taskFb;
    task='<div class="panel"><h3>À vous · '+(l.task.kind==='speak'?'à l’oral (dictée)':'à l’écrit')+'</h3><p>'+h(l.task.prompt)+'</p><textarea id="taskans" lang="fr" placeholder="'+(l.task.kind==='speak'?'Utilisez le micro de votre clavier et parlez…':'Écrivez ici…')+'">'+h(S.taskAns||'')+'</textarea><div class="row">'+(ctx.canDictate?ctx.micButton('mictask','Parler'):'')+'<button class="btn primary" data-act="taskfb" '+(S.taskBusy?'disabled':'')+'>'+(S.taskBusy?'Correction…':'Obtenir une correction')+'</button>'+(S.taskBusy?'<span class="spinner"></span>':'')+'</div>'+
    (fb?(fb.err?'<p class="banner bad">'+h(fb.err)+'</p>':'<div class="stack"><div class="row"><span class="pill ink">NCLC '+h(fb.nclc)+'</span></div><p>'+h(fb.verdict)+'</p><p class="small">'+h(fb.used_point||'')+'</p>'+errTable(toArr(fb.errors))+(fb.better?'<h3>Version NCLC 9</h3><div class="model">'+h(fb.better)+'</div>':'')+'</div>'):'')+'</div>'}
  return head+'<div class="panel"><p style="max-width:68ch">'+h(l.intro)+'</p>'+teach+'</div>'+phrases+quiz+task;
}

/* ---------- events ---------- */
document.addEventListener('click',async e=>{
  if(!ACTIVE)return;
  const t=e.target.closest('[data-nav],[data-act],[data-tab],[data-unit],[data-report]');if(!t)return;
  if(t.dataset.nav){if(S.run&&['intro','section','marking'].includes(S.view))return;S.view=t.dataset.nav;S.confirmReset=false;render();window.scrollTo(0,0);return}
  if(t.dataset.unit){openUnit(t.dataset.unit);return}
  if(t.dataset.report){S.view='report';S.reportRun=null;render();try{S.reportRun=await Store.getAttempt(t.dataset.report)}catch(err){}if(!S.reportRun)toast('Ce résultat n’a pas pu être chargé.');render();window.scrollTo(0,0);return}
  if(t.dataset.tab!=null&&S.view==='section'){S.tab=Number(t.dataset.tab);saveRun(S.run);render();window.scrollTo(0,0);return}
  const a=t.dataset.act;
  if(a==='placement'){await startRun(newRun('placement',ORDER.slice(),'exam','Test de positionnement'));return}
  if(a==='mock'){const m=S.mock;const secs=m.type==='full'?ORDER.slice():[m.type];await startRun(newRun('mock',secs,m.diff,(m.type==='full'?'Test blanc complet':'Test blanc · '+SK[m.type])+' · '+(m.diff==='auto'?'auto':DIFF[m.diff].label)));return}
  if(a==='checkpoint'){const u=S.lessonUnit;await startRun(newRun('mock',[u.skill],'auto','Test d’étape · '+u.title,u.id));return}
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
  if(a==='play'){playDoc();return}
  if(a==='readonce'){readOnce();return}
  if(a==='nextdoc'){nextDoc();return}
  if(a==='ask-next'){S.confirmNext=true;render();window.scrollTo(0,0);return}
  if(a==='cancel-next'){S.confirmNext=false;render();return}
  if(a==='tob'){toPhaseB('W');return}
  if(a==='speakstart'){beginSpeak(t.dataset.sec);return}
  if(a==='send'){ctx.stopDictation();sendSpeak();return}
  if(a==='repeat'){const log=S.run.answers.S[S.run.state.S.phase]||[];const last=[...log].reverse().find(m=>m.role==='ex');if(last)sayEx(last.text);return}
  if(a==='endA'){toPhaseB('S');return}
  if(a==='build'){S.view='course';buildCourse();return}
  if(a==='relesson'){const u=S.lessonUnit;genLesson(u,S.course.version+'_'+u.id);return}
  if(a==='checkquiz'){checkQuiz();return}
  if(a==='taskfb'){taskFeedback();return}
  if(a==='savesettings'){const p=S.profile;p.examDate=($('#examdate')||{}).value||'';const tg=Number(($('#target')||{}).value);if(tg)p.target=tg;p.studyTime=($('#set-time')||{}).value||p.studyTime;p.about=(($('#set-about')||{}).value||'').slice(0,280);const first=!p.setupDone;p.setupDone=true;saveProfile();toast(first?'Enregistré. Commencez par le test de positionnement.':'Réglages enregistrés.');render();return}
  if(a==='mic'){ctx.toggleDictation(()=>$('#spk'),'fr-FR',v=>{S.draft=v});render();return}
  if(a==='mictask'){ctx.toggleDictation(()=>$('#taskans'),'fr-FR',v=>{S.taskAns=v});render();return}
  if(a==='reset'){S.confirmReset=true;render();return}
  if(a==='reset-no'){S.confirmReset=false;render();return}
  if(a==='reset-yes'){try{await ctx.api('DELETE','/api/docs/'+EXAM)}catch(err){ctx.handleError(err);return}S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;toast('Progression TEF effacée.');render();return}
});
document.addEventListener('change',e=>{
  if(!ACTIVE)return;
  const t=e.target;
  if(t.name==='mtype'){S.mock.type=t.value;render();return}
  if(t.name==='mdiff'){S.mock.diff=t.value;render();return}
  if(S.view==='section'&&t.dataset.n){S.run.answers[S.sec][t.dataset.n]=t.value;scheduleSave()}
});
document.addEventListener('input',e=>{
  if(!ACTIVE)return;
  const t=e.target;if(S.view!=='section')return;
  if(t.dataset.w){S.run.answers.W[t.dataset.w]=t.value;const min=t.dataset.w==='A'?80:200;const n=words(t.value);const wc=$('#wc');if(wc){wc.textContent=n+' mots';wc.classList.toggle('ok',n>=min)}scheduleSave();return}
  if(t.id==='spk')S.draft=t.value;
});
document.addEventListener('keydown',e=>{if(ACTIVE&&e.target&&e.target.id==='spk'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();sendSpeak()}});
async function resume(){
  const id=S.profile.activeAttemptId;if(!id)return;
  let run=null;try{run=await Store.getAttempt(id)}catch(e){}
  if(!run){toast('Ce test n’a pas pu être chargé.');S.profile.activeAttemptId=null;saveProfile();render();return}
  run.content=run.content||{};run.state=run.state||{};run.results=run.results||{};
  S.run=run;S.gen={};const k=nextSection(run);
  if(k&&run.state[k]&&run.state[k].submitted){markProduction(k);return}
  if(k&&run.state[k]&&run.state[k].deadline&&Date.now()>=run.state[k].deadline&&!(k==='W'&&run.state.W.phase==='A')&&!(k==='S'&&run.state.S.phase==='A')){S.sec=k;submitSection(k,true);return}
  S.view='intro';render();generateAll(run);
}
window.addEventListener('beforeunload',()=>{if(S.run)saveRun(S.run)});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&S.run)saveRun(S.run)});

/* ---------- boot ---------- */
async function boot(){
  render();
  try{const p=await Store.get('profile');if(p)S.profile=Object.assign(DEFAULT_PROFILE(),p)}catch(e){ctx.handleError(e)}
  try{const c=await Store.get('course');if(c&&Array.isArray(c.phases))S.course=c}catch(e){}
  S.ready=true;render();
}
function mount(){ACTIVE=true;if(!S.ready&&!S.booting){S.booting=true;boot()}else render()}
function unmount(){ACTIVE=false;stopSpeech();ctx.stopDictation()}
return {mount,unmount,isBusy:()=>!!S.run};
}
