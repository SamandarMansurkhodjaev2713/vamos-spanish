/* node check-missions-v24.cjs [--syntax]. Independent finite dialogue and persistence regression. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const root=__dirname,revision='6d9d541',DAY=86400000,NOW=Date.now(),PAST=NOW-3*DAY,changedDays=[15,24,28],changedIds=new Set(["d15-train-a","d15-train-b","d24-train-a","d24-train-b","d28-train-a","d28-train-b","d28-control-a","d28-control-b"]);
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const original=f=>execFileSync('git',['show',revision+':'+f],{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024});
const catalog=JSON.parse(read('mission-data.json')),baseline=JSON.parse(original('mission-data.json'));
const source=read('web/missions.js'),oldSource=original('web/missions.js'),profileSource=read('web/profile.js');
const reportPath=path.join(root,'.impeccable/review-v24/semantic-regression.json');
const report={passed:false,baseline:revision,counts:{activeVariants:0,archivedVariants:0,preparedForms:0,negativeBoundaries:0,branchPaths:0,semanticCases:0,legacySessions:0,legacyHistories:0,dueMappings:0,exposureCases:0},checks:[],limits:'Finite text models, original audio metadata and persisted evidence only; no recorded-speech, pronunciation, language-level, physical-device or learning-efficacy claim.'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
report.sources={missionData:hash(read('mission-data.json')),missions:hash(source),profile:hash(profileSource)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(name,value='')=>({dataset:{[name.replace(/^data-/,'').replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]:value},hasAttribute:a=>a===name});
function harness(saved,{module=source,data=catalog,now=NOW}={}){
 let time=now;const state={missions:plain(saved)},ctx={window:{},console,Date:class extends Date{static now(){return time}}};
 vm.createContext(ctx);vm.runInContext(module,ctx);const toasts=[];
 const app=ctx.window.VamosMissions.create({state,data:{missions:data},esc,save(){},render(){},toast:s=>toasts.push(s)});
 return {state,app,toasts,tick:n=>time+=n};
}
function answer(h,text,oral='independent'){
 h.app.input({value:text,hasAttribute:a=>a==='data-mission-answer'});h.app.change(button('data-mission-oral',oral));h.tick(1);h.app.click(button('data-mission-check'));
 return plain(h.app.current.session.responses[h.app.current.step].latest);
}
const next=h=>h.app.click(button('data-mission-next'));
function expect(h,text,status,label=text){assert.equal(answer(h,text).status,status,label);}
function complete(h){let guard=0;while(!h.app.current.completed){assert(++guard<10,'Finite mission');answer(h,h.app.current.content.rule.forms[0]);next(h);}return plain(h.state.missions.history.at(-1));}
function at(id,step,options={}){const data=options.data||catalog,day=data.days.find(d=>d.variants.some(v=>v.id===id));assert(day,id+' selectable fixture');const h=harness(undefined,options);assert(h.app.start(day.day,{variant:id,resume:false}));for(let i=0;i<step;i++){answer(h,h.app.current.content.rule.forms[0]);next(h);}return h;}
function semantic(id,step,text,status){expect(at(id,step),text,status,id+': '+text);report.counts.semanticCases++;}
const log=(kind,detail={})=>report.checks.push({kind,...detail});
const activeIds=new Set(catalog.days.flatMap(d=>d.variants.map(v=>v.id)));
const fixtureCatalog=v=>({...baseline,days:[{day:v.day,title:'Archived original runtime fixture',variants:[v]}]});
function profile(saved){const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(profileSource,ctx);const app=ctx.window.VamosProfile.create({state:{missions:plain(saved)},data:{missions:catalog},esc});return {evidence:plain(app.evidence()),html:app.html()};}

try{
 if(process.argv.includes('--syntax'))for(const f of ['web/missions.js','web/profile.js','web/course.js','web/experience.js'])execFileSync(process.execPath,['--check',path.join(root,f)],{stdio:'pipe'});
 assert.equal(catalog.days.length,30);assert.equal(activeIds.size,120);assert.equal(catalog.legacyVariants.length,32);
 const originals=baseline.days.flatMap(d=>d.variants.filter(v=>changedIds.has(v.id)).map(v=>({...v,day:d.day})));
 assert.equal(originals.length,8);const expectedArchives=[...baseline.legacyVariants,...originals],sort=a=>[...a].sort((x,y)=>x.id.localeCompare(y.id));
 assert.deepEqual(sort(catalog.legacyVariants),sort(expectedArchives),'All original objects archived byte-equivalent as parsed, with day');
 for(const d of baseline.days)for(const v of d.variants){if(changedIds.has(v.id))continue;const current=catalog.days.find(x=>x.day===d.day).variants.find(x=>x.id===v.id);if(d.day===26){assert.deepEqual(current.turns,v.turns,'Day26 unchanged turn bodies '+v.id);assert.equal(current.mode,v.mode);}else assert.deepEqual(current,v,'Unchanged variant '+v.id);}
 for(const v of originals){const replacement=catalog.days.find(d=>d.day===v.day).variants.find(x=>x.supersedes===v.id);assert(replacement,v.id);assert.equal(replacement.id,v.id+'-v24');assert.equal(replacement.mode,v.mode);assert(!activeIds.has(v.id));}
 log('archives',{newOriginals:8,priorOriginals:24,unrelatedDaysUnchanged:true});

 const attribution=JSON.parse(read('web/assets/audio/ATTRIBUTION.json'));
 function validate(t,label){assert(t.rule.forms.length,label);assert.equal(t.partner.es,attribution[t.partner.audio]?.text,label+' exact audio caption');assert(fs.existsSync(path.join(root,'web',attribution[t.partner.audio].file)),label+' local original audio');}
 function walk(v,day,options,archived=false){const h=at(v.id,0,options);for(const [i,t]of v.turns.entries()){validate(t,v.id+':'+i);for(const branch of Object.values(t.branch||{})){assert(branch.next>i&&branch.next<v.turns.length);validate(branch.turn,v.id+':branch');}}
  let guard=0;while(!h.app.current.completed){assert(++guard<10);const t=h.app.current.content;
   expect(h,'Estoy pensando en otra cosa.',t.rule.required.length?'missing':'unknown',v.id+' unrelated text');report.counts.negativeBoundaries++;
   const first=plain(h.app.current.session.responses[h.app.current.step].first);
   for(const form of t.rule.forms){expect(h,form,'supported',v.id+' prepared '+form);assert.deepEqual(plain(h.app.current.session.responses[h.app.current.step].first),first);report.counts.preparedForms++;}
   for(const text of ['xylophone porque '+t.rule.forms[0],t.rule.forms[0]+' porque 123']){expect(h,text,'unknown',v.id+' anchored rejection');report.counts.negativeBoundaries++;}
   if(t.branch)h.app.change(button('data-mission-intent','accept'));next(h);
  }
  const loaded=harness(h.state.missions,options);assert.deepEqual(plain(loaded.state.missions.history),plain(h.app.sanitize(h.state.missions).history));report.counts[archived?'archivedVariants':'activeVariants']++;
 }
 for(const d of catalog.days){assert.equal(d.variants.length,4);assert.equal(d.variants.filter(v=>v.mode==='control').length,2);for(const v of d.variants)walk(v,d.day,{});}
 for(const v of expectedArchives)walk(v,v.day,{module:oldSource,data:fixtureCatalog(v)},true);
 assert.equal(report.counts.activeVariants,120);assert.equal(report.counts.archivedVariants,32);log('finite-model-membership',{...report.counts,firstEvidenceImmutable:true});

 for(const d of catalog.days)for(const v of d.variants){const step=v.turns.findIndex(t=>t.branch);if(step<0)continue;for(const intent of ['accept','refuse'])for(const free of [false,true]){
  const h=at(v.id,step),text=free?(intent==='accept'?'Me apetece un café.':'Hoy prefiero pasar.'):(intent==='accept'?'Sí, quiero un café.':'No, gracias.');
  const first=answer(h,text);assert.equal(first.status,free?'unknown':'supported');assert.equal(first.intent,free?null:intent);
  if(free){next(h);assert.equal(h.app.current.step,step);h.app.change(button('data-mission-intent',intent));}next(h);assert.deepEqual(plain(h.app.current.content),v.turns[step].branch[intent].turn);
  for(const form of h.app.current.content.rule.forms)expect(h,form,'supported');assert.deepEqual(plain(h.app.current.session.responses[step].first),first);
  complete(h);assert.deepEqual(plain(harness(h.state.missions).state.missions.history),plain(h.app.sanitize(h.state.missions).history));report.counts.branchPaths++;
 }}log('branch-routing',{paths:report.counts.branchPaths,unknownRequiresMeaning:true});

 // The expected language here is independently authored; do not derive this table from edited keys.
 for(const day of [10,14])for(const mode of ['train','control'])for(const suffix of ['a','b']){
  const id='d'+day+'-'+mode+'-'+suffix+'-v22',activity=mode==='control'&&suffix==='b'?'viajar':'leer',other=activity==='leer'?'viajar':'leer',verb=day===10?'Prefiero':'Me gusta';
  if(day===14&&mode==='train'){semantic(id,0,'No, no me gusta la música.','supported');semantic(id,0,'Me gusta leer.','unknown');}
  else{semantic(id,0,verb+' '+activity+'.','supported');semantic(id,0,verb+' '+other+'.','unknown');}
  semantic(id,1,verb+' '+activity+' porque es interesante.','supported');
  if(mode==='control')semantic(id,1,verb+' '+activity+' porque es divertido.','supported');
  semantic(id,1,verb+' '+other+' porque es divertido.',day===14&&mode==='train'?'supported':'unknown');
  semantic(id,1,'Prefiero el café porque es interesante.','unknown');semantic(id,1,'Me gusta la música porque es divertida.','unknown');
  semantic(id,1,verb+' '+activity+'.','missing');semantic(id,1,verb+' '+activity+' por que es interesante.','missing');
  semantic(id,1,'porque','unknown');semantic(id,1,'Porque es interesante.','unknown');semantic(id,1,verb+' '+activity+' porque descubro nuevas ideas.','unknown');
  semantic(id,1,verb+' '+activity+' porque es divertida.','unknown');
  semantic(id,1,('  '+verb+' '+activity+', porque es interesante!  ').toUpperCase(),'supported');
  if(day===10)semantic(id,1,'Me gusta '+activity+' porque es interesante.','unknown');
  else{semantic(id,1,'Prefiero '+activity+' porque es divertido.','supported');semantic(id,1,'Prefiero '+other+' porque es interesante.',mode==='train'?'supported':'unknown');}
  semantic(id,2,'¿Te gusta la música?','supported');semantic(id,2,'¿Y tú, te gusta la música?','supported');
  semantic(id,2,'¿Y tú?','unknown');semantic(id,2,'¿Y tú, qué prefieres?','unknown');
  const v=catalog.days.find(d=>d.day===day).variants.find(v=>v.id===id);assert.equal(v.turns.length,3);assert(v.turns.at(-1).prompt.includes('музык'));assert(!v.turns.slice(0,-1).some(t=>/^(?:Me gusta|No me gusta|Prefiero).*música/.test(t.partner.es)),'Partner music taste remains unknown until learner asks');
 }
 for(const id of ['d30-train-a','d30-train-b']){
  for(const [text,status]of [['Me gusta la música porque es divertida.','supported'],['Prefiero la música porque es interesante.','supported'],['Me gusta la música porque es divertido.','unknown'],['Me gusta leer porque es interesante.','unknown'],['Me gusta la música.','missing']])semantic(id,1,text,status);
 }
 for(const mode of ['train','control'])for(const suffix of ['a','b']){
  const id='d12-'+mode+'-'+suffix+'-v22',v=catalog.days.find(d=>d.day===12).variants.find(v=>v.id===id);
  assert.equal(v.turns[1].partner.audio,mode==='train'?'609857':'437723');assert.equal(v.turns[1].partner.es,mode==='train'?'Ven a las dos.':'De acuerdo.');
  if(mode==='train'){semantic(id,1,'A las seis.','supported');semantic(id,1,'A las dos.',suffix==='a'?'supported':'unknown');semantic(id,1,'Son las dos.','unknown');}
  else{semantic(id,1,'Son las dos.','supported');semantic(id,1,'Ahora son las dos.','supported');semantic(id,1,'A las dos.','unknown');semantic(id,1,'A las seis.','unknown');}
  semantic(id,1,'¿Qué hora es?','unknown');semantic(id,1,'Estoy libre mañana.','unknown');
  if(mode==='train'){semantic(id,0,'¿A qué hora?','supported');semantic(id,0,'Son las dos.','unknown');}
  else{semantic(id,0,'A las seis.','supported');semantic(id,0,'A las dos.',suffix==='a'?'supported':'unknown');semantic(id,0,'Son las dos.','unknown');}
  const final=suffix==='b'?'Nos vemos a las seis.':mode==='train'?'De acuerdo, nos vemos.':'Nos vemos.';
  semantic(id,2,final,'supported');semantic(id,2,'De acuerdo, a las dos.','unknown');semantic(id,2,'Son las dos.','unknown');
 }
 log('independent-task-semantics',{cases:report.counts.semanticCases,fixedReferents:true,musicQuestionUnanswered:true,standalonePorque:true});

 const oldHistories=[];
 for(const archived of expectedArchives){
  const options={module:oldSource,data:fixtureCatalog(archived),now:PAST},old=at(archived.id,0,options);
  old.app.click(button('data-mission-reveal','translation'));answer(old,archived.turns[0].rule.forms[0],'hesitant');answer(old,archived.turns[0].rule.forms.at(-1),'typed');next(old);
  old.app.input({value:'Mi borrador guardado.',hasAttribute:a=>a==='data-mission-answer'});old.app.change(button('data-mission-oral','help'));
  const partial=plain(old.app.sanitize(old.state.missions)),restored=harness(partial);assert.deepEqual(plain(restored.state.missions.sessions),partial.sessions,'Original text/status/time/aids/retry/draft: '+archived.id);
  assert(restored.app.start(archived.day,{control:archived.mode==='control'}));assert.equal(restored.app.current.variant,archived.id);assert.deepEqual(plain(restored.app.current.content),archived.turns[1]);assert(restored.app.html().includes('сохранённая сцена'));
  const altered=plain(partial);altered.sessions[0].responses[0].first.text='Otro texto.';altered.sessions[0].responses[0].first.oral='help';assert.deepEqual(plain(restored.app.merge(partial,altered).sessions[0].responses[0].first),partial.sessions[0].responses[0].first);
  complete(old);const saved=plain(old.app.sanitize(old.state.missions));oldHistories.push(saved.history[0]);const loaded=harness(saved);assert.deepEqual(plain(loaded.state.missions.history),saved.history);
  const alteredHistory=plain(saved);alteredHistory.history[0].responses[0].first.text='Otro texto.';assert.deepEqual(plain(loaded.app.merge(saved,alteredHistory).history),saved.history);
  const promoted=restored.app.merge(partial,saved);assert.equal(promoted.sessions.length,0);assert.deepEqual(plain(promoted.history[0].responses[0].first),partial.sessions[0].responses[0].first);
  const fresh=harness();fresh.app.start(archived.day,{variant:archived.id,control:archived.mode==='control',resume:false});assert(activeIds.has(fresh.app.current.variant),'No new archived attempts');
  report.counts.legacySessions++;report.counts.legacyHistories++;
 }
 let originalSemanticCases=0;
 for(const archived of originals){
  const i=archived.day===15?1:0,text=archived.day===15?'Estoy contento.':archived.day===24?'Más despacio, por favor.':'No lo sé.';
  const old=at(archived.id,i,{module:oldSource,data:baseline,now:PAST});expect(old,text,'supported');const first=plain(old.app.current.session.responses[i].first),content=plain(old.app.current.content);
  const restored=harness(old.state.missions);assert(restored.app.start(archived.day,{control:archived.mode==='control'}));assert.deepEqual(plain(restored.app.current.content),content);assert.deepEqual(plain(restored.app.current.session.responses[i].first),first);assert.equal(restored.app.current.phase,'answer');
  complete(old);assert.deepEqual(plain(harness(old.state.missions).state.missions.history[0].responses[i].first),first);originalSemanticCases++;
 }
 log('independent-original-meaning-evidence',{cases:originalSemanticCases,oldKnownAnswersRemainSupportedAfterRepair:true,oldCaptionsUnchanged:true});
 const prof=profile({version:1,sessions:[],history:oldHistories,seenVariants:oldHistories.map(h=>h.variant)});
 assert.equal(prof.evidence.missions.length,32);assert.equal(prof.evidence.firstResponses,oldHistories.reduce((n,h)=>n+h.responses.length,0));assert.equal(prof.evidence.independentSpeech,oldHistories.reduce((n,h)=>n+h.responses.filter(r=>r.first.oral==='independent').length,0));assert(prof.html.includes('Разговор доведён до конца'));assert(prof.html.includes('32 разговорных попыток'));
 log('original-session-history-profile',{partials:32,histories:32,originalStatusesAndFirstAttempts:true,profileMissions:32,profileFirstResponses:prof.evidence.firstResponses});
 // Original, pre-fix scenes are run with the untouched production snapshot and compared to current restoration.
 const browserOld=at('d28-train-a',1,{module:oldSource,data:baseline,now:PAST});
 expect(browserOld,'¿Podrías repetir eso?','supported');browserOld.app.input({value:'Más despacio, por favor.',hasAttribute:a=>a==='data-mission-answer'});browserOld.app.change(button('data-mission-oral','help'));
 const browserPartial=plain(browserOld.app.sanitize(browserOld.state.missions).sessions[0]),browserContent=plain(browserOld.app.current.content);
 const browserDone=at('d28-train-b',0,{module:oldSource,data:baseline,now:PAST}),browserHistory=complete(browserDone);
 const browserSaved={version:1,sessions:[browserPartial],history:[browserHistory],seenVariants:[browserPartial.variant,browserHistory.variant]};
 const browserFixture={baseline:revision,createdAt:NOW,missions:browserSaved,expected:{resume:{id:browserPartial.id,day:28,variant:browserPartial.variant,step:browserPartial.step,content:browserContent,first:browserPartial.responses[0].first,draft:browserPartial.responses[1].draft,oral:browserPartial.responses[1].oral,repairFirst:browserPartial.responses[1].first},history:{id:browserHistory.id,day:28,variant:browserHistory.variant,firsts:browserHistory.responses.map(r=>r.first),completedAt:browserHistory.completedAt,dueAt:browserHistory.dueAt,dueVariant:browserHistory.dueVariant},profile:{missions:1,firstResponses:browserHistory.responses.length}}};
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(path.join(path.dirname(reportPath),'semantic-legacy-browser-fixture.json'),JSON.stringify(browserFixture,null,2)+'\n');
 // All 30 saved train schedules, including the six old controls now rewritten and prior v20/v22 families.
 for(const day of Array.from({length:30},(_,i)=>i+1))for(const suffix of ['a','b']){
  const oldDay=baseline.days.find(d=>d.day===day),train=oldDay.variants.find(v=>v.mode==='train'&&v.id.startsWith('d'+String(day).padStart(2,'0')+'-train-'+suffix)),control=oldDay.variants.find(v=>v.mode==='control'&&v.id.startsWith('d'+String(day).padStart(2,'0')+'-control-'+suffix));
  const prior=suffix==='b'?{sessions:[],history:[],seenVariants:[oldDay.variants.find(v=>v.mode==='control'&&v.id.startsWith('d'+String(day).padStart(2,'0')+'-control-a')).id]}:undefined;
  const old=harness(prior,{module:oldSource,data:baseline,now:PAST});assert(old.app.start(day,{variant:train.id,resume:false}));const history=complete(old),due=control.id;
  assert.equal(history.dueVariant,due);assert.equal(history.dueAt,history.completedAt+DAY);const loaded=harness(old.state.missions);assert.equal(loaded.state.missions.history[0].dueVariant,due);assert(loaded.app.pendingControl(loaded.state.missions.history[0]));
  loaded.app.start(day,{control:true,resume:false});const expectedControl=catalog.days.find(d=>d.day===day).variants.find(v=>v.id===due||v.supersedes===due);assert.equal(loaded.app.current.variant,expectedControl.id);assert.equal(loaded.app.current.exposed,false);assert(!loaded.app.pendingControl(loaded.state.missions.history[0]));report.counts.dueMappings++;
  const seen=plain(old.state.missions);seen.seenVariants.push(due);const blocked=harness(seen);assert(!blocked.app.pendingControl(blocked.state.missions.history[0]));report.counts.exposureCases++;
 }
 for(const d of catalog.days)for(const mode of ['train','control']){
  const current=d.variants.filter(v=>v.mode===mode),oldIds=current.map(v=>v.supersedes||v.id);
  const exhausted=harness({sessions:[],history:[],seenVariants:oldIds});exhausted.app.start(d.day,{control:mode==='control',resume:false});assert.equal(exhausted.app.current.exposed,true);assert(exhausted.app.html().includes('этот вариант уже встречался'));
  const sibling=harness({sessions:[],history:[],seenVariants:oldIds.slice(0,1)});sibling.app.start(d.day,{control:mode==='control',resume:false});assert.equal(sibling.app.current.variant,current[1].id);assert.equal(sibling.app.current.exposed,false);report.counts.exposureCases+=2;
 }
 log('saved-due-and-exposure-families',{mappings:report.counts.dueMappings,cases:report.counts.exposureCases,savedScheduleUnchanged:true});

 for(const suffix of ['a','b']){
  const id='d15-train-'+suffix+'-v24',v=catalog.days[14].variants.find(v=>v.id===id);
  assert.deepEqual(v.turns.map(t=>t.partner.es),suffix==='a'?['Yo estoy cansado.','Estoy contento.','Estoy bien.']:['Yo estoy cansado.','Estoy contento.','Nos vemos.'],'One masculine partner; wellbeing answer follows wellbeing question, not another unexplained contento');
  for(const text of ['Estoy cansado.','Estoy cansada.','No estoy cansado.','No estoy cansada.'])semantic(id,0,text,'supported');
  for(const text of ['Estoy contento.','Me llamo Ana.','¿Y tú?'])semantic(id,0,text,'unknown');
  if(suffix==='a'){
   semantic(id,1,'¿Y tú, estás bien?','supported');semantic(id,1,'¿Cómo estás hoy?','supported');
   for(const text of ['Estoy contento.','Estoy cansado.','¿Y tú?','¿Te gusta la música?'])semantic(id,1,text,'unknown');
   assert(/cómo estás hoy/i.test(v.turns[1].explanation),'New prepared wellbeing question explicitly explained');
  }else{
   semantic(id,1,'Estoy contento.','supported');semantic(id,1,'Estoy contenta.','supported');
   for(const text of ['Estoy cansada.','¿Y tú, estás bien?'])semantic(id,1,text,'unknown');
  }
  for(const text of ['Hasta luego.','Nos vemos.'])semantic(id,2,text,'supported');
  for(const text of ['¿Y tú?','Estoy bien.'])semantic(id,2,text,'unknown');
 }
 for(const suffix of ['a','b']){
  const id='d24-train-'+suffix+'-v24',v=catalog.days[23].variants.find(v=>v.id===id);
  assert.deepEqual(v.turns.slice(0,2).map(t=>t.partner.es),['¿Qué vas a hacer mañana?','¿Qué vas a hacer mañana?'],'Unheard plan question is repeated verbatim');
  assert.deepEqual(v.turns[0].partner,v.turns[1].partner,'Actual original recording identity repeats');
  assert(!/имя|Андреа/.test(v.turns[0].prompt+v.context),'Plan repair is not captioned as missed name');
  for(const text of ['¿Podrías repetir eso?','Más despacio, por favor.','Más despacio.'])semantic(id,0,text,'supported');
  for(const text of ['Me llamo Andrea.','No lo sé.','Mañana voy a trabajar.'])semantic(id,0,text,'unknown');
  for(const text of ['Mañana voy a trabajar.','Voy a estudiar español mañana.','Voy a trabajar.','Voy a estudiar español.'])semantic(id,1,text,'supported');
  for(const text of ['¿Podrías repetir eso?','Me llamo Andrea.','Trabajo ayer.','No lo sé.'])semantic(id,1,text,'unknown');
  if(suffix==='a'){semantic(id,2,'Me gusta viajar.','supported');semantic(id,2,'Me gusta leer.','supported');semantic(id,2,'Hasta luego.','unknown');}
  else{semantic(id,2,'Hasta luego.','supported');semantic(id,2,'Nos vemos.','supported');semantic(id,2,'Me gusta viajar.','unknown');}
 }
 for(const mode of ['train','control'])for(const suffix of ['a','b']){
  const id='d28-'+mode+'-'+suffix+'-v24',v=catalog.days[27].variants.find(v=>v.id===id);
  assert.deepEqual(v.turns.map(t=>t.partner.es),['¿Qué vas a hacer mañana?','¿Qué vas a hacer mañana?','Nos vemos.'],'Repair precedes the true repeated question and a meaningful answer precedes goodbye');
  assert.deepEqual(v.turns[0].partner,v.turns[1].partner,'Same unaltered recording, no fictitious newly recorded slow voice');
  if(mode==='control'){assert.equal(v.goal,'Контроль знакомой сцены');assert(/знакомый вопрос/i.test(v.context));assert(/не проверяет новый голос или незнакомую ситуацию/i.test(v.outcome));}else assert(/не проверка нового голоса/i.test(v.outcome));
  for(const text of ['Más despacio.','Más despacio, por favor.'])semantic(id,0,text,'supported');
  if(mode==='train')semantic(id,0,'¿Podrías repetir eso?','supported');
  for(const text of ['No lo sé.','Hola.','Hasta luego.'])semantic(id,0,text,'unknown');
  for(const text of ['No lo sé.','No sé.','Lo siento, no lo sé.'])semantic(id,1,text,'supported');assert.deepEqual([...v.turns[1].rule.forms].sort(),['No lo sé.','No sé.','Lo siento, no lo sé.'].sort(),'Finite unknown-plan models have one meaning, with optional apology');assert.deepEqual(v.turns[1].rule.patterns,[]);
  for(const text of ['¿Y tú?','Hola.','Más despacio.','Voy a trabajar.'])semantic(id,1,text,'unknown');
  const farewell=mode==='control'&&suffix==='a'?'Gracias, hasta luego.':'Hasta luego.';
  semantic(id,2,farewell,'supported');semantic(id,2,mode==='control'&&suffix==='a'?'Gracias, nos vemos.':'Nos vemos.','supported');
  for(const text of ['No lo sé.','¿Y tú?','Quiero hablar contigo.'])semantic(id,2,text,'unknown');
 }
 for(const v of catalog.days.flatMap(d=>d.variants).filter(v=>v.id.endsWith('-v24')))for(const [i,t]of v.turns.entries())for(const e of t.examples)semantic(v.id,i,e,'supported');
 log('independent-v24-task-semantics',{cases:report.counts.semanticCases,coherentSinglePartner:true,realRepeatThenMeaningfulAnswer:true});
 // Independently keyed written scene: known facts first, then an unknown taste, answer, farewell.
 const bank=JSON.parse(read('exercise-bank.json')),goals=JSON.parse(read('course-goals.json')),written=bank[25];
 assert.deepEqual(written.dialogue,['A: Hola. Me llamo Ana. Soy de México. Estudio español.','B: ¿Te gusta la música?','A: Sí, me gusta la música.','B: Nos vemos.','A: Hasta luego.']);
 const writtenKeys=['Имя и происхождение.','¿Te gusta la música?'];
 for(let i=0;i<2;i++){assert.equal(written.quiz[i].options[written.quiz[i].answer],writtenKeys[i]);assert.equal(written.quiz[i].options.filter(x=>x===writtenKeys[i]).length,1);assert.equal(goals.lessons[25].closedChecks[i].question,written.quiz[i].question);assert.equal(goals.lessons[25].closedChecks[i].expected,writtenKeys[i]);}
 assert.deepEqual(written.quiz[1].options,['¿Cómo te llamas?','¿Te gusta la música?','¿De dónde eres?'],'Known-fact questions are explicit wrong alternatives to the missing interest');
 assert.equal(goals.lessons[25].missionVerification.task,written.own,'Written personal task and day26 goal contract match');
 assert(/первой реплики/i.test(written.own),'Own task names first-replica boundary before taste is disclosed');
 const coreSource=read('web/course.js'),extraBranch=coreSource.split(/\r?\n/).find(l=>l.includes("if(b.hasAttribute('data-extra-check'))"));assert(extraBranch);
 const ctx={window:{},Date,console};vm.createContext(ctx);vm.runInContext(read('web/course-data.js'),ctx);const built=ctx.window.VAMOS_DATA;
 assert.deepEqual(plain(built.lessons[25].practice),written,'Built data uses actual checked written scene');assert.deepEqual(plain(built.missions),catalog,'Built mission catalog includes final familiar-control labels');
 Object.assign(ctx,{data:built,state:{day:26,mistakes:{},cards:{}},contentDay:()=>26,practiceLesson:()=>built.lessons[25],extra:()=>built.expanded.lessons[25],norm:s=>String(s).toLowerCase().replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim(),save(){},practiceIndex:0,selected:null,practiceResult:null,render(){},focusPractice(){},learning:{log(){}},adaptive:{observe(){}},sound(){}});
 vm.runInContext(`function extraCheck(){const b={hasAttribute:key=>key==='data-extra-check'};${extraBranch}}`,ctx);
 let accepted=0,rejected=0;for(let i=0;i<2;i++){ctx.practiceIndex=i;for(let n=0;n<written.quiz[i].options.length;n++){ctx.selected=n;ctx.practiceResult=null;ctx.extraCheck();assert.equal(ctx.practiceResult.correct,written.quiz[i].options[n]===writtenKeys[i],'Actual production extra quiz grading');if(ctx.practiceResult.correct)accepted++;else rejected++;}}
 log('written-day26-known-fact-and-unknown-interest',{accepted,rejected,actualProductionHandler:true,firstReplicaBoundary:true});

 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,report:reportPath}));}
