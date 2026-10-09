/* Independent state-machine regression: due conversation → cards → new lesson. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const base=__dirname,now=Date.now(),checks=[];
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(base,'web/course-data.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(base,'web/studio.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(base,'web/focus-home.js'),'utf8'),ctx);
const data=ctx.window.VAMOS_DATA,copy=x=>JSON.parse(JSON.stringify(x));
const course=fs.readFileSync(path.join(base,'web/course.js'),'utf8');
const dueSource=course.match(/dueControl:(\(\)=>state\.missions\?\.history\?\.filter\([^\r\n]+?\|\|null),cardExists:/)?.[1];
assert.ok(dueSource,'production due callback found');
function harness({raw,next=2,cards=[],history=[],pending=()=>true,recovery=true,repairDay=1,recordingMarkup='<div>recorder</div>'}={}){
 const state={day:next,recovery,repairDay,completed:[1],motion:false,missions:{history:copy(history)},studio:copy(raw||{profile:{name:'Лена',city:'Taskent',interest:'leer'},active:null,history:[]})},events=[];
 const due=vm.runInNewContext(dueSource,{state,missions:{pendingControl:pending},Date});
 const api={state,data,esc:String,icon:()=>'',mascot:()=>'<span>Lumo</span>',footer:()=>'',save:()=>events.push(['save']),render:()=>events.push(['render']),toast:()=>{},navigate:(...a)=>events.push(['navigate',...a]),openLesson:(...a)=>events.push(['lesson',...a]),startSet:keys=>events.push(['cards',copy(keys)]),dueKeys:()=>cards,nextDay:()=>next,recorderHTML:()=>recordingMarkup,cardExists:k=>['p:437710','p:444117'].includes(k),personal:d=>'<p>PERSONAL-'+d+'</p>',sound:()=>{}};
 const studio=ctx.window.VamosStudio.create({...api,dueControl:due});return {state,events,studio,api,due};
}
const ended={day:1,started:now-90000000,step:4,reviewKeys:[],reviewSkipped:true,rating:'help',difficulty:'llamo',finished:now-87000000};
const activeLegacy={day:2,started:now-600000,step:1,reviewKeys:['p:437710'],reviewSkipped:false,rating:null,difficulty:'',finished:null};
function check(name,fn){fn();checks.push(name)}
check('future and exhausted conversation controls do not interrupt a fresh lesson',()=>{
 for(const history of [[{day:1,dueAt:now+60000}],[{day:1,dueAt:now-1,exhausted:true}],[]]){
  const h=harness({history,pending:x=>!x.exhausted});h.studio.begin();assert.equal(h.studio.current().step,1);assert.equal(h.studio.current().controlReviewDay,undefined);assert.deepEqual(h.events.filter(x=>x[0]==='lesson'),[['lesson',2,true]]);assert.deepEqual(h.state.completed,[1]);
 }
});
check('oldest eligible control wins; exhausted rows ignored',()=>{const h=harness({history:[{day:3,dueAt:now-1000},{day:1,dueAt:now-3000,exhausted:true},{day:2,dueAt:now-2000}],pending:x=>!x.exhausted});assert.equal(h.due(),2)});
check('due control resumes after reload and returning from an exit',()=>{
 const h=harness({history:[{day:1,dueAt:now-1}],cards:['p:437710','p:444117']});h.studio.begin();assert.equal(h.studio.current().step,0);assert.equal(h.studio.current().controlReviewDay,1);assert.equal(h.events.at(-1)[0],'navigate');assert.deepEqual(h.events.at(-1).slice(0,3),['navigate','mission',1]);assert.equal(h.events.at(-1)[3].control,true);
 const reloaded=harness({raw:h.state.studio,history:[{day:1,dueAt:now-1}],cards:['p:437710','p:444117']});reloaded.studio.begin();assert.equal(reloaded.studio.current().controlReviewDay,1);assert.equal(reloaded.studio.current().step,0);assert.equal(reloaded.events.at(-1)[2],1);assert.deepEqual(reloaded.state.completed,[1]);
 // Exiting the mission calls no completion transition: begin returns to it.
 reloaded.studio.begin();assert.equal(reloaded.studio.current().step,0);assert.equal(reloaded.events.at(-1)[3].control,true);
 assert.equal(reloaded.studio.reviewMissionDone(3),false);assert.equal(reloaded.studio.current().controlReviewDay,1);
 assert.equal(reloaded.studio.reviewMissionDone(1),true);assert.equal(reloaded.studio.current().controlReviewDay,undefined);assert.equal(reloaded.state.day,2);assert.deepEqual(reloaded.events.at(-1),['cards',['p:437710','p:444117']]);assert.equal(reloaded.studio.current().step,0);
 reloaded.studio.reviewRated('p:437710');assert.equal(reloaded.studio.current().step,0);reloaded.studio.reviewRated('p:444117');assert.equal(reloaded.studio.current().step,1);reloaded.studio.begin();assert.deepEqual(reloaded.events.at(-1),['lesson',2,true]);assert.deepEqual(reloaded.state.completed,[1]);
});
check('control completion with no cards opens the planned lesson and retains the performed review',()=>{const h=harness({history:[{day:1,dueAt:now-1}]});h.studio.begin();assert.equal(h.studio.reviewMissionDone(1),true);assert.equal(h.studio.current().step,1);assert.equal(h.studio.current().reviewSkipped,false);assert.deepEqual(h.events.at(-1),['lesson',2,true]);assert.deepEqual(h.state.completed,[1]);const html=ctx.window.VamosFocusHome.create({...h.api,screen:()=> 'today',dueControl:h.due}).html(),steps=html.match(/<ol class="study-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];assert.equal((steps.match(/<li /g)||[]).length,4);assert.match(steps,/<li class="is-done"[^>]*>[\s\S]*?<strong>Повторить<\/strong>/);assert.match(steps,/<li class="is-current" aria-current="step"[^>]*>[\s\S]*?<strong>Урок<\/strong>/);assert.match(h.studio.band('practice','menu',2)||h.studio.band('practice','pronunciation',2),/Шаг 2 из 4/);});
check('legacy active/history/profile stay intact and do not acquire a due field',()=>{const raw={profile:{name:'Лена',city:'Taskent',interest:'leer'},active:activeLegacy,history:[ended]},h=harness({raw,history:[{day:1,dueAt:now-1}]});assert.deepEqual(copy(h.state.studio),raw);h.studio.begin();assert.equal(h.studio.current().step,1);assert.equal(h.studio.current().controlReviewDay,undefined);assert.deepEqual(copy(h.state.studio.history),[ended]);assert.equal(h.state.studio.profile.name,'Лена');assert.deepEqual(h.events.at(-1),['lesson',2,true]);});
check('all 30 due review days preserve a separate planned learning day',()=>{
 for(let day=1;day<=30;day++){const h=harness({next:day===30?29:30,history:[{day,dueAt:now-1}],cards:['p:437710']});h.studio.begin();assert.equal(h.studio.current().controlReviewDay,day);assert.equal(h.events.at(-1)[2],day);const planDay=h.studio.current().day;assert.equal(h.studio.reviewMissionDone(day),true);assert.equal(h.state.day,planDay);assert.equal(h.studio.current().day,planDay);assert.equal(h.studio.current().step,0);assert.deepEqual(h.state.completed,[1]);}
});
check('lesson and ordinary mission completion cannot finish the daily own-answer stage',()=>{const h=harness();h.studio.begin();h.studio.lessonDone(3);assert.equal(h.studio.current().step,1);h.studio.lessonDone(2);assert.equal(h.studio.current().step,2);h.studio.missionDone(2);assert.equal(h.studio.current().step,3);assert.equal(h.studio.reviewMissionDone(2),false);assert.equal(h.studio.current().finished,null);assert.deepEqual(h.state.completed,[1]);});
check('day 1 and 2 final prompt is personal; support and recording are opt-in',()=>{
 for(const day of [1,2]){const h=harness({next:day});h.studio.begin();h.studio.lessonDone(day);h.studio.missionDone(day);const html=h.studio.html();assert.match(html,day===1?/своё настоящее имя/:/своё настоящее состояние/);assert.match(html,/<details class="own-support">/);assert.match(html,/<details class="own-recording"\s*>/);assert.doesNotMatch(html,/<details class="own-(?:support|recording)"\s+open\b/);assert.match(html,/data-studio-finish disabled/);}
});
check('Pending/capturing microphone or prepared audio reveals the own-answer recorder without opening support or awarding completion',()=>{
 for(const recordingMarkup of ['<section class="recorder" aria-busy="true">Ожидаю разрешения</section>','<section class="recorder recording" aria-busy="true">Записываю</section>','<section class="recorder" aria-busy="false"><audio controls></audio></section>']){const h=harness({next:1,recordingMarkup});h.studio.begin();h.studio.lessonDone(1);h.studio.missionDone(1);const before=JSON.stringify(h.state),html=h.studio.html();assert.match(html,/<details class="own-recording"\s+open>/);assert.doesNotMatch(html,/<details class="own-support"\s+open\b/);assert(html.includes(recordingMarkup));assert.match(html,/data-studio-finish disabled/);assert.equal(JSON.stringify(h.state),before);assert.equal(h.studio.current().step,3);assert.equal(h.studio.current().finished,null)}
});
check('day 2 quiz and its goal contract use the taught native state response',()=>{const lesson=data.lessons[1],quiz=lesson.practice.quiz[1],goal=data.goals.lessons.find(x=>x.day===2);assert.equal(quiz.options[quiz.answer],'Estoy bien. ¿Y tú?');assert.ok(data.expanded.lessons[1].examples.some(x=>x.es==='Estoy bien.'));assert.ok(data.expanded.lessons[1].examples.some(x=>x.es==='¿Y tú?'));assert.equal(goal.closedChecks[1].expected,quiz.options[quiz.answer]);assert.doesNotMatch(quiz.question,/Qué tal/);assert.equal(quiz.options.filter(x=>x==='Estoy bien. ¿Y tú?').length,1)});
check('actual mission callback keeps exit incomplete and advances only the completed scheduled control',()=>{
 const callbackSource=course.match(/onComplete:(result=>\{if\(result\?\.completed[^\r\n]+?)\}\);/)?.[1];assert.ok(callbackSource);
 const h=harness({history:[{day:1,dueAt:now-1}],cards:['p:437710']});h.studio.begin();h.state.day=1;
 const callback=vm.runInNewContext(callbackSource,{studio:h.studio,state:h.state,contentDay:()=>h.state.day,openPractice:(...args)=>h.events.push(['openPractice',...args])});
 callback({closed:true});assert.equal(h.studio.current().step,0);assert.equal(h.studio.current().controlReviewDay,1);assert.deepEqual(h.events.at(-1),['openPractice','menu']);assert.deepEqual(h.state.completed,[1]);
 callback({completed:true,control:true,day:3});assert.equal(h.studio.current().controlReviewDay,1);
 callback({completed:true,control:true,day:1});assert.equal(h.studio.current().controlReviewDay,undefined);assert.equal(h.studio.current().step,0);assert.equal(h.state.day,2);assert.deepEqual(h.events.at(-1),['cards',['p:437710']]);
});
check('final self-rating is required and preserves its honest result without changing lesson completion',()=>{
 const h=harness();h.studio.begin();h.studio.lessonDone(2);h.studio.missionDone(2);
 const button=key=>({dataset:{},hasAttribute:x=>x===key});h.studio.click(button('data-studio-finish'));assert.equal(h.studio.current().step,3);assert.equal(h.studio.current().finished,null);
 h.studio.click({dataset:{studioRating:'retry'},hasAttribute:()=>false});h.studio.input({id:'session-difficulty',dataset:{},value:'¿Y tú?'});h.studio.click(button('data-studio-finish'));
 assert.equal(h.studio.current().step,4);assert.ok(h.studio.current().finished);assert.equal(h.studio.current().rating,'retry');assert.equal(h.studio.current().difficulty,'¿Y tú?');assert.equal(h.state.studio.history.at(-1).rating,'retry');assert.deepEqual(h.state.completed,[1]);
 const resumed=harness({raw:h.state.studio});assert.equal(resumed.studio.current().step,4);assert.equal(resumed.state.studio.history.at(-1).rating,'retry');
});
// Exercise the actual production openPractice mapping, especially day 24 and recovery days.
check('actual production mission entry retains all 30 control day identities including recovery aliases',()=>{
 const openSource=course.match(/^ function openPractice\([^\r\n]+/m)?.[0];assert.ok(openSource);
 for(let day=1;day<=30;day++){
  const state={day:30,chapter:3,recovery:true,repairDay:1},calls=[];
  const c={state,view:'home',stage:0,practiceKind:'menu',speech:{stop(){}},stopRecording(){},save(){},render(){},scrollTo(){},focusPractice(){},chapters:[{first:1,last:7},{first:8,last:14},{first:15,last:21},{first:22,last:30}],studio:{current:()=>({day:30,step:0,controlReviewDay:day})},missions:{start:(...args)=>calls.push(args)},contentDay:()=>state.day===24?1:state.day===22?19:state.day===23?20:state.day};vm.createContext(c);vm.runInContext(openSource+'\nopenPractice("mission",'+day+',{control:true});',c);assert.equal(calls[0][0],day);assert.equal(calls[0][1].control,true);
 }
});
check('actual Today ignores completed prior reviewSkipped when a due control starts the next day',()=>{
 const h=harness({raw:{profile:{},active:ended,history:[ended]},history:[{day:1,dueAt:now-1}]});
 const focus=ctx.window.VamosFocusHome.create({...h.api,screen:()=> 'today',icon:name=>'<i>'+name+'</i>',mascot:()=>'<b>Lumo</b>',playButton:()=>'',dueControl:h.due});
 const html=focus.html(),steps=html.match(/<ol class="study-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];
 assert.match(html,/День 2 из 30/);assert.match(html,/≈ 35 мин/);assert.match(steps,/<strong>Повторить<\/strong>/);assert.equal((steps.match(/<li /g)||[]).length,4);assert.match(steps,/<li class="is-current" aria-current="step"/);assert.doesNotMatch(steps,/is-done|<i>check<\/i>/);assert.match(html,/со знакомого разговора дня 1:/);assert.doesNotMatch(html,/Сегодня познакомимся/);
});
check('actual Today uses three steps only when no due cards/control and no ongoing plan',()=>{
 const h=harness({raw:{profile:{},active:ended,history:[ended]}}),html=ctx.window.VamosFocusHome.create({...h.api,screen:()=> 'today',dueControl:h.due}).html(),steps=html.match(/<ol class="study-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];
 assert.match(html,/≈ 30 мин/);assert.doesNotMatch(steps,/<strong>Повторить<\/strong>/);assert.equal((steps.match(/<li /g)||[]).length,3);assert.doesNotMatch(steps,/is-done/);assert.match(html,/Как дела\?/);
});
check('actual Today preserves an ongoing legacy skipped plan despite newly due review work',()=>{
 const h=harness({raw:{profile:{},active:{...activeLegacy,reviewSkipped:true},history:[ended]},cards:['p:437710'],history:[{day:1,dueAt:now-1}]});
 const html=ctx.window.VamosFocusHome.create({...h.api,screen:()=> 'today',dueControl:h.due}).html(),steps=html.match(/<ol class="study-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];
 assert.match(html,/≈ 30 мин/);assert.doesNotMatch(steps,/<strong>Повторить<\/strong>/);assert.equal((steps.match(/<li /g)||[]).length,3);assert.match(steps,/<li class="is-current" aria-current="step"[^>]*>[\s\S]*?<strong>Урок<\/strong>/);assert.doesNotMatch(html,/со знакомого разговора дня/);assert.equal(h.studio.current().controlReviewDay,undefined);
});
check('actual Today restores visible review when due cards exist after a completed skipped plan',()=>{
 const h=harness({raw:{profile:{},active:ended,history:[ended]},cards:['p:437710']}),html=ctx.window.VamosFocusHome.create({...h.api,screen:()=> 'today',dueControl:h.due}).html(),steps=html.match(/<ol class="study-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];
 assert.match(html,/≈ 35 мин/);assert.match(steps,/<strong>Повторить<\/strong>/);assert.equal((steps.match(/<li /g)||[]).length,4);assert.doesNotMatch(steps,/is-done/);assert.match(steps,/<li class="is-current" aria-current="step"/);
});
check('recovery journey captures one topic and moves from its actual mission into the own reply',()=>{
 for(const [day,topic] of [[22,19],[23,20],[24,7]]){
  const h=harness({next:day,repairDay:7});h.studio.begin();assert.equal(h.studio.current().contentDay,topic);h.studio.lessonDone(day);assert.equal(h.studio.current().step,2);
  h.state.recovery=false;h.state.repairDay=2;assert.equal(h.studio.missionDone(day),false);assert.equal(h.studio.current().step,2);assert.equal(h.studio.missionDone(topic),true);assert.equal(h.studio.current().step,3);assert.match(h.studio.html(),new RegExp('PERSONAL-'+topic));assert.doesNotMatch(h.studio.html(),new RegExp('PERSONAL-'+day));
  const loaded=harness({raw:h.state.studio,next:day,recovery:false,repairDay:2});assert.equal(loaded.studio.current().contentDay,topic);assert.match(loaded.studio.html(),new RegExp('PERSONAL-'+topic));assert.deepEqual(loaded.state.completed,[1]);
 }
});
check('ordinary and recovery-off days cannot acquire unrelated source topics through backup',()=>{
 for(const [day,topic] of [[1,30],[22,20],[23,19],[24,30]]){const h=harness({raw:{active:{...activeLegacy,day,contentDay:topic}}});assert.equal(h.studio.current().contentDay,undefined)}
 for(const day of [22,23]){const h=harness({next:day,recovery:false});h.studio.begin();assert.equal(h.studio.current().contentDay,day);h.studio.lessonDone(day);assert.equal(h.studio.missionDone(day),true);assert.equal(h.studio.current().step,3)}
});
check('production content-day and mission-entry preserve captured topic while route day remains scheduled',()=>{
 const contentSource=course.match(/const contentDay=\(\)=>[^\r\n]+/)[0],openSource=course.match(/^ function openPractice\([^\r\n]+/m)[0];
 for(const [day,topic] of [[22,19],[23,20],[24,7]]){
  const state={day,chapter:3,recovery:false,repairDay:2},calls=[];const c={state,studio:{current:()=>({day,contentDay:topic,step:2})},view:'home',stage:0,practiceKind:'menu',speech:{stop(){}},stopRecording(){},save(){},render(){},scrollTo(){},focusPractice(){},chapters:[{first:1,last:7},{first:8,last:14},{first:15,last:21},{first:22,last:30}],missions:{start:(...a)=>calls.push(a)}};vm.createContext(c);vm.runInContext(contentSource+'\n'+openSource+'\nopenPractice("mission",'+day+',{});',c);assert.equal(calls[0][0],topic);assert.equal(state.day,day);
 }
});
check('production completion passes actual content day into Studio, including recovery topics',()=>{const callback=course.match(/onComplete:result=>\{[^\r\n]+?else openPractice\('menu'\)\}/)[0].replace('onComplete:','');for(const [day,topic] of [[22,19],[23,20],[24,7],[1,1]]){const calls=[],c={state:{day},studio:{current:()=>({day,step:2}),missionDone:n=>calls.push(n)},contentDay:()=>topic,openPractice:()=>{throw Error('unexpected menu')}};vm.createContext(c);vm.runInContext('('+callback+')({completed:true,day:'+topic+'})',c);assert.deepEqual(calls,[topic])}});
const report={pass:true,checks:checks.length,allReviewDayMappings:30,allProductionControlDayMappings:30,checksPassed:checks};
fs.mkdirSync(path.join(base,'.impeccable/review-v28'),{recursive:true});fs.writeFileSync(path.join(base,'.impeccable/review-v28/studio-regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
