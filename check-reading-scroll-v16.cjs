// Bounded live-browser regression: in-place reading operations retain their visual anchor and focus.
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const data=require('./pathway-data.json');
const fs=require('node:fs');
const base=process.env.VAMOS_QA_URL||'http://127.0.0.1:8768';
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const baseline=[];
 try{for(const width of [390,1440]){
  // Reproduce the previous redraw implementation in the live app without changing published files.
  const legacy=await browser.newContext({viewport:{width,height:700},serviceWorkers:'block'});
  await legacy.addInitScript(()=>localStorage.setItem('vamos-course-v2',JSON.stringify({day:7,welcomeSeen:true,sounds:false,motion:false})));
  await legacy.route('**/workbook.js',route=>{
   const source=fs.readFileSync('./web/workbook.js','utf8');
   const start=source.indexOf(' function redraw('),end=source.indexOf(' function enter(',start);
   assert.ok(start>=0&&end>start);
   return route.fulfill({contentType:'text/javascript',body:source.slice(0,start)+' function redraw(selector){render();if(selector)document.querySelector(selector)?.focus({preventScroll:true});}\n'+source.slice(end)});
  });
  const old=await legacy.newPage();await old.goto(base+'/?view=practice&day=7&mode=workbook');
  await old.locator('.workbook-after summary').click();
  await old.locator('[data-wb-save]').evaluate(e=>e.scrollIntoView({block:'center'}));
  const oldY=await old.evaluate(()=>scrollY);await old.locator('[data-wb-save]').click();
  const broken=await old.evaluate(()=>({y:scrollY,open:document.querySelector('.workbook-after').open,focused:document.activeElement?.hasAttribute('data-wb-save')}));
  assert.equal(broken.open,false,'Legacy baseline must reproduce the collapsed reading block');
  baseline.push({width,before:oldY,after:broken.y,collapsed:true});await legacy.close();
  const context=await browser.newContext({viewport:{width,height:700},serviceWorkers:'block'});
  await context.addInitScript(()=>!localStorage.getItem('vamos-course-v2')&&localStorage.setItem('vamos-course-v2',JSON.stringify({day:7,welcomeSeen:true,sounds:false,motion:false,pathway:{selectedReading:'c1-memory'}})));
  const page=await context.newPage();
  await page.goto(base+'/?view=practice&mode=reading&book=c1-memory');
  async function anchored(selector,action,after=selector){
   const loc=page.locator(selector).first();await loc.evaluate(e=>e.scrollIntoView({block:'center'}));
   const before=await loc.evaluate(e=>({top:e.getBoundingClientRect().top,y:scrollY}));
   await (action?action(loc):loc.click());
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const target=page.locator(after).first();
   const result=await target.evaluate(e=>({top:e.getBoundingClientRect().top,y:scrollY,focused:document.activeElement===e}));
   // At the bottom of a document the browser must clamp scroll; compare anchors where scrolling is possible.
   const clamped=await page.evaluate(()=>scrollY===0||Math.abs(scrollY+innerHeight-document.documentElement.scrollHeight)<2);
   if(!clamped)assert.ok(Math.abs(result.top-before.top)<3,`${width} ${selector}: anchor moved ${result.top-before.top} before=${JSON.stringify(before)} after=${JSON.stringify(result)}`);
   assert.ok(result.focused,`${width} ${selector}: lost keyboard focus`);
   results.push({width,selector,drift:Math.round(result.top-before.top),clamped});
  }
  await anchored('[data-pw-gloss]');
  await anchored('[data-pw-save-word]');
  await anchored('[data-pw-translation]');await anchored('[data-pw-translation]');
  await anchored('[data-pw-choice="0"]');await anchored('[data-pw-help]');await anchored('[data-pw-help]');
  await anchored('[data-pw-check]');
  await anchored('[data-pw-choice="1"]');await anchored('[data-pw-check]');
  let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));
  const first=stored.pathway.readings['c1-memory'].answers.meaning.first;
  assert.equal(first.correct,false);assert.equal(first.aided,true);
  await page.locator('[data-pw-next]').click();
  assert.match(await page.locator(':focus').textContent(),/Воспроизведи/);
  await anchored('[data-pw-text]');await anchored('[data-pw-text]');
  const recall=data.readings.find(x=>x.id==='c1-memory').tasks[1].accepted[0];
  await page.locator('#pathway-answer').fill(recall);
  await anchored('[data-pw-help]');await anchored('[data-pw-help]');await anchored('[data-pw-check]');
  const word=data.readings.find(x=>x.id==='c1-memory').glossary[0].es;
  await page.locator('#pathway-word-answer').fill(word);
  await anchored('[data-pw-word-help]');await anchored('[data-pw-word-help]');await anchored('[data-pw-word-check]');
  await anchored('#pathway-word-rating',loc=>loc.selectOption('1'));
  await anchored('#pathway-word-review',loc=>loc.selectOption({index:0}));
  await page.reload();
  stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));
  assert.deepEqual(stored.pathway.readings['c1-memory'].answers.meaning.first,first);
  assert.equal(stored.pathway.readings['c1-memory'].answers.recall.first.aided,true);
  assert.ok(Object.values(stored.pathway.words)[0].due>0);
  await page.goto(base+'/?view=practice&day=7&mode=workbook');
  await anchored('[data-workbook-translation]');await anchored('[data-workbook-translation]');
  await page.locator('.workbook-after summary').click();
  await anchored('[data-wb-save]');
  assert.equal(await page.locator('.workbook-after').evaluate(e=>e.open),true);
  await anchored('[data-wb-choice="0"]');await anchored('[data-wb-help]');await anchored('[data-wb-help]');await anchored('[data-wb-check]');
  await anchored('[data-wb-choice="1"]');await anchored('[data-wb-check]',null,'[data-wb-next]');
  await page.locator('[data-wb-next]').click();
  assert.equal(await page.locator('#workbook-task-title').evaluate(e=>document.activeElement===e),true);
  assert.ok(await page.locator('#workbook-task-title').evaluate(e=>e.getBoundingClientRect().top>=0&&e.getBoundingClientRect().top<innerHeight));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: horizontal overflow`);
  await context.close();
 }}finally{await browser.close();}
 console.log(JSON.stringify({status:'PASS',legacyBaseline:baseline,cases:results.length,maxAnchorDrift:Math.max(...results.map(x=>Math.abs(x.drift))),focusRetained:true,immutableEvidenceAndStickyHelp:true,widths:[390,1440]},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
