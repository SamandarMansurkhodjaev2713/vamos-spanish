/* Finite task, first-attempt, repair and persistence contracts; no speech-level claims. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const stories=JSON.parse(fs.readFileSync('course-stories.json','utf8')),workshops=JSON.parse(fs.readFileSync('course-workshops.json','utf8'));
const expanded=JSON.parse(fs.readFileSync('course-expanded.json','utf8'));
const data={stories,workshops,expanded};
const code=fs.readFileSync('web/workbook.js','utf8');
let clock=Date.now(),observed=[],saves=0;
class TestDate extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock++;}}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function make(raw){const context={window:{},document:{querySelector:()=>null},Date:TestDate};vm.createContext(context);vm.runInContext(code,context);const state={day:1,workbook:raw,completed:[]};let workbook;workbook=context.window.VamosWorkbook.create({state,data,esc:escape,icon:()=>'',mascot:()=>'',playButton:(id,label)=>`<button data-audio="${id}">${escape(label)}</button>`,audioControls:()=>'',footer:()=>'',save:()=>saves++,render:()=>{},toast:()=>{},observe:e=>observed.push(e),sound:()=>{},active:()=>true,open:day=>workbook.enter(day)});return {state,workbook};}
function button(attribute,value=''){return {dataset:{[attribute.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:String(value)},hasAttribute:name=>name===attribute};}
function click(w,key,value=''){assert.strictEqual(w.click(button(key,value)),true);}
function solve(w,t,wrong=false){
 if(t.kind==='build'){
  if(wrong){const order=t.tokens.map((_,i)=>i).reverse();for(const i of order)click(w,'data-wb-token',i);}
  else{for(const i of t.tokens.keys())click(w,'data-wb-token',i);}
 }else click(w,'data-wb-choice',wrong?(t.answer+1)%t.options.length:t.answer);
 click(w,'data-wb-check');
}
let checked=0;
for(let day=1;day<=30;day++){
 const s=stories.days[day-1],w=workshops.days[day-1];assert.strictEqual(s.day,day);assert.strictEqual(w.day,day);assert.strictEqual(s.questions.length,2);assert.strictEqual(w.tasks.length,3);assert(s.lines.length>=4&&s.lines.length<=6);assert(s.glossary.length<=3);assert(s.callback.day<day);
 for(const line of s.lines)if(line.audio)assert.strictEqual(expanded.audio[line.audio].text,line.es,'Audio must voice the exact displayed line');
 const {state,workbook}=make();workbook.enter(day);
 for(const section of ['story','workshop']){
  click(workbook,'data-wb-section',section);
  const tasks=section==='story'?s.questions:w.tasks;
  for(const t of tasks){
   if(t.kind==='build'){assert(t.tokens.length>=3&&t.tokens.length<=8);assert(t.accepted.includes(t.tokens.join(' ')));}
   else{assert.strictEqual(t.options.length,3);assert.strictEqual(new Set(t.options).size,3);assert(Number.isInteger(t.answer)&&t.answer>=0&&t.answer<3);}
   solve(workbook,t,true);const key=`${day}:${section}:${t.id}`,record=state.workbook.days[day].answers[key];assert.strictEqual(record.first.correct,false);assert(record.due>clock);
   if(t.kind==='build')for(let i=t.tokens.length-1;i>=0;i--)click(workbook,'data-wb-remove',i);
   solve(workbook,t);assert.strictEqual(record.first.correct,false);assert.strictEqual(record.retries.at(-1).correct,true);assert.strictEqual(record.retries.at(-1).aided,true);click(workbook,'data-wb-next');checked++;
  }
  assert(workbook.html().includes('Твоя реплика')||workbook.html().includes('твоя реплика'));
  workbook.input({id:'workbook-own',value:'<img src=x onerror=alert(1)> Mi idea.'});assert(!workbook.html().includes('<img src=x'));
  workbook.change({hasAttribute:name=>name==='data-wb-said',checked:true});assert.strictEqual(state.completed.length,0,'Self-rated speech cannot complete a day');
 }
 const reloaded=make(JSON.parse(JSON.stringify(state.workbook)));reloaded.workbook.enter(day);assert.strictEqual(reloaded.state.workbook.days[day].positions.workshop,3);assert.strictEqual(reloaded.state.workbook.days[day].positions.story,2);
}
// Explicit assistance remains recorded after hiding, reload and completion.
const aided=make();const q=stories.days[0].questions[0];click(aided.workbook,'data-wb-help');click(aided.workbook,'data-wb-help');const restored=make(JSON.parse(JSON.stringify(aided.state.workbook)));solve(restored.workbook,q);assert.strictEqual(restored.state.workbook.days[1].answers[`1:story:${q.id}`].first.aided,true);
// A due repair starts blank; old successful correction cannot bypass the new response.
const repair=make();solve(repair.workbook,q,true);solve(repair.workbook,q);clock+=600001;click(repair.workbook,'data-wb-review');assert(repair.workbook.html().includes('data-wb-check disabled'));click(repair.workbook,'data-wb-next');assert(repair.workbook.html().includes('Повтор дня 1'));solve(repair.workbook,q);assert.strictEqual(repair.state.workbook.days[1].answers[`1:story:${q.id}`].due,0);assert.strictEqual(repair.state.workbook.days[1].answers[`1:story:${q.id}`].first.correct,false);
// Merge keeps the earliest failure rather than replacing it with a later successful export.
const old=make();solve(old.workbook,q,true);const later=make();solve(later.workbook,q);old.workbook.merge(later.state.workbook);assert.strictEqual(old.state.workbook.days[1].answers[`1:story:${q.id}`].first.correct,false);
// A tampered cursor/choice/tokens cannot skip finite tasks or introduce unknown task evidence.
const clean=make({days:{1:{positions:{story:999,workshop:999},answers:{evil:{first:{correct:true,time:clock}}},drafts:{[`1:story:${q.id}`]:{choice:999,tokens:[-1,999],aided:true}},own:{story:{text:'a'.repeat(3000)}},section:'evil'}}});assert.strictEqual(clean.state.workbook.days[1].positions.story,0);assert.strictEqual(clean.state.workbook.days[1].positions.workshop,0);assert.strictEqual(Object.keys(clean.state.workbook.days[1].answers).length,0);assert.strictEqual(clean.state.workbook.days[1].own.story.text.length,2000);
// Content-specific witness: day10 never substitutes liking for a requested preference.
const missions=JSON.parse(fs.readFileSync('mission-data.json','utf8'));for(const variant of missions.days[9].variants)for(const t of variant.turns)if(t.prompt.includes('предпочит')){assert(!t.rule.forms.some(x=>x.startsWith('Me gusta')));assert(!t.rule.patterns.some(x=>x.includes('me gusta')));}
for(const day of [22,23]){assert(!JSON.stringify(stories.days[day-1].lines).match(/Estudié|Trabajé|Anoche/));assert(!workshops.days[day-1].tool.model.match(/Estudié|Trabajé|Anoche/));}
const bounded=make();solve(bounded.workbook,q,true);const firstTime=bounded.state.workbook.days[1].answers[`1:story:${q.id}`].first.time;for(let i=0;i<8;i++)solve(bounded.workbook,q,true);assert.strictEqual(bounded.state.workbook.days[1].answers[`1:story:${q.id}`].retries.length,5);assert.strictEqual(bounded.state.workbook.days[1].answers[`1:story:${q.id}`].first.time,firstTime);
const edited=make();solve(edited.workbook,q);click(edited.workbook,'data-wb-choice',(q.answer+1)%3);assert(!edited.workbook.html().includes('По этой модели — верно'));assert(!edited.workbook.html().includes('data-wb-next'));click(edited.workbook,'data-wb-next');assert.strictEqual(edited.state.workbook.days[1].positions.story,0);click(edited.workbook,'data-wb-check');assert.strictEqual(edited.state.workbook.days[1].answers[`1:story:${q.id}`].first.correct,true);assert(edited.state.workbook.days[1].answers[`1:story:${q.id}`].due>clock);
const tokenEdit=make();click(tokenEdit.workbook,'data-wb-section','workshop');for(const t of workshops.days[0].tasks.slice(0,2)){solve(tokenEdit.workbook,t);click(tokenEdit.workbook,'data-wb-next');}const buildTask=workshops.days[0].tasks[2];solve(tokenEdit.workbook,buildTask);assert(tokenEdit.workbook.html().includes('data-wb-next'));click(tokenEdit.workbook,'data-wb-remove',0);assert(!tokenEdit.workbook.html().includes('data-wb-next'));assert(!tokenEdit.workbook.html().includes('По этой модели — верно'));const tokenReload=make(JSON.parse(JSON.stringify(tokenEdit.state.workbook)));click(tokenReload.workbook,'data-wb-next');assert.strictEqual(tokenReload.state.workbook.days[1].positions.workshop,2);
assert.strictEqual(observed.length,checked+9,'Only first prepared answers produce adaptive evidence');
const report={status:'pass',days:30,preparedTasks:checked,storyLines:stories.days.reduce((n,d)=>n+d.lines.length,0),exactNativeLines:stories.days.flatMap(d=>d.lines).filter(l=>l.audio).length,contracts:['all correct/incorrect finite keys','immutable first attempts','sticky assistance','bounded retries','blank delayed repair','import cannot skip tasks','escaped own drafts','no self-rating completion','day10 preference semantics','recovery22/23'],saves};
fs.mkdirSync('.impeccable/review-v9',{recursive:true});fs.writeFileSync('.impeccable/review-v9/workbook-contracts.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
