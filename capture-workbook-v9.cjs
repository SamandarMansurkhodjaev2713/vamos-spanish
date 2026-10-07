const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/sam4k/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),assert=require('assert/strict');
const out='.impeccable/review-v9',base='http://127.0.0.1:8768/';
const stories=JSON.parse(fs.readFileSync('course-stories.json','utf8')),workshops=JSON.parse(fs.readFileSync('course-workshops.json','utf8'));
function stateFor(day,section,pos){const r={section,positions:{story:0,workshop:0},answers:{},drafts:{},translation:false,own:{},saved:false};r.positions[section]=pos;const list=section==='story'?stories.days[day-1].questions:workshops.days[day-1].tasks;for(const t of list.slice(0,pos))r.answers[`${day}:${section}:${t.id}`]={first:{correct:true,aided:false,time:Date.now()-2000},retries:[],due:0};return {day,workbook:{days:{[day]:r}}};}
const cases=[
 {name:'story',url:'?view=practice&mode=workbook&day=10',state:stateFor(10,'story',0)},
 {name:'translated',url:'?view=practice&mode=workbook&day=19',state:{...stateFor(19,'story',0),setup:'translation'}},
 {name:'workshop',url:'?view=practice&mode=workbook&day=12',state:stateFor(12,'workshop',0)},
 {name:'build',url:'?view=practice&mode=workbook&day=10',state:stateFor(10,'workshop',2)},
 {name:'own',url:'?view=practice&mode=workbook&day=30',state:stateFor(30,'story',2)},
 {name:'practice-new',url:'?view=practice',state:{day:1}},
 {name:'materials-stories',url:'?view=materials&tab=stories',state:{day:1}}
];
(async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:390,height:844}}),errors=[],bounds=[],failures=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
 const fit=async name=>{const item=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,escaped:[...document.querySelectorAll('main button,main textarea,main select,main h1,main h2,main p,main dt,main dd,footer,.topbar')].filter(e=>e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<-.6||r.right>innerWidth+.6;}).map(e=>e.outerHTML.slice(0,160))}));bounds.push({name,...item});if(item.scroll>item.width+1||item.escaped.length)failures.push({name,...item});};
 const capture=async name=>{await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.screenshot({path:out+'/'+name+'.png',fullPage:true,animations:'disabled'});};
 const show=async item=>{await p.evaluate(s=>localStorage.setItem('vamos-course-v2',JSON.stringify(s)),item.state);await p.goto(base+item.url);await p.locator('h1').waitFor();if(item.state.setup==='translation')await p.locator('[data-workbook-translation]').click();if(item.name==='workshop')await p.locator('.meaning-contrast>summary').click();if(item.name==='own')await p.fill('#workbook-own','Me gusta viajar. ¿Y tú? '+ 'España 日本語 العربية '.repeat(12));};
 for(const width of [320,390,600,775,980,1440,1600]){await p.setViewportSize({width,height:900});for(const item of cases){await show(item);await fit(item.name+'-'+width);if([390,1440].includes(width))await capture(item.name+'-'+width);}}
 await p.setViewportSize({width:320,height:760});for(const item of cases.slice(0,5)){const dark={...item,state:{...item.state,theme:'dark',largeText:true}};await show(dark);await fit(item.name+'-dark-large-320');await capture(item.name+'-dark-large-320');}
 await show(cases[0]);await p.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await p.locator('[data-wb-section="workshop"]').focus();assert.equal(await p.locator('[data-wb-section="workshop"]').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');await p.locator('[data-wb-section="workshop"]').click();await p.locator('[data-wb-choice="0"]').click();await p.locator('[data-wb-check]').click();assert.equal(await p.locator('.feedback').evaluate(e=>getComputedStyle(e).animationName),'none');await fit('forced-reduced-320');await capture('forced-reduced-320');
 await p.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});await p.locator('.topbar [data-menu-open]').click();for(let i=0;i<12;i++){await p.keyboard.press('Tab');assert(await p.locator('#course-menu').evaluate(e=>e.contains(document.activeElement)));}await p.keyboard.press('Escape');assert(await p.locator('.topbar [data-menu-open]').evaluate(e=>e===document.activeElement));
 // Semantic palette contrast, including actual translated speech and focus/control roles.
 const contrast=[];const luminance=h=>{const rgb=h.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 for(const theme of ['light','dark']){await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);const colors=await p.evaluate(()=>Object.fromEntries(['ink','muted','accent','paper','soft','bg','on-accent'].map(n=>[n,getComputedStyle(document.documentElement).getPropertyValue('--'+n).trim()])));for(const [fg,bg]of [['ink','paper'],['muted','paper'],['muted','soft'],['accent','bg'],['on-accent','accent']]){const a=luminance(colors[fg]),z=luminance(colors[bg]),ratio=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);contrast.push({theme,fg,bg,ratio});assert(ratio>=4.5);}}
 fs.writeFileSync(out+'/workbook-responsive.json',JSON.stringify({passed:!errors.length&&!failures.length,layouts:bounds.length,bounds,failures,errors,contrast,keyboardMenu:true,reducedForced:true,limits:'Chromium viewports and injected long content; physical devices and Safari not tested.'},null,2));await b.close();assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);console.log('PASS material responsive:',bounds.length,'layouts, 7 widths, dark/large/forced/reduced/keyboard; 10 palette contrasts');
})().catch(e=>{console.error(e);process.exit(1)});
