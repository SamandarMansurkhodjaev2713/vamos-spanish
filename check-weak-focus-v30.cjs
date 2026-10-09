/* Read-only day29 selection witnesses; not a learning-effect evaluation. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),plain=x=>JSON.parse(JSON.stringify(x));
const data={expanded:json('course-expanded.json')},source=read('web/weak-focus.js'),noop=()=>{},report={passed:false,checks:[]};
const attr=json('web/assets/audio/ATTRIBUTION.json'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function harness(state,custom=data){const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(source,ctx);const calls=[];const app=ctx.window.VamosWeakFocus.create({state,data:custom,esc,icon:()=>'',playButton:(id,label)=>`<button data-audio="${id}">${esc(label)}</button>`,startSet:keys=>calls.push(plain(keys))});return {app,calls};}
const button=day=>({dataset:{weakFocusReview:String(day)},hasAttribute:a=>a==='data-weak-focus-review'});
const early=new Map();for(const l of data.expanded.lessons)for(const p of l.examples)if(!early.has(p.audio))early.set(p.audio,{...p,day:l.day});
const p1=data.expanded.lessons[0].examples[1],p2=data.expanded.lessons[1].examples[0],p15=data.expanded.lessons[14].examples[0];
const metric=(misses=1,aided=0)=>({attempts:3,misses,aided,last:Date.now()-1000,recent:.3});
function check(name,fn){report.checks.push({name,...fn()});}
try{
 check('Actual adaptive first miss remains; aided success is not independent evidence',()=>{
  const state={day:29,completed:[],cards:{}},ctx={window:{},console};vm.createContext(ctx);vm.runInContext(read('web/adaptive.js'),ctx);const adaptive=ctx.window.VamosAdaptive.create({state,data,save:noop});
  const common={id:'independent-first',day:1,audio:p1.audio,skill:'recall'};adaptive.observe({...common,correct:false});adaptive.observe({...common,correct:true,aided:true});assert.equal(state.adaptive.phrases[p1.audio].attempts,1);assert.equal(state.adaptive.phrases[p1.audio].misses,1);
  adaptive.observe({...common,id:'later-with-help',correct:true,aided:true});assert.equal(state.adaptive.phrases[p1.audio].aided,1);assert.equal(state.adaptive.phrases[p1.audio].misses,1);
  adaptive.observe({...common,id:'later-independent',correct:true});assert.equal(state.adaptive.phrases[p1.audio].attempts,3);assert.equal(state.adaptive.phrases[p1.audio].misses,1);
  const before=plain(state),h=harness(state);assert(h.app.keys(29).includes('p:'+p1.audio));assert.match(h.app.html(29),/требовалась опора/);assert.deepEqual(plain(state),before);return {firstWrong:1,aided:1,laterIndependent:1};
 });
 check('At most2 unique original phrases; ES and human audio stay in closed support',()=>{
  const state={day:29,completed:[],cards:{},adaptive:{phrases:{[p1.audio]:metric(),[p2.audio]:metric(0,1),[p15.audio]:metric()}}},before=plain(state),h=harness(state),keys=plain(h.app.keys(29)),html=h.app.html(29);assert.equal(keys.length,2);assert.equal(new Set(keys).size,2);
  for(const key of keys){const p=early.get(key.slice(2));assert.equal(attr[p.audio].text,p.es);const start=html.indexOf('<details class="weak-focus-support"'),firstAudio=html.indexOf('data-audio');assert(start>=0&&firstAudio>start);assert(html.includes(esc(p.es)));assert(html.includes(esc(p.ru)));}
  assert(!html.includes('<details class="weak-focus-support" open'));assert.deepEqual(plain(state),before);return {selected:keys};
 });
 check('An unseen due card and optional fourth model cannot become a weakness',()=>{
  const fourth=data.expanded.lessons[0].examples[3],state={day:29,completed:[1],cards:{['p:'+p15.audio]:{due:Date.now()-1000},['p:'+fourth.audio]:{due:Date.now()-1000}},adaptive:{phrases:{}}},h=harness(state);assert(!h.app.keys(29).includes('p:'+p15.audio));assert(!h.app.keys(29).includes('p:'+fourth.audio));assert.match(h.app.html(29),/Обычная практика/);return {unseenExcluded:2};
 });
 check('Future source, malformed metric and duplicated captions do not enter selection',()=>{
  const future=plain(data),id=p15.audio;for(const l of future.expanded.lessons)l.examples=l.examples.filter(p=>p.audio!==id);future.expanded.lessons[29].examples.push(p15);
  const state={day:29,completed:[30],cards:{['p:'+id]:{due:Date.now()-1000}},adaptive:{phrases:{[id]:metric(),[p1.audio]:{...metric(),last:Date.now()+600000}}}},h=harness(state,future);assert.deepEqual(plain(h.app.keys(29)),[]);assert.match(h.app.html(29),/нет достаточных/);
  const dup=plain(data);dup.expanded.lessons[28].examples.push({...p1});const valid=harness({day:29,completed:[],cards:{},adaptive:{phrases:{[p1.audio]:metric()}}},dup);assert.deepEqual(plain(valid.app.keys(29)),['p:'+p1.audio]);return {futureExcluded:true,invalidExcluded:true,deduplicated:true};
 });
 check('Due known models use timing reason; fallback is ordinary practice, not a diagnosis',()=>{
  const due=harness({day:29,completed:[1],cards:{['p:'+p1.audio]:{due:Date.now()-1000}},adaptive:{phrases:{}}});assert.match(due.app.html(29),/подошло время повторения/);assert(!due.app.html(29).includes('Раньше ответ не совпадал'));
  const ordinary=harness({day:29,completed:[1],cards:{},adaptive:{phrases:{}}});assert.match(ordinary.app.html(29),/Обычная практика знакомой модели; слабость не установлена/);
  const empty=harness({day:29,completed:[],cards:{},adaptive:{phrases:{}}});assert.deepEqual(plain(empty.app.keys(29)),[]);assert.match(empty.app.html(29),/Сначала пройди урок/);return {timed:1,ordinary:true,emptyHonest:true};
 });
 check('Mission unknown does not mean bad Spanish or create a weak-phrase score',()=>{
  const state={day:29,completed:[1],cards:{},adaptive:{phrases:{}},missions:{history:[{day:13,responses:[{first:{text:'Otra frase natural.',status:'unknown',aids:[]}}]}]}},before=plain(state),h=harness(state);assert.match(h.app.html(29),/Обычная практика/);assert(!h.app.html(29).includes('Раньше ответ не совпадал'));assert.deepEqual(plain(state),before);return {unknownIgnored:true};
 });
 check('Disabled adaptive selection respects preference; card timing remains independent',()=>{
  const state={day:29,completed:[1],cards:{},adaptive:{enabled:false,phrases:{[p1.audio]:metric()}}},h=harness(state);assert.match(h.app.html(29),/Обычная практика/);assert(!h.app.html(29).includes('Раньше ответ не совпадал'));
  state.cards['p:'+p1.audio]={due:Date.now()-1000};assert.match(h.app.html(29),/подошло время повторения/);assert(!h.app.html(29).includes('Раньше ответ не совпадал'));return {preferenceRespected:true,cardTimingRetained:true};
 });
 check('Recovered historical mistakes are not called a current difficulty',()=>{
  const state={day:29,completed:[],cards:{},adaptive:{phrases:{[p1.audio]:{attempts:100,misses:1,aided:0,last:Date.now()-1000,recent:.99}}}},h=harness(state);assert.match(h.app.html(29),/Обычная практика/);assert(!h.app.html(29).includes('Раньше ответ не совпадал'));
  state.cards['p:'+p1.audio]={due:Date.now()-1000};assert.match(h.app.html(29),/подошло время повторения/);assert(!h.app.html(29).includes('Раньше ответ не совпадал'));return {sameThresholdAsAdaptivePlan:.35,dueStillEligible:true};
 });
 check('Only day29, stable bounded callback and unchanged own-step evidence',()=>{
  const state={day:29,completed:[],cards:{},adaptive:{phrases:{[p1.audio]:metric(),[p2.audio]:metric()}},studio:{active:{day:29,step:3,rating:'help',difficulty:'known issue'},history:[{day:1,step:4,rating:'independent'}]}},before=plain(state),h=harness(state);
  for(const day of [1,13,16,28,30,'29',null]){assert.equal(h.app.html(day),'');assert.deepEqual(plain(h.app.keys(day)),[]);}assert.equal(h.app.handleClick(button(28)),false);assert.equal(h.app.handleClick(button(29)),true);assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0],plain(h.app.keys(29)));assert.equal(h.calls[0].length,2);assert.deepEqual(plain(state),before);return {oneCallback:true,ownStep:3,stateUnchanged:true};
 });
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
fs.mkdirSync(path.join(root,'.impeccable/review-v30'),{recursive:true});fs.writeFileSync(path.join(root,'.impeccable/review-v30/weak-focus-results.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
