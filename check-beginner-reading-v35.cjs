/* Exact source captions, immutable media and real reader state. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),beginner=JSON.parse(read('course-reader-beginner.json'));
const corpus=new Map(JSON.parse(read('.cache/audio-corpus/spanish-audio.json')).map(a=>[String(a.audioId),a]));
const data={beginnerReading:beginner,stories:JSON.parse(read('course-stories.json')),library:JSON.parse(read('course-library.json')),pathway:JSON.parse(read('pathway-data.json')),expanded:JSON.parse(read('course-expanded.json')),wordAudio:JSON.parse(read('word-audio.json'))};
const state={day:1,audioSpeed:.5,completed:[1],reader:{},library:{favorites:[]}},node={focus(){},getBoundingClientRect:()=>({top:0,bottom:0}),setAttribute(){}},c={window:{scrollY:200,scrollTo(){}},Date,Map,Set,CSS:{escape:String},document:{querySelector:()=>node,querySelectorAll:()=>[]}};
vm.createContext(c);vm.runInContext(read('web/reader.js').replace('return {toggle,html,render:html,','return {auditTokens:()=>[...tokenMap.values()],toggle,html,render:html,'),c);
const api=c.window.VamosReader.create({data,state,esc:String,icon:()=>'',playButton:(id,label)=>`<button data-audio="${id}">${label}</button>`,audioStatus:()=>'',audioControls:()=>'',audioCredit:()=>'',save(){},render(){},footer:()=>'',mascot:()=>''});
function click(attribute,value=''){const key=attribute.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());assert.equal(api.click({dataset:{[key]:String(value)},hasAttribute:a=>a===attribute}),true);}
assert.equal(beginner.books.length,6);assert.equal(beginner.books.filter(b=>b.level==='A1').length,3);assert.equal(beginner.books.filter(b=>b.level==='A2').length,3);
for(const b of beginner.books){
 assert(['story','article'].includes(b.formatId));assert(b.lines.length>=5);assert.equal(b.es,b.lines.map(l=>l.es).join(' '));
 for(const l of b.lines){const a=beginner.clips[l.audio],original=corpus.get(String(a.audioId));assert(a&&original);assert.equal(l.es,original.text);assert.equal(a.text,l.es);assert.equal(original.speaker,'arh');assert.equal(original.license,a.license);assert(l.ru.trim());const bytes=fs.readFileSync('web/'+a.file);assert.equal(bytes.length,a.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);assert(a.unaltered);}
 for(const t of b.tasks){assert.equal(new Set(t.options).size,t.options.length);assert(Number.isInteger(t.answer)&&t.answer>=0&&t.answer<t.options.length);assert((t.feedback||t.explanation)?.length>10);}
 for(const t of api.auditTokens().filter(t=>t.bookId===b.id)){assert(t.ru?.trim(),'Missing meaning '+t.key);assert.equal(b.lines[t.line].es.slice(t.offset,t.offset+t.text.length),t.text);}
 api.enter(b.id);assert.match(api.html(),/data-reader-play/);assert.match(api.html(),/Перевод предложения/);
 click('data-reader-answer',(b.task.answer+1)%b.task.options.length);click('data-reader-check');assert.equal(state.reader.rows[b.id].attempts[0].correct,false);
 click('data-reader-translation',0);click('data-reader-answer',b.task.answer);click('data-reader-check');assert.equal(state.reader.rows[b.id].attempts.at(-1).correct,true);assert.equal(state.reader.rows[b.id].attempts.at(-1).aided,true);assert.match(api.html(),/Ещё две маленькие практики/);assert.equal(state.reader.rows[b.id].attempts[0].correct,false);
}
click('data-reader-back');click('data-reader-beginner');assert.equal((api.html().match(/class="reader-book"/g)||[]).length,6);assert.match(api.html(),/Начни здесь/);assert.deepEqual(state.completed,[1]);
console.log('PASS six A1–A2 texts, source-exact human media, full glossary, all quiz retries and beginner filter.');
