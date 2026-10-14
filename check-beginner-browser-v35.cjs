const {chromium}=require('C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync('course-reader-beginner.json','utf8')),base=process.env.VAMOS_BASE_URL||'http://127.0.0.1:8778/',out='.impeccable/review-v36';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();const results=[];try{
 for(const width of [320,390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await ctx.addInitScript(()=>{if(!localStorage.getItem('vamos-course-v2'))localStorage.setItem('vamos-course-v2',JSON.stringify({welcomeSeen:true,sounds:false,motion:false,audioSpeed:.5,largeText:innerWidth===320,completed:[1]}));const Original=window.Audio;window.__voice=[];window.Audio=function(...args){const a=new Original(...args);window.__voice.push(a);return a;};});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const b of data.books){
   await p.goto(base+'?view=practice&mode=reader&book='+encodeURIComponent(b.id));await p.evaluate(()=>document.fonts.ready);
   assert.equal(await p.locator('[data-reader-line]').count(),b.lines.length);assert.equal(await p.locator('[data-reader-line] [data-audio]').count(),b.lines.length);
   await p.locator('[data-reader-line="0"] [data-audio]').click();await p.waitForFunction(()=>window.__voice.some(a=>a.currentTime>0));assert.equal(await p.evaluate(()=>window.__voice.at(-1).playbackRate),.5);
   await p.locator('[data-reader-translation="0"]').click();assert.equal(await p.locator('[data-reader-line="0"] .reader-translation').innerText(),b.lines[0].ru);
   await p.locator('[data-reader-word]').first().click();assert((await p.locator('.reader-gloss').innerText()).length>20);await p.locator('[data-reader-gloss-close]').click();
   await p.locator('[data-reader-answer="'+b.task.answer+'"]').click();await p.locator('[data-reader-check]').click();assert(await p.locator('.reader-mini-practice').isVisible());
   await p.locator('.reader-mini-practice details>summary').first().click();assert(await p.locator('.reader-mini-practice details[open]').count());
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(b===data.books[0]||b===data.books.at(-1))await p.screenshot({path:out+'/beginner-task-'+b.level+'-'+width+'.png',fullPage:true,animations:'disabled'});
   const next=data.books[data.books.indexOf(b)+1];if(next){await p.locator('.reader-retell [data-reader-open]').click();assert.equal(await p.locator('[data-reader-book]').getAttribute('data-reader-book'),next.id);assert.match(await p.locator('.reader-heading').innerText(),new RegExp('Шаг '+(data.books.indexOf(b)+2)+' из 18'));}else assert.equal(await p.locator('.reader-retell [data-reader-open]').count(),0);
  }
  await p.locator('[data-reader-back]').click();await p.locator('[data-reader-beginner]').click();assert.equal(await p.locator('.reader-book').count(),8);
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/beginner-catalog-'+width+'.png',fullPage:true,animations:'disabled'});
  await p.reload();assert.equal(await p.locator('.reader-book').count(),8);assert.deepEqual(errors,[]);results.push({width,texts:data.books.length,voiceAtHalfSpeed:true,translations:true,glossary:true,tasks:true,reload:true,overflow:false});
  if(width===390){
   const decode=await p.evaluate(async clips=>{const ac=new AudioContext(),rows=[];for(const a of clips){const response=await fetch(a.file);if(!response.ok)throw Error(a.file);const raw=await response.arrayBuffer(),decoded=await ac.decodeAudioData(raw);if(!(decoded.duration>0))throw Error('decode');rows.push({file:a.file,duration:decoded.duration});}await ac.close();return rows;},Object.values(data.clips));fs.writeFileSync(out+'/decoded-human-media.json',JSON.stringify(decode,null,2));
   for(const full of ['A1-start','A1-grow','A2-start','A2-grow'].map(band=>data.books.filter(b=>b.progressionBand===band).at(-1))){await p.goto(base+'?view=practice&mode=reader&book='+encodeURIComponent(full.id));await p.evaluate(()=>{const Original=Audio;window.__ended=0;window.Audio=function(...args){const a=new Original(...args);a.addEventListener('ended',()=>window.__ended++);return a;};});await p.locator('[data-audio-speed]').first().selectOption('1.25');await p.locator('[data-reader-play]').click();await p.waitForFunction(n=>window.__ended===n,full.lines.length,{timeout:90000});assert.equal(await p.evaluate(()=>window.__voice.length),full.lines.length);}
  }
  await ctx.close();
 }
 const old=JSON.parse(require('node:child_process').execFileSync('git',['show','4d46784:course-reader-beginner.json'],{encoding:'utf8'})).books,migrated=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await migrated.addInitScript(books=>{const time=Date.now()-86400000,rows=Object.fromEntries(books.map(b=>[b.id,{visited:true,answer:b.task.answer,checked:true,readingMode:'read',attempts:[{value:b.task.answer,aided:true,time}]}]));localStorage.setItem('vamos-course-v2',JSON.stringify({welcomeSeen:true,motion:false,sounds:false,completed:[1,2],reader:{selected:null,lastBook:books.at(-1).id,rows}}));},old);
 const mp=await migrated.newPage();await mp.goto(base+'?view=practice&mode=reader');assert.equal(await mp.locator('.reader-first').getAttribute('data-reader-open'),data.books.find(b=>!old.some(o=>o.id===b.id)).id);await mp.locator('.reader-first').click();const kept=await mp.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.deepEqual(kept.completed,[1,2]);for(const b of old){assert.equal(kept.reader.rows[b.id].attempts.length,1);assert.equal(kept.reader.rows[b.id].attempts[0].value,b.task.answer);assert.equal(kept.reader.rows[b.id].attempts[0].aided,true);}await migrated.close();
 fs.writeFileSync(out+'/browser.json',JSON.stringify({pass:true,results,migration:true},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
