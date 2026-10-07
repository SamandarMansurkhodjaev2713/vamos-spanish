'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=__dirname,load=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const data={goals:load('course-goals.json'),expanded:load('course-expanded.json')};
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(base,'web/goals.js'),'utf8'),context);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=context.window.VamosGoals.create({data,esc,icon:()=>'',playButton:id=>`<button data-audio="${esc(id)}">Слушать</button>`,profile:()=>({name:'<img src=x onerror=alert(1)>',city:'<script>x</script>',interest:'<img src=x onerror=alert(2)>'})});
for(let day=1;day<=30;day++){
 const html=api.contract(day),personal=api.personal(day);
 assert.match(html,/^<details class="goal-contract">/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
 for(const heading of ['Тренируем по записи','Узнаём в тексте','Проверяем самостоятельно'])assert.ok(html.includes(heading));
 assert.equal((html.match(/data-audio=/g)||[]).length,3);
 assert.ok(personal.includes(esc(api.item(day).warmup))&&personal.includes(esc(api.item(day).personalPrompt))&&personal.includes(esc(api.item(day).reviewContrast)));
 assert.doesNotMatch(personal,/<(?:img|script)\b/);
 const hasInterest=[8,9,10,11,12,13,14,16,20,25,27,30].includes(day);
 assert.equal(personal.includes('Твой интерес (записанная заметка)'),hasInterest);
 if(hasInterest){assert.ok(personal.includes('&lt;img src=x onerror=alert(2)&gt;'));assert.ok(personal.includes(esc(api.item(day).textPattern)));assert.ok(personal.includes('произвольная подстановка'));}
 assert.equal(api.feedback({day,answer:'unrecognised valid alternative',target:'Prefiero leer.',correct:false}),'');
}
const known=[
 [20,'Voy estudiar francés.','Voy a estudiar francés.','пропущено a'],
 [20,'Voy trabajar.','Voy a trabajar.','пропущено a'],
 [1,'Me llamas Andrea.','Me llamo Andrea.','me llamo'],
 [1,'Te llamo Andrea.','Me llamo Andrea.','Te llamo'],
 [4,'Vivo de Moscú.','Vivo en Moscú.','месте проживания'],
 [4,'Vivo en Brasil.','Soy de Brasil.','происхождение'],
 [4,'Soy de Moscú.','Vivo en Moscú.','происхождение'],
 [2,'Soy bien.','Estoy bien.','estoy'],
 [8,'Yo gusto viajar.','Me gusta viajar.','me gusta'],
 [17,'Yo también.','A mí también.','исходной репликой'],
 [17,'A mí también.','Yo también.','Prefiero leer'],
 [18,'Quiero un café.','¿Quieres un café?','вопрос'],
 [18,'¿Quieres un café?','Quiero un café.','своё желание'],
 [12,'Son las dos.','A las dos.','¿A qué hora?'],
 [12,'A las dos.','Son las dos.','сейчас времени'],
 [10,'Prefiero la música por que es interesante.','Prefiero la música porque es interesante.','одним словом'],
 [28,'No entiendo eso.','No lo sé.','ответа не знаешь']
];
for(const [day,answer,target,fragment]of known){
 const message=api.feedback({day,stage:'typed',answer,target,correct:false});assert.ok(message.includes(fragment),`${answer} => ${message}`);
 assert.equal(api.feedback({day,answer,target,correct:true}),'');
 assert.equal(api.feedback({day,answer:target,target,correct:false}),'');
 assert.equal(api.feedback({day,answer:answer+' otra frase',target,correct:false}),'');
}
for(const [answer,target]of [
 ['Quiero leer.','Prefiero leer.'],['Me gusta la música.','Prefiero leer.'],
 ['Soy de Madrid.','Soy de Brasil.'],['Vivo en Roma.','Vivo en Moscú.'],
 ['Estoy contenta.','Estoy contento.'],['No sé.','No lo sé.'],
 ['¿Puedes repetir?','¿Podrías repetir eso?'],['¿Y tú?','¿Cómo te llamas?'],
 ['Voy a estudiar español.','Voy a estudiar francés.'],
 ['Prefiero la música porqué es interesante.','Prefiero la música porque es interesante.']
])assert.equal(api.feedback({day:20,answer,target,correct:false}),'');
assert.equal(api.contract(0),'');assert.equal(api.personal(31),'');
assert.equal(api.feedback({day:31,answer:'voy trabajar',target:'voy a trabajar',correct:false}),'');
const arrayApi=context.window.VamosGoals.create({data:{...data,goals:data.goals.lessons},esc,playButton:()=>''});assert.ok(arrayApi.contract('10'));
assert.doesNotMatch(api.personal(8,{interest:'   '}),/Твой интерес/);
assert.doesNotMatch(api.personal(8,{interest:{unexpected:'object'}}),/Твой интерес/);
assert.ok(api.personal(8,{interest:'плавание'}).includes('Твой интерес (записанная заметка): плавание'));
console.log('PASS: 30 closed disclosures and goal prompts; escaped profile; 17 exact diagnostic pairs; 10 plausible alternatives; bounded unknown/correct feedback; array/object data support.');
