/* Standalone node check-readiness-v21.cjs. No generated fixtures or browser required.
   Executes production code in VM; git 8fad6ca supplies the pre-change contract. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),clone=o=>JSON.parse(JSON.stringify(o));
const baseline=f=>cp.execFileSync('git',['show','8fad6ca:'+f],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});
const report={passed:false,baseline:'8fad6ca',checks:[],limits:'Source/VM tests do not measure acoustic accuracy, learning efficacy, or browser layout. Root review owns browser screenshots and full lesson navigation.'};
const out=path.join(root,'.impeccable/review-v21');fs.mkdirSync(out,{recursive:true});
const data={...json('course-blueprint.json'),expanded:json('course-expanded.json'),library:json('course-library.json'),goals:json('course-goals.json')};
const practice=json('exercise-bank.json');data.lessons.forEach((lesson,i)=>lesson.practice=practice[i]);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const old=baseline('web/course.js').replace(/\r\n/g,'\n'),source=read('web/course.js').replace(/\r\n/g,'\n');
function section(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,`Production section missing: ${a}`);return s.slice(start,end);}
function check(name,fn){fn();report.checks.push(name);}
function vmContext(globals={}){const ctx={window:{},console,...globals};vm.createContext(ctx);return ctx;}
function button(attribute,value=''){return {dataset:{[attribute.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:a=>a===attribute};}
async function main(){
 check('21 bounded day 7 Russian fields changed, one explicit personal model added; all other JSON structurally unchanged',()=>{
  const allowed={
   'course-blueprint.json':['goal','tasks.0','tasks.2','scene','check'],
   'course-expanded.json':['explanation','mission'],
   'course-goals.json':['goal','missionVerification.task','missionVerification.expandedMission','warmup','personalPrompt','nativeScope'],
   'course-stories.json':['goal','own.prompt','own.variation','whyUseful'],
   'course-workshops.json':['hook','challenge.prompt','challenge.change'],
   'exercise-bank.json':['own']};
  report.changedLeaves=[];
  function compare(a,b,file,trail=[],day=null,entry=[]){
   if(a&&typeof a==='object'&&!Array.isArray(a)&&Number.isInteger(a.day)){day=a.day;entry=trail;}
   if(a===b)return;
   if(a&&b&&typeof a==='object'&&typeof b==='object'){
    if(file==='course-expanded.json'&&day===7&&trail.join('.')==='lessons.6'){
     assert.equal(b.personalModel,'Me llamo… Vivo en… Hablo un poco de español. ¿Cómo te llamas?');
     assert.equal(a.personalModel,undefined,'one explicitly added text-only personal model');
     b={...b};delete b.personalModel;
    }
    assert.deepEqual(Object.keys(a),Object.keys(b),`${file}:${trail.join('.')} keys/IDs`);
    for(const key of Object.keys(a))compare(a[key],b[key],file,[...trail,key],day,entry);return;
   }
   const field=trail.slice(entry.length).join('.');assert.equal(day,7,`${file}:${trail.join('.')} non-day7 changed`);
   assert.ok(allowed[file].includes(field),`${file}:${field} outside Russian metadata`);
   assert.equal(typeof a,'string');assert.equal(typeof b,'string');assert.match(b,/[А-Яа-яЁё]/);
   report.changedLeaves.push({file,path:trail.join('.')});
  }
  for(const file of Object.keys(allowed))compare(JSON.parse(baseline(file)),json(file),file);
  for(const file of ['course-library.json','course-drills.json','mission-data.json','course-repair-v14.json','pathway-data.json'])assert.deepEqual(json(file),JSON.parse(baseline(file)),file+' unchanged');
  assert.equal(report.changedLeaves.length,21);report.addedTextOnlyPersonalModel=true;
 });
 check('Day 7 required actions agree in lesson/goal/story/workshop and actual coach/compass views',()=>{
  const lesson=data.lessons[6],g=data.goals.lessons[6],e=data.expanded.lessons[6],story=json('course-stories.json').days[6],workshop=json('course-workshops.json').days[6];
  for(const [label,text]of [['blueprint',lesson.check],['expanded',e.mission],['goal',g.personalPrompt],['story',story.own.prompt],['workshop',workshop.challenge.prompt]]){
   for(const term of [/сво[ёе] имя|своего имени|назови.*имя|назвать.*имя|представься/i,/город/i,/испанск/i,/спроси.*имя|спросить.*имя/i])assert.match(text,term,label+' required action');
   assert.doesNotMatch(text,/задай два|задать два|один раз восстановить/i,label+' obsolete minimum');
  }
  assert.equal(g.goal,lesson.goal);assert.equal(g.missionVerification.expandedMission,e.mission);
  const ctx=vmContext();vm.runInContext(read('web/goals.js'),ctx);const goals=ctx.window.VamosGoals.create({data,esc,icon:()=>'',playButton:()=>''});
  assert.ok(goals.personal(7).includes(esc(g.personalPrompt)));assert.ok(goals.contract(7).includes(esc(g.missionVerification.task)));
  vm.runInContext(read('web/day-compass.js'),ctx);
  const state={day:7,recovery:false,completed:[],learning:{sessions:{}},studio:{history:[]},missions:{history:[]},workbook:{},library:{},cards:{}};
  const d={...data,stories:json('course-stories.json'),workshops:json('course-workshops.json'),videoGuide:json('video-guide-v13.json')};
  const api=ctx.window.VamosDayCompass.create({state,data:d,esc,icon:()=>'',dueKeys:()=>[],save(){},render(){}});
  const c=api.context(7);assert.equal(c.goal,g.goal);assert.equal(c.check,lesson.check);
 });
 check('Checkpoint independent rating requires indices 0+1 on day7; all other chapters require 0+1+2; legacy records are not regraded',()=>{
  const ctx=vmContext();vm.runInContext(read('web/coach.js'),ctx);
  const fixed=1740000000000,legacy={rating:'independent',checks:[0,1,2],date:fixed};
  const state={day:7,checkpoints:{7:clone(legacy)},sceneRatings:{}};let saves=0;
  const coach=ctx.window.VamosCoach.create({data,state,esc,icon:()=>'',playButton:()=>'',audioControls:()=>'',audioCredit:()=>'',recorderHTML:()=>'',footer:()=>'',save(){saves++},render(){},toast(){},stopRecording(){}});
  coach.enterCheckpoint(0);assert.deepEqual(clone(state.checkpoints[7]),legacy);assert.equal(saves,0);
  assert.deepEqual([...coach.checkpointView().matchAll(/data-checkpoint-item="(\d)"/g)].map(m=>Number(m[1])),[0,1,2]);
  for(let chapter=0;chapter<4;chapter++)for(let mask=0;mask<8;mask++){
   const day=[7,14,21,30][chapter];delete state.checkpoints[day];coach.enterCheckpoint(chapter);
   const selected=[];for(let i=0;i<3;i++)if(mask&(1<<i)){const el=button('data-checkpoint-item',String(i));el.checked=true;coach.handleChange(el);selected.push(i);}
   coach.handleClick(button('data-checkpoint-rating','independent'));
   const allowed=chapter===0?(mask&3)===3:mask===7;assert.equal(!!state.checkpoints[day],allowed,`chapter ${chapter} mask ${mask}`);
   if(allowed)assert.deepEqual(clone(state.checkpoints[day].checks),selected);
   if(chapter===0&&mask===4)assert.equal(state.checkpoints[day],undefined,'optional index cannot substitute a required action');
   if(chapter>0)assert.doesNotMatch(coach.checkpointView(),/Дополнительно:/);
  }
  report.checkpointMasks=32;
 });
 check('Existing task generation/answer grading unchanged against release baseline',()=>{
  for(const [a,b]of [[' const norm=',' const icon='],[' function baseTarget()',' function feedbackHTML()'],[' function checkTask()',' function completeLesson()'],[' function completeLesson()',' function advance()']])assert.equal(section(source,a,b),section(old,a,b),a+' changed');
  for(const file of ['web/learning.js','web/mastery.js','web/adaptive.js','web/meaning-choices.js'])assert.equal(read(file).replace(/\r\n/g,'\n'),baseline(file).replace(/\r\n/g,'\n'),file+' unchanged');
  const ctx=vmContext({data,sound(){},save(){},renderLessonInteraction(){}});vm.runInContext(read('web/meaning-choices.js'),ctx);
  vm.runInContext(section(source,' const norm=',' const icon=')+`\nlet stage=1,selected=null,tokens=[],draft='',result=null,hadHelp=false;const state={day:1,mistakes:{},cards:{}};const cardCatalog={};const observed=[],logged=[];const adaptive={observe:e=>observed.push(e)};const learning={usedHelp:()=>false,log:(...v)=>logged.push(v)};const goals={feedback:()=>''};const contentDay=()=>state.day,extra=()=>data.expanded.lessons[state.day-1],practiceLesson=()=>data.lessons[state.day-1];\n`+section(source,' function baseTarget()',' function feedbackHTML()')+section(source,' function checkTask()',' function completeLesson()')+`\nwindow.grade=(day,s,correct)=>{state.day=day;stage=s;const p=target();selected=[1,2,4].includes(s)?currentTask().answer+(correct?0:99):null;tokens=correct?p.es.split(/\\s+/).map((_,i)=>i):[];draft=correct?p.es:'¿Cómo te llamas otra persona?';checkTask();return {correct:result.correct,observation:observed.at(-1),event:logged.at(-1)};};`,ctx);
  for(let day=1;day<=30;day++)for(const stage of [1,2,3,4,5])for(const correct of [true,false]){
   const answer=ctx.window.grade(day,stage,correct);assert.equal(answer.correct,correct,`day ${day} stage ${stage} grading`);assert.equal(answer.observation.correct,correct);assert.deepEqual(clone(answer.event),['answer',day+':'+stage,correct]);
  }
  report.legacyGradeCases=300;
 });
 check('Day 4 prep has distinct model→meaning→recall→done; errors do not advance or award learning evidence',()=>{
  const counters={persist:0,render:0,sound:0,completion:0};
  const ctx=vmContext({esc,persistLesson(){counters.persist++},renderLessonInteraction(){counters.render++},sound(){counters.sound++},completeLesson(){counters.completion++}});
  vm.runInContext(section(source,' const norm=',' const icon=')+`\nlet originPrep=null,view='lesson',stage=6,rating='help';const state={day:4,completed:[],ratings:{},cards:{},mistakes:{},learning:{events:[]},mastery:{}};\n`+section(source,' function newOriginPrep()',' function introHTML(')+section(source,' function advance()',' function words()')+`\nwindow.prep={newOriginPrep,restoreOriginPrep,originCorrect,originHTML,preparingOrigin,advanceOrigin:advance,set:p=>originPrep=p,get:()=>originPrep,state};`,ctx);
  const p=ctx.window.prep;p.set(p.newOriginPrep());const before=clone(p.state);
  assert.equal(p.preparingOrigin(),true);let html=p.originHTML();assert.doesNotMatch(html,/data-audio|data-rating|data-learning-support/);assert.match(html,/записи носителя пока нет/);
  p.advanceOrigin();assert.equal(p.get().phase,'meaning');p.get().choice=0;p.advanceOrigin();assert.equal(p.get().checked,true);p.advanceOrigin();assert.equal(p.get().phase,'meaning','name question must remain in meaning');
  p.get().choice=2;p.get().checked=false;p.advanceOrigin();p.advanceOrigin();assert.equal(p.get().phase,'meaning');
  p.get().choice=1;p.get().checked=false;p.advanceOrigin();assert.equal(p.get().phase,'meaning','first click only checks');p.advanceOrigin();assert.equal(p.get().phase,'recall');
  for(const answer of ['¿Cómo te llamas?','Vivo en Moscú.','Soy de Brasil.','¿De dónde es usted?','¿Dónde vives?','De donde eres otra frase']){p.get().draft=answer;p.get().checked=false;p.advanceOrigin();p.advanceOrigin();assert.equal(p.get().phase,'recall',answer+' must remain on model recall');assert.equal(p.originCorrect(),false);}
  for(const answer of ['¿De dónde eres?','de donde eres',' DE  DONDE ERES? ', '¿De dónde eres?']){p.get().draft=answer;assert.equal(p.originCorrect(),true,answer);}
  p.get().draft='de donde eres';p.get().checked=false;p.advanceOrigin();assert.match(p.originHTML(),/В письме добавь ударение: dónde/);p.advanceOrigin();assert.equal(p.get().phase,'done');assert.equal(p.preparingOrigin(),false);assert.deepEqual(clone(p.state),before,'prep cannot mutate grade/mastery/events/day completion');assert.equal(counters.completion,0,'even an existing rating cannot complete while prep is active');p.advanceOrigin();assert.equal(counters.completion,1,'usual stage6 completion is reachable only after prep');
  for(const v of [null,{}, {version:2,phase:'done'}, {version:1,phase:'invalid'}, {version:1,phase:'done',choice:0,draft:'¿De dónde eres?'}, {version:1,phase:'done',choice:1,draft:'Vivo en Moscú.'}])assert.equal(p.restoreOriginPrep(v).phase,'model','malformed done cannot skip preparation');
  assert.equal(p.restoreOriginPrep({version:1,phase:'done',choice:1,draft:'de donde eres'}).phase,'done');
  const restored=p.restoreOriginPrep({version:1,phase:'recall',choice:99,draft:'x'.repeat(300),checked:'true'});assert.equal(restored.choice,null);assert.equal(restored.draft.length,160);assert.equal(restored.checked,false);
  report.prepCounters=counters;
  report.prepCounters.completionDuringPrep=0;report.prepCounters.completionAfterDone=1;
 });
 // Real export/import entry points (no exposed or copied sanitizer). Stub unrelated
 // modules so the assertions focus on production progress transfer/session fields.
 async function transfer(input){
  let captured,saves=0;const target={completed:[],cards:{},ratings:{},mistakes:{},checkpoints:{},sceneRatings:{},library:{favorites:[],known:[],difficult:[],notes:{}},learning:{events:[],sessions:{}},profile:{}};
  const ctx=vmContext({Blob,URL:{createObjectURL(b){captured=b;return 'blob:test'},revokeObjectURL(){}},document:{createElement:()=>({click(){}}),querySelector:()=>null},setTimeout:()=>0});vm.runInContext(read('web/progress.js'),ctx);
  const module={sanitize:v=>v||{},merge:()=>({}),close(){}};
  const api={data,save(){saves++},toast(){},esc,icon:()=>'',render(){},mastery:module,adaptive:module,studio:module,missions:module,workbook:module,profile:module,pathway:module,repair:module,bridgeReview:module,libraryPractice:module};
  const exporting=ctx.window.VamosProgress.create({...api,state:input});exporting.click(button('data-backup-export'));assert.ok(captured instanceof Blob,'actual export blob');
  const text=await captured.text(),parsed=JSON.parse(text);assert.equal(parsed.format,'vamos-backup-v1');
  const importing=ctx.window.VamosProgress.create({...api,state:target});await importing.change({id:'backup-file',files:[{size:Buffer.byteLength(text),text:async()=>text}]});assert.match(importing.html(),/data-backup-apply/);importing.click(button('data-backup-apply'));assert.equal(saves,1);return target;
 }
 const now=Date.now()-1000,legacy={stage:6,hadHelp:true,time:now,signature:'v14:4:503010',selected:null,tokens:[],draft:'Saved old own-response note',rating:'help'},checkpoint={checks:[0,1,2],rating:'independent',date:now};
 const imported=await transfer({learning:{events:[],sessions:{4:legacy}},checkpoints:{7:checkpoint}});
 assert.deepEqual(clone(imported.learning.sessions[4]),legacy);assert.deepEqual(clone(imported.checkpoints[7]),checkpoint);
 report.checks.push('Actual export/import preserves old day4 stage6 draft/rating/signature and day7 checkpoint indices/rating/date exactly');
 for(const phase of ['model','meaning','recall','done']){
  const prep={version:1,phase,choice:1,draft:'¿De dónde eres?',checked:true},record={...legacy,originPrep:prep};const imported=await transfer({learning:{events:[],sessions:{4:record,5:record}}});
  assert.deepEqual(clone(imported.learning.sessions[4]),record);assert.equal(imported.learning.sessions[5].originPrep,undefined,'prep only belongs to day4');assert.deepEqual(clone(imported.completed),[]);assert.deepEqual(clone(imported.learning.events),[]);
 }
 for(const prep of [{version:2,phase:'done'}, {version:1,phase:'other'}, {phase:'done'}, null]){
  const result=await transfer({learning:{sessions:{4:{...legacy,originPrep:prep}}}});assert.equal(result.learning.sessions[4].originPrep,undefined);
 }
 const bounded=await transfer({learning:{sessions:{4:{...legacy,originPrep:{version:1,phase:'recall',choice:99,draft:'x'.repeat(200),checked:'true'}}}}});assert.deepEqual(clone(bounded.learning.sessions[4].originPrep),{version:1,phase:'recall',choice:null,draft:'x'.repeat(160),checked:false});
 report.checks.push('All four valid prep phases survive real transfer; unknown versions/phases excluded; day4 scope, choice/checked types and 160-character cap enforced');
 const goalsRun=cp.spawnSync(process.execPath,['check-goals-v8.cjs'],{cwd:root,encoding:'utf8'});assert.equal(goalsRun.status,0,goalsRun.stderr);report.supplemental={goalsV8:{passed:true,output:goalsRun.stdout.trim()}};
 for(const file of ['check-content-v11.cjs','web/missions.js','mission-data.json'])assert.equal(read(file).replace(/\r\n/g,'\n'),baseline(file).replace(/\r\n/g,'\n'),file+' inherited content test changed');
 const contentRun=cp.spawnSync(process.execPath,['check-content-v11.cjs'],{cwd:root,encoding:'utf8'});report.supplemental.contentV11={passed:contentRun.status===0,exitCode:contentRun.status,baselineFilesUnchanged:true,output:(contentRun.stdout+contentRun.stderr).trim()};
 report.passed=true;
}
main().then(()=>{fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'regression.md'),`# Readiness v21 regression\n\nRun: \`node check-readiness-v21.cjs\`\n\nBaseline: \`8fad6ca\`\n\n${report.checks.map(x=>'- '+x).join('\n')}\n\nSupplemental: original check-goals-v8.cjs passes. Original check-content-v11.cjs ${report.supplemental.contentV11.passed?'passes':'fails at d10-control-a: Me gusta leer porque es interesante. Expected supported; actual unknown. Test, mission implementation and mission JSON are identical to baseline; this is not a day 4/day 7 regression.'}\n\n${report.limits}\n`);console.log(JSON.stringify(report));}).catch(e=>{report.failure=e.stack;fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
