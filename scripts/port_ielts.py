import re, sys
p = '/home/claude/prep-canada/public/js/ielts.js'
s = open(p).read()

def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:90])
    s = s.replace(a, b)

def cut(start, end_incl):
    """remove from `start` up to and including `end_incl`"""
    global s
    i = s.index(start); j = s.index(end_incl, i) + len(end_incl)
    s = s[:i] + s[j:]

# ---- module wrapper
rep('\n(function(){\n"use strict";', '// IELTS General Training coach (module). Prompts live on the server; this file drives the UI.\nexport function createIELTS(ctx){\n"use strict";\nconst EXAM=\'ielts\';\nlet ACTIVE=false;')
rep('boot();\n})();', '''function mount(){ACTIVE=true;if(!S.ready&&!S.booting){S.booting=true;boot()}else render()}
function unmount(){ACTIVE=false;stopSpeech();ctx.stopDictation()}
return {mount,unmount,isBusy:()=>!!S.run};
}''')

# ---- targets
rep("const TARGET={L:8,R:7,W:7,S:7};\nconst STRETCH={L:8.5,R:8,W:7.5,S:7.5};",
"const TARGETS={7:{L:6,R:6,W:6,S:6},8:{L:7.5,R:6.5,W:6.5,S:6.5},9:{L:8,R:7,W:7,S:7},10:{L:8.5,R:8,W:7.5,S:7.5}};\nlet TARGET=TARGETS[9],STRETCH=TARGETS[10];\nconst CLBT=()=>S.profile.clbTarget||9;\nfunction setTargets(){TARGET=TARGETS[CLBT()]||TARGETS[9];STRETCH=TARGETS[Math.min(10,CLBT()+1)]}")

# ---- generic default profile
i = s.index('const DEFAULT_PROFILE=()=>({'); j = s.index('});', i) + 3
s = s[:i] + "const DEFAULT_PROFILE=()=>({v:1,setupDone:false,clbTarget:9,examDate:'',about:'',studyTime:'1 hour a day',bands:{L:null,R:null,W:null,S:null},bandNote:{},placementDone:false,qtypeStats:{},usedTopics:[],history:[],activeAttemptId:null,errorPatterns:[]});" + s[j:]

# ---- helpers
rep("function lsGet(k){try{const v=localStorage.getItem('ielts_'+k);return v?JSON.parse(v):null}catch(e){return null}}\nfunction lsSet(k,v){try{localStorage.setItem('ielts_'+k,JSON.stringify(v))}catch(e){}}\n", '')
rep("function daysLeft(){const d=new Date(S.profile.examDate+'T09:00:00');return Math.max(0,Math.ceil((d-new Date())/86400000))}",
    "function daysLeft(){if(!S.profile.examDate)return null;const d=new Date(S.profile.examDate+'T09:00:00');return Math.max(0,Math.ceil((d-new Date())/86400000))}")
i = s.index('let toastT=null;'); j = s.index("Try again.';\n}", i) + len("Try again.';\n}")
s = s[:i] + 'const toast=ctx.toast;\nconst errCopy=ctx.errCopy;' + s[j:]

# ---- storage through the API
i = s.index('const Store={'); j = s.index('};', i) + 2
s = s[:i] + '''const Store={
  get:(key)=>ctx.getDoc(EXAM,key),
  set:(key,val)=>ctx.putDoc(EXAM,key,val),
  getAttempt:(id)=>ctx.getDoc(EXAM,'attempt_'+id),
  saveAttempt:(a)=>ctx.putDoc(EXAM,'attempt_'+a.id,a),
  getLesson:(id)=>ctx.getDoc(EXAM,'lesson_'+id),
  setLesson:(id,v)=>ctx.putDoc(EXAM,'lesson_'+id,v)
};''' + s[j:]
rep("function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}",
    "function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}\nfunction saveRunNow(run){return serial('a'+run.id,()=>Store.saveAttempt(run))}")

# ---- AI through the server
rep('''let SAMPLE=null;
async function askJSON(prompt,tier){
  if(!SAMPLE)throw{code:'unavailable'};
  return SAMPLE.json(prompt,{modelTier:tier||'default',cache:false});
}''', "const SAMPLE=true;\nconst ai=(task,params)=>ctx.ai(EXAM,task,params);")
cut('function brief(){', "+'.';\n}\n")
cut('function focusLine(run,k){', "  if(j.k==='S'){")
cut("    return 'You are an IELTS speaking examiner preparing", "}\n}\n")

