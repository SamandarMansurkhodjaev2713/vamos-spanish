/* Pinned, field-level source guard plus independent teaching/audio boundaries. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=__dirname,revision='f18373bdcfd4c71017b106f9f46f40e7d2eff6e0';
const json=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const baseline=f=>JSON.parse(execFileSync('git',['show',revision+':'+f],{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024}));
const clone=x=>JSON.parse(JSON.stringify(x));
const guidance=json('course-guidance.json'),goals=json('course-goals.json');
const oldGuidance=baseline('course-guidance.json'),oldGoals=baseline('course-goals.json');
// Only these exact fields may change. No lesson reordering, other metadata or deletion.
const allowedGuidance={2:['missionPrep'],5:['missionPrep'],9:['quizPrep','ownPrep'],10:['missionPrep','ownPrep'],11:['missionPrep','quizPrep'],13:['missionPrep'],15:['missionPrep'],16:['missionPrep'],23:['quizPrep']};
const allowedGoals={26:['personalPrompt'],30:['personalPrompt']};
const checks=[];
function check(name,fn){const detail=fn();checks.push({name,...detail});}
function guard(current,original,allowed,label){
 assert.equal(current.lessons.length,30,label+' has all 30 days');
 assert.deepEqual(current.lessons.map(l=>l.day),original.lessons.map(l=>l.day),label+' order/identity');
 const a=clone(current),b=clone(original);
 for(let i=0;i<a.lessons.length;i++){
  const day=a.lessons[i].day;
  for(const key of allowed[day]||[]){
   assert(Object.hasOwn(a.lessons[i],key),label+' required '+day+'.'+key);
   assert.notDeepEqual(a.lessons[i][key],b.lessons[i][key],label+' expected reviewed change '+day+'.'+key);
   if(label==='guidance'&&day===11&&key==='quizPrep'){const currentPrep=clone(a.lessons[i][key]),oldPrep=clone(b.lessons[i][key]);delete currentPrep.noteRu;delete oldPrep.noteRu;assert.deepEqual(currentPrep,oldPrep,'Only the day11 meaning note may change');}
   delete a.lessons[i][key];delete b.lessons[i][key];
  }
 }
 assert.deepEqual(a,b,label+' unrelated source must match pinned baseline');
}
const lesson=(source,day)=>source.lessons.find(l=>l.day===day);
check('Exact pinned source scope',()=>{
 guard(guidance,oldGuidance,allowedGuidance,'guidance');
 guard(goals,oldGoals,allowedGoals,'goals');
 return {guidanceFields:12,goalFields:2,unchangedGuidanceDays:21,unchangedGoalDays:28};
});
check('Guard rejects unrelated edits, extra fields, day swaps and deletion',()=>{
 const bad=[
  ['guidance',x=>lesson(x,11).miniRule.explanation+=' Unreviewed change.'],
  ['guidance',x=>lesson(x,11).quizPrep.es='Una mañana diferente.'],
  ['guidance',x=>lesson(x,14).missionPrep=clone(lesson(x,13).missionPrep)],
  ['guidance',x=>x.lessons.reverse()],
  ['guidance',x=>delete lesson(x,13).missionPrep],
  ['guidance',x=>x.scope='Changed source scope'],
  ['goals',x=>lesson(x,25).personalPrompt='Unreviewed task.'],
  ['goals',x=>lesson(x,26).missionVerification='Unreviewed evidence.'],
  ['goals',x=>delete lesson(x,30).personalPrompt]
 ];
 for(const [type,mutate]of bad){const x=clone(type==='guidance'?guidance:goals);mutate(x);assert.throws(()=>guard(x,type==='guidance'?oldGuidance:oldGoals,type==='guidance'?allowedGuidance:allowedGoals,type));}
 return {rejectedMutations:bad.length};
});
const expected=[
 [2,1,'Gracias.','Спасибо.','437777'],
 [5,2,'¿A qué te dedicas?','Чем ты занимаешься?','441321'],
 [10,1,'Prefiero leer porque es interesante.','Я предпочитаю читать, потому что это интересно.',null],
 [11,2,'¿Trabajas hoy?','Ты сегодня работаешь?',null],
 [13,1,'A veces voy a pie.','Иногда я хожу пешком.',null],
 [13,1,'A veces desayuno aquí.','Иногда я завтракаю здесь.',null],
 [15,1,'¿Y tú, estás bien?','А у тебя всё хорошо?',null],
 [16,0,'¡Qué bien!','Как здорово!',null],
 [16,1,'Lo siento.','Мне жаль.','48650']
];
check('Prepared Spanish and Russian address exactly the required communicative action',()=>{
 const rows=Object.keys(allowedGuidance).flatMap(Number).flatMap(day=>(lesson(guidance,day).missionPrep||[]).flatMap(p=>p.frames.map(f=>[day,p.step,f.es,f.ru,f.audio])));
 assert.deepEqual(rows,expected);
 for(const [day,step,es]of expected){
  const row=lesson(guidance,day).missionPrep.find(p=>p.step===step);
  assert.equal(typeof row.frames.find(f=>f.es===es).noteRu,'string');
  assert(row.frames.find(f=>f.es===es).noteRu.trim().length>20,'Useful explanation '+day);
 }
 assert.match(lesson(guidance,13).missionPrep[0].frames[0].noteRu,/частот/);
 assert.match(lesson(guidance,16).missionPrep[0].frames[0].noteRu,/хорошую новость/);
 assert.match(lesson(guidance,16).missionPrep[1].frames[0].noteRu,/не сможет прийти/);
 return {preparedFrames:rows.length,steps:8};
});
check('Every preparation model is valid for its matching training turn; no control preparation data',()=>{
 const missions=json('mission-data.json');let matches=0;
 for(const [day,step,es]of expected){
  const variants=missions.days.find(d=>d.day===day).variants.filter(v=>v.mode==='train');
  const matching=variants.filter(v=>v.turns[step]?.rule.forms?.includes(es));
  assert(matching.length>0,'Prepared model has an actual matching training turn '+day+': '+es);
  for(const v of matching)for(const example of v.turns[step].examples)assert(v.turns[step].rule.forms.includes(example),'Shown example is accepted '+v.id);
  matches+=matching.length;
 }
 // A frequency response must contribute frequency, a reaction must reflect the partner's news.
 for(const v of missions.days.find(d=>d.day===13).variants.filter(v=>v.mode==='train'))assert.match(v.turns[1].partner.es,/^Normalmente /);
 for(const v of missions.days.find(d=>d.day===16).variants.filter(v=>v.mode==='train')){
  assert.match(v.turns[0].partner.es,/^Estoy content[oa]\.$/);
  assert.equal(v.turns[1].partner.es,'No puedo.');
  assert.match(v.context,/встреч/);
 }
 return {matchingTrainingModels:matches,controlsCoveredBy:'actual Missions runtime in check-preparation-v29.cjs'};
});
check('Human recording IDs retain exact captions and attribution; missing recordings stay missing',()=>{
 const expanded=json('course-expanded.json'),attr=json('web/assets/audio/ATTRIBUTION.json');let audio=0,textOnly=0;
 for(const [day,,es,,id]of expected){
  const frame=lesson(guidance,day).missionPrep.flatMap(p=>p.frames).find(f=>f.es===es);
  if(id){assert.equal(frame.audio,id);assert.equal(expanded.audio[id].text,es);assert.equal(attr[id].text,es);assert.equal(attr[id].unaltered,true);assert(attr[id].license);audio++;}
  else{assert.equal(frame.audio,null);textOnly++;}
 }
 for(const day of [9,10])for(const f of lesson(guidance,day).ownPrep.frames)assert(!f.audio,'New own question has no invented recording '+day);
 for(const day of [9,23])assert(!lesson(guidance,day).quizPrep.audio,'New combination has no invented recording '+day);
 return {humanFrames:audio,textOnlyMissionFrames:textOnly,textOnlyOwnFrames:2,textOnlyQuizFrames:2};
});
check('Own and quiz scaffolds prepare person/reason/time before retrieval',()=>{
 assert.equal(lesson(guidance,9).quizPrep.es,'Mi película favorita es…');
 assert.equal(lesson(guidance,9).ownPrep.frames[0].es,'¿Cuál es tu película favorita?');
 assert.match(lesson(guidance,9).quizPrep.noteRu,/Mi — мой\/моя; su .*его\/её/);
 assert.equal(lesson(guidance,10).ownPrep.frames[0].es,'¿Por qué?');
 assert.match(lesson(guidance,10).ownPrep.frames[0].noteRu,/Porque.*потому что/);
 assert.equal(lesson(guidance,11).quizPrep.noteRu,'Учи por la mañana как одно выражение: «утром». Mañana как наречие часто значит «завтра»; как существительное — «утро».');
 assert.equal(lesson(guidance,10).ownPrep.frames[0].noteRu,'Вопрос о причине: por qué пишется раздельно и с ударением — «почему». Porque слитно и без ударения — «потому что» в ответе: prefiero leer porque es interesante. Короткий вопрос пригодится после выбора собеседника.');
 assert.equal(lesson(guidance,23).quizPrep.es,'Ayer trabajé. Mañana voy a estudiar.');
 assert.match(lesson(guidance,23).quizPrep.noteRu,/вчера.*завтра/);
 assert.match(lesson(goals,26).personalPrompt,/четыре записи без текста.*три факта по-русски/);
 assert.match(lesson(goals,26).personalPrompt,/не понял.*спроси именно о ней/);
 assert.match(lesson(goals,30).personalPrompt,/три разговора по две минуты/);
 assert.match(lesson(goals,30).personalPrompt,/только один трудный обмен/);
 return {newQuestionFrames:2,personalTasks:2};
});
fs.mkdirSync(path.join(root,'.impeccable/review-v30'),{recursive:true});
fs.writeFileSync(path.join(root,'.impeccable/review-v30/curriculum-source-check.json'),JSON.stringify({pass:true,baseline:revision,checks,limits:'Finite source scope and teaching/audio alignment. Does not measure pronunciation, learning outcomes or CEFR.'},null,2));
console.log('PASS '+checks.length+' pinned curriculum groups');
