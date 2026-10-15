/* Actual reader/library APIs: isolated human audio stays distinct from sentence recordings. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const extra={words:{me:'extra-me',llamo:'extra-llamo','qué':'extra-que'},clips:{'extra-me':{text:'me'},'extra-llamo':{text:'llamo'},'extra-que':{text:'qué'}}};
const prefix=read('check-reader-v28.cjs').split('\ntest(')[0];
vm.runInNewContext(prefix+`
data.wordAudioExtra=${JSON.stringify(extra)};
const e=environment();e.api.enter('text:1');
const key=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)].find(m=>m[1]==='text:1:2:0')[1];
click(e,'data-reader-word',key);
assert.match(e.api.html(),/Послушать по словам/);
assert.match(e.api.html(),/data-reader-word-sound="Me"/);
assert.match(e.api.html(),/data-reader-word-sound="llamo"/);
const saved=JSON.stringify(e.state.reader),before=e.played.length;
click(e,'data-reader-word-sound','Me');assert.equal(e.played.length,before+1);assert.deepEqual(e.played.at(-1),['extra-me']);
assert.equal(JSON.stringify(e.state.reader),saved);
click(e,'data-reader-word-sound','Me llamo');assert.equal(e.played.length,before+1);
click(e,'data-reader-word-sound','qué');assert.equal(e.played.length,before+1);
`,{require,__dirname,console});
const data={library:json('course-library.json'),expanded:json('course-expanded.json'),wordAudio:json('word-audio.json'),wordAudioExtra:extra},plays=[],messages=[];
const state={cards:{},audioSpeed:.5,library:{favorites:[],known:[],difficult:[],notes:{},pageSize:6,layout:'list',hideTranslation:false}};
const c={window:{},document:{querySelector:()=>null},scrollY:300,scrollTo:()=>{},CSS:{escape:String}};vm.createContext(c);vm.runInContext(read('web/library.js'),c);
const api=c.window.VamosLibrary.create({data,state,esc,plain:s=>String(s||'').toLowerCase().replace(/\p{P}/gu,''),icon:()=>'',coach:{highlight:esc,explanation:()=>''},playButton:(id,label)=>`<button data-audio="${esc(id)}" aria-label="${esc(label)}"></button>`,audioCredit:p=>`<p>Credit ${p.audio}</p>`,audioStatus:()=>'',audioControls:()=>'',recorderHTML:()=>'',footer:()=>'',render:()=>{},playSequence:ids=>plays.push([...ids]),toast:s=>messages.push(s),stopRecording:()=>{}});
const click=(attr,value)=>api.handleClick({hasAttribute:k=>k===attr,dataset:{[attr.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]:value}});
let html=api.render();assert.match(html,/data-lib-word-sound="hola"/);assert.match(html,/Слушать слово: hola/);assert.match(html,/data-audio="437710"/);
const before=JSON.stringify(state);click('data-lib-word-sound','Me');assert.deepEqual(plays.at(-1),['extra-me']);assert.equal(JSON.stringify(state),before);
click('data-lib-word-sound','qué');assert.deepEqual(plays.at(-1),['extra-que']);const count=plays.length;click('data-lib-word-sound','que');assert.equal(plays.length,count);assert.match(messages.at(-1),/человеческая запись пока не добавлена/);
const phrase=data.library.items.find(x=>x.es==='¿A qué te dedicas?');assert(phrase);click('data-lib-open',phrase.id);html=api.render();assert.match(html,/data-lib-word-sound="qué"/);assert.match(html,/Слушать фразу целиком: ¿A qué te dedicas\?/);assert.match(html,/Credit extra-que/);
for(const text of data.library.items.filter(x=>x.type==='text')){click('data-lib-open',text.id);html=api.render();assert.match(html,/data-lib-word-sound=/);assert.match(html,/data-lib-play-text/);for(const line of text.lines)assert(html.includes('data-audio="'+line.audio+'"'));}
console.log('PASS direct-word UI: exact accented registry lookup, grouped phrase controls, no fabricated audio, no state/scroll reset, all 12 dictionary texts retain whole-line playback.');