rep("const data=await askJSON(promptFor(run,j),(j.k==='W'||j.k==='S')?'quick':'default');",
    "const data=await ai('gen',{attemptId:run.id,k:j.k,i:j.i});")

# ---- start a test on the server first (quota + id)
rep('''async function startRun(run){
  if(!SAMPLE){toast(errCopy({code:'unavailable'}));return}''',
'''async function startRun(run){
  if(S.starting)return;S.starting=true;
  try{const r=await ctx.api('POST','/api/attempts/start',{exam:EXAM,kind:run.unitId?'checkpoint':run.kind,sections:run.sections,diff:run.diff});run.id=r.id}
  catch(e){S.starting=false;ctx.handleError(e);return}
  S.starting=false;''')

# ---- marking
i = s.index("  const prompt='You are a strict, experienced IELTS General Training Writing examiner."); j = s.index("const r=await askJSON(prompt,'default');", i) + len("const r=await askJSON(prompt,'default');")
s = s[:i] + "  await saveRunNow(run);\n  const r=await ai('markW',{attemptId:run.id});" + s[j:]
i = s.index("  const lines=[];\n  speakSteps(c).forEach"); j = s.index("const r=await askJSON(prompt,'default');", i) + len("const r=await askJSON(prompt,'default');")
s = s[:i] + "  await saveRunNow(run);\n  const r=await ai('markS',{attemptId:run.id});" + s[j:]

# ---- course, lessons, feedback
i = s.index("    const prompt='You are an expert IELTS General Training coach. Design"); j = s.index("const r=await askJSON(prompt,'default');", i) + len("const r=await askJSON(prompt,'default');")
s = s[:i] + "    const r=await ai('course',{});" + s[j:]
i = s.index("    const prompt='You are an expert IELTS General Training coach. Write one short"); j = s.index("const r=await askJSON(prompt,'default');", i) + len("const r=await askJSON(prompt,'default');")
s = s[:i] + "    const r=await ai('lesson',{unitId:u.id});" + s[j:]
i = s.index("    const r=await askJSON('You are a strict IELTS coach."); j = s.index("'default');", i) + len("'default');")
s = s[:i] + "    const r=await ai('taskfb',{unitId:u.id,answer:txt});" + s[j:]
i = s.index("    const r=await askJSON('You are an IELTS Listening coach."); j = s.index("'default');", i) + len("'default');")
s = s[:i] + "    const r=await ai('real',{wrong:wrong.map(i=>({n:i.n,given:i.given,key:[i.correct,...i.alts].join(' / ')})),transcript:R.transcript});" + s[j:]
rep("}catch(e){S.courseErr=errCopy(e)}", "}catch(e){S.courseErr=errCopy(e);S.courseErrCode=e&&e.code}")

# ---- rendering: shell header, setup, plan gates
rep("  app.innerHTML=(inTest?'':topBar())+(SAMPLE||inTest?'':'<div class=\"banner bad\">Creating and marking tests needs Claude. Open this page in Claude and allow it to use Claude when asked.</div>')+(S.dbOk||inTest?'':'<div class=\"banner small\">Progress is saved in this browser only in this view.</div>')+body;",
    "  if(!ACTIVE)return;\n  app.innerHTML=(inTest?'':topBar())+body;\n  ctx.afterRender&&ctx.afterRender();")
i = s.index('function topBar(){'); j = s.index("</nav></header>';\n}", i) + len("</nav></header>';\n}")
s = s[:i] + '''function topBar(){
  const nav=[['home','Dashboard'],['tests','Tests'],['course','Course'],['history','Results']];
  return ctx.header(EXAM,nav,S.view==='lesson'?'course':S.view==='real'?'tests':S.view,'General Training · target CLB '+CLBT());
}''' + s[j:]

rep("<p class=\"muted small\">Your CLB level is set by your lowest skill. Target: CLB 9 in every skill.</p>",
    "<p class=\"muted small\">Your CLB level is set by your lowest skill. Target: CLB '+CLBT()+' in every skill.</p>")
