const assert=require('node:assert/strict');
global.window={};require('./web/course-data.js');require('./web/drills.js');require('./web/profile.js');
const data=window.VAMOS_DATA,now=Date.now(),DAY=86400000;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const make=(state={})=>{const calls=[];const p=window.VamosProfile.create({state,data,esc,save:()=>calls.push('save'),openPractice:(...x)=>calls.push(x),openWords:d=>calls.push(['words',d]),openProfile:()=>calls.push('profile'),openLesson:d=>calls.push(['lesson',d]),settingsHTML:()=>'<div id="real-settings">Settings</div>'});return {p,state,calls}};
const button=(action,day)=>({hasAttribute:k=>k==='data-profile-action',dataset:{profileAction:action,profileDay:day}});
// Pass 1: Empty and malformed state must not award progress or invent an account.
let {p,state}=make({completed:[1,1,31,-1,'2'],profile:{nickname:42,pace:500,goal:'admin'},learning:{events:[null,{id:'future',kind:'answer',day:1,time:now+DAY}]},mastery:{1:{retainedAt:now}},missions:{history:[{completedAt:now}]},workbook:{days:{1:{saved:true}}}});
assert.equal(p.evidence().completed.length,1);assert.equal(p.evidence().events.length,0);assert.equal(p.evidence().retained.length,0);assert.equal(p.evidence().missions.length,0);assert.equal(p.evidence().stories,0);assert.equal(state.profile.pace,30);assert(!p.html().includes('XP'));assert(p.html().includes('на этом устройстве'));assert(p.html().includes('real-settings'));
// Pass 2: Narrow phrase evidence requires two real matching histories and the full pause.
const examples=data.expanded.lessons[0].examples,idx=window.VAMOS_DRILLS[0].index,pool=examples.filter((_,i)=>i!==idx),modelSet=[pool[0].audio,pool[1].audio,examples[idx].audio].join(':'),firstAt=now-2*DAY;
const entry=(at,more={})=>({at,correct:3,aided:false,contentDay:1,modelSet,...more});
const mastery={1:{firstAt,retainedAt:now,history:[entry(firstAt),entry(now)]},2:{firstAt,retainedAt:firstAt+DAY-1,history:[entry(firstAt),entry(firstAt+DAY-1)]},3:{firstAt,retainedAt:now,history:[entry(firstAt),entry(now,{aided:true})]},4:{firstAt,retainedAt:now,history:[entry(firstAt),entry(now,{modelSet:'forged'})]}};
({p}=make({mastery}));assert.deepEqual(p.evidence().retained,[1]);assert.deepEqual(p.evidence().initial,[1,2,3,4]);
// Pass 3: Activity is unique; speech is self-report; a complete story needs task results.
const v=data.missions.days[0].variants[0];const m={id:'m-123-abc',day:1,variant:v.id,startedAt:now-5000,completedAt:now,responses:v.turns.map((t,i)=>({first:{at:now-4000+i,text:'Hola',oral:i?'typed':'independent'}}))};const story=data.stories.days[0],answers={};for(const t of story.questions)answers[`1:story:${t.id}`]={first:{time:now,correct:true,aided:false},retries:[]};
({p}=make({learning:{events:[{id:'a',kind:'speech',time:now,day:1},{id:'a',kind:'speech',time:now,day:1}]},missions:{history:[m,m]},workbook:{days:{1:{answers}}}}));let e=p.evidence();assert.equal(e.events.length,1);assert.equal(e.missions.length,1);assert.equal(e.independentSpeech,1);assert.equal(e.stories,1);assert.equal(e.firstCorrect,story.questions.length);assert(p.html().includes('без автоматической оценки звучания'));
// Pass 4: Local privacy, escaping and settings changes use only provided callbacks.
let q=make({profile:{nickname:'<img src=x onerror=1>'}});assert(!q.p.html().includes('<img src=x'));assert(q.p.html().includes('&lt;img'));q.p.input({id:'profile-nickname',value:'  Мария\u0000  '});assert.equal(q.state.profile.nickname,'Мария');q.p.change({id:'profile-pace',value:'90'});assert.equal(q.state.profile.pace,90);q.p.change({dataset:{profileToggle:'showLumo'},checked:false});assert.equal(q.state.profile.showLumo,false);assert(!q.p.homeWidget().includes('profile-lumo'));
// Pass 5: Daily actions explicitly select the topic and reuse the native review scheduler.
q=make();for(const action of ['words','mission','workbook','mastery','lesson'])assert(q.p.click(button(action,'4')));q.p.click(button('review'));q.p.click(button('profile'));assert.deepEqual(q.calls,[['words',4],['mission',4],['workbook',4],['mastery',4],['lesson',4],['review'],'profile']);const home=q.p.homeWidget();assert(home.includes('Сегодня в испанском'));assert(home.includes('Видео на сегодня'));assert(home.includes('Короткое повторение'));assert(home.includes('rel="noopener noreferrer"'));assert(home.includes('полный звук и таймкоды не проверены'));assert(!home.includes('data-review-rating'));
console.log('Profile v13: five focused passes passed (schema, delayed evidence, workload/self-report, local privacy, daily navigation).');
if(process.argv.includes('--layout'))(async()=>{
 const fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch(),page=await browser.newPage();
 const css=['course-foundation.css','course-v3.css','course-v10.css','course-v11.css','adult.css','profile.css'].map(f=>fs.readFileSync('web/'+f,'utf8')).join('\n');
 const fixture=make({profile:{nickname:'Очень длинное имя для проверки'}}).p;
 for(const theme of ['light','dark'])for(const width of [1440,775,390,320]){
  await page.setViewportSize({width,height:900});await page.setContent(`<html data-theme="${theme}"><head><style>${css}</style></head><body><main>${fixture.homeWidget()}${fixture.html()}</main></body></html>`);
  const issues=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,escaped:[...document.querySelectorAll('button,input,select,h1,h2,dd')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left<-.6||r.right>innerWidth+.6}).map(el=>el.outerHTML.slice(0,120))}));
  assert(!issues.overflow&&!issues.escaped.length,`${theme} ${width}: ${JSON.stringify(issues)}`);
 }
 await browser.close();console.log('Profile layout: 320/390/775/1440px, light and dark, no overflow. Isolated component fixture only.');
})().catch(err=>{console.error(err);process.exitCode=1});
