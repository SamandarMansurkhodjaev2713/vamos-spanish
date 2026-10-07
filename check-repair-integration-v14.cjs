/* Local browser integration: real answers, contextual aid, persistence, bridge and backup. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const out='.impeccable/review-v14';fs.mkdirSync(out,{recursive:true});
const base=process.env.VAMOS_URL||'http://127.0.0.1:8768/';
(async()=>{
 const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await ctx.addInitScript(()=>{if(!localStorage.getItem('vamos-course-v2'))localStorage.setItem('vamos-course-v2',JSON.stringify({day:7,completed:[],sounds:false,motion:false,welcomeSeen:true}));});
  await page.goto(base+'?view=practice&day=7&mode=repair');await page.locator('.repair-page').waitFor();assert.equal(await page.evaluate(()=>VAMOS_DATA.version),'6.1-focused-learning');await page.locator('[data-rp-start]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')).repairPractice.active.focus),7);
  const responsive=[];
  async function capture(kind){for(const width of [320,390,1440]){await page.setViewportSize({width,height:width===1440?900:844});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${kind} overflow at ${width}`);await page.screenshot({path:`${out}/${kind}-${width}.png`,fullPage:true});const heading=await page.locator(kind==='repair-active'?'.repair-task h2':'.bridge-review summary').boundingBox();const barTop=await page.evaluate(()=>{const el=document.querySelector('.mobile-nav');return el&&getComputedStyle(el).display!=='none'?el.getBoundingClientRect().top:innerHeight;});assert.ok(heading.y+heading.height<barTop,`${kind} active prompt visible before bottom bar at ${width}`);responsive.push({kind,width,overflow,promptBottom:heading.y+heading.height,barTop});}await page.setViewportSize({width:390,height:844});}
  await capture('repair-active');
  for(let i=0;i<6;i++){
   const prompt=await page.locator('.repair-task h2').innerText(),t=await page.evaluate(prompt=>VAMOS_DATA.repair.lessons.flatMap(l=>l.tasks).find(t=>t.prompt===prompt),prompt);assert(t);
   if(t.kind==='choice')await page.locator(`[data-rp-choice="${t.answer}"]`).click();else await page.locator('#repair-answer').fill(t.accepted[0]);
   await page.locator('[data-rp-check]').click();await page.locator('[data-rp-next]').click();
  }
  assert.equal(await page.locator('[data-rp-start]').count(),1);let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(saved.repairPractice.sessions.length,1);assert.equal(saved.day,7);
  await page.reload();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')).repairPractice.sessions.length),1);
  await page.locator('[data-rp-start]').click();await page.locator('[data-lumo="open"]').first().click();await page.locator('[data-lumo="help"]').click();assert.match(await page.locator('.lumo-task-help').innerText(),/Андреа|Andrea/);await page.locator('[data-lumo="close"]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')).repairPractice.active.draft.aided),true);
  // The core day-7 intro stays compact and its actual Spanish appears above the fixed CTA.
  const introBounds=[];
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.goto(base+'?view=lesson&day=7');await page.locator('.intro-mentor').waitFor();assert.match(await page.locator('.exercise-meta').innerText(),/День 7/);const spanish=await page.locator('.intro-slide:not([hidden]) .spanish').boundingBox(),cta=await page.locator('#lesson-actions').boundingBox();assert.ok(spanish&&cta&&spanish.y+spanish.height<cta.y,`Primary Spanish visible before CTA at ${width}px`);introBounds.push({width,spanishBottom:spanish.y+spanish.height,ctaTop:cta.y});}
  await page.setViewportSize({width:390,height:844});
  // Leave lesson mode before seeding: its pagehide intentionally persists its live state.
  await page.goto(base+'?view=practice&day=7');await page.locator('[data-open-pathway]').waitFor();
  // Seed complete finite answer evidence from the current delivered catalogue, two days old.
  await page.evaluate(()=>{
   const stored=JSON.parse(localStorage.getItem('vamos-course-v2')),d=VAMOS_DATA.pathway.days[0],reading=VAMOS_DATA.pathway.readings.find(r=>r.id===d.readingId),time=Date.now()-2*86400000;
   stored.pathway.selectedDay=32;stored.pathway.days[31]={position:5,oral:{attempted:true,rating:1,note:''},answers:{},drafts:{}};
   for(const t of [...d.tasks,...reading.tasks.map(t=>({...t,id:'reading-'+t.id}))])stored.pathway.days[31].answers[t.id]={first:{value:t.kind==='choice'?t.answer:t.accepted[0],correct:true,aided:false,time},retries:[]};
   localStorage.setItem('vamos-course-v2',JSON.stringify(stored));
  });
  await page.goto(base+'?view=practice&day=7&mode=pathway&pathDay=32');await page.locator('.bridge-review').waitFor();assert.match(await page.locator('.bridge-review').innerText(),/дня 31/);
  await capture('bridge-due');
  await page.locator('[data-lumo="open"]').first().click();await page.locator('[data-lumo="help"]').click();assert.match(await page.locator('.lumo-task-help').innerText(),/фразу дня 31/);await page.locator('[data-lumo="listen"]').click();assert.match(await page.locator('.lumo-native').innerText(),/нет записи носителя/);await page.locator('[data-lumo="close"]').click();
  const aid=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(aid.bridgeReview[31].aided,true);assert.equal(aid.pathway.days[32].drafts.meaning.aided,false);
  const model=await page.evaluate(()=>VAMOS_DATA.pathway.days[0].model.es);await page.locator('#bridge-answer').fill(model);await page.locator('[data-bridge-check]').click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(saved.bridgeReview[31].first.correct,true);assert.equal(saved.bridgeReview[31].first.aided,true);assert.equal(saved.day,7);
  await page.goto(base+'?view=practice&day=7&mode=reading');assert.equal(await page.locator('.bridge-review').count(),0);
  // Transfer uses the public UI and actual module sanitizers; unrelated day stays untouched.
  const backup={format:'vamos-backup-v1',state:saved};await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vamos-course-v2'));delete s.repairPractice;delete s.bridgeReview;localStorage.setItem('vamos-course-v2',JSON.stringify(s));});
  await page.goto(base+'?view=profile');await page.locator('.profile-settings>summary').click();await page.getByText('Курс на другом устройстве',{exact:true}).click();await page.locator('#backup-file').setInputFiles({name:'repair-integration.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('[data-backup-apply]').click();const merged=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(merged.repairPractice.sessions.length,1);assert.equal(merged.bridgeReview[31].first.correct,true);assert.equal(merged.bridgeReview[31].first.aided,true);assert.equal(merged.day,7);assert.deepEqual(errors,[]);
  const report={passed:true,repairActualTasks:6,repairDay:7,persistence:true,lumoAid:true,bridgeContext:true,bridgeOnlyPathway:true,backup:true,introBounds,responsive,errors};fs.writeFileSync(`${out}/repair-integration.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
