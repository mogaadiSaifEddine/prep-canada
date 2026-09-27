import re
src = '/home/claude/tef-coach.html'
p = '/home/claude/prep-canada/public/js/tef.js'
s0 = open(src).read()
s = s0[s0.index('<script>') + 8:s0.rindex('</script>')]

def rep(a, b, count=1):
    global s
    n = s.count(a)
    assert n == count, (n, a[:100])
    s = s.replace(a, b)

def cut_between(start, end_incl, new=''):
    global s
    i = s.index(start); j = s.index(end_incl, i) + len(end_incl)
    s = s[:i] + new + s[j:]

rep('\n(function(){\n"use strict";', '// TEF Canada coach (module). Prompts live on the server; this file drives the UI.\nexport function createTEF(ctx){\n"use strict";\nconst EXAM=\'tef\';\nlet ACTIVE=false;')
rep('boot();\n})();', '''function mount(){ACTIVE=true;if(!S.ready&&!S.booting){S.booting=true;boot()}else render()}
function unmount(){ACTIVE=false;stopSpeech();ctx.stopDictation()}
return {mount,unmount,isBusy:()=>!!S.run};
}''')
cut_between('const WHO={', '};\n')
cut_between('const DEFAULT_PROFILE=()=>({', '});',
    "const DEFAULT_PROFILE=()=>({v:1,setupDone:false,examDate:'',target:7,about:'',studyTime:'1 heure par jour',scores:{L:null,R:null,W:null,S:null},placementDone:false,typeStats:{},usedTopics:[],history:[],activeAttemptId:null,errorPatterns:[]});")
cut_between("function lsGet(k){", "catch(e){}}\n")
rep("function daysLeft(){const d=new Date(S.profile.examDate+'T09:00:00');return Math.max(0,Math.ceil((d-new Date())/86400000))}",
    "function daysLeft(){if(!S.profile.examDate)return null;const d=new Date(S.profile.examDate+'T09:00:00');return Math.max(0,Math.ceil((d-new Date())/86400000))}")
cut_between('let toastT=null;', "Réessayez.';\n}", 'const toast=ctx.toast;\nconst errCopy=ctx.errCopy;')
cut_between('const Store={', '};\n', '''const Store={
  get:(key)=>ctx.getDoc(EXAM,key),
  set:(key,val)=>ctx.putDoc(EXAM,key,val),
  getAttempt:(id)=>ctx.getDoc(EXAM,'attempt_'+id),
  saveAttempt:(a)=>ctx.putDoc(EXAM,'attempt_'+a.id,a),
  getLesson:(id)=>ctx.getDoc(EXAM,'lesson_'+id),
  setLesson:(id,v)=>ctx.putDoc(EXAM,'lesson_'+id,v)
};
''')
rep("function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}",
    "function saveRun(run){if(!run)return;return serial('a'+run.id,()=>Store.saveAttempt(run).catch(()=>{}))}\nfunction saveRunNow(run){return serial('a'+run.id,()=>Store.saveAttempt(run))}")
cut_between('/* ---------- Claude ---------- */', "return r.text}\n", "/* ---------- AI (server) ---------- */\nconst SAMPLE=true;\nconst ai=(task,params)=>ctx.ai(EXAM,task,params);\n")
cut_between('function brief(){', "+'.';\n}\n")
cut_between('function avoidLine(){', "}\n}\n")   # avoidLine, Q_SHAPE, promptFor
rep("const data=await askJSON(promptFor(run,j),(j.k==='W'||j.k==='S')?'quick':'default');", "const data=await ai('gen',{attemptId:run.id,k:j.k,i:j.i});")
rep('''async function startRun(run){
  if(!SAMPLE){toast(errCopy({code:'unavailable'}));return}''', '''async function startRun(run){
  if(S.starting)return;S.starting=true;
  try{const r=await ctx.api('POST','/api/attempts/start',{exam:EXAM,kind:run.unitId?'checkpoint':run.kind,sections:run.sections,diff:run.diff});run.id=r.id}
  catch(e){S.starting=false;ctx.handleError(e);return}
  S.starting=false;''')
