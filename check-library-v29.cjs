/* Finite library integrity and actual-module interaction checks. No general grammar grader. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const library=json('course-library.json'),expanded=json('course-expanded.json'),baseline=JSON.parse(cp.execFileSync('git',['show','b0d0421e19e499e7e351a717b5e065e7a0a3d38e:course-library.json'],{cwd:root,encoding:'utf8'}));
const norm=s=>s.normalize('NFC').toLocaleLowerCase('es').replace(/\p{P}/gu,'').replace(/\s+/gu,' ').trim();
const report={passed:false,checks:[],limits:['Finite editorial review and exact-key practice, not a general Spanish grammar judge.','Conditional word-audio renderer tested with an isolated fixture when the root word-audio corpus is not yet integrated.','Browser sizing, playback, keyboard focus and real geometry require a separate integrated CUA check.']};
function check(name,fn){fn();report.checks.push(name)}
check('All316 identities and315 old objects preserved; one witnessed usage correction',()=>{for(const old of baseline.items){const current=library.items.find(x=>x.id===old.id);if(old.id==='phrase:v16:por-la-manana'){const fixed={...old,usage:'Por la mañana — утром. Самостоятельное mañana часто значит «завтра»; esta mañana — «сегодня утром». Значение зависит от сочетания и контекста.'};assert.deepEqual(current,fixed)}else assert.deepEqual(current,old)}assert.equal(baseline.items.length,316);const como=library.items.find(x=>x.id==='word:v27:recorded-como-a429cf');assert.equal(como.context,'¿Cómo se dice esto en español?');assert.equal(como.contextRu,'Как это сказать по-испански?');assert.equal(como.audio,null)});
const added=library.items.filter(x=>x.id.includes(':v27:')),topicAdded=added.filter(x=>!x.id.includes(':recorded-')),recordedAdded=added.filter(x=>x.id.includes(':recorded-'));
check('Independent editorial fixes: matching gender and clear written-accent explanation',()=>{
 const find=id=>added.find(x=>x.id===id);
 assert.equal(find('word:v27:contacts-4').context,'Encantado de conocerte.');assert.equal(find('word:v27:contacts-4').contextRu,'Рад познакомиться с тобой.');
 assert.equal(find('word:v27:wellbeing-4').context,'Estoy preocupado.');assert.equal(find('word:v27:wellbeing-4').contextRu,'Я обеспокоен.');
 assert.equal(find('word:v27:work-1').context,'Mi compañero trabaja conmigo.');assert.equal(find('word:v27:work-1').contextRu,'Мой коллега работает со мной.');
 assert(find('word:v27:transport-1').usage.includes('без письменного знака ударения'));
});
check('164 unique useful entries in all 16 themes; keys, exact captions and translations valid',()=>{
 assert.equal(added.length,164);assert.equal(topicAdded.length,128);const allIds=library.items.map(x=>x.id),oldKeys=new Set(baseline.items.map(x=>x.reviewKey)),newKeys=added.map(x=>x.reviewKey);assert.equal(new Set(allIds).size,allIds.length);assert.equal(new Set(newKeys).size,newKeys.length);newKeys.forEach(k=>assert(!oldKeys.has(k)));
 const seen=new Set(baseline.items.map(x=>norm(x.es)));for(const x of added){assert(!seen.has(norm(x.es)),x.es);seen.add(norm(x.es));assert(library.categories.some(t=>t.id===x.categoryId));assert.equal(library.itemThemes[x.id],x.categoryId);assert(x.day>=1&&x.day<=30);assert(x.usage.length>30);assert(x.context&&x.contextRu&&x.ru);assert.deepEqual(x.accepted,[x.es]);if(x.audio)assert.equal(expanded.audio[x.audio].text,x.context)}
 for(const t of library.categories){const entries=topicAdded.filter(x=>x.categoryId===t.id);assert.equal(entries.length,8);assert.equal(entries.filter(x=>x.type==='word').length,4);assert.equal(entries.filter(x=>x.type==='phrase').length,2);assert.equal(entries.filter(x=>x.type==='sentence').length,2)}
 assert.equal(added.filter(x=>x.audio).length,7);
});
const noop=()=>{},button=(attr,value='')=>({hasAttribute:n=>n===attr,dataset:{[attr.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value}});
let lastHTML='',lastPlay=null;
const state={cards:{},reviewSize:6,audioSpeed:.5,library:{favorites:['word:hola'],known:[],difficult:[],notes:{},pageSize:6,layout:'list',hideTranslation:false}};
const wordAudio=json('word-audio.json');
check('36 independently witnessed basic translations; exact standalone caption coverage for all51 recordings',()=>{
 const witnesses=[['ahí','там (недалеко)'],['bueno','хороший'],['comer','есть (принимать пищу)'],['con','с'],['cuándo','когда (в вопросе)'],['cómo','как (в вопросе)'],['decir','сказать / говорить'],['dormir','спать'],['día','день'],['dónde','где / куда (в вопросе)'],['esto','это (без названного предмета)'],['grande','большой'],['mujer','женщина'],['noche','ночь / вечер'],['nosotros','мы (мужская или смешанная группа)'],['nuevo','новый'],['pequeño','маленький'],['rojo','красный'],['sal','соль'],['sol','солнце'],['tres','три'],['uno','один (самостоятельно)'],['venir','приходить / приезжать сюда'],['ver','видеть / смотреть'],['verde','зелёный'],['yo','я'],['blanco','белый'],['caliente','горячий / тёплый'],['caminar','идти пешком / ходить'],['cerca','близко / рядом'],['cinco','пять'],['correcto','правильный'],['cuatro','четыре'],['negro','чёрный'],['niño','ребёнок / мальчик'],['quién','кто (в вопросе)']];
 assert.equal(recordedAdded.length,witnesses.length);for(const[es,ru]of witnesses){const x=recordedAdded.find(x=>x.es===es);assert(x,es);assert.equal(x.ru,ru);assert.equal(x.audio,null);assert.equal(wordAudio.clips[wordAudio.words[es]].text,es);assert(new RegExp('(^|[^\\p{L}])'+es+'($|[^\\p{L}])','iu').test(x.context),es);}
 for(const es of Object.keys(wordAudio.words))assert(library.items.some(x=>x.type==='word'&&x.es===es),es);
});
const data={library,expanded,wordAudio:{...wordAudio,words:{...wordAudio.words,hola:'isolated-word-fixture'}}};
const c={window:{scrollTo:noop},Date,console,scrollY:250,scrollTo:noop,CSS:{escape:s=>s},document:{querySelector:()=>null,getElementById:()=>null}};vm.createContext(c);vm.runInContext(read('web/library.js'),c);vm.runInContext(read('web/library-practice.js'),c);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const api={data,state,esc,plain:norm,icon:()=>'<svg aria-hidden="true"></svg>',coach:{highlight:(a,b)=>esc(a),explanation:()=>''},startScene:noop,playButton:(id,label)=>`<button type="button" data-audio="${esc(id)}" aria-label="${esc(label)}">Play</button>`,audioCredit:x=>`Credit ${esc(x.audio)}`,audioStatus:()=>'',audioControls:()=>'',recorderHTML:()=>'',footer:()=>'',save:noop,toast:noop,sound:noop,render:()=>lastHTML=app.render(),startSet:noop,openLesson:noop,playSequence:(ids,b)=>lastPlay=ids,stopRecording:noop};
api.practice=c.window.VamosLibraryPractice.create(api);
const app=c.window.VamosLibrary.create(api);
check('Exact ES/RU entry wins over context matches; prefixes precede context and explicit sorts break relevance ties',()=>{
 const ids=html=>[...html.matchAll(/data-lib-item="([^"]+)"/g)].map(m=>m[1]);
 for(const query of ['agua','вода']){app.handleClick(button('data-lib-reset'));app.handleInput({id:'word-search',value:query});for(const value of ['day','alpha','short']){app.handleChange({id:'lib-sort',value,hasAttribute:()=>false});assert.equal(ids(app.render())[0],'word:agua',query+' / '+value)}}
 const fixture=[{id:'test:context',type:'word',es:'zeta',ru:'зета',day:1,context:'Agua fresca.',contextRu:'Свежая вода.',reviewKey:'test:context'},{id:'test:prefix-z',type:'phrase',es:'Agua z',ru:'вода Z',day:2,reviewKey:'test:prefix-z'},{id:'test:prefix-a',type:'phrase',es:'Agua a',ru:'вода A',day:3,reviewKey:'test:prefix-a'},{id:'test:exact',type:'word',es:'agua',ru:'вода',day:30,reviewKey:'test:exact'},{id:'test:accent',type:'word',es:'sí',ru:'да',day:1,reviewKey:'test:accent'},{id:'test:plain',type:'word',es:'si',ru:'если',day:30,reviewKey:'test:plain'}];
 const probe=c.window.VamosLibrary.create({...api,data:{...data,library:{...library,items:fixture}},plain:v=>norm(v).normalize('NFD').replace(/\p{M}/gu,'')});
 probe.handleInput({id:'word-search',value:'agua'});assert.deepEqual(ids(probe.render()),['test:exact','test:prefix-z','test:prefix-a','test:context']);probe.handleChange({id:'lib-sort',value:'alpha',hasAttribute:()=>false});assert.deepEqual(ids(probe.render()),['test:exact','test:prefix-a','test:prefix-z','test:context']);
 probe.handleInput({id:'word-search',value:'si'});assert.equal(ids(probe.render())[0],'test:plain');probe.handleInput({id:'word-search',value:'sí'});assert.equal(ids(probe.render())[0],'test:accent');
 app.handleClick(button('data-lib-reset'));
});
check('Immediately visible exact word / whole phrase controls, persistent tempo and all-type search',()=>{
 lastHTML=app.render();assert(lastHTML.includes('Слушать слово: hola'));assert(lastHTML.includes('data-audio="isolated-word-fixture"'));assert(lastHTML.includes('Слушать всю фразу: Me llamo Andrea.'));assert(lastHTML.includes('В записи — фраза целиком'));assert(lastHTML.includes('value="0.5" selected'));assert(!lastHTML.includes('data-lib-select='));
 app.handleInput({id:'word-search',value:'¿De dónde eres?'});lastHTML=app.render();assert(lastHTML.includes('sentence:v27:contacts-7'));assert(!lastHTML.includes('word:hola'));
});
check('Topic, recording filter, favorites, selection and reset operate without changing existing evidence',()=>{
 app.handleClick(button('data-lib-reset'));app.handleChange({id:'lib-topic',value:'home',hasAttribute:()=>false});lastHTML=app.render();assert(lastHTML.includes('Дом и вещи'));assert(!lastHTML.includes('word:hola'));
 app.handleClick(button('data-lib-audio'));lastHTML=app.render();assert(!lastHTML.includes('словарь: padding'));const before=JSON.stringify(state.cards);app.handleClick(button('data-lib-reset'));app.handleClick(button('data-lib-status','favorite'));lastHTML=app.render();assert(lastHTML.includes('word:hola'));assert(!lastHTML.includes('word:me'));
 app.handleClick(button('data-lib-selection'));lastHTML=app.render();assert(lastHTML.includes('data-lib-select="word:hola"'));assert.equal(JSON.stringify(state.cards),before);assert.deepEqual(state.library.favorites,['word:hola']);
});
check('Real standalone word recording makes a text-only-context entry immediately playable',()=>{
 app.handleClick(button('data-lib-reset'));app.handleInput({id:'word-search',value:'frío'});app.handleClick(button('data-lib-type','word'));app.handleClick(button('data-lib-audio'));lastHTML=app.render();assert(lastHTML.includes('word:v27:wellbeing-1'));assert(lastHTML.includes('data-audio="'+wordAudio.words['frío']+'"'));assert(lastHTML.includes('Слушать слово: frío'));assert(!lastHTML.includes('Без записи'));
});
check('Detail has direct word play, full context play and single-item actual practice',()=>{
 app.handleClick(button('data-lib-reset'));app.handleClick(button('data-lib-open','word:me'));lastHTML=app.render();const contextual=library.items.find(x=>x.id==='word:me');assert(lastHTML.includes('Слушать всю фразу: Me llamo Andrea.'));assert(lastHTML.includes('data-audio="'+contextual.audio+'"'));assert(lastHTML.includes('class="recorded-context"'));
 app.handleClick(button('data-lib-open','word:hola'));lastHTML=app.render();assert(lastHTML.includes('Разбор слова'));assert(lastHTML.includes('data-audio="isolated-word-fixture"'));assert(lastHTML.includes('Слушать слово: hola'));assert(lastHTML.includes('Credit isolated-word-fixture'));assert(!lastHTML.includes('class="recorded-context"'));assert(!lastHTML.includes('Слушать всю фразу: Hola.'));
 app.handleClick(button('data-lib-practice-item','word:hola'));assert(api.practice.active());assert.deepEqual(JSON.parse(JSON.stringify(state.libraryPractice.ids)),['word:hola']);api.practice.handleInput({id:'lp-answer',value:'hola'});api.practice.handleClick(button('data-lp-check'));assert.equal(state.libraryPractice.records[0].correct,true);api.practice.stop();
});
check('All164 canonical keys accepted; different meaning and accent omission rejected where applicable',()=>{
 for(const x of added){api.practice.start([x],'Test');api.practice.handleInput({id:'lp-answer',value:x.es});api.practice.handleClick(button('data-lp-check'));assert.equal(state.libraryPractice.records[0].correct,true,x.es);api.practice.start([x],'Test');api.practice.handleInput({id:'lp-answer',value:'otra respuesta diferente'});api.practice.handleClick(button('data-lp-check'));assert.equal(state.libraryPractice.records[0].correct,false,x.es)}
 const x=added.find(x=>x.es==='andén');api.practice.start([x]);api.practice.handleInput({id:'lp-answer',value:'anden'});api.practice.handleClick(button('data-lp-check'));assert.equal(state.libraryPractice.records[0].correct,false);api.practice.stop();
});
check('Legacy text immediate playback queues its exact original lines',()=>{
 app.handleClick(button('data-lib-play-item','text:1'));assert.deepEqual(JSON.parse(JSON.stringify(lastPlay)),library.items.find(x=>x.id==='text:1').lines.map(x=>x.audio));
});
report.passed=true;report.counts=library.contentExpansion.counts;report.added=164;report.recordedContextAdded=7;report.standaloneWordCoverage=51;
const out=path.join(root,'.impeccable/review-v29');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'library-integrity.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
