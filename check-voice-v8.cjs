const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),fs=require('fs');
(async()=>{const b=await chromium.launch(),c=await b.newContext(),p=await c.newPage(),errors=[],report={};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto('http://127.0.0.1:8768/');report.archive=await p.evaluate(async()=>{
  const notes=[],archive=VamosRecordings.create({esc:s=>String(s).replace(/</g,'&lt;'),icon:()=>'',footer:()=>'',render:()=>{},toast:s=>notes.push(s),active:()=>false});
  // Independent storage fixture, not a captured or graded learner recording.
  const blob=new Blob(['test-storage-fixture'],{type:'audio/webm'});for(let i=0;i<30&&!await archive.save(blob,{day:1,label:'Storage fixture'});i++)await new Promise(r=>setTimeout(r,20));
  const created=[];for(let i=0;i<7;i++)created.push(await archive.save(blob,{day:i+2,label:'Storage fixture '+i}));
  const ninth=await archive.save(blob,{day:9}),rapid=await Promise.all(Array.from({length:10},()=>archive.save(blob,{day:10}))),html=archive.html();
  const oversized=await archive.save(new Blob([new Uint8Array(8*1024*1024+1)]),{day:1}),empty=await archive.save(new Blob([]),{day:1});
  const ids=[...html.matchAll(/data-voice-compare="([^"]+)"/g)].map(m=>m[1]);for(const id of ids.slice(0,3))archive.click({dataset:{voiceCompare:id}});
  const pair=new DOMParser().parseFromString(archive.html(),'text/html').querySelectorAll('.voice-pair audio').length;
  return {created,ninth,rapid,saved:ids.length,pair,oversized,empty,notes};
 });assert(report.archive.created.every(Boolean));assert.equal(report.archive.saved,8);assert.equal(report.archive.ninth,false);assert(report.archive.rapid.every(x=>x===false));assert.equal(report.archive.pair,2);assert.equal(report.archive.oversized,false);assert.equal(report.archive.empty,false);
 const c2=await b.newContext();await c2.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('denied','SecurityError')}}));const p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));await p2.goto('http://127.0.0.1:8768/?view=practice&mode=recordings');assert((await p2.locator('.record-archive').textContent()).includes('Локальный архив недоступен'));assert(await p2.locator('[data-practice-open="pronunciation"]').isVisible());report.idbUnavailableFallback=true;
 const c3=await b.newContext();await c3.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError')}});const p3=await c3.newPage();p3.on('pageerror',e=>errors.push(e.message));await p3.goto('http://127.0.0.1:8768/?view=practice&mode=mission');await p3.fill('#mission-answer','Mi propio texto');await p3.locator('.mission-record summary').click();await p3.locator('[data-record]').click();await p3.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('Микрофон не разрешён'));assert.equal(await p3.locator('#mission-answer').inputValue(),'Mi propio texto');assert(await p3.locator('[data-mission-check]').isEnabled());report.micDeniedPreservesAnswer=true;
 assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;fs.writeFileSync('.impeccable/review-v8/voice-verification.json',JSON.stringify(report,null,2));console.log('PASS voice v8: eight-clip cap/concurrency/size/compare, unavailable IDB and denied mic preserve task');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
