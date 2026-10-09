/* Independent production-function regression for lesson primers, help and navigation.
 * Pure Node VM fixtures: does not touch browser storage or actual user progress. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8'),copy=x=>JSON.parse(JSON.stringify(x)),noop=()=>{};
const source=read('web/course.js'),checks=[],issues=[];
const dataContext={window:{}};vm.createContext(dataContext);vm.runInContext(read('web/course-data.js'),dataContext);vm.runInContext(read('web/meaning-choices.js'),dataContext);
const data=dataContext.window.VAMOS_DATA;data.guidance=JSON.parse(read('course-guidance.json'));
const line=name=>{const found=source.split(/\r?\n/).find(l=>l.startsWith(' function '+name+'('));assert(found,name+' source');return found};
const coreRegion=source.slice(source.indexOf(' function baseTarget(){'),source.indexOf(' function feedbackHTML(){'));
const gradeRegion=source.slice(source.indexOf(' function checkTask(){'),source.indexOf(' function completeLesson(){'));
const exerciseRegion=source.slice(source.indexOf(' function exercise(){'),source.indexOf(' function recordingLimit(){'));
function harness(day=1){
 const state={day,repairDay:1,recovery:false,completed:[],mistakes:{},cards:{},chapter:0,learning:{sessions:{},events:[]},pathway:{selectedDay:31,selectedReading:null},reader:{selected:null,collection:false}},observed=[],events=[];
 const element={hidden:false,innerHTML:'',disabled:false};
 const c={state,data,window:{...dataContext.window,scrollTo:noop},document:{getElementById:()=>element},Date,URL,URLSearchParams,view:'lesson',stage:2,introIndex:0,introCycles:[0,0,0],introModelShown:false,productMotion:null,dailyPlan:{phaseHTML:()=>''},quizPrepSeen:false,hadHelp:false,selected:null,result:null,rating:null,tokens:[],draft:'',enterStep:false,originPrep:null,practiceKind:'menu',homeScreen:'today',planDay:day,readingRoute:false,routeReady:true,practiceIndex:0,practiceResult:null,tab:'index',chapters:[{first:1,last:7},{first:8,last:14},{first:15,last:21},{first:22,last:30}],location:{search:'',href:'https://example.test/'},history:{replaceState:noop},cardCatalog:{},esc:String,icon:()=>'',mascot:()=>'',playButton:(id,label)=>`<button data-audio="${id}">${label}</button>`,audioStatus:()=>'',audioControls:()=>'',audioCredit:()=>'',phrase:()=>'',introHTML:()=>'',repairPanel:()=>'',feedbackHTML:()=>'',footer:()=>'',recorderHTML:()=>'',preparingOrigin:()=>false,goals:{personal:()=>'',feedback:()=>''},coach:{explanation:()=>'',enterScene:noop,enterCheckpoint:noop},workbook:{toggle:noop},studio:{current:()=>null,nextButton:()=>''},reader:{catalog:()=>[{id:'text:1'}]},speech:{stop:noop},stopRecording:noop,save:noop,toast:noop,sound:noop,scrollTo:noop,render:()=>events.push('render'),renderLessonInteraction:()=>events.push('interaction'),focusPractice:noop,completeLesson:()=>events.push('completed'),newOriginPrep:()=>null,restoreOriginPrep:()=>null,openFolds:{},startReview:noop,routeURL:()=>'/'};
 c.norm=s=>String(s).normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 c.recallPlain=s=>c.norm(s).normalize('NFD').replace(/\u0301/g,'').normalize('NFC');
 c.contentDay=()=>state.day===24?state.repairDay:state.recovery&&[22,23].includes(state.day)?(state.day===22?19:20):state.day;
 c.extra=()=>data.expanded.lessons[c.contentDay()-1];c.practiceLesson=()=>data.lessons[c.contentDay()-1];c.lesson=()=>data.lessons[state.day-1];
 c.learning={usedHelp:()=>false,remember:value=>{state.learning.sessions[state.day]={...copy(value),time:Date.now()}},session:d=>state.learning.sessions[d],allowed:()=>true,attempt:noop,newStage:noop,log:(...args)=>events.push(['log',...args])};
 c.adaptive={observe:e=>observed.push(copy(e))};c.action=(label,disabled)=>events.push(['action',label,disabled]);
 c.openPractice=(kind,d,options)=>{c.view='practice';c.practiceKind=kind;events.push(['openPractice',kind,d,options])};
 vm.createContext(c);vm.runInContext(coreRegion+gradeRegion+exerciseRegion+['resetTask','persistLesson','openLesson','readRoute','guidance','guidanceHTML','advance'].map(line).join('\n'),c);
 const toggleLine=source.split(/\r?\n/).find(l=>l.includes("app.addEventListener('toggle',event=>"));assert(toggleLine);
 c.onToggle=vm.runInContext('('+toggleLine.slice(toggleLine.indexOf('event=>'),toggleLine.lastIndexOf(',true);'))+')',c);
 return {c,state,observed,events};
}
function check(name,fn){try{fn();checks.push({name,passed:true})}catch(e){issues.push({name,error:e.message})}}
check('Eight primers require an explicit action and award no answer/completion',()=>{
 for(const day of [3,6,8,11,16,19,22,27]){const h=harness(day),{c}=h;let html=c.exercise();assert.match(html,/quiz-preparation/);assert.doesNotMatch(html,/data-option=/);c.advance();assert.equal(c.quizPrepSeen,true);assert.equal(c.stage,2);assert.equal(c.result,null);assert.equal(c.selected,null);assert.equal(h.observed.length,0);assert.equal(h.state.completed.length,0);assert(!h.events.some(e=>Array.isArray(e)&&e[0]==='log'));assert.match(c.exercise(),/data-option=/);}
});
check('All 22 previously taught quiz models show their task directly',()=>{
 for(let day=1;day<=30;day++)if(!data.guidance.lessons[day-1].quizPrep){const {c}=harness(day);assert.doesNotMatch(c.exercise(),/quiz-preparation/);assert.match(c.exercise(),/data-option=/);}
});
check('Primer flag survives actual persisted lesson reload; an old selected quiz remains answerable',()=>{
 for(const day of [3,6,8,11,16,19,22,27]){const {c,state}=harness(day);c.advance();assert.equal(state.learning.sessions[day].quizPrepSeen,true);c.openLesson(day,true);assert.equal(c.stage,2);assert.equal(c.quizPrepSeen,true);assert.equal(c.selected,null);assert.doesNotMatch(c.exercise(),/quiz-preparation/);state.learning.sessions[day].quizPrepSeen=false;state.learning.sessions[day].selected=0;c.view='home';c.openLesson(day,true);assert.equal(c.quizPrepSeen,true);assert.equal(c.selected,0);assert.doesNotMatch(c.exercise(),/quiz-preparation/);}
});
check('Five task modes mark opened help as aided in actual grading',()=>{
 for(let stage=1;stage<=5;stage++){const {c,state,observed}=harness(1);c.stage=stage;c.quizPrepSeen=true;c.onToggle({target:{dataset:{},open:true,hasAttribute:x=>x==='data-learning-support'}});assert.equal(c.hadHelp,true);assert.equal(state.learning.sessions[1].hadHelp,true);if([1,2,4].includes(stage))c.selected=c.currentTask().answer;else if(stage===3)c.tokens=c.target().es.split(/\s+/).map((_,i)=>i);else c.draft=c.target().es;c.checkTask();assert.equal(observed.length,1);assert.equal(observed[0].correct,true);assert.equal(observed[0].aided,true);assert.equal(state.completed.length,0);}
});
check('Closed/irrelevant helper does not mark a fresh answer aided',()=>{
 const {c,observed}=harness(1);c.stage=2;c.quizPrepSeen=true;c.onToggle({target:{dataset:{},open:false,hasAttribute:()=>true}});c.selected=c.currentTask().answer;c.checkTask();assert.equal(observed[0].aided,false);
});
check('All 30 guidance HTML hints follow the actual task and expose exact-caption audio',()=>{
 for(let day=1;day<=30;day++){const {c}=harness(day);for(let stage=1;stage<=6;stage++){c.stage=stage;const g=c.guidance(),kind={1:'listening',2:'quiz',3:'builder',4:'gap',5:'recall',6:'oral'}[stage],html=c.guidanceHTML();assert(html.includes(g.practiceHints[kind].hintRu));assert(html.includes(g.miniRule.exampleEs));assert(html.includes(`data-audio="${g.miniRule.audio}"`));}}
});
check('Recovery and repair guidance follow content day instead of scheduled day',()=>{
 for(const [day,actual]of [[22,19],[23,20],[24,3]]){const {c,state}=harness(day);state.recovery=true;state.repairDay=3;assert.equal(c.guidance().day,actual);c.stage=4;assert(c.guidanceHTML().includes(data.guidance.lessons[actual-1].practiceHints.gap.hintRu));}
});
check('Catalog/book/collection reader routes resolve explicitly without awarding progress',()=>{
 for(const [q,book,collection]of [['?view=practice&mode=reader',null,false],['?view=practice&mode=reader&book=text%3A1','text:1',false],['?view=practice&mode=reader&collection=1',null,true]]){const {c,state,observed}=harness(1);c.view='home';c.location.search=q;c.readRoute();assert.equal(state.reader.selected,book);assert.equal(state.reader.collection,collection);assert.equal(c.practiceKind,'reader');assert.equal(state.completed.length,0);assert.equal(observed.length,0);}
});
check('Route change to a different lesson preserves each day separately instead of transplanting task progress',()=>{
 const {c,state}=harness(1);c.stage=3;c.tokens=[0,1];c.location.search='?view=lesson&day=2';c.readRoute();assert.equal(state.learning.sessions[1].stage,3);assert.equal(c.stage,0);assert.equal(c.tokens.length,0);assert.equal(state.completed.length,0);
});
check('Actual speech screens stop capture while preserving same-phrase comparison; changing phrase discards old recording',()=>{
 const calls=[],node={disabled:false,focus:noop};const c={window:{scrollTo:noop},document:{querySelector:()=>node,getElementById:()=>node},clearTimeout:noop,setTimeout:()=>1};vm.createContext(c);vm.runInContext(read('web/speech.js'),c);
 const app=c.window.VamosSpeech.create({state:{audioSpeed:.5},esc:String,icon:()=>'',mascot:()=>'',playButton:()=>'',audioControls:()=>'',audioStatus:()=>'',audioCredit:()=>'',recorderHTML:()=>'<div>LOCAL_RECORDER</div>',footer:()=>'',render:noop,stopAudio:()=>calls.push(['audio']),stopRecording:discard=>calls.push(['record',discard===true]),active:()=>true,examples:()=>data.expanded.lessons[0].examples,pronunciation:()=>'',log:(...e)=>calls.push(['log',...e]),toast:noop});
 const screen=id=>({dataset:{speechScreen:id},hasAttribute:k=>k==='data-speech-screen'});app.enter();assert.match(app.html(),/native-model/);app.click(screen('record'));assert.match(app.html(),/LOCAL_RECORDER/);assert.equal(app.audioContextKey(),'record:437710');assert.deepEqual(calls.at(-1),['record',false]);app.click(screen('words'));assert.match(app.html(),/распознавание недоступно/);assert.match(app.html(),/LOCAL_RECORDER/);assert.match(app.html(),/Голос носителя/);assert.match(app.html(),/акцент автоматически здесь не оцениваются/);assert.doesNotMatch(app.html(),/data-speech-start/);assert.equal(app.audioContextKey(),'words:437710');assert.deepEqual(calls.at(-1),['record',false]);app.click(screen('record'));calls.length=0;app.change({id:'speech-phrase',value:'1'});assert.deepEqual(calls,[['audio'],['record',true]]);assert.equal(app.audioContextKey(),'record:788477');assert(!calls.some(x=>x[0]==='log'));
 // With recognition available, the words screen offers a fresh consent-bound check, not reuse of local audio.
 const supportedCalls=[];class Recognition{start(){supportedCalls.push('started')}abort(){supportedCalls.push('aborted')}}
 const supportedContext={window:{SpeechRecognition:Recognition,scrollTo:noop},document:{querySelector:()=>node,getElementById:()=>node},clearTimeout:noop,setTimeout:()=>1};vm.createContext(supportedContext);vm.runInContext(read('web/speech.js'),supportedContext);
 const supported=supportedContext.window.VamosSpeech.create({state:{audioSpeed:.5},esc:String,icon:()=>'',mascot:()=>'',playButton:()=>'',audioControls:()=>'',audioStatus:()=>'',audioCredit:()=>'',recorderHTML:()=>'<div>LOCAL_RECORDER</div>',footer:()=>'',render:noop,stopAudio:noop,stopRecording:noop,active:()=>true,examples:()=>data.expanded.lessons[0].examples,pronunciation:()=>'',log:(...e)=>supportedCalls.push(['log',...e]),toast:noop});
 supported.click(screen('words'));const supportedHTML=supported.html();assert.doesNotMatch(supportedHTML,/LOCAL_RECORDER|распознавание недоступно/);assert.match(supportedHTML,/speech-consent/);assert.match(supportedHTML,/data-speech-start disabled/);supported.click({dataset:{},hasAttribute:k=>k==='data-speech-start'});assert.equal(supportedCalls.length,0);assert.match(supportedHTML,/акцент она не оценивает/);
});
check('Stale browser recognition callback cannot grade a phrase after switching speech screen',()=>{
 const calls=[],recognitions=[],node={disabled:false,focus:noop};class Recognition{constructor(){recognitions.push(this)}start(){calls.push('started')}abort(){calls.push('aborted')}stop(){calls.push('stopped')}}
 const c={window:{SpeechRecognition:Recognition,scrollTo:noop},document:{querySelector:()=>node,getElementById:()=>node},clearTimeout:noop,setTimeout:()=>1};vm.createContext(c);vm.runInContext(read('web/speech.js'),c);
 const app=c.window.VamosSpeech.create({state:{audioSpeed:.5},esc:String,icon:()=>'',mascot:()=>'',playButton:()=>'',audioControls:()=>'',audioStatus:()=>'',audioCredit:()=>'',recorderHTML:()=>'',footer:()=>'',render:noop,stopAudio:noop,stopRecording:noop,active:()=>true,examples:()=>data.expanded.lessons[0].examples,pronunciation:()=>'',log:(...e)=>calls.push(['log',...e]),toast:noop});
 const screen=id=>({dataset:{speechScreen:id},hasAttribute:k=>k==='data-speech-screen'});app.click(screen('words'));app.change({id:'speech-consent',checked:true});app.click({dataset:{},hasAttribute:k=>k==='data-speech-start'});assert.equal(recognitions.length,1);const oldResult=recognitions[0].onresult;assert.equal(typeof oldResult,'function');app.click(screen('record'));assert(calls.includes('aborted'));oldResult({results:[[{transcript:'Hola.'}]]});assert(!calls.some(x=>Array.isArray(x)&&x[0]==='log'));assert.match(app.html(),/Мой голос и голос носителя/);assert.doesNotMatch(app.html(),/Распознанные слова совпали/);
});

// Actual backup module with test-only import/export fixtures and genuine reader sanitizer.
async function imports(){
 const c={window:{},Date,console,Blob,URL:{createObjectURL:blob=>{c.exportBlob=blob;return'test-blob'},revokeObjectURL:noop},setTimeout:noop,document:{createElement:()=>({click:noop}),querySelector:()=>({scrollIntoView:noop})},CSS:{escape:String}};vm.createContext(c);vm.runInContext(read('web/reader.js'),c);vm.runInContext(read('web/progress.js'),c);
 function instance(){
  const state={day:3,audioSpeed:1,completed:[],cards:{},ratings:{},mistakes:{},checkpoints:{},sceneRatings:{},library:{favorites:[],known:[],difficult:[],notes:{}},learning:{events:[],sessions:{}},profile:{nickname:''}},pass={sanitize:x=>x||{},merge:noop,close:noop};
  const reader=c.window.VamosReader.create({state,data,esc:String,icon:()=>'',mascot:()=>'',playButton:()=>'',audioControls:()=>'',audioStatus:()=>'',audioCredit:()=>'',footer:()=>'',save:noop,render:noop,toast:noop});
  const missions={...pass,merge:(a,b)=>a||b||{}},libraryPractice={...pass,merge:(a,b)=>a||b||{}};
  const progress=c.window.VamosProgress.create({state,data,save:noop,toast:noop,esc:String,icon:()=>'',render:noop,mastery:pass,adaptive:pass,studio:pass,missions,workbook:pass,profile:pass,pathway:pass,repair:pass,bridgeReview:pass,libraryPractice,reader});return {state,reader,progress};
 }
 const click=key=>({hasAttribute:k=>k===key}),importFile=async(progress,state)=>{const text=JSON.stringify({format:'vamos-backup-v1',state});await progress.change({id:'backup-file',files:[{size:text.length,text:async()=>text}]});progress.click(click('data-backup-apply'))};
 try{
  const h=instance(),model=data.expanded.lessons[2].examples[0];h.state.learning.sessions[3]={stage:2,introIndex:2,quizPrepSeen:true,hadHelp:true,time:Date.now()-1000,signature:'v14:3:'+model.audio,selected:null,tokens:[],draft:'',rating:null};h.progress.click(click('data-backup-export'));const raw=JSON.parse(await c.exportBlob.text());assert.equal(raw.state.learning.sessions[3].quizPrepSeen,true);const imported=instance();await importFile(imported.progress,raw.state);assert.equal(imported.state.learning.sessions[3].quizPrepSeen,true);assert.equal(imported.state.learning.sessions[3].hadHelp,true);assert.equal(imported.state.completed.length,0);checks.push({name:'Actual backup/import preserves primer/help and never completes a lesson',passed:true});
  try{assert.equal(imported.state.learning.sessions[3].introIndex,2);checks.push({name:'Actual backup/import preserves current phrase position',passed:true})}catch(e){issues.push({name:'Actual backup/import preserves current phrase position',error:e.message})}
 }catch(e){issues.push({name:'Actual backup/import primer/help',error:e.message})}
 try{
  const h=instance(),task=h.reader.catalog().find(b=>b.id==='text:1').task,now=Date.now();h.state.reader.rows['text:1']={translations:[],selectedGloss:null,answer:task.answer,checked:true,aided:false,visited:true,attempts:[{value:task.answer,correct:true,aided:false,time:now-1000}]};const imported={reader:{rows:{'text:1':{translations:[0],selectedGloss:null,answer:(task.answer+1)%task.options.length,checked:true,aided:true,visited:true,attempts:[{value:(task.answer+1)%task.options.length,correct:false,aided:true,time:now-2000}]}}}};await importFile(h.progress,imported);const r=h.state.reader.rows['text:1'];assert.equal(r.attempts.length,2);assert.equal(r.attempts[0].correct,false);assert.equal(r.attempts[0].time,now-2000);assert.equal(r.attempts[1].correct,true);assert.equal(r.checked,false);assert.equal(r.aided,true);assert.equal(h.state.completed.length,0);checks.push({name:'Reader merge keeps the earliest actual attempt with chronological history; does not invent success',passed:true});
 }catch(e){issues.push({name:'Reader earliest attempt merge',error:e.message})}
 check('Thirty guided introductions use three cycles per phrase and cannot award completion or independent answers',()=>{
 for(let day=1;day<=30;day++){const h=harness(day),c=h.c;c.stage=0;c.introIndex=0;c.introCycles=[0,0,0];
  for(let phrase=0;phrase<3;phrase++){assert.equal(c.introIndex,phrase);for(let cycle=0;cycle<2;cycle++){assert.equal(c.introCycles[phrase],cycle);c.advance();assert.equal(c.stage,0);assert.equal(c.introIndex,phrase);}assert.equal(c.introCycles[phrase],2);c.advance();}
  assert.equal(c.stage,1);assert.equal(h.observed.length,0);assert.equal(h.state.completed.length,0);
 }
});
check('Guided cycles and actual intro phrase survive reload and backup sanitization',()=>{
 const h=harness(5),c=h.c;c.stage=0;c.introIndex=1;c.introCycles=[2,1,0];c.persistLesson();c.view='home';c.openLesson(5,true);assert.deepEqual(Array.from(c.introCycles),[2,1,0]);assert.equal(c.introIndex,1);
 const intro=line('introHTML');const context={...c,phrase:p=>`<p lang="es">${p.es}</p>`,audioStatus:()=>'',speeds:[.5,1],mascot:()=>'',icon:()=>'',esc:String};vm.createContext(context);vm.runInContext(intro,context);context.introCycles[1]=2;context.introModelShown=false;const html=context.introHTML(c.extra());assert(!html.includes(c.extra().examples[1].es));assert(html.includes(c.extra().examples[1].ru));context.introModelShown=true;assert(context.introHTML(c.extra()).includes(c.extra().examples[1].es));
});
const report={passed:issues.length===0,checks,issues,scope:'Production extracted lesson functions, real backup and reader sanitizer in isolated Node fixtures; no physical/browser/microphone verification'};fs.mkdirSync(path.join(root,'.impeccable/review-v28'),{recursive:true});fs.writeFileSync(path.join(root,'.impeccable/review-v28/lesson-support-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}
imports().catch(e=>{console.error(e);process.exitCode=1});