rep("<h2>Hi Saif</h2></div><div class=\"row\"><span class=\"pill\"><span class=\"mono\">'+daysLeft()+'</span> days to exam</span></div></div>'+\n  hero+",
    "<h2>Hi '+h(ctx.firstName())+'</h2></div><div class=\"row\">'+(daysLeft()!=null?'<span class=\"pill\"><span class=\"mono\">'+daysLeft()+'</span> days to exam</span>':'')+ctx.planPill(EXAM)+'</div></div>'+\n  (S.profile.setupDone?'':setupPanel(true))+hero+")
rep("'<div class=\"grid\"><div class=\"panel\"><h3>Errors to watch</h3><ul class=\"stack\" style=\"gap:6px;margin:0;padding-left:18px\">'+pats.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul></div>'+",
    "'<div class=\"grid\"><div class=\"panel\"><h3>Errors to watch</h3>'+(pats.length?'<ul class=\"stack\" style=\"gap:6px;margin:0;padding-left:18px\">'+pats.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>':'<p class=\"muted\">Appears after your first Writing or Speaking test.</p>')+'</div>'+")
i = s.index("  '<div class=\"panel flat\"><h3>Exam date</h3>"); j = s.index("</span></div></div>';\n}", i) + len("</span></div></div>';\n}")
s = s[:i] + '''  (S.profile.setupDone?setupPanel(false):'');
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
}''' + s[j:]

rep("'<p>'+(onTrack?'These results meet your CLB 9 targets. Keep the level steady and push toward the stretch bands.':'Honest verdict: not yet at CLB 9 in '+",
    "'<p>'+(onTrack?'These results meet your CLB '+CLBT()+' targets. Keep the level steady and push toward the stretch bands.':'Honest verdict: not yet at CLB '+CLBT()+' in '+")
rep("Twelve units, each one focused point with short teaching, a 10-question quiz and a task marked by Claude.", "Twelve units, each one focused point with short teaching, a 10-question quiz and a task marked by your AI coach.")

# course gate
rep("  if(S.courseBusy)return '<div class=\"panel\"><div class=\"row\"><span class=\"spinner\"></span><h2>Building your course</h2>",
    "  if(!ctx.ent(EXAM).course)return ctx.upsell(EXAM,'Your personal course','A 12-unit course built on your placement results, with lessons, quizzes, marked tasks and timed checkpoints.');\n  if(S.courseBusy)return '<div class=\"panel\"><div class=\"row\"><span class=\"spinner\"></span><h2>Building your course</h2>")
rep("        const next=allUnits().find(u=>!(S.course.progress||{})[u.id]?.done);".replace('        ','    '),
    "    const next=S.course?allUnits().find(u=>!(S.course.progress||{})[u.id]?.done):null;")

# free plan note on tests
rep("'<div class=\"panel\"><p class=\"eyebrow\">Mock test generator</p><h2>Build a new mock test</h2>",
    "(ctx.ent(EXAM).paid?'':'<div class=\"banner small\">Free plan: 1 mock test per month and 1 placement test. <a href=\"#/plans\">See plans</a> for unlimited tests and natural voices.</div>')+'<div class=\"panel\"><p class=\"eyebrow\">Mock test generator</p><h2>Build a new mock test</h2>")

# voices panel
i = s.index('function voicePanel(){'); j = s.index("</button></div></div>';\n}", i) + len("</button></div></div>';\n}")
s = s[:i] + '''function voicePanel(){
  if(ctx.ent(EXAM).tts)return '<div class="panel flat"><h3>Voices</h3><p class="small muted" style="max-width:68ch">Your plan reads Listening tests and speaking questions with natural studio voices in British accents. If they can\\'t load, the app falls back to your device\\'s voices.</p><div class="row"><button class="btn sm" data-act="voicetest">Hear a sample</button></div></div>';
  if(!TTS)return '<div class="panel flat"><h3>Voices</h3><p class="muted">This browser has no speech voices, so generated Listening tests show the script once instead. Upgrade for natural studio voices, or use Chrome or Edge.</p></div>';
  const vs=engVoices();const top=vs.slice(0,4);
  return '<div class="panel flat"><h3>Voices</h3><p class="small muted" style="max-width:68ch">The free plan uses your device\\'s voices: '+(top.length?h(top.map(v=>v.name.replace(/\\s*\\(.*\\)/,'')).join(', ')):'none found yet')+'. <a href="#/plans">Solo and Duo</a> use natural studio voices that sound like the real exam.</p><div class="row"><button class="btn sm" data-act="voicetest">Hear a sample</button></div></div>';
}''' + s[j:]

