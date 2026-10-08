/* Actual route integration: previews preserve evidence; effective-topic missions finish logical days. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.VAMOS_URL||'http://127.0.0.1:8768/';
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],report={passed:false,previewDays:[],navigation:[],resources:[],missions:[],futurePreservesActive:false};
 async function fixture(day=7,recovery=true,step=2){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(({day,recovery,step})=>{if(!localStorage.getItem('vamos-course-v2')){const started=Date.now()-60000;localStorage.setItem('vamos-course-v2',JSON.stringify({day,recovery,repairDay:3,completed:Array.from({length:day-1},(_,i)=>i+1),sounds:false,motion:false,welcomeSeen:true,learning:{order:'free',events:[],sessions:{[day]:{stage:3,hadHelp:false,time:started,signature:'preserved-preview',draft:'saved draft',tokens:[0]}}},studio:{profile:{},history:[],active:{day,started,step,reviewKeys:[],reviewSkipped:true,rating:null,difficulty:'saved difficulty',finished:null}}}));}},{day,recovery,step});
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return {ctx,p};
 }
 const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2')));
 const evidence=p=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('vamos-course-v2'));return {day:s.day,completed:s.completed,active:s.studio.active,studioHistory:s.studio.history,learning:s.learning,missions:s.missions,mastery:s.mastery,workbook:s.workbook,repair:s.repairPractice,bridge:s.bridgeReview};});
 try{
  const {ctx,p}=await fixture();await p.goto(base+'?view=plan&planDay=1');await p.locator('.day-compass').waitFor();const untouched=await evidence(p);
  for(let day=1;day<=30;day++){
   await p.goto(base+`?view=plan&planDay=${day}`);await p.locator('.day-compass h1').waitFor();assert.equal(new URL(p.url()).searchParams.get('planDay'),String(day));assert.deepEqual(await evidence(p),untouched,`Plan ${day} must not mutate core/session/evidence`);assert.equal(await p.locator('.day-compass [data-compass-action="begin"]').getAttribute('data-compass-day'),String(day));report.previewDays.push(day);
  }
  await p.goto(base+'?view=plan&planDay=7');await p.locator('.day-compass [data-day-plan="8"]').click();assert.equal(new URL(p.url()).searchParams.get('planDay'),'8');await p.locator('.day-compass [data-day-plan="7"]').click();assert.equal(new URL(p.url()).searchParams.get('planDay'),'7');assert.deepEqual(await evidence(p),untouched);report.navigation.push('previous/next preserve evidence');
  await p.locator('.compass-home').click();await p.locator('[data-chapter-nav="2"]').click();await p.locator('.focus-topic[data-day-plan="18"]').click();assert.equal(new URL(p.url()).searchParams.get('planDay'),'18');assert.equal((await state(p)).day,7);assert.deepEqual((await state(p)).studio.active,untouched.active);report.navigation.push('home chapter → day18 preview');
  await p.goto(base+'?view=plan&planDay=30');assert.match(await p.locator('[data-compass-action="begin"]').innerText(),/Открыть выбранный урок/);await p.locator('[data-compass-action="begin"]').click();await p.locator('.exercise').waitFor();const future=await state(p);assert.equal(future.day,30);assert.deepEqual(future.studio.active,untouched.active);assert.deepEqual(future.completed,untouched.completed);assert.deepEqual(future.learning.sessions[7],untouched.learning.sessions[7]);report.futurePreservesActive=true;await ctx.close();
  // Explicit materials target the effective source while previews themselves remain read-only.
  for(const [logical,content]of [[22,19],[23,20],[24,3]]){
   const {ctx,p}=await fixture(logical,true);await p.goto(base+`?view=plan&planDay=${logical}`);
   for(const action of ['words','story','review','speech']){
    await p.goto(base+`?view=plan&planDay=${logical}`);await p.locator('.compass-materials>summary').click();await p.locator(`[data-compass-action="${action}"]`).click();
    if(action==='words')assert.equal(new URL(p.url()).searchParams.get('wordDay'),String(content));
    if(action==='story'){await p.locator('.workbook-page').waitFor();assert.equal((await state(p)).day,content);assert.equal(await p.locator('#workbook-day').inputValue(),String(content));}
    if(action==='review'){await p.locator('.repair-page').waitFor();assert.equal((await state(p)).repairPractice.selectedDay,content);}
    if(action==='speech'){await p.locator('.speech-lab').waitFor();const audio=await p.locator('.native-model').getAttribute('data-line-audio'),expected=await p.evaluate(day=>VAMOS_DATA.expanded.lessons[day-1].examples[0].audio,content);assert.equal(audio,expected);}
    report.resources.push({logical,content,action});
   }
   await ctx.close();
  }
  // Complete real finite mission responses, including the selected branch's replacement turn.
  for(const [logical,content,recovery]of [[22,19,true],[23,20,true],[13,13,false],[30,30,false]]){
   const {ctx,p}=await fixture(logical,recovery);await p.goto(base+`?view=plan&planDay=${logical}`);await p.locator('.compass-materials>summary').click();await p.locator('[data-compass-action="mission"]').click();await p.locator('.mission-turn').waitFor();assert.equal((await state(p)).day,logical);
   let answers=0;
   while(await p.locator('.mission-turn').count()){
    assert.ok(++answers<=5,'Finite mission turn boundary');
    const response=await p.evaluate(content=>{const s=JSON.parse(localStorage.getItem('vamos-course-v2')).missions.sessions.findLast(s=>s.day===content),v=VAMOS_DATA.missions.days.find(d=>d.day===content).variants.find(v=>v.id===s.variant);let t=v.turns[s.step];for(let i=0;i<s.step;i++){const b=v.turns[i].branch,r=s.responses[i],intent=r?.first?.intent||r?.branchIntent;if(b&&b[intent]?.next===s.step)t=b[intent].turn;}return {day:s.day,text:t.rule.forms[0]};},content);
    assert.equal(response.day,content);await p.locator('#mission-answer').fill(response.text);await p.locator('[data-mission-oral="typed"]').check();await p.locator('[data-mission-check]').click();assert.equal(await p.locator('.mission-feedback').getAttribute('data-result'),'supported');await p.locator('[data-mission-next]').click();
   }
   await p.locator('[data-mission-finish]').click();await p.locator('.studio-session').waitFor();const final=await state(p);assert.equal(final.day,logical);assert.equal(final.studio.active.day,logical);assert.equal(final.studio.active.step,3);assert.ok(final.missions.history.some(h=>h.day===content&&h.responses.length===answers&&h.responses.every(r=>r.first?.status==='supported')));assert.ok(!final.completed.includes(logical));report.missions.push({logical,content,answers,studioStep:3});await ctx.close();
  }
  assert.deepEqual(errors,[]);report.passed=true;report.errors=errors;fs.mkdirSync('.impeccable/review-v17',{recursive:true});fs.writeFileSync('.impeccable/review-v17/day-compass-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
