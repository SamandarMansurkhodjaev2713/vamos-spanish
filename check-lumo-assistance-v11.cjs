/* First-answer assistance is evidence, not a mutable cosmetic label. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('assert/strict'),fs=require('fs'),base=process.env.VAMOS_URL||'http://127.0.0.1:8768/',out='.impeccable/review-v11';
(async()=>{const browser=await chromium.launch(),report={checks:[],status:'RUNNING'},errors=[];
try{for(const kind of ['lesson','drill','mission','mastery','workbook'])for(const aided of [true,false]){
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>localStorage.getItem('vamos-course-v2')||localStorage.setItem('vamos-course-v2',JSON.stringify({day:1,motion:false,sounds:false,recovery:true,learning:{order:'free'}})));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('vamos-course-v2'))),help=async()=>{await p.locator('.lumo-launcher').click();await p.locator('.lumo-dialog[open]').waitFor();await p.keyboard.press('Escape');await p.locator('.lumo-dialog[open]').waitFor({state:'hidden'})};
await p.goto(base+(kind==='lesson'?'?view=lesson&day=1':'?view=practice&mode='+kind+'&day=1'));
const data=await p.evaluate(()=>VAMOS_DATA),e=data.expanded.lessons[0];let first;
if(kind==='lesson'){
await p.locator('[data-advance]').click();if(aided){await help();assert.equal((await read()).learning.sessions[1].hadHelp,true);await p.reload();assert.equal((await read()).learning.sessions[1].hadHelp,true)}
await p.locator('[data-option]').filter({hasText:e.examples[0].ru}).click();await p.locator('[data-advance]').click();first=(await read()).adaptive.skills['1:listening'];assert.equal(first.aided,aided?1:0);assert.equal(first.attempts,1);assert.equal(first.misses,0);if(!aided){await help();assert.deepEqual((await read()).adaptive.skills['1:listening'],first)}
}else if(kind==='drill'){
if(aided)await help();await p.fill('#drill-answer',e.examples[0].es);await p.locator('[data-drill-check]').click();first=(await read()).adaptive.skills['1:recall'];assert.equal(first.aided,aided?1:0);assert.equal(first.attempts,1);assert.equal(first.misses,0);if(!aided){await help();assert.deepEqual((await read()).adaptive.skills['1:recall'],first)}
}else if(kind==='mission'){
if(aided){await help();await p.reload();assert((await read()).missions.sessions.at(-1).responses[0].aids.includes('explanation'))}const current=(await read()).missions.sessions.at(-1),v=data.missions.days[0].variants.find(v=>v.id===current.variant);await p.fill('#mission-answer',v.turns[0].examples[0]);await p.locator('[data-mission-oral=typed]').check();await p.locator('[data-mission-check]').click();first=(await read()).missions.sessions.at(-1).responses[0].first;assert.equal(first.status,'supported');assert.equal(first.aids.includes('explanation'),aided);if(!aided){await help();assert.deepEqual((await read()).missions.sessions.at(-1).responses[0].first,first)}
}else if(kind==='mastery'){
await p.locator('[data-mastery-start]').click();if(aided)await help();const index=await p.evaluate(()=>VAMOS_DRILLS[0].index),pool=e.examples.filter((_,i)=>i!==index),answers=[pool[0].es,pool[1].es,e.examples[index].es];
for(let i=0;i<3;i++){await p.fill('#mastery-answer',answers[i]);await p.locator('[data-mastery-check]').click();if(i===0){first=(await read()).adaptive.skills['1:recall'];assert.equal(first.aided,aided?1:0);if(!aided){await help();assert.deepEqual((await read()).adaptive.skills['1:recall'],first)}}await p.locator('[data-mastery-next]').click()}
const result=(await read()).mastery[1];assert.equal(result.history.at(-1).aided,aided);assert.equal(result.history.at(-1).correct,3);assert.equal(result.firstAt===0,aided);
}else{
const t=data.stories.days[0].questions[0],key='1:story:'+t.id;if(aided){await help();await p.reload();assert.equal((await read()).workbook.days[1].drafts[key].aided,true)}await p.locator('[data-wb-choice="'+t.answer+'"]').click();await p.locator('[data-wb-check]').click();first=(await read()).workbook.days[1].answers[key].first;assert.equal(first.correct,true);assert.equal(first.aided,aided);if(!aided){await help();assert.deepEqual((await read()).workbook.days[1].answers[key].first,first)}
}
report.checks.push({kind,case:aided?'Lumo before first answer remains aided after close':'Lumo after first answer leaves original evidence immutable',reloadRetention:aided&&['lesson','mission','workbook'].includes(kind)});await context.close();
}assert.deepEqual(errors,[]);report.status='PASS';}catch(e){report.status='FAIL';report.error=e.stack;throw e}finally{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/lumo-assistance-checks.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
