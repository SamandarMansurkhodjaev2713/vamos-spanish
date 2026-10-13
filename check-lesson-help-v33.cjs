'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8'),context={window:{}};
vm.createContext(context);vm.runInContext(read('web/course-data.js'),context);vm.runInContext(read('web/lesson-help.js'),context);
const data=context.window.VAMOS_DATA;
data.guidance=JSON.parse(read('course-guidance.json'));data.phraseCoaching=JSON.parse(read('course-phrase-coaching.json'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const played=[];const help=context.window.VamosLessonHelp.create({data,esc,icon:()=>'',playButton:(id,label)=>{played.push({id,label});return `<button data-audio="${id}">${esc(label)}</button>`;}});
let assertions=0;
for(let day=1;day<=30;day++){
 const e=data.expanded.lessons[day-1],base=e.examples.find(p=>p.es===e.build)||e.examples[0];
 for(let stage=1;stage<=6;stage++){
  const phrase=[4,5].includes(stage)?e.examples.slice(0,3).find(p=>p.audio!==base.audio&&p.audio!==e.examples[0].audio)||e.examples[2]||base:base;
  const task=stage===1?{audio:e.examples[0].audio}:stage===2?data.lessons[day-1].practice.quiz[0]:{};
  played.length=0;const html=help.html({day,stage,phrase,task});
  assert.match(html,/^<details[^>]+data-learning-support>/);assert.doesNotMatch(html,/\bundefined\b|\bNaN\b|\bnull\b/);
  assert.doesNotMatch(html.slice(0,html.indexOf('</summary>')),new RegExp(phrase.es.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  if(stage===2){assert.equal(played.length,0);assert(!html.includes('Открыть образец'));}
  else{const expected=stage===1?e.examples[0]:phrase;assert.equal(played.length,1);assert.equal(played[0].id,expected.audio);assert.equal(played[0].label,'Слушать: '+expected.es);assert(html.includes(esc(expected.ru)));assert(html.slice(html.indexOf('Открыть образец')).includes('<p lang="es">'+esc(expected.es)+'</p>'));}
  assertions++;
 }
}
assert.equal(help.html({day:0,stage:1}), '');assert.equal(help.html({day:31,stage:1}), '');assert.equal(help.html({day:1,stage:7}), '');
const malicious={es:'<script>alert(1)</script>',ru:'<b>x</b>',audio:'missing'};const safe=help.html({day:1,stage:3,phrase:malicious});assert(!safe.includes('<script>'));assert(safe.includes('&lt;script&gt;'));assert(safe.includes('нет записи'));
const mismatch=help.html({day:1,stage:2,task:{question:'Другая задача'}});assert(!mismatch.includes(data.guidance.lessons[0].practiceHints.quiz.hintRu));
console.log(`PASS: ${assertions} real lesson/stage combinations; closed answers, exact listening audio, truthful absent recording, escaping, and mismatch guards.`);