cut_between("function nclcTable(k){", "}\n")
cut_between("  const prompt='Tu es un correcteur expérimenté", "const r=await askJSON(prompt,'default');", "  await saveRunNow(run);\n  const r=await ai('markW',{attemptId:run.id});")
cut_between("  const tr=sec=>A[sec]", "const r=await askJSON(prompt,'default');", "  await saveRunNow(run);\n  const r=await ai('markS',{attemptId:run.id});")
cut_between("function examinerRules(sec){", "}\n")
rep('''  const turns=[{role:'user',content:examinerRules(sec)}];
  run.answers.S[sec].forEach(m=>turns.push({role:m.role==='ex'?'assistant':'user',content:m.text}));
  try{
    const reply=(await askText(turns,'quick')).trim();''', '''  try{
    await saveRunNow(run);
    const reply=String((await ai('examiner',{attemptId:run.id,sec})).text||'').trim();''')
rep("S.exBusy=false;saveRun(run);render();", "S.exBusy=false;saveRun(run);render();ctx.stopDictation();")
cut_between("    const prompt='Tu es un coach expert du TEF Canada. Conçois", "const r=await askJSON(prompt,'default');", "    const r=await ai('course',{});")
cut_between("    const prompt='Tu es un coach expert du TEF Canada. Écris", "const r=await askJSON(prompt,'default');", "    const r=await ai('lesson',{unitId:u.id});")
cut_between("    S.taskFb=await askJSON('Tu es un coach TEF Canada exigeant.", "'default');", "    S.taskFb=await ai('taskfb',{unitId:u.id,answer:txt});")
rep("}catch(e){S.courseErr=errCopy(e)}", "}catch(e){S.courseErr=errCopy(e)}")

# rendering
i = s.index("  app.innerHTML=(inTest?'':topBar())"); j = s.index("+v();", i) + len("+v();")
s = s[:i] + "  if(!ACTIVE)return;\n  app.innerHTML=(inTest?'':topBar())+v();\n  ctx.afterRender&&ctx.afterRender();" + s[j:]
cut_between('function topBar(){', "</nav></header>';\n}", '''function topBar(){
  const nav=[['home','Tableau de bord'],['tests','Tests'],['course','Parcours'],['history','Résultats']];
  return ctx.header(EXAM,nav,S.view==='lesson'?'course':S.view,'TEF Canada · objectif NCLC '+S.profile.target);
}''')
rep("<h2>'+(WHO.name?'Bonjour '+h(WHO.name):'Bonjour')+'</h2></div><span class=\"pill\"><span class=\"mono\">'+daysLeft()+'</span> jours avant l’examen</span></div>'+\n  hero+",
    "<h2>Bonjour '+h(ctx.firstName())+'</h2></div><div class=\"row\">'+(daysLeft()!=null?'<span class=\"pill\"><span class=\"mono\">'+daysLeft()+'</span> jours avant l’examen</span>':'')+ctx.planPill(EXAM)+'</div></div>'+\n  (S.profile.setupDone?'':setupPanel(true))+hero+")
cut_between("  '<div class=\"panel flat\"><h3>Réglages</h3>", "</p></div>';\n}", '''  (S.profile.setupDone?setupPanel(false):'');
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
}''')
rep("    const next=allUnits().find(u=>!((S.course.progress||{})[u.id]||{}).done);", "    const next=S.course?allUnits().find(u=>!((S.course.progress||{})[u.id]||{}).done):null;")
rep("  if(S.courseBusy)return '<div class=\"panel\"><div class=\"row\"><span class=\"spinner\"></span><h2>Création de votre parcours</h2>",
    "  if(!ctx.ent(EXAM).course)return ctx.upsell(EXAM,'Votre parcours personnalisé','Un parcours de 12 unités construit sur vos résultats, avec leçons, quiz, tâches corrigées et tests d’étape chronométrés.');\n  if(S.courseBusy)return '<div class=\"panel\"><div class=\"row\"><span class=\"spinner\"></span><h2>Création de votre parcours</h2>")
