/* node check-missions-v22.cjs [--syntax]. Independent finite dialogue and persistence regression. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const root=__dirname,revision='cd41fe9',DAY=86400000,NOW=Date.now(),PAST=NOW-3*DAY,changedDays=[10,12,14];
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const original=f=>execFileSync('git',['show',revision+':'+f],{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024});
const catalog=JSON.parse(read('mission-data.json')),baseline=JSON.parse(original('mission-data.json'));
const source=read('web/missions.js'),oldSource=original('web/missions.js'),profileSource=read('web/profile.js');
const reportPath=path.join(root,'.impeccable/review-v22/missions-regression.json');
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
 assert.equal(catalog.days.length,30);assert.equal(activeIds.size,120);assert.equal(catalog.legacyVariants.length,24);
 const originals=baseline.days.filter(d=>changedDays.includes(d.day)).flatMap(d=>d.variants.map(v=>({...v,day:d.day})));
 assert.equal(originals.length,12);const expectedArchives=[...baseline.legacyVariants,...originals],sort=a=>[...a].sort((x,y)=>x.id.localeCompare(y.id));
 assert.deepEqual(sort(catalog.legacyVariants),sort(expectedArchives),'All original objects archived byte-equivalent as parsed, with day');
 for(const d of baseline.days)if(!changedDays.includes(d.day))assert.deepEqual(catalog.days.find(x=>x.day===d.day),d,'Unchanged day '+d.day);
 for(const v of originals){const replacement=catalog.days.find(d=>d.day===v.day).variants.find(x=>x.supersedes===v.id);assert(replacement,v.id);assert.equal(replacement.id,v.id+'-v22');assert.equal(replacement.mode,v.mode);assert(!activeIds.has(v.id));}
 log('archives',{newOriginals:12,priorOriginals:12,unrelatedDaysUnchanged:true});

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
 assert.equal(report.counts.activeVariants,120);assert.equal(report.counts.archivedVariants,24);log('finite-model-membership',{...report.counts,firstEvidenceImmutable:true});

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
  if(changedDays.includes(archived.day)&&[10,14].includes(archived.day)){
   const value=archived.day===10?'Me gusta leer porque es interesante.':'Me gusta viajar porque es divertido.';
   expect(old,value,archived.day===10?'unknown':'supported');expect(old,archived.turns[1].rule.forms[0],'supported');
  }
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
 const prof=profile({version:1,sessions:[],history:oldHistories,seenVariants:oldHistories.map(h=>h.variant)});
 assert.equal(prof.evidence.missions.length,24);assert.equal(prof.evidence.firstResponses,oldHistories.reduce((n,h)=>n+h.responses.length,0));assert.equal(prof.evidence.independentSpeech,oldHistories.reduce((n,h)=>n+h.responses.filter(r=>r.first.oral==='independent').length,0));assert(prof.html.includes('Разговор доведён до конца'));assert(prof.html.includes('24 разговорных попыток'));
 log('original-session-history-profile',{partials:24,histories:24,originalStatusesAndFirstAttempts:true,profileMissions:24,profileFirstResponses:prof.evidence.firstResponses});
 let originalReasonCases=0;
 for(const [id,text,status]of [
  ['d10-control-a','Prefiero viajar porque es divertido.','supported'],
  ['d10-control-b','Me gusta leer porque es interesante.','unknown'],
  ['d10-control-a','Prefiero leer.','missing'],
  ['d14-control-a','Me gusta viajar porque es divertido.','supported'],
  ['d14-control-b','Me gusta la música porque es divertida.','unknown'],
  ['d14-control-a','Me gusta leer.','missing']
 ]){
  const old=at(id,1,{module:oldSource,data:baseline,now:PAST});expect(old,text,status);const before=plain(old.app.current.session.responses[1].first);const restored=harness(old.state.missions);assert.deepEqual(plain(restored.state.missions.sessions[0].responses[1].first),before,'Archived original reason status '+id);
  complete(old);const saved=plain(old.app.sanitize(old.state.missions));assert.deepEqual(plain(harness(saved).state.missions.history[0].responses[1].first),before,'Completed original reason first status '+id);originalReasonCases++;
 }
 log('independent-original-reason-statuses',{cases:originalReasonCases,oldActivitySwitchSupported:true,unknownAndMissingRemainOriginal:true});
 const browserOld=harness(undefined,{module:oldSource,data:baseline,now:PAST});browserOld.app.start(14,{variant:'d14-control-b',control:true,resume:false});answer(browserOld,'Me gusta leer.','hesitant');next(browserOld);expect(browserOld,'Me gusta viajar porque es divertido.','supported');
 browserOld.app.input({value:'Me gusta viajar porque es divertido.',hasAttribute:a=>a==='data-mission-answer'});browserOld.app.change(button('data-mission-oral','help'));const browserPartial=plain(browserOld.app.sanitize(browserOld.state.missions).sessions[0]),browserContent=plain(browserOld.app.current.content);
 const browserDone=harness(undefined,{module:oldSource,data:baseline,now:PAST});browserDone.app.start(12,{variant:'d12-train-a',resume:false});const browserHistory=complete(browserDone);
 const browserSaved={version:1,sessions:[browserPartial],history:[browserHistory],seenVariants:[browserPartial.variant,browserHistory.variant]},browserProfile=profile(browserSaved);
 const browserFixture={baseline:revision,createdAt:NOW,missions:browserSaved,expected:{resume:{id:browserPartial.id,day:14,variant:browserPartial.variant,step:browserPartial.step,content:browserContent,first:browserPartial.responses[0].first,draft:browserPartial.responses[1].draft,oral:browserPartial.responses[1].oral,reasonFirst:browserPartial.responses[1].first},history:{id:browserHistory.id,day:12,variant:browserHistory.variant,firsts:browserHistory.responses.map(r=>r.first),completedAt:browserHistory.completedAt,dueAt:browserHistory.dueAt,dueVariant:browserHistory.dueVariant},profile:{missions:1,firstResponses:browserProfile.evidence.firstResponses}}};
 assert.equal(browserHistory.dueVariant,'d12-control-a');assert.equal(browserPartial.responses[1].first.status,'supported');assert.equal(browserProfile.evidence.missions.length,1);
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(path.join(path.dirname(reportPath),'legacy-browser-fixture.json'),JSON.stringify(browserFixture,null,2)+'\n');

 for(const day of changedDays)for(const suffix of ['a','b']){
  const prior=suffix==='b'?{sessions:[],history:[],seenVariants:['d'+day+'-control-a']}:undefined,old=harness(prior,{module:oldSource,data:baseline,now:PAST});assert(old.app.start(day,{resume:false}));const history=complete(old),due='d'+day+'-control-'+suffix;
  assert.equal(history.dueVariant,due);assert.equal(history.dueAt,history.completedAt+DAY);const loaded=harness(old.state.missions);assert.equal(loaded.state.missions.history[0].dueVariant,due);assert(loaded.app.pendingControl(loaded.state.missions.history[0]));
  loaded.app.start(day,{control:true,resume:false});assert.equal(loaded.app.current.variant,due+'-v22');assert.equal(loaded.app.current.exposed,false);assert(!loaded.app.pendingControl(loaded.state.missions.history[0]));report.counts.dueMappings++;
  const seen=plain(old.state.missions);seen.seenVariants.push(due);const blocked=harness(seen);assert(!blocked.app.pendingControl(blocked.state.missions.history[0]));const merged=loaded.app.merge(seen,{sessions:[],history:[],seenVariants:[due+'-v22']});assert(merged.seenVariants.includes(due)&&merged.seenVariants.includes(due+'-v22'));report.counts.exposureCases++;
 }
 for(const day of [1,2,7,...changedDays])for(const mode of ['train','control']){
  const current=catalog.days.find(d=>d.day===day).variants.filter(v=>v.mode===mode),oldIds=current.map(v=>v.supersedes);
  const exhausted=harness({sessions:[],history:[],seenVariants:oldIds});exhausted.app.start(day,{control:mode==='control',resume:false});assert.equal(exhausted.app.current.exposed,true);assert(exhausted.app.html().includes('этот вариант уже встречался'));
  const sibling=harness({sessions:[],history:[],seenVariants:oldIds.slice(0,1)});sibling.app.start(day,{control:mode==='control',resume:false});assert.equal(sibling.app.current.variant,current[1].id);assert.equal(sibling.app.current.exposed,false);report.counts.exposureCases+=2;
 }
 log('saved-due-and-exposure-families',{mappings:report.counts.dueMappings,cases:report.counts.exposureCases,savedScheduleUnchanged:true});
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,report:reportPath}));}
