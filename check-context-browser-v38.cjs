const {chromium}=require('C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const base=process.env.VAMOS_BASE_URL||'http://127.0.0.1:8780/',out='.impeccable/review-v38';
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch(),results=[];
try{for(const width of [320,390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{if(!localStorage.getItem('vamos-course-v2'))localStorage.setItem('vamos-course-v2',JSON.stringify({welcomeSeen:true,sounds:false,motion:false,audioSpeed:.5,completed:[1,2],day:4,studio:{active:{day:4,contentDay:4,step:2,mediaVersion:1,mediaCompleted:false,started:Date.now(),reviewKeys:[],reviewSkipped:true},history:[]}}));const Original=window.Audio;window.__voice=[];window.Audio=function(...args){const a=new Original(...args);window.__voice.push(a);return a;}});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'?view=practice&mode=media&day=4');await p.locator('.lesson-media').waitFor();
 await p.locator('[data-media-translation]').first().click();await p.locator('[data-media-next]').click();await p.locator('[data-media-answer="0"]').click();
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('[data-media-answer="0"]').evaluate(el=>el===document.activeElement),true);await p.reload();await p.locator('[data-media-answer]').first().waitFor();
 const lesson=await p.evaluate(()=>{const u=VAMOS_DATA.lessonMedia.units.find(x=>x.day===4),v=VAMOS_DATA.lessonMedia.resources.find(x=>x.id===u.videoResourceId);return {u,v}});
 for(const [i,q]of [...lesson.u.reading.questions,...lesson.v.questions].entries()){
  if(i===2){await p.locator('[data-media-load-video]').click();assert.equal(await p.locator('iframe').getAttribute('src'),'https://www.youtube-nocookie.com/embed/'+lesson.v.youtubeId);await p.screenshot({path:out+'/video-'+width+'.png'});await p.locator('[data-media-next]').click();}
  await p.locator('[data-media-answer="'+q.answer+'"]').click();await p.locator('[data-media-check]').click();await p.locator('[data-media-check]').click();
 }
 assert(await p.locator('[data-media-finish]').isDisabled());await p.locator('[data-media-transfer]').check();await p.locator('[data-media-finish]').click();await p.locator('.mission-turn').waitFor();
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));assert.equal(saved.studio.active.mediaCompleted,true);assert.equal(saved.studio.active.step,2);assert.equal(saved.lessonMedia.rows[4].done,true);assert.equal(saved.lessonMedia.rows[4].answers[lesson.u.reading.questions[0].id].aided,true);assert.deepEqual(saved.completed,[1,2]);assert.deepEqual(errors,[]);
 results.push({width,mediaCompleted:true,firstReadingAided:true});await ctx.close();
 }
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await ctx.addInitScript(()=>{localStorage.setItem('vamos-course-v2',JSON.stringify({welcomeSeen:true,motion:false,sounds:false,audioSpeed:.5}));const Original=window.Audio;window.__voice=[];window.Audio=function(...args){const a=new Original(...args);window.__voice.push(a);return a;}});
 const p=await ctx.newPage();await p.goto(base+'?view=words');await p.locator('.library-word-sound').first().click();await p.waitForTimeout(250);assert(await p.evaluate(()=>window.__voice.at(-1)?.src));await p.screenshot({path:out+'/dictionary-390.png'});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));results.push({dictionaryDirectAudio:true});await ctx.close();
 fs.writeFileSync(out+'/browser.json',JSON.stringify({pass:true,results},null,2));console.log('PASS context flows at 320/390/1440; dictionary direct audio. No full video-watch claim.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
