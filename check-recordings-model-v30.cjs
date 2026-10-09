/* Actual archive controller with asynchronous IndexedDB transaction/request fixtures. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'web/recordings.js'),'utf8');
const data={expanded:JSON.parse(fs.readFileSync('course-expanded.json','utf8')),wordAudio:JSON.parse(fs.readFileSync('word-audio.json','utf8'))};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<6;i++)await tick();}
function environment(seed=[],{deferCount=false,failWrite=false,withStatus=true}={}){
 const records=new Map(seed.map(r=>[r.id,{...r}])),calls={writes:[],plays:[],credits:[],urls:[],revoked:[],toasts:[],renders:0,close:0},events={};let next=0,releaseCount;
 const db={createObjectStore(){},close(){calls.close++;},transaction(storeName,mode){assert.equal(storeName,'clips');const tx={mode,objectStore(name){assert.equal(name,'clips');return {
  getAll:()=>request(()=>[...records.values()].map(r=>({...r}))),count:()=>request(()=>records.size,true),
  add:r=>request(()=>{if(failWrite)throw Error('write failure');assert.equal(mode,'readwrite');assert(!records.has(r.id));records.set(r.id,{...r});calls.writes.push({...r});return r.id;}),
  delete:id=>request(()=>{assert.equal(mode,'readwrite');records.delete(id);return undefined;})
 };}};
  function request(action,count=false){const req={};const finish=()=>setImmediate(()=>{try{req.result=action();req.onsuccess?.();tx.oncomplete?.();}catch(e){tx.error=e;tx.onerror?.();}});if(count&&deferCount){releaseCount=finish;}else finish();return req;}
  return tx;
 }};
 const indexedDB={open(name,version){assert.equal(name,'vamos-voice-v1');assert.equal(version,1);const req={result:db};setImmediate(()=>req.onsuccess?.());return req;}};
 const c={window:{addEventListener:(name,fn)=>events[name]=fn},indexedDB,Blob,Date,Map,URL:{createObjectURL:blob=>{const url='blob:archive-'+next++;calls.urls.push([url,blob]);return url;},revokeObjectURL:url=>calls.revoked.push(url)},crypto:{randomUUID:()=>String(++next)},document:{querySelectorAll:()=>[{pause:()=>{}}]}};
 vm.createContext(c);vm.runInContext(source,c);
 const app=c.window.VamosRecordings.create({data,esc,icon:()=>'',footer:()=>'',active:()=>true,render:()=>calls.renders++,toast:s=>calls.toasts.push(s),playButton:(id,label)=>{calls.plays.push([id,label]);return `<button data-audio="${esc(id)}">${esc(label)}</button>`;},audioCredit:m=>{calls.credits.push({...m});return `<span data-credit="${esc(m.audio)}">SOURCE</span>`;},audioControls:()=>'<select data-audio-speed><option value="0.5">×0,5</option></select>',...(withStatus?{audioStatus:()=>'<p id="audio-status" role="status">BUFFER_OR_ERROR</p>'}:{})});
 return {app,records,calls,db,events,releaseCount:()=>{assert(releaseCount);releaseCount();}};
}
const blob=new Blob(['voice'],{type:'audio/webm'}),clip=(id,extra={})=>({id,created:Date.now()-1000,day:1,label:'Моя попытка '+id,context:'speech',blob,...extra});
const word=Object.keys(data.wordAudio.clips)[0],wordText=data.wordAudio.clips[word].text;
const reports=[];async function test(name,fn){await fn();reports.push({name,pass:true});}
(async()=>{
 assert.equal(Object.keys(data.expanded.audio).length+Object.keys(data.wordAudio.clips).length,123);
 await test('Exact phrase and word originals are stored from catalogue, never from untrusted captions',async()=>{
  const h=environment();await settle();assert(await h.app.save(blob,{day:22,contentDay:19,label:'Моя версия <script>',context:'speech',audio:'437710',es:'UNTRUSTED TEXT'}));
  const phrase=h.calls.writes[0];assert.equal(phrase.audio,'437710');assert.equal(phrase.es,'Hola.');assert.equal(phrase.contentDay,19);assert.equal(phrase.day,22);assert.equal(phrase.blob,blob);
  assert(await h.app.save(blob,{day:4,contentDay:4,label:'Отдельное слово',audio:word,es:'Hola.'}));assert.equal(h.calls.writes[1].es,wordText);assert.equal(h.calls.writes[1].audio,word);
  const html=h.app.html();assert(html.includes('data-audio="437710"'));assert(html.includes('data-audio="'+word+'"'));assert(html.includes('Hola.'));assert(html.includes(esc(wordText)));assert(!html.includes('UNTRUSTED TEXT'));assert(html.includes('Моя версия &lt;script&gt;'));assert(!html.includes('autoplay'));assert.equal((html.match(/<audio controls/g)||[]).length,2);assert(html.includes('День 22 · тема 19'));
 });
 await test('Unknown audio, user text and invalid optional days cannot fabricate a source model',async()=>{
  const h=environment();await settle();for(const audio of ['unknown','__proto__','<script>',437710])assert(await h.app.save(blob,{day:2,contentDay:45,label:'Свой текст',audio,es:'Hola.'}));
  for(const r of h.calls.writes){assert(!Object.hasOwn(r,'audio'));assert(!Object.hasOwn(r,'es'));assert(!Object.hasOwn(r,'contentDay'));}
  const html=h.app.html();assert(!html.includes('data-audio='));assert(!html.includes('Образец носителя'));assert.equal((html.match(/Моя попытка<\/h3>/g)||[]).length,4);
 });
 await test('Metadata is captured before asynchronous count; later mutation cannot retarget saved voice',async()=>{
  const h=environment([],{deferCount:true});await settle();const meta={day:9,contentDay:9,label:'Исходная фраза',context:'words',audio:'437710'},pending=h.app.save(blob,meta);meta.audio=word;meta.day=20;meta.contentDay=20;meta.label='Changed';await tick();h.releaseCount();assert(await pending);
  const r=h.calls.writes[0];assert.equal(r.audio,'437710');assert.equal(r.es,'Hola.');assert.equal(r.label,'Исходная фраза');assert.equal(r.day,9);assert.equal(r.contentDay,9);assert.equal(r.context,'words');
 });
 await test('Legacy clips remain self-only; malformed optional source does not corrupt other saved records',async()=>{
  const old=clip('old'),bad=clip('bad',{audio:'missing',es:'Fake recorded phrase',contentDay:99}),valid=clip('valid',{audio:'437710',es:'Untrusted persisted caption'}),h=environment([old,bad,valid]);await settle();const before=[...h.records.values()].map(r=>({...r})),html=h.app.html();assert.equal((html.match(/Образец носителя/g)||[]).length,1);assert(!html.includes('Untrusted persisted caption'));assert(!html.includes('Fake recorded phrase'));assert(!html.includes('тема 99'));assert(html.includes('Hola.'));assert.equal(h.calls.writes.length,0);assert.deepEqual([...h.records.values()],before);
 });
 await test('Original attribution and 0.5 tempo stay closed; viewing and comparing never write grades',async()=>{
  const h=environment([clip('a',{audio:'437710'}),clip('b',{audio:word}),clip('c')]);await settle();const writes=h.calls.writes.length;h.app.html();assert.deepEqual(new Set(h.calls.credits.map(m=>m.audio)),new Set(['437710',word]));assert(h.calls.credits.every(m=>m.es===data.expanded.audio[m.audio]?.text||m.es===data.wordAudio.clips[m.audio]?.text));
  for(const id of ['a','b','c'])h.app.click({dataset:{voiceCompare:id}});const html=h.app.html();assert(html.includes('aria-label="Сравнение двух своих записей"'));assert.equal((html.match(/voice-compare"/g)||[]).length,2);assert.equal((html.match(/<audio controls/g)||[]).length,3,'No duplicate playback of selected clips in lower list');assert.match(html,/<details class="voice-source"><summary>Темп и источник записи<\/summary>/);assert(html.includes('value="0.5"'));assert(!html.includes('<details class="voice-source" open'));assert.equal(h.calls.writes.length,writes);assert(!html.includes('CEFR'));assert(html.includes('Архив не измеряет акцент или уровень'));
 });
 await test('One shared playback status for all visible models, absent for legacy-only and optional default',async()=>{
  const h=environment([clip('a',{audio:'437710'}),clip('b',{audio:word})]);await settle();const before=[...h.records.values()];assert.equal((h.app.html().match(/id="audio-status"/g)||[]).length,1);
  for(const id of ['a','b'])h.app.click({dataset:{voiceCompare:id}});const html=h.app.html();assert.equal((html.match(/id="audio-status"/g)||[]).length,1);assert.equal((html.match(/data-audio=/g)||[]).length,2);assert(html.includes('BUFFER_OR_ERROR'));assert.equal(h.calls.writes.length,0);assert.deepEqual([...h.records.values()],before);
  const legacy=environment([clip('old'),clip('bad',{audio:'unknown'})]);await settle();assert.equal((legacy.app.html().match(/id="audio-status"/g)||[]).length,0);
  const optional=environment([clip('valid',{audio:'437710'})],{withStatus:false});await settle();assert(optional.app.html().includes('data-audio="437710"'));assert.equal((optional.app.html().match(/id="audio-status"/g)||[]).length,0);
 });
 await test('Pair comparison returns to ordinary archive without reload or changing stored attempts',async()=>{
  const h=environment([clip('a',{audio:'437710'}),clip('b',{audio:word})]);await settle();const before=[...h.records.values()].map(r=>({...r}));for(const id of ['a','b'])h.app.click({dataset:{voiceCompare:id}});
  assert(h.app.html().includes('voice-pair'));assert(h.app.html().includes('data-voice-clear'));assert.equal((h.app.html().match(/data-voice-compare=/g)||[]).length,0);
  assert.equal(h.app.click({dataset:{voiceClear:''},hasAttribute:k=>k==='data-voice-clear'}),true);const html=h.app.html();assert(!html.includes('voice-pair'));assert.equal((html.match(/data-voice-compare=/g)||[]).length,2);assert.equal((html.match(/<audio controls/g)||[]).length,2);assert.equal((html.match(/id="audio-status"/g)||[]).length,1);assert.deepEqual([...h.records.values()],before);assert.equal(h.calls.writes.length,0);
 });
 await test('Eight-clip, Blob, transaction failure and cleanup boundaries preserve existing archive',async()=>{
  const full=environment(Array.from({length:8},(_,i)=>clip('old'+i)));await settle();assert.equal(await full.app.save(blob,{audio:'437710'}),false);assert.equal(full.records.size,8);assert.equal(full.calls.writes.length,0);
  const h=environment([clip('old')]);await settle();assert.equal(await h.app.save(new Blob([]),{}),false);assert.equal(await h.app.save('not a Blob',{}),false);assert.equal(h.records.size,1);h.app.click({dataset:{voiceDelete:'old'}});await settle();assert.equal(h.records.size,0);assert(h.calls.revoked.length>0);h.events.pagehide();assert.equal(h.calls.close,1);
  const fail=environment([clip('preserved')],{failWrite:true});await settle();assert.equal(await fail.app.save(blob,{audio:'437710'}),false);assert.equal(fail.records.size,1);assert.equal(fail.calls.writes.length,0);
 });
 const dir=path.join(__dirname,'.impeccable/review-v30');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'recordings-model-results.json'),JSON.stringify({pass:true,groups:reports.length,reports,limits:'Actual controller with asynchronous request/transaction and Blob fixtures; no physical IndexedDB, browser decoding, acoustic grading or learning state writes.'},null,2));console.log('PASS '+reports.length+' recordings model groups');
})().catch(e=>{console.error(e);process.exitCode=1;});