rep("une tâche corrigée par Claude.", "une tâche corrigée par votre coach IA.")
rep("'<div class=\"panel\"><p class=\"eyebrow\">Générateur de tests blancs</p>",
    "(ctx.ent(EXAM).paid?'':'<div class=\"banner small\">Offre gratuite : 1 test blanc par mois et 1 test de positionnement. <a href=\"#/plans\">Voir les offres</a> pour des tests illimités et des voix naturelles.</div>')+'<div class=\"panel\"><p class=\"eyebrow\">Générateur de tests blancs</p>")
rep("<li>Claude joue l’examinateur et vous répond, avec une voix si votre appareil en a une.</li><li>Parlez en utilisant le micro de dictée de votre clavier : vos phrases s’écrivent pendant que vous parlez. Envoyez chaque réplique.</li>",
    "<li>Votre coach IA joue l’examinateur et vous répond'+(ctx.ent(EXAM).tts?' avec une voix naturelle':', avec la voix de votre appareil si elle existe')+'.</li><li>'+(ctx.canDictate?'Appuyez sur <b>Parler</b> et répondez à voix haute : vos phrases s’écrivent pendant que vous parlez.':'Parlez en utilisant le micro de dictée de votre clavier : vos phrases s’écrivent pendant que vous parlez.')+' Envoyez chaque réplique.</li>")
rep("<li>Chaque document est lu <b>une seule fois</b> par la voix de votre appareil, et vous ne pouvez pas revenir en arrière. Utilisez des écouteurs.</li>",
    "<li>Chaque document est lu <b>une seule fois</b> par '+(ctx.ent(EXAM).tts?'des voix naturelles de studio':'la voix de votre appareil')+', et vous ne pouvez pas revenir en arrière. Utilisez des écouteurs.</li>")
rep("  const player=TTS?'<div class=\"player\">", "  const player=(TTS||ctx.ent(EXAM).tts)?'<div class=\"player\">")
rep("<span class=\"small muted\">Une seule écoute</span></div>'", "<span class=\"small muted\" id=\"lstatus\">Une seule écoute</span></div>'")
rep("placeholder=\"Touchez le micro de votre clavier et parlez…\">'+h(S.draft||'')+'</textarea><div class=\"row between\"><div class=\"row\">'+(TTS?'<button class=\"btn sm\" data-act=\"repeat\">Réécouter</button>':'')",
    "placeholder=\"'+(ctx.canDictate?'Appuyez sur Parler, ou écrivez…':'Touchez le micro de votre clavier et parlez…')+'\">'+h(S.draft||'')+'</textarea><div class=\"row between\"><div class=\"row\">'+(ctx.canDictate?ctx.micButton('mic','Parler'):'')+((TTS||ctx.ent(EXAM).tts)?'<button class=\"btn sm\" data-act=\"repeat\">Réécouter</button>':'')")
rep("'</textarea><div class=\"row\"><button class=\"btn primary\" data-act=\"taskfb\" '", "'</textarea><div class=\"row\">'+(ctx.canDictate?ctx.micButton('mictask','Parler'):'')+'<button class=\"btn primary\" data-act=\"taskfb\" '")

# natural voices
rep("function stopSpeech(){speakToken++;if(TTS)try{speechSynthesis.cancel()}catch(e){}}", "function stopSpeech(){speakToken++;ctx.stopAudio();if(TTS)try{speechSynthesis.cancel()}catch(e){}}")
rep("function sayEx(text){if(TTS)speakLines([{speaker:'ex',text}],{ex:EXV()})}",
    "function sayEx(text,role){if(ctx.ent(EXAM).tts){const tok=speakToken;ctx.say(EXAM,text,{role},()=>tok!==speakToken).then(ok=>{if(!ok&&tok===speakToken&&TTS)speakLines([{speaker:'ex',text}],{ex:EXV()})});return}if(TTS)speakLines([{speaker:'ex',text}],{ex:EXV()})}")
