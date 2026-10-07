/* Narrow state-machine verification. Simulated clock is not learning efficacy evidence. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let now=Date.UTC(2026,9,7,9),actual=3,toast='';
class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
const context=vm.createContext({window:{},Date:TestDate,requestAnimationFrame:()=>{},document:{querySelector:()=>null}});
for(const file of ['course-data.js','drills.js','adaptive.js','mastery.js'])vm.runInContext(fs.readFileSync('web/'+file,'utf8'),context,{filename:file});
const {VAMOS_DATA:data,VAMOS_DRILLS:drills,VamosMastery,VamosAdaptive}=context.window;
const state={day:24,completed:[],cards:{}};
const adaptive=VamosAdaptive.create({data,state,save:()=>{}});
const api={data,state,save:()=>{},render:()=>{},toast:t=>{toast=t},contentDay:()=>actual,setDay:d=>{state.day=d},log:()=>{},adaptive,sound:()=>{}};
let mastery=VamosMastery.create(api);
const button=attribute=>({hasAttribute:a=>a===attribute,dataset:{}}),click=a=>{now++;mastery.click(button(a))};
function run({wrong=false,hint=false,changeMidRun=false}={}){
 const source=data.expanded.lessons[actual-1],d=drills[actual-1],pool=source.examples.filter((_,i)=>i!==d.index),r=0;
 const qs=[pool[r],pool[(r+1)%pool.length],source.examples[d.index]];
 mastery.enter(state.day);click('data-mastery-start');
 for(let i=0;i<3;i++){
  if(hint&&i===0)click('data-mastery-hint');
  mastery.input({id:'mastery-answer',value:wrong&&i===0?'incorrect':qs[i].es});click('data-mastery-check');
  if(changeMidRun&&i===2)actual=actual===3?4:3;
  click('data-mastery-next');
 }
 return state.mastery[state.day];
}
const canonical=day=>{const source=data.expanded.lessons[day-1],d=drills[day-1],pool=source.examples.filter((_,i)=>i!==d.index);return [pool[0],pool[1],source.examples[d.index]].map(p=>p.audio).join(':')};
for(let day=1;day<=30;day++){const source=data.expanded.lessons[day-1],d=drills[day-1],pool=source.examples.filter((_,i)=>i!==d.index);assert.equal(new Set([pool[0],pool[1],source.examples[d.index]].map(p=>p.audio)).size,3,'Canonical check has three distinct original models for day '+day)}
const initial=run(),firstAt=initial.firstAt;assert(firstAt>0);assert.equal(initial.history[0].modelSet,canonical(3));
for(let i=0;i<20;i++)run();
assert.equal(state.mastery[24].firstAt,firstAt);assert.equal(state.mastery[24].retainedAt,0);assert(state.mastery[24].history.length<=12);assert(state.mastery[24].history.every(x=>x.modelSet===canonical(3)),'All immediate checks keep the exact same ordered three-model set');
mastery=VamosMastery.create(api);assert.equal(state.mastery[24].firstAt,firstAt,'Pinned first record survives reload after 20 repeats');
now=firstAt+86400001;run();const retainedAt=state.mastery[24].retainedAt;assert(retainedAt-firstAt>=86400000);
for(let i=0;i<20;i++)run();
assert.equal(state.mastery[24].firstAt,firstAt);assert(state.mastery[24].retainedAt>=retainedAt);assert(state.mastery[24].history.length<=12);
mastery=VamosMastery.create(api);assert.equal(state.mastery[24].firstAt,firstAt);assert(state.mastery[24].retainedAt>=retainedAt);
assert(state.mastery[24].history.every(x=>x.modelSet===canonical(3)),'Delayed evidence uses the same exact set after >12 checks and recreation');
const backupState={day:24,completed:[],cards:{}},backupMastery=VamosMastery.create({...api,state:backupState});backupMastery.merge(JSON.parse(JSON.stringify(state.mastery)));assert.equal(backupState.mastery[24].firstAt,firstAt);assert(backupState.mastery[24].retainedAt>=retainedAt);assert(backupState.mastery[24].history.every(x=>x.modelSet===canonical(3)),'Serialized backup merge retains exact set identity');
run({wrong:true});assert.equal(state.mastery[24].firstAt,0);assert.equal(state.mastery[24].retainedAt,0);assert(Object.values(state.cards).some(c=>c.due===now+600000));
run({hint:true});assert.equal(state.mastery[24].firstAt,0);assert.equal(state.mastery[24].retainedAt,0);
run();const resetFirst=state.mastery[24].firstAt;assert(resetFirst>firstAt);
now=resetFirst+86400001;actual=4;run();assert.equal(state.mastery[24].retainedAt,0,'Different recovery content cannot inherit delayed success');const contentFirst=state.mastery[24].firstAt;assert(contentFirst>resetFirst);assert.equal(state.mastery[24].history.at(-1).contentDay,4);
now=contentFirst+86400001;run();assert(state.mastery[24].retainedAt-contentFirst>=86400000);
const before=JSON.stringify(state.mastery[24]);run({changeMidRun:true});assert.equal(JSON.stringify(state.mastery[24]),before);assert.match(toast,/Тема изменилась/);
const imported=mastery.sanitize({24:{firstAt:resetFirst,retainedAt:contentFirst,history:[{at:resetFirst,correct:3,aided:false,contentDay:3,modelSet:canonical(3)},{at:contentFirst,correct:3,aided:false,contentDay:4,modelSet:canonical(4)}]}});assert.equal(imported[24].retainedAt,0);
const mismatchedIdentity=mastery.sanitize({24:{firstAt:resetFirst,retainedAt:contentFirst,history:[{at:resetFirst,correct:3,aided:false,contentDay:3,modelSet:canonical(4)},{at:contentFirst,correct:3,aided:false,contentDay:3,modelSet:canonical(3)}]}});assert(!mismatchedIdentity[24]?.firstAt);assert(!mismatchedIdentity[24]?.retainedAt,'Wrong exact model identity cannot grant delayed credit');
const legacy=mastery.sanitize({24:{firstAt:resetFirst,retainedAt:contentFirst,history:[{at:resetFirst,correct:3,aided:false,contentDay:3},{at:contentFirst,correct:3,aided:false,contentDay:3}]}});assert.equal(Object.keys(legacy).length,0,'Legacy evidence without exact-set identity cannot grant credit');
const target=data.expanded.lessons[0].examples[0].audio;actual=1;
adaptive.observe({id:'merge',day:1,audio:target,skill:'recall',correct:false});const old=JSON.stringify(state.adaptive.phrases[target]);
adaptive.merge(JSON.parse(JSON.stringify(state.adaptive)));assert.equal(JSON.stringify(state.adaptive.phrases[target]),old,'Importing same aggregate must not double-count');
const incoming=JSON.parse(JSON.stringify(state.adaptive));incoming.enabled=false;incoming.phrases[target].last=now-1;incoming.phrases[target].attempts=77;adaptive.merge(incoming);assert.equal(state.adaptive.enabled,true,'Import preserves device preference');assert.equal(JSON.stringify(state.adaptive.phrases[target]),old,'Older aggregate must not replace newer state');
const output={passed:true,firstRecordPinnedAfter20ImmediateRepeats:true,delayedRecordAndFirstPinnedAfter20DelayedRepeats:true,exactThreeModelSetPreservedAcrossRepeatsReloadAndBackup:true,invalidSetIdentityAndLegacyEvidenceRejected:true,boundedHistoryAndReload:true,wrongOrHintResetsIndependentEvidence:true,recoveryContentMustMatch:true,contentChangeMidRunRejected:true,malformedCrossContentImportNoDelayedCredit:true,aggregateImportNotDoubleCounted:true,olderAggregateIgnored:true,devicePreferencePreserved:true,limit:'Synthetic clock and state-machine checks only; no actual retention or efficacy measurement.'};
fs.mkdirSync('.impeccable/review-v6',{recursive:true});fs.writeFileSync('.impeccable/review-v6/evidence-edge-verification.json',JSON.stringify(output,null,2));console.log('PASS evidence edges: pinned bounded history/reload, reset, recovery content, interruption and non-duplicating import.');
