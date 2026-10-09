/* Native feature logic, manifests and ICS files. No claim of OS install/calendar delivery. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=__dirname,identitySource=fs.readFileSync(path.join(root,'web/identity.js'),'utf8'),nativeSource=fs.readFileSync(path.join(root,'web/native.js'),'utf8'),results=[];
const expanded=JSON.parse(fs.readFileSync(path.join(root,'course-expanded.json'),'utf8')),wordAudio=JSON.parse(fs.readFileSync(path.join(root,'word-audio.json'),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function identityEnvironment(prior={}){
 const file={clicks:0,blobs:[],intervals:0,notifications:0},links=new Map([['link[rel="manifest"]',{}],['link[rel="icon"]',{}],['link[rel="apple-touch-icon"]',{}]]);
 class BrowserURL extends URL{}BrowserURL.createObjectURL=b=>{file.blobs.push(b);return 'blob:unit-test'};BrowserURL.revokeObjectURL=()=>{};
 const win={isSecureContext:true,Notification:{permission:'default',requestPermission:()=>{file.notifications++;return Promise.resolve('granted')}},matchMedia:()=>({matches:false}),addEventListener:()=>{},setInterval:()=>file.intervals++,setTimeout:()=>{},focus:()=>{}};
 const document={hidden:true,head:{appendChild(){}},body:{appendChild(){}},addEventListener:()=>{},querySelector:s=>links.get(s)||null,querySelectorAll:()=>[],createElement:()=>({click:()=>file.clicks++,remove:()=>{}})};
 const state={identity:JSON.parse(JSON.stringify(prior)),day:2,completed:[1]},original=JSON.stringify(state),context={window:win,document,navigator:{onLine:true},location:{href:'https://example.test/vamos/'},URL:BrowserURL,Blob,TextEncoder,Date,Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:'Asia/Tashkent'})})}};
 vm.createContext(context);vm.runInContext(identitySource,context);const api=win.VamosIdentity.create({state,esc,save:()=>{},toast:()=>{},dueKeys:()=>[],context:()=>({view:'home'})});return {api,state,file,links,original};
}
function nativeEnvironment(data,supported=false){
 const cache=new Map(),status={textContent:''},win={crypto:crypto.webcrypto,MediaRecorder:class{},addEventListener:()=>{}},document={hidden:true,documentElement:{},addEventListener:()=>{},querySelectorAll:()=>[],querySelector:()=>null,getElementById:id=>id==='offline-status'?status:null};
 const registry={active:{},addEventListener:()=>{}},events=[];
 const stores={open:async()=>({match:async key=>cache.get(key)?.clone(),put:async(key,response)=>cache.set(key,response.clone()),delete:async key=>cache.delete(key)})};
 const navigator={onLine:true,mediaDevices:{getUserMedia:()=>{}}};if(supported){navigator.serviceWorker={register:async()=>registry,ready:Promise.resolve(registry)};win.caches=stores;}
 const fetcher=async url=>{url=String(url);if(url.endsWith('assets/audio/ATTRIBUTION.json'))return new Response(JSON.stringify(Object.fromEntries(Object.values(data.expanded.audio).map((p,i)=>[i,p]))));events.push(url);const clip=[...Object.values(data.expanded.audio),...Object.values(data.wordAudio?.clips||{})].find(p=>new URL(p.file,'https://example.test/vamos/').href===url);return clip?new Response(clip.payload):new Response('',{status:404});};
 const box={window:win,document,navigator,location:{href:'https://example.test/vamos/',hostname:'example.test'},URL,matchMedia:()=>({matches:false,addEventListener:()=>{}}),fetch:fetcher,caches:stores,crypto:crypto.webcrypto,AbortController,Response,Promise};vm.createContext(box);vm.runInContext(nativeSource,box);const state={native:{awake:true},day:3,completed:[1]},api=win.VamosNative.create({data,state,esc,icon:()=>'',save:()=>{},toast:()=>{},activeLesson:()=>false});return {api,state,cache,status,events};
}
async function test(name,fn){await fn();results.push({name,pass:true});}
function unfolded(ics){return ics.replace(/\r\n[ \t]/g,'');}
function button(attribute){return {getAttribute:()=>null,hasAttribute:a=>a===attribute};}
const tick=()=>new Promise(r=>setTimeout(r,30));
async function settled(predicate){const deadline=Date.now()+3000;while(!predicate()){assert.ok(Date.now()<deadline,'Native operation did not settle');await tick();}}
(async()=>{
 await test('Five manifests preserve icon assets and install identity, and expose four consistent truthful shortcuts',()=>{
  const files=fs.readdirSync(path.join(root,'web')).filter(x=>/^manifest.*\.webmanifest$/.test(x));assert.equal(files.length,5);
  for(const f of files){const m=JSON.parse(fs.readFileSync(path.join(root,'web',f),'utf8'));assert.equal(m.id,'./');assert.equal(m.theme_color,'#963d4a');assert.equal(m.background_color,'#f8f2ec');assert.equal(m.shortcuts.length,4);assert.deepEqual(m.shortcuts.map(x=>x.name),['Сегодня','Разговор','Словарь','Чтение']);assert.equal(m.shortcuts[3].url,'./?view=practice&mode=reader');assert.ok(m.icons.length===2&&m.icons.every(x=>fs.existsSync(path.join(root,'web',x.src))));}
 });
 await test('Selected future install pose updates both manifest and Apple touch icon without changing learning evidence',()=>{const e=identityEnvironment({installPose:'proud'});assert.match(e.links.get('link[rel="manifest"]').href,/manifest-lumo-proud\.webmanifest$/);assert.match(e.links.get('link[rel="apple-touch-icon"]').href,/app-icon-lumo-proud-192\.png$/);assert.match(e.api.html(),/data-fold="identity:icon"/);e.api.click({getAttribute:()=> 'joy',hasAttribute:()=>false});assert.match(e.links.get('link[rel="manifest"]').href,/manifest-lumo-joy\.webmanifest$/);assert.match(e.links.get('link[rel="apple-touch-icon"]').href,/app-icon-lumo-joy-192\.png$/);assert.deepEqual(e.state.completed,[1]);assert.equal(e.state.day,2)});
 await test('Installation guidance distinguishes browser storage from installed iOS app and offers export before install',()=>{const e=nativeEnvironment({expanded,wordAudio});assert.match(e.api.html(),/Перед установкой сохрани файл прогресса/);assert.match(e.api.html(),/Safari/);assert.match(e.api.html(),/отдельное хранилище/);assert.match(e.api.html(),/импортируй копию, если уроки не перенеслись/)});
 await test('Offline catalog includes every original phrase and original word with byte/hash/license metadata',()=>{
  const e=nativeEnvironment({expanded,wordAudio}),clips=e.api.audioCatalog();assert.equal(clips.length,72+Object.keys(wordAudio.clips).length);assert.equal(new Set(clips.map(x=>x.file)).size,clips.length);
  for(const clip of clips){const bytes=fs.readFileSync(path.join(root,'web',clip.file));assert.equal(bytes.length,clip.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),clip.sha256);assert.ok(clip.license&&clip.licenseUrl&&clip.speaker&&clip.unaltered===true);}
  assert.equal(e.state.native.awake,true);assert.equal(e.state.day,3);assert.equal(e.state.completed[0],1);assert.doesNotMatch(e.api.html(),/оригинальных MP3/);
 });
 await test('Real offline download logic validates both media types, evicts corruption and resumes preserved files',async()=>{
  const make=(file,text)=>{const payload=Buffer.from(text);return {file,payload,sha256:crypto.createHash('sha256').update(payload).digest('hex'),bytes:payload.length};};
  const a=make('assets/audio/native.mp3','original-phrase'),b=make('assets/word-audio/word.wav','original-word'),e=nativeEnvironment({expanded:{audio:{a}},wordAudio:{clips:{b}}},true);await settled(()=>/0 из 2/.test(e.status.textContent));e.api.click(button('data-offline-download'));await settled(()=>/Проверено на устройстве: 2 из 2/.test(e.status.textContent));assert.equal(e.cache.size,2);
  e.cache.set('https://example.test/vamos/assets/word-audio/word.wav',new Response('corrupted'));e.api.click(button('data-offline-refresh'));await settled(()=>/Проверено на устройстве: 1 из 2/.test(e.status.textContent));assert.equal(e.cache.size,1);const before=e.events.length;e.api.click(button('data-offline-download'));await settled(()=>/Проверено на устройстве: 2 из 2/.test(e.status.textContent));assert.equal(e.cache.size,2);assert.equal(e.events.length-before,1);assert.ok(e.events.at(-1).endsWith('.wav'));
 });
 await test('Calendar uses nearest local time, daily floating schedule, 15-minute event and alarm at start',()=>{
  const e=identityEnvironment({time:'18:00',installPose:'proud',badge:true,reminder:true,lastDate:'2026-10-08'}),ics=unfolded(e.api.calendarFile(new Date(2026,9,9,17,55,0)));
  assert.match(ics,/DTSTART:20261009T180000\r\n/);assert.match(ics,/DTEND:20261009T181500\r\n/);assert.match(ics,/DTSTAMP:\d{8}T\d{6}Z/);assert.match(ics,/RRULE:FREQ=DAILY/);assert.match(ics,/X-WR-TIMEZONE:Asia\/Tashkent/);assert.match(ics,/BEGIN:VALARM\r\nTRIGGER:PT0M\r\nACTION:DISPLAY/);assert.doesNotMatch(ics,/DTSTART[^\r\n]*Z|DTSTART;TZID/);assert.match(ics,/URL:https:\/\/example.test\/vamos\/\?view=home/);assert.equal(e.state.identity.installPose,'proud');assert.equal(e.state.identity.badge,true);assert.equal(e.state.identity.reminder,true);assert.equal(e.state.identity.lastDate,'2026-10-08');assert.equal(e.state.day,2);
 });
 await test('Calendar moves past times to tomorrow and wraps 15-minute events over midnight',()=>{
  const tomorrow=identityEnvironment({time:'18:00'}),ics=unfolded(tomorrow.api.calendarFile(new Date(2026,9,9,18,0,1)));assert.match(ics,/DTSTART:20261010T180000/);
  const midnight=identityEnvironment({time:'23:55'}),out=unfolded(midnight.api.calendarFile(new Date(2026,11,31,23,50,0)));assert.match(out,/DTSTART:20261231T235500/);assert.match(out,/DTEND:20270101T001000/);
 });
 await test('Calendar UTF-8 lines are CRLF-folded to 75 octets and source text is safely escaped',()=>{
  const e=identityEnvironment(),ics=e.api.calendarFile(new Date(2026,9,9));assert.ok(ics.endsWith('END:VCALENDAR\r\n'));assert.ok(!ics.replace(/\r\n/g,'').includes('\n'));
  for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
  const out=unfolded(ics);assert.ok(out.includes('\\nhttps://'));assert.ok(out.includes('устройства\\;'));assert.match(out,/UID:vamos-local-study@vamos-spanish/);
 });
 await test('Calendar is downloaded only by user click and requests no notification/account permission',async()=>{
  const e=identityEnvironment({time:'10:30',installPose:'joy',reminder:false,badge:false});assert.equal(e.file.blobs.length,0);assert.equal(e.file.clicks,0);assert.equal(e.api.click(button('data-identity-calendar')),true);assert.equal(e.file.clicks,1);assert.equal(e.file.blobs.length,1);assert.equal(e.file.blobs[0].type,'text/calendar;charset=utf-8');assert.match(await e.file.blobs[0].text(),/BEGIN:VCALENDAR/);assert.equal(e.file.notifications,0);assert.equal(e.state.identity.reminder,false);assert.equal(e.state.identity.installPose,'joy');assert.match(e.api.html(),/автоматически не заменяет/);assert.match(e.api.html(),/Системные виджеты эта веб-версия не создаёт/);
 });
 const dir=path.join(root,'.impeccable/review-v29');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'native-check.json'),JSON.stringify({pass:true,groups:results,media:{phrases:72,words:Object.keys(wordAudio.clips).length},limits:'Logic/hash/ICS tests only. No physical OS install, calendar-import delivery, browser background push, dynamic installed icon or system widget verified.'},null,2));console.log(`PASS ${results.length} native/offline/calendar groups`);
})().catch(e=>{console.error(e);process.exitCode=1});