# ---- natural voices for Listening and speaking questions
rep('''function playListening(){
  const run=S.run;const i=S.tab;const part=run.content.L[i];
  run.state.L.played=run.state.L.played||{};
  if(run.state.L.played[i])return;
  run.state.L.played[i]='playing';saveRun(run);render();
  runPart(run,i,part);
}''', '''function playListening(){
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
}''')
rep("function stopSpeech(){speakToken++;if(TTS)try{speechSynthesis.cancel()}catch(e){}}",
    "function stopSpeech(){speakToken++;ctx.stopAudio();if(TTS)try{speechSynthesis.cancel()}catch(e){}}")
rep("  if(TTS&&step.phase!=='talk'){const text=step.phase==='prep'?'Now I\\'m going to give you a topic, and I\\'d like you to talk about it for one to two minutes. You have one minute to think about what you\\'re going to say. You can make some notes if you wish.':step.q;speakLines([{speaker:'ex',text}],{ex:pickVoices([{name:'ex',gender:'female'}]).ex},null,null)}\n  if(step.phase==='talk'&&TTS)speakLines([{speaker:'ex',text:'All right? Remember you have one to two minutes for this. Please start speaking now.'}],pickVoices([{name:'ex',gender:'female'}]),null,null);",
    "  if(step.phase!=='talk'){say(step.phase==='prep'?'Now I\\'m going to give you a topic, and I\\'d like you to talk about it for one to two minutes. You have one minute to think about what you\\'re going to say. You can make some notes if you wish.':step.q)}\n  else say('All right? Remember you have one to two minutes for this. Please start speaking now.');")
rep("function advanceSpeak(d){const run=S.run;stopSpeech();", "function advanceSpeak(d){const run=S.run;stopSpeech();ctx.stopDictation();")
rep("if(a==='repeatq'){const run=S.run;const step=speakSteps(run.content.S[0])[run.state.S.pos];if(step&&TTS)speakLines([{speaker:'ex',text:step.q}],pickVoices([{name:'ex',gender:'female'}]));return}",
    "if(a==='repeatq'){const run=S.run;const step=speakSteps(run.content.S[0])[run.state.S.pos];if(step){stopSpeech();say(step.q)}return}\n  if(a==='mic'){const el=$('#spk');if(el)ctx.toggleDictation(()=>$('#spk'),'en-GB',v=>{const x=$('#spk');if(!x||!S.run)return;const key=x.dataset.s;if(key==='notes')S.run.answers.S.notes=v;else S.run.answers.S[key]=v;const wc=$('#wc');if(wc&&key!=='notes')wc.textContent=words(v)+' words';scheduleSave()});render();return}\n  if(a==='mictask'){ctx.toggleDictation(()=>$('#taskans'),'en-GB',v=>{S.taskAns=v});render();return}")
rep("if(a==='voicetest'){const vm=",
    "if(a==='voicetest'&&ctx.ent(EXAM).tts){stopSpeech();say('Good morning, Riverside Sports Centre. How can I help you? This is how your Listening tests will sound.');return}\n  if(a==='voicetest'){const vm=")
rep("(TTS&&step.phase!=='talk'?'<button class=\"btn sm\" data-act=\"repeatq\">Hear it again</button>':'')",
    "((TTS||ctx.ent(EXAM).tts)&&step.phase!=='talk'?'<button class=\"btn sm\" data-act=\"repeatq\">Hear it again</button>':'')")
rep("'<label for=\"spk\" class=\"eyebrow\">'+lbl+'</label>'+box+'<div class=\"row between\"><span class=\"wc\" id=\"wc\">'",
    "'<label for=\"spk\" class=\"eyebrow\">'+lbl+'</label>'+box+'<div class=\"row between\"><div class=\"row\">'+(step.phase!=='prep'&&ctx.canDictate?ctx.micButton('mic'):'')+'<span class=\"wc\" id=\"wc\">'")
rep("+(step.phase==='prep'?'':words(val)+' words')+'</span><button class=\"btn primary\" data-act=\"snext\">",
    "+(step.phase==='prep'?'':words(val)+' words')+'</span></div><button class=\"btn primary\" data-act=\"snext\">")
