/* Run with node check-missions-v20.cjs [--syntax]. No browser, publish or learner-audio grading. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const root=__dirname,revision='3141e8c',DAY=86400000,NOW=Date.now(),PAST=NOW-3*DAY;
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const originalFile=f=>execFileSync('git',['show',revision+':'+f],{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024});
const activeData=JSON.parse(read('mission-data.json')),originalData=JSON.parse(originalFile('mission-data.json'));
const activeSource=read('web/missions.js'),originalSource=originalFile('web/missions.js'),profileSource=read('web/profile.js');
const reportPath=path.join(root,'.impeccable/review-v20/missions-regression.json');
const report={passed:false,baseline:revision,checks:[],counts:{activeVariants:0,preparedForms:0,unknownBoundaries:0,branchPaths:0,editorialCases:0,otherSemanticCases:0,legacyBodies:0,legacySessions:0,legacyHistories:0,dueMappings:0,exposureCases:0},limits:'Real finite text modules and persisted evidence only. Does not assess recorded speech, pronunciation, language level, general Spanish correctness, browser layout, or learning efficacy.'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
report.sources={missionData:hash(read('mission-data.json')),missions:hash(activeSource),profile:hash(profileSource)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(name,value='')=>({dataset:{[name.replace(/^data-/,'').replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]:value},hasAttribute:a=>a===name});
function harness(saved,{source=activeSource,catalog=activeData,now=NOW}={}){
 let time=now;const state={missions:json(saved)},context={window:{},Date:class extends Date{static now(){return time}},console};
 vm.createContext(context);vm.runInContext(source,context,{filename:source===activeSource?'web/missions.js':'baseline/web/missions.js'});
 const toasts=[],app=context.window.VamosMissions.create({state,data:{missions:catalog},esc,save(){},render(){},toast:s=>toasts.push(s)});
 return {state,app,toasts,tick:n=>time+=n};
}
function answer(h,text,oral='independent'){
 h.app.input({value:text,hasAttribute:a=>a==='data-mission-answer'});h.app.change(button('data-mission-oral',oral));h.tick(1);
 h.app.click(button('data-mission-check'));return json(h.app.current.session.responses[h.app.current.step].latest);
}
const advance=h=>h.app.click(button('data-mission-next'));
function finish(h){let guard=0;while(!h.app.current.completed){assert(++guard<10,'Mission must remain finite');answer(h,h.app.current.content.rule.forms[0]);advance(h);}return json(h.state.missions.history.at(-1));}
function atTurn(v,day,step){const h=harness();assert(h.app.start(day,{variant:v.id,resume:false}));for(let i=0;i<step;i++){answer(h,h.app.current.content.rule.forms[0]);advance(h);}return h;}
function log(kind,detail={}){report.checks.push({kind,...detail});}
function expectAnswer(h,text,status,message){const result=answer(h,text);assert.equal(result.status,status,message||text);return result;}
function profileEvidence(saved){const context={window:{},console};vm.createContext(context);vm.runInContext(profileSource,context,{filename:'web/profile.js'});const state={missions:json(saved)},profile=context.window.VamosProfile.create({state,data:{missions:activeData},esc});return {evidence:json(profile.evidence()),html:profile.html()};}

try {
 if(process.argv.includes('--syntax'))for(const file of ['web/missions.js','web/profile.js','web/course.js','web/experience.js'])execFileSync(process.execPath,['--check',path.join(root,file)],{cwd:root,stdio:'pipe'});
 assert.equal(activeData.days.length,30);const ids=new Set(),attribution=JSON.parse(read('web/assets/audio/ATTRIBUTION.json'));
 function validateTurn(t,label){assert(t.rule.forms.length>0,label);assert.equal(t.partner.es,attribution[t.partner.audio]?.text,label+' exact original audio caption');assert(fs.existsSync(path.join(root,'web',attribution[t.partner.audio].file)),label+' audio exists');}
 for(const day of activeData.days){assert.equal(day.variants.length,4);assert.equal(day.variants.filter(v=>v.mode==='control').length,2);
  for(const v of day.variants){assert(!ids.has(v.id),'Unique active IDs');ids.add(v.id);assert(v.turns.length>=3&&v.turns.length<=5);
   for(const [i,t]of v.turns.entries()){validateTurn(t,v.id+':'+i);for(const b of Object.values(t.branch||{})){assert(b.next>i&&b.next<v.turns.length);validateTurn(b.turn,v.id+':branch');}}
   const h=harness();assert(h.app.start(day.day,{variant:v.id,resume:false}));
   while(!h.app.current.completed){const t=h.app.current.content,step=h.app.current.step;
    // Unknown text first, then every prepared form as retries. A later match cannot rewrite evidence.
    expectAnswer(h,'Estoy pensando en otra cosa.',t.rule.required.length?'missing':'unknown',v.id+':'+step+' unknown boundary');report.counts.unknownBoundaries++;
    const first=json(h.app.current.session.responses[step].first);
    for(const form of t.rule.forms){expectAnswer(h,form,'supported',v.id+':'+step+' '+form);assert.deepEqual(json(h.app.current.session.responses[step].first),first);report.counts.preparedForms++;}
    if(t.branch)h.app.change(button('data-mission-intent','accept'));advance(h);
   }
   const restored=harness(h.state.missions);assert.deepEqual(json(restored.state.missions.history),json(h.app.sanitize(h.state.missions).history));report.counts.activeVariants++;
  }
 }
 log('all-active-variants',{variants:report.counts.activeVariants,preparedForms:report.counts.preparedForms,firstAnswersImmutable:true,audioOriginal:true});assert.equal(report.counts.activeVariants,120);

 // Both explicit and recognized branches for every authored branching variant, including refusal forms.
 for(const day of activeData.days)for(const v of day.variants){const branchStep=v.turns.findIndex(t=>t.branch);if(branchStep<0)continue;
  for(const intent of ['accept','refuse'])for(const free of [false,true]){
   const h=atTurn(v,day.day,branchStep),text=free?(intent==='accept'?'Me apetece un café.':'Hoy prefiero pasar.'):(intent==='accept'?'Sí, quiero un café.':'No, gracias.');
   const first=answer(h,text);assert.equal(first.status,free?'unknown':'supported');assert.equal(first.intent,free?null:intent);
   if(free){advance(h);assert.equal(h.app.current.step,branchStep,'Free wording requires chosen meaning');h.app.change(button('data-mission-intent',intent));}
   advance(h);const branch=v.turns[branchStep].branch[intent];assert.equal(h.app.current.step,branch.next);assert.deepEqual(json(h.app.current.content),branch.turn);
   for(const form of branch.turn.rule.forms){expectAnswer(h,form,'supported',v.id+' '+intent+' '+form);report.counts.preparedForms++;}
   expectAnswer(h,'Estoy pensando en otra cosa.','unknown');report.counts.unknownBoundaries++;assert.deepEqual(json(h.app.current.session.responses[branchStep].first),first);
   finish(h);assert.deepEqual(json(harness(h.state.missions).state.missions.history),json(h.app.sanitize(h.state.missions).history));report.counts.branchPaths++;
  }
 }
 log('finite-branch-routing',{paths:report.counts.branchPaths,unknownNeedsMeaning:true,reloadKeepsPath:true});

 // Independently chosen editorial cases: task completion, not arbitrary answer-key membership.
 const editorial=[
  [1,1,'Me llamo Inés.','supported'],[1,1,'Vivo en Roma.','unknown'],
  [1,2,'Mucho gusto. ¿Cómo te llamas?','supported'],[1,2,'Me llamo Inés.','unknown'],[1,2,'¿Y tú?','unknown'],
  [2,0,'Estoy contenta, gracias. ¿Y tú?','supported'],[2,0,'Estoy bien. ¿Y tú, cómo estás?','supported'],
  [2,0,'Gracias.','unknown'],[2,0,'¿Y tú?','unknown'],[2,0,'Estoy contenta.','unknown'],[2,0,'¿Cómo te llamas?','unknown'],[2,0,'Estoy triste. ¿Y tú?','unknown'],
  [2,1,'Muchas gracias.','supported'],[2,1,'Bien, gracias.','unknown'],[2,1,'¿Y tú?','unknown'],
  [2,2,'Mucho gusto, gracias.','supported'],[2,2,'Estoy contento.','unknown'],
  [7,0,'Me llamo Inés.','supported'],[7,0,'Soy de España.','unknown'],
  [7,1,'Vivo en Valencia.','supported'],[7,1,'Soy de España.','unknown'],
  [7,2,'Sí, hablo español, un poco.','supported'],[7,2,'Hablo español.','unknown'],[7,2,'No hablo español.','unknown'],[7,2,'¿Cómo te llamas?','unknown'],[7,2,'Todavía estoy empezando.','unknown'],
  [7,3,'¿Y tú, cómo te llamas?','supported'],[7,3,'Hablo un poco de español.','unknown'],[7,3,'¿Y tú?','unknown']
 ];
 for(const [day,step,text,status]of editorial)for(const v of activeData.days.find(d=>d.day===day).variants){expectAnswer(atTurn(v,day,step),text,status,v.id+' editorial '+text);report.counts.editorialCases++;}
 for(const v of activeData.days[1].variants){assert(v.context.includes('втроём')&&v.context.includes('другой'),'Day 2 establishes another speaker before ¿Y tú?');assert.equal(v.turns[0].partner.es,'¿Y tú?');assert(v.turns[0].prompt.includes('как у тебя дела')&&v.turns[0].prompt.includes('в этой же реплике спроси'));assert(v.turns[1].prompt.includes('ответил на твой вопрос'));assert(v.turns[1].prompt.includes('за интерес к тебе'));}
 for(const day of [1,7])for(const v of activeData.days.find(d=>d.day===day).variants){assert.equal(v.turns.at(-1).partner.es,'Mucho gusto.');assert(v.turns.at(-1).prompt.includes('сам спроси имя'));}
 for(const v of activeData.days[6].variants){assert.equal(v.turns.length,4);assert.equal(v.turns[2].partner.es,'¿Hablas español?');assert(v.turns[1].prompt.includes('город проживания'));}
 log('independent-editorial-semantics',{cases:report.counts.editorialCases,day2BareThanksRejected:true,contextEstablishesUnansweredSpeaker:true,freeSpanishNotDeclaredWrong:true});

 const otherCases=[
  [3,0,'No entiendo.','supported'],[4,1,'Vivo en Bujará.','supported'],[5,0,'Estudio español.','supported'],[6,0,'Hablo un poco de español.','supported'],
  [8,0,'No, no me gusta la música.','supported'],[9,0,'Me gusta la música pop.','supported'],[10,1,'Prefiero leer porque es interesante.','supported'],
  [11,0,'No trabajo hoy.','supported'],[12,1,'A las seis.','supported'],[13,1,'Normalmente voy a pie.','supported'],[14,1,'Me gusta viajar porque es divertido.','supported'],
  [15,0,'Estoy cansada.','supported'],[16,0,'¡Qué buena idea!','supported'],[17,0,'Prefiero agua.','supported'],[18,1,'¿Nos vemos mañana?','supported'],
  [19,2,'A las dos.','supported'],[20,0,'Voy a estudiar español mañana.','supported'],[21,1,'¿Quieres un café mañana?','supported'],[22,0,'Anoche estudié.','supported'],
  [23,1,'Hoy no trabajo.','supported'],[24,0,'Más despacio, por favor.','supported'],[25,0,'Agua, por favor.','supported'],[26,1,'Vivo en Samarcanda.','supported'],
  [27,2,'¿Nos vemos mañana?','supported'],[28,0,'No sé.','supported'],[29,2,'Nos vemos.','supported'],[30,1,'Me gusta la música porque es divertida.','supported'],[30,1,'Me gusta leer porque es interesante.','unknown'],
  [10,1,'Prefiero leer.','missing'],[14,1,'Me gusta viajar.','missing'],[12,1,'Son las dos.','unknown'],[22,0,'Anoche estudio.','unknown'],[25,0,'Quiero un café.','unknown'],[6,0,'Hablo espanol.','unknown']
 ];
 for(const [day,step,text,status]of otherCases){const v=activeData.days.find(d=>d.day===day).variants.find(v=>v.mode==='train');expectAnswer(atTurn(v,day,step),text,status,'Day '+day+': '+text);report.counts.otherSemanticCases++;}
 log('other-independent-semantics',{cases:report.counts.otherSemanticCases});

 // Archives must be actual original objects, not hand-built lookalikes.
 assert.equal(activeData.legacyVariants.length,12);const expectedArchives=originalData.days.filter(d=>[1,2,7].includes(d.day)).flatMap(d=>d.variants.map(v=>({...v,day:d.day})));
 assert.deepEqual([...activeData.legacyVariants].sort((a,b)=>a.id.localeCompare(b.id)),[...expectedArchives].sort((a,b)=>a.id.localeCompare(b.id)));
 for(const day of originalData.days){const current=activeData.days.find(d=>d.day===day.day);if(![1,2,7].includes(day.day))assert.deepEqual(current,day,'Unchanged day '+day.day);}
 const archivedIds=new Set(activeData.legacyVariants.map(v=>v.id));assert.equal(archivedIds.size,12);
 for(const archived of expectedArchives){assert(!ids.has(archived.id),'Old IDs not selectable active content');const replacement=activeData.days.find(d=>d.day===archived.day).variants.find(v=>v.supersedes===archived.id);assert(replacement);assert.equal(replacement.id,archived.id+'-v20');assert.equal(replacement.mode,archived.mode);report.counts.legacyBodies++;}
 log('archive-original-bodies',{count:report.counts.legacyBodies,unchangedOtherDays:true});

 const oldHistories=[];let browserPartial=null,browserHistory=null;
 for(const archived of expectedArchives){
  const old=harness(undefined,{source:originalSource,catalog:originalData,now:PAST});assert(old.app.start(archived.day,{variant:archived.id,resume:false}));
  old.app.click(button('data-mission-reveal','translation'));answer(old,archived.turns[0].rule.forms[0],'hesitant');
  old.tick(20);answer(old,archived.turns[0].rule.forms.at(-1),'typed');advance(old);
  old.app.input({value:'Mi borrador guardado.',hasAttribute:a=>a==='data-mission-answer'});old.app.change(button('data-mission-oral','help'));
  const partial=json(old.app.sanitize(old.state.missions)),restored=harness(partial);assert.deepEqual(json(restored.state.missions.sessions),partial.sessions,'Original first status/text/time/aids and retry/draft kept: '+archived.id);
  if(archived.id==='d07-train-a')browserPartial={session:partial.sessions[0],content:json(old.app.current.content)};
  assert(restored.app.start(archived.day,{control:archived.mode==='control'}));assert.equal(restored.app.current.variant,archived.id);assert.equal(restored.app.current.session.id,partial.sessions[0].id);
  assert.deepEqual(json(restored.app.current.content),archived.turns[1],'Unfinished old session resumes original content');assert(restored.app.html().includes('сохранённая сцена'));assert(restored.app.html().includes('Mi borrador guardado.'));
  const changed=json(partial);changed.sessions[0].responses[0].first.text='Otro texto.';changed.sessions[0].responses[0].first.oral='help';changed.sessions[0].responses[0].first.aids=[];changed.sessions[0].responses[0].first.at+=2;
  assert.deepEqual(json(restored.app.merge(partial,changed).sessions[0].responses[0].first),partial.sessions[0].responses[0].first,'Merge protects original first evidence');
  finish(old);const oldHistory=json(old.app.sanitize(old.state.missions));oldHistories.push(oldHistory.history[0]);
  if(archived.id==='d02-train-a')browserHistory=oldHistory.history[0];
  const loaded=harness(oldHistory);assert.deepEqual(json(loaded.state.missions.history),oldHistory.history,'Completed old history reload exact: '+archived.id);
  const changedHistory=json(oldHistory);changedHistory.history[0].responses[0].first.text='Otro texto.';assert.deepEqual(json(loaded.app.merge(oldHistory,changedHistory).history),oldHistory.history,'Completed original evidence immutable on import');
  const promoted=restored.app.merge(partial,oldHistory);assert.equal(promoted.sessions.length,0);assert.deepEqual(json(promoted.history[0].responses[0].first),partial.sessions[0].responses[0].first,'Import completion promotes original partial without rewriting first');
  const fresh=harness();fresh.app.start(archived.day,{variant:archived.id,control:archived.mode==='control',resume:false});assert(!archivedIds.has(fresh.app.current.variant),'New request for old ID cannot create an archived attempt');assert(fresh.app.current.variant.endsWith('-v20'));
  report.counts.legacySessions++;report.counts.legacyHistories++;
 }
 log('real-old-module-fixtures',{partialSessions:report.counts.legacySessions,completedHistories:report.counts.legacyHistories,originalFirstEvidencePreserved:true,oldContentResumable:true,importCompletionPreservesFirst:true});
 const prof=profileEvidence({history:oldHistories,sessions:[],seenVariants:oldHistories.map(h=>h.variant)});
 assert.equal(prof.evidence.missions.length,12);assert.equal(prof.evidence.firstResponses,oldHistories.reduce((n,h)=>n+h.responses.length,0));assert.equal(prof.evidence.independentSpeech,oldHistories.reduce((n,h)=>n+h.responses.filter(r=>r.first.oral==='independent').length,0));assert(prof.html.includes('Разговор доведён до конца'));assert(prof.html.includes('12 разговорных попыток'));
 log('real-profile-legacy-achievements',{missions:12,firstResponses:prof.evidence.firstResponses,independentSpeech:prof.evidence.independentSpeech});
 const browserFixture={baseline:revision,createdAt:NOW,missions:{version:1,sessions:[browserPartial.session],history:[browserHistory],seenVariants:[browserPartial.session.variant,browserHistory.variant]},expected:{resume:{id:browserPartial.session.id,day:7,variant:browserPartial.session.variant,step:browserPartial.session.step,content:browserPartial.content,first:browserPartial.session.responses[0].first,draft:browserPartial.session.responses[1].draft,oral:browserPartial.session.responses[1].oral},history:{id:browserHistory.id,day:2,variant:browserHistory.variant,firsts:browserHistory.responses.map(r=>r.first),completedAt:browserHistory.completedAt,dueAt:browserHistory.dueAt,dueVariant:browserHistory.dueVariant},profile:{missions:1,firstResponses:browserHistory.responses.length}}};
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(path.join(path.dirname(reportPath),'legacy-browser-fixture.json'),JSON.stringify(browserFixture,null,2)+'\n');

 // Original train completions generate true original due IDs. New control selection maps only unseen equivalents.
 for(const day of [1,2,7])for(const suffix of ['a','b']){
  const prior=suffix==='b'?{history:[],sessions:[],seenVariants:['d'+String(day).padStart(2,'0')+'-control-a']}:undefined;
  const old=harness(prior,{source:originalSource,catalog:originalData,now:PAST});old.app.start(day,{resume:false});const history=finish(old),dueId='d'+String(day).padStart(2,'0')+'-control-'+suffix;
  assert.equal(history.dueVariant,dueId);assert.equal(history.dueAt,history.completedAt+DAY);
  const h=harness(old.state.missions);assert.equal(h.state.missions.history[0].dueVariant,dueId,'Do not rewrite saved schedule');assert(h.app.pendingControl(h.state.missions.history[0]));
  h.app.start(day,{control:true,resume:false});assert.equal(h.app.current.variant,dueId+'-v20');assert.equal(h.app.current.exposed,false);assert(!h.app.pendingControl(h.state.missions.history[0]),'Exposed corrected scheduled variant no longer pending');report.counts.dueMappings++;
  const seen=json(old.state.missions);seen.seenVariants.push(dueId);const blocked=harness(seen);assert(!blocked.app.pendingControl(blocked.state.missions.history[0]),'Seen old equivalent cannot become fresh due content');
  const merged=h.app.merge(seen,{history:[],sessions:[],seenVariants:[dueId+'-v20']});assert(merged.seenVariants.includes(dueId)&&merged.seenVariants.includes(dueId+'-v20'));
  report.counts.exposureCases++;
 }
 for(const day of [1,2,7])for(const mode of ['train','control']){
  const seen=originalData.days.find(d=>d.day===day).variants.filter(v=>v.mode===mode).map(v=>v.id),h=harness({history:[],sessions:[],seenVariants:seen});h.app.start(day,{control:mode==='control',resume:false});assert(h.app.current.exposed,'Exhausted old family still familiar');assert(h.app.current.variant.endsWith('-v20'));assert(h.app.html().includes('этот вариант уже встречался'));
  const one=harness({history:[],sessions:[],seenVariants:seen.slice(0,1)});one.app.start(day,{control:mode==='control',resume:false});assert.equal(one.app.current.variant,seen[1]+'-v20');assert.equal(one.app.current.exposed,false,'Skip seen equivalent and use unseen sibling');report.counts.exposureCases+=2;
 }
 log('due-and-exposure-families',{originalDueMappings:report.counts.dueMappings,exposureCases:report.counts.exposureCases,savedSchedulePreserved:true,seenOldNotClaimedNew:true});
 // Empty oral choice and draft are real submit guards, and narrow feedback remains honest.
 const guard=harness();guard.app.start(2);guard.app.input({value:'Bien, gracias. ¿Y tú?',hasAttribute:a=>a==='data-mission-answer'});guard.app.click(button('data-mission-check'));assert.equal(guard.app.current.session.responses[0].first,null);assert(guard.toasts.at(-1).includes('оценку устного'));
 expectAnswer(guard,'Gracias.','unknown');assert(guard.app.html().includes('не доказательство ошибки'));assert(!guard.app.html().includes('Неверно'));assert.equal(guard.app.current.session.responses[0].first.oral,'independent');
 log('limited-feedback',{oralSelfReportRequired:true,unknownDoesNotMeanBadSpanish:true});
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally {fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,report:reportPath}));}
