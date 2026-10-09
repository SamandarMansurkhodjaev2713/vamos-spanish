/* Pure module/state tests. Browser layout, audible media and touch are checked separately. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=__dirname,data={stories:JSON.parse(fs.readFileSync(path.join(base,'course-stories.json'),'utf8')),library:JSON.parse(fs.readFileSync(path.join(base,'course-library.json'),'utf8')),pathway:JSON.parse(fs.readFileSync(path.join(base,'pathway-data.json'),'utf8')),expanded:JSON.parse(fs.readFileSync(path.join(base,'course-expanded.json'),'utf8')),wordAudio:{words:{hola:'word-hola'},clips:{'word-hola':{text:'hola'}}}};
const source=fs.readFileSync(path.join(base,'web/reader.js'),'utf8'),results=[];
function environment(reader){
 const win={scrollY:450,scrollTo({top}){this.scrollY=top}},played=[],state={day:8,audioSpeed:.5,library:{favorites:['word:me']},pathway:{legacy:'keep'},workbook:{days:{1:{legacy:'keep'}}},reader},ui={focuses:0,renders:0,saves:0};
 const node={focus({preventScroll}){assert.equal(preventScroll,true);ui.focuses++}},document={querySelector(){return node}};
 const box={window:win,document,CSS:{escape:s=>s},Date,Map,Set,JSON};vm.createContext(box);vm.runInContext(source,box);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=box.window.VamosReader.create({data,state,esc,icon:s=>`<i>${s}</i>`,mascot:s=>`<div class="mascot">${s}</div>`,playButton:(id,label)=>`<button data-audio="${esc(id)}" aria-label="${esc(label)}">Слушать</button>`,audioControls:()=>'',audioStatus:()=>'<p id="audio-status"></p>',audioCredit:p=>`<p>Лицензия ${p.audio}</p>`,footer:()=>'<footer></footer>',save:()=>ui.saves++,render:()=>ui.renders++,toast:()=>{},playSequence:(ids,b)=>played.push([...ids]),startScene:id=>ui.scene=id,openReading:id=>ui.reading=id,openWorkbook:day=>ui.workbook=day});
 return {api,state,win,played,ui};
}
function button(attribute,value=''){const key=attribute.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return {dataset:{[key]:String(value)},hasAttribute:a=>a===attribute};}
function click(e,key,v){assert.equal(e.api.click(button(key,v)),true);}
function test(name,fn){fn();results.push({name,pass:true});}
test('Catalog exposes 12 original recorded scenes and 10 original authored readings with source/level boundaries',()=>{
 const e=environment(),books=e.api.catalog();assert.equal(books.length,52);assert.equal(books.filter(b=>b.kind==='native').length,12);assert.equal(books.filter(b=>b.kind==='authored').length,10);assert.match(e.api.html(),/Чтение/);assert.match(e.api.html(),/С нуля/);e.api.change({id:'reader-type',value:'authored'});assert.match(e.api.html(),/Авторские тексты без полной озвучки/);click(e,'data-reader-reset');assert.match(e.api.html(),/Начать с/);
 for(const b of books.filter(b=>b.kind==='native')){const original=data.library.items.find(x=>x.id===b.id);assert.equal(JSON.stringify(b.lines),JSON.stringify(original.lines));for(const line of b.lines)assert.ok(data.expanded.audio[line.audio]);}
 for(const b of books.filter(b=>b.kind==='authored')){const original=data.pathway.readings.find(x=>x.id===b.sourceId);assert.equal(b.lines.map(x=>x.es).join(' '),original.text);assert.equal(b.lines.map(x=>x.ru).join(' '),original.translation);assert.ok(b.lines.every(x=>x.audio===null));}
});
test('Every token of each original native short text has a curated or existing definition',()=>{
 const e=environment();let count=0;
 for(const b of e.api.catalog().filter(b=>b.kind==='native')){e.api.enter(b.id);const keys=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)].map(m=>m[1]);assert.ok(keys.length);for(const key of keys){click(e,'data-reader-word',key);const html=e.api.html();assert.doesNotMatch(html,/Отдельный перевод этого слова пока не добавлен/);count++;}}
 assert.ok(count>100);
});
test('Known isolated word plays exact word recording; unsupported name clearly offers full sentence',()=>{
 const e=environment();e.api.enter('text:1');const keys=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)].map(m=>m[1]);click(e,'data-reader-word',keys[0]);assert.deepEqual(e.played.at(-1),['word-hola']);assert.match(e.api.html(),/Слушать слово: Hola/);assert.doesNotMatch(e.api.html(),/В записи целиком:/);
 const andrea=keys.find(k=>k.endsWith(':2:9'));assert.ok(andrea);const n=e.played.length;click(e,'data-reader-word',andrea);assert.equal(e.played.length,n);assert.match(e.api.html(),/В записи целиком:/);assert.match(e.api.html(),/Слушать всё предложение: Me llamo Andrea/);
});
test('Unknown authored word does not invent definition/audio; sentence meaning remains available',()=>{
 const e=environment();e.api.enter('reading:a1-home');const key=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)].find(m=>m[1]==='reading:a1-home:0:4')[1];click(e,'data-reader-word',key);assert.match(e.api.html(),/Отдельный перевод этого слова пока не добавлен/);assert.match(e.api.html(),/Ана живёт в маленьком доме/);assert.equal(e.played.length,0);assert.doesNotMatch(e.api.html(),/data-reader-play/);assert.ok(!e.api.html().match(/data-reader-save=/));
});
test('Word, translation, answer and check interactions preserve scroll; word context persists after restart',()=>{
 const e=environment();e.api.enter('text:1');const key=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)][0][1];click(e,'data-reader-word',key);click(e,'data-reader-translation',0);click(e,'data-reader-answer',1);click(e,'data-reader-check');assert.equal(e.win.scrollY,450);const restored=environment(JSON.parse(JSON.stringify(e.state.reader)));assert.equal(restored.state.reader.rows['text:1'].selectedGloss,key);assert.deepEqual([...restored.state.reader.rows['text:1'].translations],[0]);assert.match(restored.api.html(),/Прочитай ещё раз/);
});
test('All 22 real meaning keys reject a wrong answer and accept the independently reviewed answer',()=>{
 const keys={'text:1':0,'text:2':1,'text:3':2,'text:4':0,'text:5':1,'text:6':1,'text:7':1,'text:8':2,'text:9':0,'text:10':0,'text:11':2,'text:12':1,'reading:a1-home':0,'reading:a1-trip':1,'reading:a1-shop':0,'reading:a2-routine':1,'reading:a2-weekend':0,'reading:a2-return':1,'reading:b1-move':0,'reading:b1-study':1,'reading:b2-library':0,'reading:c1-memory':1};
 const e=environment();for(const b of e.api.catalog().filter(b=>b.kind!=='course')){assert.equal(b.task.answer,keys[b.id],b.id);e.api.enter(b.id);const wrong=(keys[b.id]+1)%b.task.options.length;click(e,'data-reader-answer',wrong);click(e,'data-reader-check');assert.equal(e.state.reader.rows[b.id].attempts[0].correct,false);click(e,'data-reader-answer',keys[b.id]);click(e,'data-reader-check');const row=e.state.reader.rows[b.id];assert.equal(row.attempts.at(-1).correct,true);assert.equal(row.attempts[0].value,wrong);assert.match(e.api.html(),/Теперь своими словами/);}
 assert.equal(e.state.day,8);assert.deepEqual(e.state.pathway,{legacy:'keep'});
});
test('Repeat starts a fresh unaided attempt but preserves immutable first attempt and saved contexts',()=>{
 const e=environment();e.api.enter('text:1');const key=[...e.api.html().matchAll(/data-reader-word="([^"]+)"/g)][0][1];click(e,'data-reader-word',key);click(e,'data-reader-save',key);click(e,'data-reader-answer',0);click(e,'data-reader-check');const first=JSON.stringify(e.state.reader.rows['text:1'].attempts[0]);assert.equal(e.state.reader.rows['text:1'].attempts[0].aided,true);click(e,'data-reader-repeat');click(e,'data-reader-answer',0);click(e,'data-reader-check');assert.equal(e.state.reader.rows['text:1'].attempts.at(-1).aided,false);assert.equal(JSON.stringify(e.state.reader.rows['text:1'].attempts[0]),first);assert.equal(e.api.savedWords().length,1);assert.equal(e.api.savedWords()[0].es,'Hola');assert.ok(e.state.library.favorites.includes('word:hola'));assert.ok(e.state.library.favorites.includes('word:me'));
 click(e,'data-reader-save',key);assert.equal(e.api.savedWords().length,0);assert.ok(e.state.library.favorites.includes('word:hola'),'Removing reader item must not erase independently usable library favorites');
});
test('Native whole-text sequence remains 4 original clips; authored practice reuses legacy route without evidence migration',()=>{
 const e=environment();e.api.enter('text:1');click(e,'data-reader-play');assert.deepEqual(e.played[0],['437710','437710','788477','40637']);click(e,'data-reader-scene','text:1');assert.equal(e.ui.scene,'text:1');e.api.enter('reading:a1-home');click(e,'data-reader-legacy','a1-home');assert.equal(e.ui.reading,'a1-home');assert.deepEqual(e.state.pathway,{legacy:'keep'});
});
test('Sanitizer rejects invalid IDs, forged results, unbounded retries, unexpected collection values and future timestamps',()=>{
 const e=environment(),now=Date.now(),s=e.api.sanitize({selected:'fake',level:'C2',theme:'fake',saved:['fake'],rows:{'text:1':{answer:0,checked:true,attempts:[{value:1,correct:true,aided:false,time:now},{value:0,correct:true,time:now+9999999}],translations:[0,0,-1,100],selectedGloss:'fake'},fake:{answer:0}}});assert.equal(s.selected,null);assert.equal(s.level,'all');assert.equal(s.saved.length,0);assert.equal(s.rows['text:1'].attempts.length,1);assert.equal(s.rows['text:1'].attempts[0].correct,false);assert.equal(s.rows['text:1'].checked,false);assert.deepEqual([...s.rows['text:1'].translations],[0]);assert.ok(!s.rows.fake);
 const retries=Array.from({length:30},(_,i)=>({value:i%3,aided:!!(i%2),time:now-i}));const capped=e.api.sanitize({rows:{'text:1':{attempts:retries}}});assert.equal(capped.rows['text:1'].attempts.length,10);assert.equal(capped.rows['text:1'].attempts[0].time,retries[0].time);
});
test('Saved collection and filters have working empty/reset states without mutating base-course progress',()=>{
 const e=environment();e.api.change({id:'reader-level',value:'C1'});assert.equal((e.api.html().match(/class="reader-book"/g)||[]).length,1);e.api.change({id:'reader-type',value:'native'});assert.match(e.api.html(),/Текстов по этим фильтрам нет/);click(e,'data-reader-reset');assert.equal((e.api.html().match(/class="reader-book"/g)||[]).length,8);click(e,'data-reader-collection');assert.match(e.api.html(),/Здесь появятся слова/);assert.equal(e.win.scrollY,0);click(e,'data-reader-back');assert.equal(e.state.reader.selected,null);assert.equal(e.state.day,8);
});
test('Thirty course-day stories preserve original roles/sentences and manually reviewed first-question keys',()=>{
 const expected=[1,2,1,2,0,1,1,0,2,0,2,1,0,1,1,0,1,1,2,1,1,0,1,1,1,1,2,1,2,1],e=environment(),course=e.api.catalog().filter(b=>b.kind==='course');assert.equal(course.length,30);
 const workbookBefore=JSON.stringify(e.state.workbook);
 const normalize=s=>s.normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 for(const book of course){
  const original=data.stories.days.find(d=>d.day===book.day);assert.equal(book.id,'story:'+book.day);assert.equal(book.task.answer,expected[book.day-1]);assert.equal(book.mission,original.own.prompt);assert.equal(book.lines.length,original.lines.length);
  book.lines.forEach((l,i)=>{assert.equal(l.es,original.lines[i].es);assert.equal(l.ru,original.lines[i].ru);assert.equal(l.speaker,original.lines[i].role);assert.equal(l.audio,original.lines[i].audio);if(l.audio)assert.equal(normalize(data.expanded.audio[l.audio].text),normalize(l.es));});
  e.api.enter(book.id);assert.match(e.api.html(),new RegExp('День '+book.day+' ·'));const wrong=(book.task.answer+1)%book.task.options.length;click(e,'data-reader-answer',wrong);click(e,'data-reader-check');assert.equal(e.state.reader.rows[book.id].attempts[0].correct,false);click(e,'data-reader-answer',expected[book.day-1]);click(e,'data-reader-check');assert.equal(e.state.reader.rows[book.id].attempts.at(-1).correct,true);assert.match(e.api.html(),/Ещё вопросы и свой ответ/);click(e,'data-reader-workbook',book.day);assert.equal(e.ui.workbook,book.day);
 }
 e.api.enter('story:1');click(e,'data-reader-word','story:1:1:9');assert.match(e.api.html(),/Лео — имя/);e.api.enter('reading:a1-home');click(e,'data-reader-word','reading:a1-home:0:0');assert.match(e.api.html(),/Ана — имя/);assert.equal(JSON.stringify(e.state.workbook),workbookBefore);assert.equal(e.state.day,8);
});
test('Partial recordings are explicitly labeled and sequence only exact recorded lines; annotated questions are clickable chunks',()=>{
 const e=environment();e.api.enter('story:1');assert.match(e.api.html(),/Озвучено 2 из 4 реплик/);assert.match(e.api.html(),/Слушать озвученные реплики · 2/);assert.doesNotMatch(e.api.html(),/>Слушать текст</);click(e,'data-reader-play');assert.deepEqual(e.played.at(-1),['788477','40637']);
 const questionKey='story:1:0:7';click(e,'data-reader-word',questionKey);assert.match(e.api.html(),/Значение: Cómo te llamas/);assert.match(e.api.html(),/Слушать сочетание: Cómo te llamas/);assert.match(e.api.html(),/reader-word-source/);assert.match(e.api.html(),/Лицензия 444117/);
 const restored=environment(JSON.parse(JSON.stringify(e.state.reader)));assert.equal(restored.state.reader.selected,'story:1');assert.equal(restored.state.reader.rows['story:1'].selectedGloss,questionKey);
 e.api.enter('text:1');assert.match(e.api.html(),/>Слушать текст</);assert.match(e.api.html(),/value="0\.75"/);assert.match(e.api.html(),/value="0\.85"/);assert.match(e.api.html(),/value="1\.25"/);assert.doesNotMatch(e.api.html(),/value="0\.65"|value="0\.8"/);
});
test('Course filter displays all 30 days and body search includes both course and native sentences',()=>{
 const e=environment();e.api.change({id:'reader-type',value:'course'});assert.equal((e.api.html().match(/class="reader-book"/g)||[]).length,8);assert.match(e.api.html(),/По дням курса/);e.api.change({id:'reader-search',value:'Me llamo Leo'});assert.ok((e.api.html().match(/class="reader-book"/g)||[]).length>0);click(e,'data-reader-reset');e.api.change({id:'reader-type',value:'native'});e.api.change({id:'reader-search',value:'Vivo en Moscú'});assert.match(e.api.html(),/О себе за четыре фразы/);const restored=environment(JSON.parse(JSON.stringify(e.state.reader)));assert.equal(restored.state.reader.type,'native');assert.equal(restored.state.reader.search,'Vivo en Moscú');
});
test('Eight-entry pagination preserves source order, page/scroll on return and reset/clamp without awarding progress',()=>{
 const e=environment(),bookIds=()=>[...e.api.html().matchAll(/<article class="reader-book"><button type="button" data-reader-open="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(bookIds(),Array.from({length:8},(_,i)=>'story:'+(i+1)));assert.match(e.api.html(),/>52 текста</);assert.match(e.api.html(),/>1 \/ 7</);
 click(e,'data-reader-page',1);assert.equal(e.state.reader.page,1);assert.deepEqual(bookIds(),Array.from({length:8},(_,i)=>'story:'+(i+9)));click(e,'data-reader-page',-1);assert.equal(e.state.reader.page,0);
 for(let i=0;i<20;i++)click(e,'data-reader-page',1);assert.equal(e.state.reader.page,6);assert.equal(bookIds().length,4);assert.deepEqual(bookIds(),['reading:b1-move','reading:b1-study','reading:b2-library','reading:c1-memory']);
 click(e,'data-reader-open','reading:b1-move');assert.equal(e.win.scrollY,0);click(e,'data-reader-back');assert.equal(e.state.reader.page,6);assert.equal(e.win.scrollY,450);
 const restored=environment(JSON.parse(JSON.stringify(e.state.reader)));assert.equal(restored.state.reader.page,6);assert.equal((restored.api.html().match(/class="reader-book"/g)||[]).length,4);
 e.api.change({id:'reader-type',value:'course'});assert.equal(e.state.reader.page,0);assert.equal(bookIds().length,8);click(e,'data-reader-page',1);e.api.change({id:'reader-search',value:'Me llamo Leo'});assert.equal(e.state.reader.page,0);click(e,'data-reader-reset');assert.equal(e.state.reader.page,0);
 assert.equal(e.api.sanitize({page:999,type:'authored',level:'C1'}).page,0);assert.equal(e.api.sanitize({page:999}).page,6);assert.equal(e.api.sanitize({page:-1}).page,0);assert.equal(e.api.sanitize({page:1.5}).page,0);
 click(e,'data-reader-collection');e.api.enter('story:1');assert.equal(e.state.reader.collection,false);assert.match(e.api.html(),/data-reader-book="story:1"/);assert.equal(e.state.day,8);assert.deepEqual(e.state.workbook,{days:{1:{legacy:'keep'}}});assert.equal(Object.values(e.state.reader.rows).reduce((n,r)=>n+r.attempts.length,0),0);
});
const dir=path.join(base,'.impeccable/review-v27');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'reader-check.json'),JSON.stringify({scope:'Pure reader state/content behavior; no browser rendering or acoustic verification',groups:results,counts:{course:30,native:12,authored:10},pass:true},null,2));console.log(`PASS ${results.length} reader state/content groups`);
