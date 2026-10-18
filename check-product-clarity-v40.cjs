/* Actual mobile/desktop tasks. No physical-device or learner-outcome claim. */
const {chromium}=require('C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.VAMOS_BASE_URL||'http://127.0.0.1:8781/';
(async()=>{const browser=await chromium.launch(),rows=[];try{
 for(const width of [320,390,844,1440]){
  const height=width===844?390:900,ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  await ctx.addInitScript(()=>localStorage.setItem('vamos-course-v2',JSON.stringify({welcomeSeen:true,sounds:false,motion:false,day:4,completed:[1,2,3],largeText:innerWidth===320})));
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const[name,route]of [['today',''],['talk','?view=practice'],['words','?view=words'],['reading','?view=practice&mode=reader'],['profile','?view=profile']]){
   await p.goto(base+route);await p.evaluate(()=>document.fonts.ready);
   assert(await p.locator('main h1').first().isVisible(),name);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');
   if(name==='talk'){assert(await p.locator('.conversation-ready summary').isVisible());await p.locator('.conversation-ready summary').click();assert(await p.locator('.conversation-ready ul').isVisible());}
   if(name==='words'){
    await p.locator('[data-lib-today]').click();assert.equal(await p.locator('[data-lib-today]').getAttribute('aria-pressed'),'true');
    const dayItems=await p.evaluate(()=>VAMOS_DATA.library.items.filter(x=>x.day===4).map(x=>x.id));const shown=await p.locator('.library-grid [data-lib-open]').evaluateAll(es=>es.map(e=>e.dataset.libOpen));assert(shown.length>0);assert(shown.every(id=>dayItems.includes(id)));
    await p.locator('[data-lib-all-days]').first().click();assert.equal(await p.locator('[data-lib-all-days]').first().getAttribute('aria-pressed'),'true');
   }
   if(name==='reading'){
    assert.equal(await p.locator('#reader-level').isVisible(),false);assert(await p.locator('#reader-search').isVisible());
    const firstCard=await p.locator('.reader-book').first().boundingBox();rows.push({width,name,firstCardY:firstCard.y});
    await p.locator('[data-reader-browse]>summary').click();await p.locator('#reader-level').selectOption('A1');assert(await p.locator('[data-reader-browse]').evaluate(el=>el.open));assert.equal(await p.locator('#reader-level').inputValue(),'A1');await p.locator('#reader-level').selectOption('all');await p.locator('[data-reader-browse]>summary').click();assert.equal(await p.locator('#reader-level').isVisible(),false);
   }
   if(name==='profile'){assert.equal(await p.locator('#profile-course-progress').getAttribute('value'),'3');assert(await p.locator('.profile-empty').first().isVisible());await p.locator('[data-profile-tab="settings"]').click();assert(await p.locator('#profile-goal').isVisible());await p.locator('[data-profile-tab="overview"]').click();}
   fs.mkdirSync('.impeccable/review-v40',{recursive:true});await p.screenshot({path:'.impeccable/review-v40/after-'+name+'-'+width+'.png',animations:'disabled'});
   rows.push({width,height,name,overflow:false});
  }
  await p.goto(base+'?view=practice&mode=media&day=4');await p.evaluate(()=>document.fonts.ready);assert(await p.locator('.lesson-media').isVisible());
  assert.equal(await p.locator('.lesson-media progress').getAttribute('value'),'1');await p.locator('[data-media-next]').click();
  const question=await p.evaluate(()=>VAMOS_DATA.lessonMedia.units.find(u=>u.day===4).reading.questions[0]),wrong=(question.answer+1)%question.options.length;
  await p.locator('[data-media-answer="'+wrong+'"]').click();const before=await p.evaluate(()=>scrollY);await p.locator('[data-media-check]').click();
  assert(await p.locator('.media-answer-review').innerText().then(t=>t.includes(question.options[wrong])));assert.equal(await p.locator('.lesson-media progress').getAttribute('value'),'2');
  await p.locator('[data-media-answer="'+question.answer+'"]').click();await p.locator('[data-media-check]').click();await p.locator('[data-media-check]').click();assert.equal(await p.locator('.lesson-media progress').getAttribute('value'),'3');
  const evidence=await p.evaluate(id=>JSON.parse(localStorage.getItem('vamos-course-v2')).lessonMedia.rows[4].answers[id],question.id);assert.equal(evidence.correct,false);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')).completed),[1,2,3]);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);rows.push({width,name:'media',oneQuestion:true,firstErrorRetained:true});await ctx.close();
 }
 fs.writeFileSync('.impeccable/review-v40/product-clarity.json',JSON.stringify({pass:true,rows},null,2));console.log('PASS '+rows.length+' screen/task checks: all five sections, day vocabulary, reading filters, profile, media correction and preserved progress.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