rep("saveRun(run);render();sayEx(run.answers.S[sec][run.answers.S[sec].length-1].text);", "saveRun(run);render();sayEx(run.answers.S[sec][run.answers.S[sec].length-1].text,sec==='B'?'friend':'staff');")
rep("run.answers.S[sec].push({role:'ex',text:reply});sayEx(reply);", "run.answers.S[sec].push({role:'ex',text:reply});sayEx(reply,sec==='B'?'friend':'staff');")
rep('''function playDoc(){
  const run=S.run;const pos=run.state.L.pos;const key=pos.p+'_'+pos.d;const{doc}=curDoc(run);if(!doc||run.state.L.played[key])return;
  run.state.L.played[key]='playing';saveRun(run);render();''', '''function playDoc(){
  const run=S.run;const pos=run.state.L.pos;const key=pos.p+'_'+pos.d;const{doc}=curDoc(run);if(!doc||run.state.L.played[key])return;
  run.state.L.played[key]='playing';render();
  if(ctx.ent(EXAM).tts){playDocNatural(run,pos.p,pos.d,key,doc);return}
  saveRun(run);''')
rep("/* ---------- speaking flow ---------- */", '''async function playDocNatural(run,p,d,key,doc){
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

/* ---------- speaking flow ---------- */''')

# settings, reset, events
rep("  if(a==='savesettings'){const d=($('#examdate')||{}).value;const tg=Number(($('#target')||{}).value);if(d)S.profile.examDate=d;if(tg)S.profile.target=tg;saveProfile();toast('Réglages enregistrés.');render();return}",
    "  if(a==='savesettings'){const p=S.profile;p.examDate=($('#examdate')||{}).value||'';const tg=Number(($('#target')||{}).value);if(tg)p.target=tg;p.studyTime=($('#set-time')||{}).value||p.studyTime;p.about=(($('#set-about')||{}).value||'').slice(0,280);const first=!p.setupDone;p.setupDone=true;saveProfile();toast(first?'Enregistré. Commencez par le test de positionnement.':'Réglages enregistrés.');render();return}\n  if(a==='mic'){ctx.toggleDictation(()=>$('#spk'),'fr-FR',v=>{S.draft=v});render();return}\n  if(a==='mictask'){ctx.toggleDictation(()=>$('#taskans'),'fr-FR',v=>{S.taskAns=v});render();return}")
rep("  if(a==='reset-yes'){S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;saveProfile();if(Store.db)serial('course',()=>Store.db.doc(Store.base()+'/course').delete().catch(()=>{}));else lsSet('course',null);toast('Progression effacée.');render();return}",
    "  if(a==='reset-yes'){try{await ctx.api('DELETE','/api/docs/'+EXAM)}catch(err){ctx.handleError(err);return}S.profile=DEFAULT_PROFILE();S.course=null;S.confirmReset=false;toast('Progression TEF effacée.');render();return}")
rep("if(a==='send'){sendSpeak();return}", "if(a==='send'){ctx.stopDictation();sendSpeak();return}")
rep("document.addEventListener('click',async e=>{\n  const t=e.target", "document.addEventListener('click',async e=>{\n  if(!ACTIVE)return;\n  const t=e.target")
rep("document.addEventListener('change',e=>{\n  const t=e.target;", "document.addEventListener('change',e=>{\n  if(!ACTIVE)return;\n  const t=e.target;")
rep("document.addEventListener('input',e=>{\n  const t=e.target;", "document.addEventListener('input',e=>{\n  if(!ACTIVE)return;\n  const t=e.target;")
rep("document.addEventListener('keydown',e=>{if(e.target", "document.addEventListener('keydown',e=>{if(ACTIVE&&e.target")
rep("if(t.dataset.nav){S.view=t.dataset.nav;", "if(t.dataset.nav){if(S.run&&['intro','section','marking'].includes(S.view))return;S.view=t.dataset.nav;")

cut_between('async function boot(){', "S.ready=true;render();\n}", '''async function boot(){
  render();
  try{const p=await Store.get('profile');if(p)S.profile=Object.assign(DEFAULT_PROFILE(),p)}catch(e){ctx.handleError(e)}
  try{const c=await Store.get('course');if(c&&Array.isArray(c.phases))S.course=c}catch(e){}
  S.ready=true;render();
}''')

for bad in ['askJSON', 'askText', 'Store.db', 'lsSet', 'lsGet', 'Saif', 'Claude', 'promptFor', 'brief()', 'WHO', 'examinerRules', 'nclcTable']:
    if bad in s:
        print('LEFTOVER', bad, [s[m.start()-60:m.start()+40] for m in re.finditer(re.escape(bad), s)][:3])
open(p, 'w').write(s)
print('ok', len(s))
