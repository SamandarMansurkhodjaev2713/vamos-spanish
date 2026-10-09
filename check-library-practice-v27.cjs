/* Actual library practice controller: finite playback/context and evidence regression witnesses. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f)),noop=()=>{},clone=x=>JSON.parse(JSON.stringify(x));
const data={library:json('course-library.json'),expanded:json('course-expanded.json'),wordAudio:json('word-audio.json')};
const src=read('web/library-practice.js'),old=cp.execFileSync('git',['show','b0d0421e19e499e7e351a717b5e065e7a0a3d38e:web/library-practice.js'],{cwd:root,encoding:'utf8'});
const c={window:{scrollY:0,scrollTo:noop},Date,document:{querySelector:()=>null}};vm.createContext(c);vm.runInContext(src,c);
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const b=(attr,val='')=>({hasAttribute:n=>n===attr,dataset:{[attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,l)=>l.toUpperCase())]:val}});
function create(ownData=data){const state={},events=[],api={data:ownData,state,esc,icon:()=>'',save:noop,toast:noop,render:noop,playButton:(id,label)=>`<button data-audio="${esc(id)}" aria-label="${esc(label)}"></button>`,audioControls:()=>'<select data-audio-speed><option value="0.5">0,5×</option></select>',observe:(x,r)=>events.push(clone(r))};return {app:c.window.VamosLibraryPractice.create(api),state,events}}
const report={passed:false,checks:[],limits:['Finite controller tests and exact key grading; not a language proficiency or accent assessment.','Parent performs integrated UI confirmation; this test does not claim physical playback or mobile tap coverage.']};
function check(name,fn){const evidence=fn();report.checks.push({name,evidence})}
check('Answer grading, scheduling, sanitization and evidence mutation logic unchanged',()=>{
 const line=s=>s.split(/\r?\n/).filter(x=>x.startsWith(' const normalize=')||x.startsWith(' const correct=')).join('\n');assert.equal(line(src),line(old));
 for(const[start,end]of [[' function sanitize(','\n function merge('],[' function merge(','\n state.libraryPractice='],[' function start(','\n function context('],[' function handleInput(','\n return {start']])assert.equal(src.slice(src.indexOf(start),src.indexOf(end)).replace(/\r/g,''),old.slice(old.indexOf(start),old.indexOf(end)).replace(/\r/g,''));
 return {baseline:'b0d0421',unchangedBlocks:6};
});
check('All51 standalone word recordings appear only after help/check and in exact Lumo contexts',()=>{
 let phraseContexts=0;for(const [es,id]of Object.entries(data.wordAudio.words)){
  const item=data.library.items.find(x=>x.type==='word'&&x.es===es);assert(item,es);assert.equal(data.wordAudio.clips[id].text,es);
  const {app,state}=create();app.start([item]);assert(!app.render().includes('data-audio="'+id+'"'),es);assert(app.render().includes('Проверено карточек: 0 из 1 · попытка 1'));assert(!app.render().includes(' / 18'));
  const examples=clone(app.context().extensionLesson.examples);assert.deepEqual(examples[0],{es:item.es,ru:item.ru,audio:id,recordingKind:'word'});
  if(item.audio){assert.deepEqual(examples[1],{es:item.context||item.es,ru:item.contextRu||item.ru,audio:item.audio,recordingKind:'phrase'});phraseContexts++}else assert.equal(examples.length,1);
  app.handleClick(b('data-lp-help'));let html=app.render();assert(html.includes('data-audio="'+id+'"'));assert(html.includes('Слушать слово: '+es));assert(html.includes('Запись слова:'));assert(html.includes('data-audio-speed'));
  if(item.audio){assert(html.includes('В записи звучит вся фраза:'));assert(html.includes('Слушать всю фразу: '+esc(item.context||item.es)))}
  app.handleInput({id:'lp-answer',value:item.es});app.handleClick(b('data-lp-check'));html=app.render();assert.equal(state.libraryPractice.records[0].correct,true);assert.equal(state.libraryPractice.records[0].aided,true);assert(html.includes('data-audio="'+id+'"'));assert(html.includes('Проверено карточек: 1 из 1 · попытка 1'));app.handleClick(b('data-lp-next'));assert(html.includes('попытка 1'));assert(app.render().includes('Без помощи с первой попытки: 0 из 1'));
 }return {words:51,standaloneAndPhraseContexts:phraseContexts};
});
check('NFC and case lookup supported; accent omission cannot select another word recording',()=>{
 for(const es of ['TÚ','fri\u0301o','frio']){const own=clone(data),item={...own.library.items.find(x=>x.es==='frío'),id:'isolated:'+es,es,accepted:[es]};own.library.items.push(item);const {app}=create(own);app.start([item]);const examples=app.context().extensionLesson.examples;assert.equal(examples.length,es==='frio'?0:1,es);if(es!=='frio')assert.equal(examples[0].audio,data.wordAudio.words[es.normalize('NFC').toLocaleLowerCase('es')]);}return {positive:2,negative:1};
});
check('Independent checked result exposes audio without rewriting first evidence after later help',()=>{
 const item=data.library.items.find(x=>x.es==='agua'&&x.type==='word'),{app,state}=create();app.start([item]);app.handleInput({id:'lp-answer',value:item.es});app.handleClick(b('data-lp-check'));const first=clone(state.libraryPractice.records[0]);assert(app.render().includes('Слушать слово: agua'));assert.equal(first.aided,false);app.handleClick(b('data-lp-help'));app.markHelp();app.handleInput({id:'lp-answer',value:'incorrecto'});app.handleClick(b('data-lp-check'));assert.deepEqual(clone(state.libraryPractice.records[0]),first);assert.equal(app.summary().independent,1);assert.equal(app.summary().attempts,1);return {firstIndependentUnchanged:true};
});
check('Wrong first response immutable, delayed retry remains aided and cannot become first independent evidence',()=>{
 const ids=['agua','frío','día'].map(es=>data.library.items.find(x=>x.type==='word'&&x.es===es).id),{app,state,events}=create();app.start(ids);
 app.handleInput({id:'lp-answer',value:'incorrecto'});app.handleClick(b('data-lp-check'));const first=clone(state.libraryPractice.records[0]);app.handleInput({id:'lp-answer',value:'agua'});app.handleClick(b('data-lp-check'));assert.deepEqual(clone(state.libraryPractice.records[0]),first);assert.equal(events.length,1);app.handleClick(b('data-lp-next'));
 assert.equal(state.libraryPractice.queue[0].id,ids[1]);for(const es of ['frío','día']){app.handleInput({id:'lp-answer',value:es});app.handleClick(b('data-lp-check'));app.handleClick(b('data-lp-next'))}
 assert.equal(state.libraryPractice.queue[0].id,ids[0]);assert.equal(state.libraryPractice.draft.aided,true);app.handleInput({id:'lp-answer',value:'agua'});app.handleClick(b('data-lp-check'));assert.deepEqual(clone(state.libraryPractice.records[0]),first);assert.equal(state.libraryPractice.records.at(-1).aided,true);assert.equal(app.summary().errors,1);assert.equal(app.summary().corrected,1);assert.equal(app.summary().independent,2);
 const fresh=create();const restored=fresh.app.sanitize(clone(state.libraryPractice));assert.deepEqual(clone(restored.records[0]),first);return {interveningDistinctCards:2,firstWrongPreserved:true,aidedCorrection:true};
});
check('Single-card wrong answer still defers10minutes and stops without demanding18attempts',()=>{
 const item=data.library.items.find(x=>x.es==='agua'&&x.type==='word'),{app,state,events}=create();app.start([item]);app.handleInput({id:'lp-answer',value:'incorrecto'});const now=Date.now();app.handleClick(b('data-lp-check'));assert(events[0].deferUntil>=now+600000);app.handleClick(b('data-lp-next'));assert.equal(state.libraryPractice.queue.length,0);assert.equal(state.libraryPractice.records.length,1);assert(app.render().includes('Короткий подход завершён'));return {attempts:1,deferredMinimumMs:600000};
});
report.passed=true;const out=path.join(root,'.impeccable/review-v27');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'library-practice-integrity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
