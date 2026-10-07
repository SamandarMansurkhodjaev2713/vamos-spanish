const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert/strict');
const out='.impeccable/review-v10',base='http://127.0.0.1:8768/';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:390,height:844}}),report={bounds:[],errors:[],failures:[]};p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base);const data=await p.evaluate(()=>VAMOS_DATA),started=Date.now()-10000;
 const active=(step)=>({day:4,started,step,reviewKeys:[],rating:null,difficulty:'',finished:null});
 const norm=s=>s.toLowerCase().replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim(),e=data.expanded.lessons[0],target=e.examples.find(x=>norm(x.es)===norm(e.build))||e.examples[0];
 const lesson=(stage)=>({day:1,learning:{sessions:{1:{stage,time:Date.now()-1000,signature:'1:'+target.audio,tokens:[],draft:'',rating:null}}}});
 const cases=[
  {name:'home',url:'',state:{}},
  {name:'resume',url:'',state:{studio:{active:active(2)}}},
  {name:'calendar',url:'',state:{learning:{route:'calendar'}}},
  {name:'lesson',url:'?view=lesson&day=1',state:{}},
  {name:'quiz',url:'?view=lesson&day=1',state:lesson(2)},
  {name:'speak',url:'?view=lesson&day=1',state:lesson(6)},
  {name:'reflection',url:'?view=practice&mode=daily&day=4',state:{studio:{active:active(3)}}},
  {name:'complete',url:'?view=practice&mode=daily&day=4',state:{completed:[4],studio:{active:{...active(4),rating:'independent',finished:Date.now()-5000}}}},
  {name:'practice',url:'?view=practice',state:{}},
  {name:'practice-open',url:'?view=practice',state:{},setup:async()=>{for(const d of await p.locator('.hub-group').all())await d.locator('summary').click()}},
  {name:'menu',url:'',state:{},setup:()=>p.locator('.topbar [data-menu-open]').click()}
 ];
 async function show(c,extra={}){await p.goto(base);await p.evaluate(s=>localStorage.setItem('vamos-course-v2',JSON.stringify(s)),{sounds:false,motion:true,...c.state,...extra});await p.goto(base+c.url);await p.locator('h1').waitFor();await p.evaluate(()=>document.fonts.ready);if(c.setup)await c.setup();}
 async function fit(name){const item=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,escaped:[...document.querySelectorAll('main button,main summary,main select,main textarea,main h1,main h2,main p,footer,.topbar')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.7||r.right>innerWidth+.7}).map(e=>e.outerHTML.slice(0,160))}));report.bounds.push({name,...item});if(item.scroll>item.width+1||item.escaped.length)report.failures.push({name,...item});}
 if(process.argv.includes('--repair-reflection')){for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});await show(cases[6]);assert.equal(await p.locator('[data-studio-finish]').count(),1);await fit('reflection-'+width);if(width!==320)await p.screenshot({path:out+'/reflection-'+width+'.png',fullPage:true,animations:'disabled'})}fs.writeFileSync(out+'/reflection-evidence-repair.json',JSON.stringify(report,null,2));await b.close();assert.deepEqual(report.failures,[]);console.log('PASS three corrected reflection states.');return}
 if(process.argv.includes('--repair-evidence')){for(const width of [320,390,768,1024,1440]){await p.setViewportSize({width,height:900});for(const c of [cases[4],cases[5]]){await show(c);assert((await p.locator('.exercise-meta').textContent()).includes(c.name==='quiz'?'задание 3 из 7':'задание 7 из 7'));await fit(c.name+'-'+width);if([390,1440].includes(width))await p.screenshot({path:out+'/'+c.name+'-'+width+'.png',fullPage:true,animations:'disabled'})}}report.passed=!report.errors.length&&!report.failures.length;fs.writeFileSync(out+'/capture-evidence-repair.json',JSON.stringify(report,null,2));await b.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.failures,[]);console.log('PASS 10 corrected quiz/speech states with verified actual task labels.');return}
 for(const width of [320,390,768,1024,1440]){await p.setViewportSize({width,height:900});for(const c of cases){await show(c);await fit(c.name+'-'+width);if([390,1440].includes(width))await p.screenshot({path:out+'/'+c.name+'-'+width+'.png',fullPage:true,animations:'disabled'});}}
 await p.setViewportSize({width:320,height:780});for(const c of [cases[0],cases[3],cases[9]]){await show(c,{theme:'dark',largeText:true});await fit(c.name+'-dark-large-320');await p.screenshot({path:out+'/'+c.name+'-dark-large-320.png',fullPage:true,animations:'disabled'});}
 await show(cases[0]);await p.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await p.locator('[data-studio-begin]').focus();assert.equal(await p.locator('[data-studio-begin]').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');assert.equal(await p.locator('.today-buddy .mascot').evaluate(e=>getComputedStyle(e).animationName),'none');await fit('forced-reduced-320');await p.screenshot({path:out+'/forced-reduced-320.png',fullPage:true,animations:'disabled'});
 await p.emulateMedia({forcedColors:'none'});await p.locator('.topbar [data-menu-open]').click();for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.locator('#course-menu').evaluate(e=>e.contains(document.activeElement)))}await p.keyboard.press('Escape');assert(await p.locator('.topbar [data-menu-open]').evaluate(e=>e===document.activeElement));
 report.passed=!report.errors.length&&!report.failures.length;report.layouts=report.bounds.length;report.keyboardMenu=true;report.reducedForced=true;report.limits='Chromium viewport simulation, not physical iOS/Android testing.';fs.writeFileSync(out+'/path-responsive.json',JSON.stringify(report,null,2));await b.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.failures,[]);console.log('PASS path responsive:',report.layouts,'layouts, five widths, dark/large, keyboard, reduced/forced.');
})().catch(e=>{console.error(e);process.exit(1)});
