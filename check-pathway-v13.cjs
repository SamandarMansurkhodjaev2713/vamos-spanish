const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=JSON.parse(fs.readFileSync('pathway-data.json','utf8'));
const base=JSON.parse(fs.readFileSync('course-expanded.json','utf8'));
const sources=JSON.parse(fs.readFileSync('course-blueprint.json','utf8')).sources;
const context={window:{},Date,Number,String,Array,Object,Map,RegExp};vm.createContext(context);vm.runInContext(fs.readFileSync('web/pathway.js','utf8'),context);
const state={day:30,pathway:{selectedDay:900,days:{900:{},31:{answers:{fake:{first:{correct:true,time:Date.now()}}},position:999,oral:{attempted:true,rating:99}}}}};
const api={state,data:{pathway:data},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),save(){},render(){},toast(){},footer:()=>'',playButton:()=>''};
const m=context.window.VamosPathway.create(api);
const button=(attr,value='')=>({hasAttribute:x=>x===attr,getAttribute:x=>x===attr?String(value):null});
const click=(name,value)=>m.click(button('data-pw-'+name,value));
const change=(id,value)=>m.change({id,value:String(value),hasAttribute:()=>false});
const input=value=>m.input({id:'pathway-answer',value});
assert.equal(state.day,30);assert.equal(state.pathway.selectedDay,31);assert.equal(state.pathway.days[31].position,0);assert.equal(state.pathway.days[31].oral.rating,null);assert.deepEqual(Object.keys(state.pathway.days[31].answers),[]);
assert.equal(data.days.length,60);assert.deepEqual(data.days.map(d=>d.day),Array.from({length:60},(_,i)=>31+i));assert.equal(new Set(data.days.map(d=>d.model.es)).size,60);
assert.equal(data.readings.length,10);assert.equal(new Set(data.readings.map(r=>r.text)).size,10);assert.deepEqual([...new Set(data.readings.map(r=>r.level))],['A1','A2','B1','B2','C1']);
for(const d of data.days){
 assert.equal(d.minutes,35);assert.equal(d.plan.reduce((n,p)=>n+p.minutes,0),35);assert.equal(d.tasks.length,3);assert.equal(d.prerequisite,d.day-1);
 assert.ok(d.vocabulary.length>=2&&d.model.rule.length>20);assert.ok(data.readings.some(r=>r.id===d.readingId));
 assert.equal(base.audio[d.nativeReview.audio]?.text,d.nativeReview.es,`exact audio day ${d.day}`);
 assert.ok(!Object.values(base.audio).some(a=>a.text===d.model.es),`extension must be new, day ${d.day}`);
 for(const t of d.tasks){assert.ok(t.id&&t.prompt&&t.help&&t.explanation);if(t.kind==='choice'){assert.ok(Number.isInteger(t.answer)&&t.answer>=0&&t.answer<t.options.length);assert.equal(new Set(t.options).size,t.options.length);}else assert.ok(t.accepted.length&&t.accepted.every(a=>a.length>5));}
 for(const v of d.videos)assert.ok(sources.some(s=>s.id===v.id&&s.url===v.url&&s.status===v.status));
}
for(const b of data.readings){assert.ok(b.editorial);assert.equal(b.tasks.length,2);assert.ok(b.text.length>80&&b.translation.length>80);assert.ok(b.glossary.length>=3);assert.ok(b.text.toLowerCase().replace(/[.,;:]/g," ").includes(b.tasks[1].accepted[0].toLowerCase().replace(/[.,;:]/g," ").trim()));}
// No completion from a cursor, trusted booleans, missing responses, or an oral tick alone.
assert.equal(m.summary().completedDays.length,0);
click('next');assert.equal(state.pathway.days[31].position,0);
click('check');assert.equal(Object.keys(state.pathway.days[31].answers).length,0);
// Wrong answer then repair: immutable first attempt and sticky correction aid.
click('choice',99);assert.equal(state.pathway.days[31].drafts.meaning.value,null);
click('choice',1);click('check');const first=JSON.stringify(state.pathway.days[31].answers.meaning.first);assert.equal(state.pathway.days[31].answers.meaning.first.correct,false);click('next');assert.equal(state.pathway.days[31].position,0);
click('choice',0);click('check');assert.equal(JSON.stringify(state.pathway.days[31].answers.meaning.first),first);assert.equal(state.pathway.days[31].answers.meaning.retries[0].aided,true);click('next');
// Opening then closing help is not independent evidence.
click('help');click('help');input(data.days[0].model.es);click('check');assert.equal(state.pathway.days[31].answers.produce.first.aided,true);click('next');
input(data.days[0].tasks[2].accepted[0]);click('check');click('next');
let rb=data.readings.find(r=>r.id===data.days[0].readingId);click('translation');click('translation');click('choice',rb.tasks[0].answer);click('check');click('next');
assert.equal(state.pathway.days[31].position,4);assert.ok(!m.html('pathway').includes('class="pathway-text"'));input(rb.tasks[1].accepted[0]);click('check');assert.equal(state.pathway.days[31].answers['reading-recall'].first.aided,true);click('next');assert.equal(m.summary().completedDays.length,0);
m.change({id:'',checked:true,hasAttribute:x=>x==='data-pw-oral'});assert.equal(m.summary().completedDays.length,0);change('pathway-rating',3);assert.equal(m.summary().completedDays.length,0);change('pathway-rating',1);assert.deepEqual(Array.from(m.summary().completedDays),[31]);assert.equal(state.day,30);
// End boundary and every real authored key can actually be completed.
for(const d of data.days.slice(1)){
 change('pathway-day',d.day);m.html('pathway');
 for(const t of [...d.tasks,...data.readings.find(r=>r.id===d.readingId).tasks]){if(t.kind==='choice')click('choice',t.answer);else input(t.accepted[0]);click('check');click('next');}
 assert.equal(m.summary().completedDays.includes(d.day),false);m.change({id:'',checked:true,hasAttribute:x=>x==='data-pw-oral'});change('pathway-rating',0);assert.equal(m.summary().completedDays.includes(d.day),true);
}
assert.equal(m.summary().completedDays.length,60);click('following');assert.equal(state.pathway.selectedDay,90);change('pathway-day',91);assert.equal(state.pathway.selectedDay,90);assert.equal(state.day,30);
// Reading library is independent and genuinely requires both tasks.
m.enter('c1-memory','reading');m.html('reading');assert.equal(m.summary().completedReadings.length,0);rb=data.readings.at(-1);click('choice',rb.tasks[0].answer);click('check');click('next');assert.equal(m.summary().completedReadings.length,0);assert.ok(!m.html('reading').includes('class="pathway-text"'));click('text');click('text');input(rb.tasks[1].accepted[0]);click('check');click('next');assert.equal(m.summary().completedReadings[0],'c1-memory');assert.equal(state.pathway.readings['c1-memory'].answers.recall.first.aided,true);
change('pathway-level','A1');assert.equal(state.pathway.selectedReading,'a1-home');change('pathway-reading','<script>');assert.equal(state.pathway.selectedReading,'a1-home');assert.equal(state.day,30);
// Sanitization discards unknown keys and recomputes correctness from submitted answer.
const now=Date.now(),raw={selectedDay:31,days:{31:{position:100,completed:true,answers:{meaning:{first:{value:1,correct:true,time:now}},produce:{first:{value:'<img src=x>',correct:true,time:now}},reply:{first:{value:data.days[0].tasks[2].accepted[0],correct:true,time:now+1000000}},unknown:{first:{correct:true,time:now}}},drafts:{produce:{value:'a'.repeat(4000),help:true,aided:false},unknown:{}},oral:{attempted:true,rating:1}}}};
const cleaned=m.sanitize(raw);assert.equal(cleaned.days[31].position,0);assert.equal(cleaned.days[31].answers.meaning.first.correct,false);assert.equal(cleaned.days[31].answers.produce.first.correct,false);assert.equal(cleaned.days[31].answers.reply,undefined);assert.equal(cleaned.days[31].answers.unknown,undefined);assert.equal(cleaned.days[31].drafts.produce.value.length,1000);assert.equal(cleaned.days[31].drafts.produce.aided,true);assert.equal(cleaned.days[31].completed,undefined);
// Merge preserves earliest evidence, and imported bad later evidence cannot erase failure.
m.merge(raw);assert.equal(state.pathway.days[31].answers.meaning.first.correct,false);assert.equal(state.day,30);
const reloaded=context.window.VamosPathway.create({...api,state:{day:30,pathway:JSON.parse(JSON.stringify(state.pathway))}});assert.equal(reloaded.summary().completedDays.includes(31),false);assert.equal(reloaded.summary().completedDays.length,59);
// Saved reader vocabulary requires typed retrieval before any review schedule.
click('save-word','unknown:0');assert.equal(m.summary().savedWords.length,0);
click('save-word','a1-home:0');m.html('reading');assert.equal(m.summary().savedWords.length,1);assert.equal(m.summary().dueWords.length,1);
change('pathway-word-rating',2);assert.equal(state.pathway.words['a1-home:0'].due,0);
m.input({id:'pathway-word-answer',value:'wrong'});click('word-check');const wf=JSON.stringify(state.pathway.words['a1-home:0'].answers.recall.first);assert.equal(state.pathway.words['a1-home:0'].answers.recall.first.correct,false);
click('word-help');click('word-help');m.input({id:'pathway-word-answer',value:data.readings[0].glossary[0].es});click('word-check');assert.equal(JSON.stringify(state.pathway.words['a1-home:0'].answers.recall.first),wf);assert.equal(state.pathway.words['a1-home:0'].answers.recall.retries[0].aided,true);
change('pathway-word-rating',2);assert.ok(state.pathway.words['a1-home:0'].due>Date.now());assert.ok(state.pathway.words['a1-home:0'].due<Date.now()+2*86400000);assert.equal(m.summary().dueWords.length,0);
const imported=m.sanitize({words:{'a1-home:0':state.pathway.words['a1-home:0'],'evil:1':{}},selectedWord:'evil:1'});assert.equal(Object.keys(imported.words).length,1);assert.equal(imported.selectedWord,null);assert.equal(imported.words['a1-home:0'].answers.recall.first.correct,false);
assert.equal(data.readings.filter(r=>r.tasks[0].answer===1).length,5);assert.ok(data.days[30].tasks[2].accepted.some(s=>s.includes('niña')));assert.ok(data.days[57].tasks[2].accepted.some(s=>s.includes('segura')));assert.equal(data.days[40].model.es,'Creo que estudiar un poco cada día funciona mejor.');
console.log('PASS: 60 days, 300 daily checks, 10 editorial readings, balanced choice keys, finite boundaries, exact audio, 9 curated video days, genuine completion, immutable first attempts, sticky aid, import/reload, saved-word typed retrieval and schedule.');