rep("placeholder=\"Tap your keyboard\\'s microphone and answer out loud…\"", "placeholder=\"'+(ctx.canDictate?'Press Speak and answer out loud, or type…':'Tap your keyboard\\'s microphone and answer out loud…')+'\"")
rep("<div class=\"row\"><button class=\"btn primary\" data-act=\"taskfb\" '", "<div class=\"row\">'+(ctx.canDictate?ctx.micButton('mictask'):'')+'<button class=\"btn primary\" data-act=\"taskfb\" '")
rep("<li>Answer out loud using your keyboard\\'s dictation microphone, so your words are typed as you speak. Don\\'t edit afterwards; the marking ignores punctuation.</li>",
    "<li>'+(ctx.canDictate?'Press <b>Speak</b> and answer out loud: your words are written as you talk.':'Answer out loud using your keyboard\\'s dictation microphone, so your words are typed as you speak.')+' Don\\'t edit afterwards; the marking ignores punctuation.</li>")
rep("<li>Each part plays <b>once</b>, read aloud by your device\\'s voice. Use headphones and turn the volume up.</li>",
    "<li>Each part plays <b>once</b>, read aloud by '+(ctx.ent(EXAM).tts?'natural studio voices':'your device\\'s voice')+'. Use headphones and turn the volume up.</li>")
rep("if(TTS){player='<div class=\"player\">", "if(TTS||ctx.ent(EXAM).tts){player='<div class=\"player\">")

# ---- settings, reset
rep("  if(a==='savedate'){const v=($('#examdate')||{}).value;if(v){S.profile.examDate=v;saveProfile();toast('Exam date saved.');render()}return}",
    "  if(a==='savesettings'){const p=S.profile;p.clbTarget=Number(($('#set-target')||{}).value)||9;p.examDate=($('#set-date')||{}).value||'';p.studyTime=($('#set-time')||{}).value||p.studyTime;p.about=(($('#set-about')||{}).value||'').slice(0,280);const first=!p.setupDone;p.setupDone=true;setTargets();saveProfile();toast(first?'Saved. Start with the placement test.':'Settings saved.');render();return}")
rep("  if(a==='reset-yes'){S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;saveProfile();if(Store.db)serial('course',()=>Store.db.doc(Store.base()+'/course').delete().catch(()=>{}));else lsSet('course',null);toast('All progress erased.');render();return}",
    "  if(a==='reset-yes'){try{await ctx.api('DELETE','/api/docs/'+EXAM)}catch(err){ctx.handleError(err);return}S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;setTargets();toast('IELTS progress erased.');render();return}")

# ---- listeners only when this coach is on screen
rep("document.addEventListener('click',async e=>{\n  const t=e.target", "document.addEventListener('click',async e=>{\n  if(!ACTIVE)return;\n  const t=e.target")
rep("document.addEventListener('change',e=>{\n  const t=e.target;", "document.addEventListener('change',e=>{\n  if(!ACTIVE)return;\n  const t=e.target;")
rep("document.addEventListener('input',e=>{\n  const t=e.target;", "document.addEventListener('input',e=>{\n  if(!ACTIVE)return;\n  const t=e.target;")
rep("if(t.dataset.nav){S.view=t.dataset.nav;", "if(t.dataset.nav){if(S.run&&['intro','section','marking'].includes(S.view))return;S.view=t.dataset.nav;")

# ---- boot
i = s.index('async function boot(){'); j = s.index("S.ready=true;render();\n}", i) + len("S.ready=true;render();\n}")
s = s[:i] + '''async function boot(){
  render();
  try{const p=await Store.get('profile');if(p)S.profile=Object.assign(DEFAULT_PROFILE(),p)}catch(e){ctx.handleError(e)}
  try{const c=await Store.get('course');if(c&&Array.isArray(c.phases))S.course=c}catch(e){}
  setTargets();S.ready=true;render();
}''' + s[j:]

for bad in ['askJSON', 'Store.db', 'lsSet', 'lsGet', 'Saif', 'Claude', 'promptFor', 'brief()']:
    if bad in s:
        print('LEFTOVER', bad, [m.start() for m in re.finditer(re.escape(bad), s)][:5])
open(p, 'w').write(s)
print('ok', len(s))
