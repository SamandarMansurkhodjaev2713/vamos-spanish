/* Isolated headless browser tests, never personal browser storage. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.VAMOS_BASE_URL||'http://127.0.0.1:8773/',out='.impeccable/review-v31';
const expanded=JSON.parse(fs.readFileSync('course-expanded.json','utf8'));
const plain=x=>x.toLowerCase().replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
const seed={welcomeSeen:true,motion:true,sounds:false,audioSpeed:.5,cards:{'p:437710':{due:123,interval:2,attempts:4}},completed:[],profile:{nickname:'QA'}};
const results=[];
(async()=>{fs.mkdirSync(out,{recursive:true});const b=await chromium.launch();try{
for(const width of [320,390,1440]){
 const ctx=await b.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:width===320?'reduce':'no-preference'});
 await ctx.addInitScript(seed=>{if(!localStorage.getItem('vamos-course-v2'))localStorage.setItem('vamos-course-v2',JSON.stringify({...seed,largeText:innerWidth===320}));},seed);
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'?view=lesson&day=1');await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('[role=progressbar]').getAttribute('aria-valuenow'),'0');assert.match(await p.locator('[role=progressbar]').getAttribute('aria-valuetext'),/Этап 1 из 7/);
 // Deliberately jump to the future model; it must not skip the first two.
 await p.locator('[data-intro-phrase="2"]').click();for(let i=0;i<3;i++)await p.locator('[data-advance]').click();
 assert.equal(await p.locator('.intro-cycle').count(),1);assert.match(await p.locator('.intro-slide').innerText(),/Hola/);
 let state=await p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.deepEqual(state.learning.sessions[1].introDone,[false,false,true]);
 assert(Number(await p.locator('[role=progressbar]').getAttribute('aria-valuenow'))>0);
 // Reload keeps the completed third model and all existing card evidence.
 await p.reload();assert.match(await p.locator('.intro-slide').innerText(),/Hola/);
 for(let i=0;i<3;i++)await p.locator('[data-advance]').click();
 assert.match(await p.locator('.intro-slide').innerText(),/Me llamo Andrea/);
 await p.locator('.phrase-coach>summary').click();assert.match(await p.locator('.phrase-coach').innerText(),/Me llamo[\s\S]*Учи эти два слова вместе/);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(width===390||width===1440){await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:out+'/phrase-coaching-'+width+'.png',fullPage:true,animations:'disabled'});}
 for(let i=0;i<2;i++)await p.locator('[data-advance]').click();
 assert.equal(await p.locator('.phrase-coach').count(),0,'No Spanish coaching leaks into closed recall');
 assert.equal(await p.locator('.intro-slide').count(),0);await p.locator('[data-intro-model]').click();assert.equal(await p.locator('.phrase-coach').count(),1);
 await p.locator('[data-intro-model]').click();await p.locator('[data-advance]').click();assert.equal(await p.locator('.intro-cycle').count(),0);
 assert.equal(await p.locator('[role=progressbar]').getAttribute('aria-valuenow'),'1');assert.match(await p.locator('.exercise-meta').innerText(),/Этап 2/);
 state=await p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.deepEqual(state.completed,[]);assert.deepEqual(state.cards['p:437710'],seed.cards['p:437710']);assert.deepEqual(state.learning.sessions[1].introDone,[true,true,true]);assert.deepEqual(errors,[]);
 results.push({width,sequenceGate:true,resume:true,coachingHiddenDuringRecall:true,existingCardsPreserved:true});await ctx.close();
}
for(const day of [1,4,7,10]){
 const e=expanded.lessons[day-1],model=e.examples.find(p=>plain(p.es)===plain(e.build))||e.examples[0],target=e.examples.slice(0,3).find(p=>p.audio!==model.audio&&p.audio!==e.examples[0].audio)||e.examples[2]||model;
 const oldSession={stage:5,introIndex:2,introCycles:[2,2,2],signature:'v14:'+day+':'+model.audio,draft:'',hadHelp:false,time:Date.now()};
 const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx.addInitScript(({seed,day,oldSession})=>localStorage.setItem('vamos-course-v2',JSON.stringify({...seed,day,learning:{sessions:{[day]:oldSession},order:'free'}})),{seed,day,oldSession});
 const p=await ctx.newPage();await p.goto(base+'?view=lesson&day='+day);assert.equal(await p.locator('#recall').count(),1,'Legacy session must not restart');
 await p.locator('#recall').fill('incorrect fixture');await p.locator('[data-advance]').click();assert.equal(await p.locator('.feedback.wrong').count(),1);assert.equal(await p.locator('[data-retry-recall]').count(),1);
 await p.locator('[data-retry-recall]').click();assert.equal(await p.locator('.feedback').count(),0);assert.equal(await p.locator('#recall').inputValue(),'');assert(await p.locator('#recall').evaluate(e=>e===document.activeElement));assert(await p.locator('[data-advance]').isDisabled());
 await p.locator('#recall').fill(target.es);await p.locator('[data-advance]').click();assert.equal(await p.locator('.feedback.wrong').count(),0);assert.equal(await p.locator('.feedback').count(),1);
 // Editing a checked answer hides its old feedback and relabels Continue as Check.
 await p.locator('#recall').fill('new attempt');assert.equal(await p.locator('.feedback').count(),0);assert.equal((await p.locator('[data-advance]').innerText()).trim(),'Проверить');
 const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(state.learning.sessions[day].stage,5);assert.equal(state.learning.sessions[day].hadHelp,true);assert.deepEqual(state.completed,[]);
 const observations=Object.values(state.adaptive.items||state.adaptive.evidence||{});results.push({day,legacyStagePreserved:true,retryHidesAnswer:true,typingClearsFeedback:true,helpRecorded:true});await ctx.close();
}
fs.writeFileSync(out+'/guided-browser.json',JSON.stringify({passed:true,flows:results.length,results},null,2));console.log('PASS '+results.length+' guided lesson flows: first-three gate, resume, real coaching, hidden recall, memory retry and legacy sessions.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
