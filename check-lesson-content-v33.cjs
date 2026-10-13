/* Read-only audit of actual authored data and production task/grading functions.
 * Isolated VM fixtures: never reads or writes personal learner storage. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const dataVM={window:{}};vm.createContext(dataVM);vm.runInContext(read('web/course-data.js'),dataVM);vm.runInContext(read('web/meaning-choices.js'),dataVM);
const data=dataVM.window.VAMOS_DATA,source=read('web/course.js'),guidance=JSON.parse(read('course-guidance.json')),plan=JSON.parse(read('course-daily-plan.json'));
const norm=s=>String(s).normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
const recallPlain=s=>norm(s).normalize('NFD').replace(/\u0301/g,'').normalize('NFC');
const region=source.slice(source.indexOf(' function baseTarget(){'),source.indexOf(' function feedbackHTML(){'));
const grading=source.slice(source.indexOf(' function checkTask(){'),source.indexOf(' function completeLesson(){'));
assert(region.includes('function currentTask'));assert(grading.includes('adaptive.observe'));
function harness(day,actual=day){const observed=[],state={day,cards:{},mistakes:{}};const c={window:dataVM.window,state,data,stage:1,selected:null,tokens:[],draft:'',result:null,hadHelp:false,cardCatalog:{},norm,recallPlain,contentDay:()=>actual,extra:()=>data.expanded.lessons[actual-1],practiceLesson:()=>data.lessons[actual-1],save:()=>{},sound:()=>{},renderLessonInteraction:()=>{},goals:{feedback:()=>''},learning:{usedHelp:()=>false,log:()=>{}},adaptive:{observe:e=>observed.push(copy(e))}};vm.createContext(c);vm.runInContext(region+grading,c);return{c,observed};}
let authored=0,audioContexts=0,taskModes=0,branches=0;
assert.equal(data.lessons.length,30);assert.equal(data.expanded.lessons.length,30);assert.equal(guidance.lessons.length,30);assert.equal(plan.lessons.length,30);
for(let day=1;day<=30;day++){
 const l=data.lessons[day-1],e=data.expanded.lessons[day-1],g=guidance.lessons.find(x=>x.day===day),p=plan.lessons.find(x=>x.day===day);
 assert.equal(l.day,day);assert.equal(e.day,day);assert.deepEqual(copy(p.models),copy(e.examples.slice(0,3)),`day${day} plan/model alignment`);
 assert(p.goal&&p.scene);assert.equal(p.phases.reduce((sum,x)=>sum+x.minutes,0),35,`day${day} timing`);
 for(const a of e.examples){assert.equal(data.expanded.audio[a.audio]?.text,a.es,`day${day} audio ${a.audio}`);assert(a.ru.trim());audioContexts++;}
 assert.equal(data.expanded.audio[g.miniRule.audio]?.text,g.miniRule.exampleEs,`day${day} rule caption`);
 for(const q of l.practice.quiz){assert(q.question.trim()&&q.feedback.trim());assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options.length);assert(q.options.every(o=>typeof o==='string'&&o.trim()));assert.equal(new Set(q.options.map(norm)).size,q.options.length,`day${day} duplicate quiz options`);authored++;}
 const {c}=harness(day);
 for(const stage of [1,2,3,4,5]){
  c.stage=stage;const p=c.target(),h=g.practiceHints[{1:'listening',2:'quiz',3:'builder',4:'gap',5:'recall'}[stage]];
  assert(h.hintRu.trim());if(stage===2)assert.equal(h.question,c.currentTask().question);else{const expected=stage===1?e.examples[0]:p;assert.equal(h.targetEs,expected.es,`day${day}/stage${stage} hint target`);assert.equal(h.targetRu,expected.ru);assert.equal(h.audio,expected.audio);}
  if([1,2,4].includes(stage)){
   const task=c.currentTask();assert(task.options.length>=2);assert.equal(new Set(task.options.map(norm)).size,task.options.length);assert(Number.isInteger(task.answer)&&task.answer>=0&&task.answer<task.options.length);
   if(stage===1)assert.equal(task.options[task.answer],e.examples[0].ru);
   if(stage===4){const expected=p.es.split(/\s+/)[Math.min(1,p.es.split(/\s+/).length-1)].replace(/[.,!?¿¡]/g,'');assert.equal(task.options[task.answer],expected);assert.equal(h.missingWord,expected);assert.equal((task.question.match(/____/g)||[]).length,1);}
   for(let i=0;i<task.options.length;i++){c.selected=i;c.checkTask();assert.equal(c.result.correct,i===task.answer,`day${day}/stage${stage}/choice${i}`);}
  }else if(stage===3){c.tokens=p.es.split(/\s+/).map((_,i)=>i);c.checkTask();assert(c.result.correct);c.tokens=[];c.checkTask();assert.equal(c.result.correct,false);}
  else{c.draft=p.es;c.checkTask();assert(c.result.correct);c.draft='incorrect fixture';c.checkTask();assert.equal(c.result.correct,false);}
  taskModes++;
 }
}
// Scheduled days retain their own identity while using the actual recovery/repair content.
for(const [day,actual] of [[22,19],[23,20],...Array.from({length:30},(_,i)=>[24,i+1])]){const {c}=harness(day,actual);for(const stage of [1,2,4]){c.stage=stage;const task=c.currentTask();c.selected=task.answer;c.checkTask();assert.equal(c.result.correct,true);if(stage===1)assert.equal(task.audio,data.expanded.lessons[actual-1].examples[0].audio);if(stage===2)assert.equal(task.question,data.lessons[actual-1].practice.quiz[0].question);}branches++;}
// Authored workshops are structurally checked separately from the daily player's five modes.
let workshopChoices=0,workshopBuilds=0;const ids=new Set();
function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x.options)){assert(Number.isInteger(x.answer)&&x.answer>=0&&x.answer<x.options.length);assert(x.options.every(o=>typeof o==='string'&&o.trim()));assert.equal(new Set(x.options.map(norm)).size,x.options.length);if(x.id){assert(!ids.has(x.id));ids.add(x.id);}workshopChoices++;}if(Array.isArray(x.tokens)&&Array.isArray(x.accepted)){const tokens=x.tokens.map(norm).sort();assert(x.accepted.length);for(const answer of x.accepted)assert.deepEqual(norm(answer).split(/\s+/).sort(),tokens,`workshop ${x.id} reachable builder answer`);workshopBuilds++;}for(const value of Object.values(x))walk(value);}
walk(JSON.parse(read('course-workshops.json')));
console.log(`PASS: ${authored} authored quiz keys; ${audioContexts} exact native captions; ${taskModes} actual task/grading modes; ${branches} recovery/repair mappings; ${workshopChoices} workshop choice structures; ${workshopBuilds} reachable workshop builders. Semantic quality still requires human review.`);
