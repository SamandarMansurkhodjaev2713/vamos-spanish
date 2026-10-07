/* Behavioral UX regression: real controls and persisted evidence, no screenshots. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),fs=require('fs');
const base=process.env.VAMOS_URL||'http://127.0.0.1:8768/',out='.impeccable/review-v10';
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],started:new Date().toISOString()};
(async()=>{
 const browser=await chromium.launch(),contexts=[];
 const ok=label=>report.checks.push(label);
 const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));
 async function page(seed){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});contexts.push(context);
  await context.addInitScript(seed=>{
   window.__mediaCalls=0;window.__recognitionStarts=0;
   if(seed&&!sessionStorage.getItem('path-fixture')){localStorage.setItem('vamos-course-v2',JSON.stringify(seed));sessionStorage.setItem('path-fixture','1')}
   if(navigator.mediaDevices){const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{window.__mediaCalls++;return get(...args)}}
   const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(Recognition){const start=Recognition.prototype.start;Recognition.prototype.start=function(...args){window.__recognitionStarts++;return start.apply(this,args)}}
  },seed);
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base);await p.locator('.path-home').waitFor();return p;
 }
 function active(day,step){return {day,step,started:Date.now()-3000,reviewKeys:[],reviewSkipped:true,rating:null,difficulty:'',finished:null}}
 try{
  const p=await page(),initial=await state(p),data=await p.evaluate(()=>VAMOS_DATA);
  assert.equal(await p.locator('.today-panel [data-studio-begin]').count(),1);
  await p.locator('.today-panel [data-studio-begin]').click();
  assert.equal(new URL(p.url()).searchParams.get('view'),'lesson');assert.equal(new URL(p.url()).searchParams.get('day'),'1');
  assert.equal((await state(p)).studio.active.step,1);assert.equal((await state(p)).studio.active.reviewSkipped,true);
  assert.equal(await p.locator('.studio-session').count(),0);assert.deepEqual((await state(p)).completed,[]);
  assert.equal(await p.locator('.active-phrases .phrase').count(),3);
  ok('One fresh home action opens lesson 1 directly; empty review skipped, viewing earns no completion');
  const e=data.expanded.lessons[0],l=data.lessons[0],norm=s=>s.toLowerCase().replace(/[¿?¡!.,;:]/g,'').trim();
  const target=e.examples.find(x=>norm(x.es)===norm(e.build))||e.examples[0],advance=()=>p.locator('[data-advance]').click();
  await advance();await p.locator('[data-option]').filter({hasText:e.examples[0].ru}).first().click();await advance();await advance();
  await p.locator('[data-option="'+l.practice.quiz[0].answer+'"]').click();await advance();await advance();
  for(let i=0;i<target.es.split(/\s+/).length;i++)await p.locator('[data-token="'+i+'"]').click();await advance();await advance();
  const word=target.es.split(/\s+/)[1].replace(/[.,!?¿¡]/g,'');await p.locator('[data-option]').filter({hasText:word}).first().click();await advance();await advance();
  await p.fill('#recall',target.es);await advance();await advance();
  assert.equal((await p.locator('[data-advance]').textContent()).trim(),'Завершить урок');assert(await p.locator('[data-advance]').isDisabled());
  await p.locator('[data-rating="independent"]').click();await advance();
  let s=await state(p);assert.deepEqual(s.completed,[1]);assert.equal(s.studio.active.step,2);assert.equal(s.studio.history.length,0);
  assert((await p.locator('.guided-finish h1').textContent()).includes('Урок выполнен'));
  assert.equal(await p.locator('.guided-finish > .btn.primary').count(),1);assert.equal(await p.locator('.guided-finish [data-studio-resume]').count(),1);
  assert(!(await p.locator('.guided-finish').textContent()).includes('Занятие на сегодня завершено'));
  ok('Six practice stages complete only the lesson; one primary continuation leads to conversation');
  await p.locator('.guided-finish [data-studio-resume]').click();
  assert.equal(new URL(p.url()).searchParams.get('mode'),'mission');assert.equal(new URL(p.url()).searchParams.get('day'),'1');
  const mission=data.missions.days[0].variants.find(v=>v.mode==='train');
  for(const turn of mission.turns){await p.fill('#mission-answer',turn.examples[0]);await p.locator('[data-mission-oral="independent"]').check();await p.locator('[data-mission-check]').click();await p.locator('[data-mission-next]').click()}
  assert.equal((await state(p)).studio.active.step,2);assert.equal((await state(p)).studio.history.length,0);
  await p.locator('[data-mission-finish]').click();assert.equal((await state(p)).studio.active.step,3);
  assert(await p.locator('[data-studio-finish]').isDisabled());assert.equal((await state(p)).studio.history.length,0);
  await p.locator('[data-studio-rating="help"]').click();await p.fill('#session-difficulty','Встречный вопрос без текста');await p.locator('[data-studio-finish]').click();
  s=await state(p);assert.equal(s.studio.active.step,4);assert.equal(s.studio.history.length,1);assert.equal(s.studio.history[0].rating,'help');
  assert.equal(s.studio.history[0].difficulty,'Встречный вопрос без текста');assert(s.studio.history[0].finished<=Date.now());
  assert((await p.locator('.session-complete h1').textContent()).includes('Занятие на сегодня завершено'));
  await p.reload();assert.equal((await state(p)).studio.history.length,1);
  ok('Daily completion waits for mission and explicit oral self-rating; history persists without duplication');
  assert.equal(await p.evaluate(()=>window.__mediaCalls),0);assert.equal(await p.evaluate(()=>window.__recognitionStarts),0);
  ok('Whole daily journey makes zero microphone or speech-recognition requests without explicit recording');

  const saved=structuredClone(initial),day=8,model=data.expanded.lessons[day-1],savedTarget=model.examples.find(x=>norm(x.es)===norm(model.build))||model.examples[0];
  saved.day=22;saved.chapter=3;saved.learning.sessions={8:{stage:5,time:Date.now()-1000,signature:'8:'+savedTarget.audio,draft:'Mi borrador guardado',tokens:[],selected:null,rating:null,hadHelp:false}};
  const q=await page(saved);assert((await q.locator('.today-meta').textContent()).includes('День 8'));assert((await q.locator('.today-status').textContent()).includes('сохранён'));
  await q.locator('.today-panel [data-studio-begin]').click();assert.equal((await state(q)).studio.active.day,8);assert.equal(await q.locator('#recall').inputValue(),'Mi borrador guardado');
  await q.reload();assert.equal(await q.locator('#recall').inputValue(),'Mi borrador guardado');
  ok('Home starts the newest saved lesson day, restoring stage and typed draft across reload');
  const r=await page(saved);await r.locator('.topbar [data-menu-open]').click();await r.locator('[data-menu-lesson]').click();
  assert.equal((await state(r)).studio.active.day,8);assert.equal(await r.locator('#recall').inputValue(),'Mi borrador guardado');
  ok('Burger-menu primary matches the home action for a saved lesson rather than restarting day 1');

  const conversation=structuredClone(initial);conversation.day=19;conversation.chapter=2;conversation.studio.active=active(3,2);
  for(const entry of ['home','menu']){const t=await page(conversation);assert((await t.locator('.today-meta').textContent()).includes('День 3'));
   if(entry==='home')await t.locator('.today-panel [data-studio-begin]').click();else{await t.locator('.topbar [data-menu-open]').click();await t.locator('[data-menu-lesson]').click()}
   assert.equal(new URL(t.url()).searchParams.get('mode'),'mission');assert.equal(new URL(t.url()).searchParams.get('day'),'3');assert.equal((await state(t)).day,3);assert.equal((await state(t)).studio.active.step,2);
   await t.locator('.section-trail [data-nav="practice"]').click();assert.equal(await t.locator('.practice-hub').count(),1);
   await t.goBack();assert.equal(new URL(t.url()).searchParams.get('mode'),'mission');assert.equal((await state(t)).day,3);
  }
  ok('Home and burger both resume the active conversation day; contextual back and browser back preserve it');
  const reflect=structuredClone(initial);reflect.day=24;reflect.chapter=3;reflect.studio.active=active(4,3);
  const t=await page(reflect);await t.locator('.today-panel [data-studio-begin]').click();assert.equal((await state(t)).day,4);
  assert.equal(new URL(t.url()).searchParams.get('day'),'4');assert.equal(await t.locator('[data-studio-finish]').count(),1);assert(await t.locator('[data-studio-finish]').isDisabled());
  await t.goto(base+'?view=practice&mode=daily&day=21');assert.equal((await state(t)).day,4);assert.equal(new URL(t.url()).searchParams.get('day'),'4');
  ok('Own-answer continuation and a conflicting daily deep link restore the active day 4');

  const hub=await page(initial);await hub.goto(base+'?view=practice');await hub.locator('.practice-hub').waitFor();
  assert.equal(await hub.locator('.hub-options > details').count(),3);assert.equal(await hub.locator('.hub-primary [data-studio-begin]').count(),1);
  const selectors=['[data-review-start]','[data-practice-open="drill"]','[data-practice-open="mastery"]','[data-practice-open="mission"]','[data-practice-open="pronunciation"]','[data-practice="scene"]','[data-practice="sound"]','[data-practice="dialogue"]','[data-practice-open="workbook"]','[data-practice-open="personal"]','[data-practice-open="recordings"]','[data-practice="extra"]'];
  for(const selector of selectors){const button=hub.locator('.hub-options '+selector);assert.equal(await button.count(),1);await button.evaluate(el=>el.closest('details').open=true);assert(await button.isVisible());await button.click();assert.notEqual(new URL(hub.url()).searchParams.get('mode'),null);assert.equal(await hub.locator('.section-trail [data-nav="practice"]').count(),1);await hub.locator('.section-trail [data-nav="practice"]').click();await hub.locator('.practice-hub').waitFor()}
  assert.equal(await hub.evaluate(()=>window.__mediaCalls),0);assert.equal(await hub.evaluate(()=>window.__recognitionStarts),0);
  ok('Three intent groups expose all 12 preserved practices; every mode has a functional return without auto microphone');
  const route=await page(initial);await route.locator('[data-chapter-nav="2"]').click();assert.equal((await state(route)).chapter,2);
  assert.equal(await route.locator('[data-chapter-nav="2"]').getAttribute('aria-pressed'),'true');assert.equal(await route.locator('.lesson-map [data-day="15"]').count(),1);
  await route.locator('.lesson-map [data-day="15"]').click();assert.equal(await route.locator('.day-preview [data-day-force="15"]').count(),1);assert.deepEqual((await state(route)).completed,[]);
  await route.locator('[data-preview-close]').click();await route.locator('[data-route-view="calendar"]').click();assert.equal(await route.locator('.day-calendar [data-day]').count(),30);
  await route.locator('.day-calendar [data-day="30"]').click();await route.locator('[data-day-force="30"]').click();assert.equal(new URL(route.url()).searchParams.get('day'),'30');assert.deepEqual((await state(route)).completed,[]);
  await route.goto(base);assert.equal(await route.locator('[data-route-view="calendar"]').getAttribute('aria-pressed'),'true');assert.equal(await route.locator('.path-count').textContent(),'0 из 30 выполнено');
  ok('Chapter pills, all-30 calendar and preview/force remain usable; preview and opening a future day never claim completion');
  await route.goto(base+'?view=lesson&day=12');assert.equal((await state(route)).day,12);assert.equal(new URL(route.url()).searchParams.get('day'),'12');await route.reload();assert.equal((await state(route)).day,12);
  ok('Direct lesson route retains the selected day through reload');
  assert.deepEqual(report.errors,[]);report.passed=true;console.log('PASS path v10:',report.checks.length,'behavioral journey checks');
 }finally{report.finished=new Date().toISOString();fs.writeFileSync(out+'/path-behavior.json',JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
