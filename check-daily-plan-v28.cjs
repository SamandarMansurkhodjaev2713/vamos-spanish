/* Read-only teacher-plan contracts. Timing and learning efficacy are not measured. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const plan=read('course-daily-plan.json'),expanded=read('course-expanded.json'),goals=read('course-goals.json'),guidance=read('course-guidance.json'),stories=read('course-stories.json'),missions=read('mission-data.json'),results=[];
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function env(state={recovery:false},dailyPlan=plan){const box={window:{},Map,Set,JSON,Number};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(__dirname,'web/daily-plan.js'),'utf8'),box);return box.window.VamosDailyPlan.create({state,data:{dailyPlan,missions},esc,icon:()=>'',playButton:(id,label)=>`<button data-audio="${esc(id)}">${esc(label)}</button>`,save(){throw Error('A plan must not save evidence')},render(){throw Error('A plan must not rerender the app')}});}
function test(name,fn){fn();results.push({name,pass:true})}
// Independently transcribed from the actual stage-5 recall keys, not from this plan.
const recallWitness=['¿Cómo te llamas?','¿Y tú?','Más despacio.','Vivo en Roma.','Estudio inglés.','¿Hablas español?','Me llamo Andrea.','Me gusta la música pop.','¿Te gusta la música?','Prefiero leer.','Normalmente desayuno aquí.','Ven a las dos.','Me gusta viajar.','Es interesante.','Estoy contenta.','Lo siento.','No puedo.','Quiero un café.','Ven a las dos.','Voy a estudiar francés.','Ven a las dos.','Trabajé mucho.','Hoy no trabajo.','¿Podrías repetir eso?','Quiero un café.','Vivo en Moscú.','¿Te gusta la música?','Lo siento.','Nos vemos.','¿Qué vas a hacer mañana?'];
// Editorial semantic witnesses: a changed fact, purpose or partner response for every day.
const changedWitness=[/настоящее имя/,/измени состояние/,/всё ещё быстрый/,/другом городе/,/работе или учёбе/,/говорить быстро/,/новом порядке/,/не нравится/,/свой фильм/,/чтение или музыка/,/распорядок изменился/,/выбери шесть/,/не подходит/,/не любит/,/ты доволен/,/приятную.*неприятную/,/при различии/,/предложи завтра/,/меняет время/,/вместо работы будет учёба/,/время не подходит/,/вчера.*завтра/,/сначала о завтра/,/две трудные/,/теперь хочешь воду/,/недостающий/,/односложно/,/не понял/,/смени цель/,/один трудный обмен с одним изменённым вопросом/];
test('All 30 days have one source-aligned goal and exactly three existing human models',()=>{
 assert.deepEqual(plan.lessons.map(x=>x.day),Array.from({length:30},(_,i)=>i+1));
 for(const row of plan.lessons){const i=row.day-1;assert.equal(row.goal,goals.lessons[i].goal);assert.equal(row.scene,guidance.lessons[i].scene);assert.equal(row.models.length,3);row.models.forEach((m,j)=>{assert.equal(m.es,expanded.lessons[i].examples[j].es);assert.equal(m.ru,expanded.lessons[i].examples[j].ru);assert.equal(m.audio,expanded.lessons[i].examples[j].audio);assert.equal(expanded.audio[m.audio].text,m.es)});}
});
test('Thirty delayed recall targets match independent actual-task witnesses and existing recordings',()=>{
 for(const row of plan.lessons){const t=row.tomorrow;assert.equal(t.modelEs,recallWitness[row.day-1],'day '+row.day);assert.equal(t.modelEs,expanded.audio[t.audio].text);assert.equal(t.promptRu,guidance.lessons[row.day-1].practiceHints.recall.targetRu);assert.equal(t.verification,'self');assert.match(t.scheduling,/не создаёт результат/);}
});
test('All changed-condition tasks and criteria remain distinct; own prompts and support frames are source-aligned',()=>{
 assert.equal(new Set(plan.lessons.map(x=>x.transfer.prompt)).size,30);
 for(const row of plan.lessons){assert.match(row.transfer.prompt,changedWitness[row.day-1]);assert.ok(row.transfer.criteria.length>=2&&row.transfer.criteria.length<=3);assert.equal(row.transfer.verification,'self');assert.equal(JSON.stringify(row.transfer.supportFrame),JSON.stringify(guidance.lessons[row.day-1].phraseFrames[0]));assert.ok(row.phases.find(p=>p.id==='own').instructions[0].instruction.includes(goals.lessons[row.day-1].personalPrompt));assert.equal(row.reading.id,'story:'+row.day);assert.equal(row.reading.title,stories.days[row.day-1].title);}
});
test('Full and skipped-review schedules match the four production studio phases; counts are planned, not graded',()=>{
 const turns=[3,3,3,3,3,3,4,3,3,3,3,3,3,3,3,3,3,3,4,3,4,3,3,3,3,3,4,3,3,5],api=env();for(let d=1;d<=30;d++){const c=api.context(d);assert.equal(c.minutes,d===1?30:35);assert.equal(api.estimate(d,{reviewSkipped:true}),30);assert.deepEqual([...api.phases(d,{reviewSkipped:true})].map(p=>p.id),['lesson','mission','own']);assert.equal(c.plannedListening,d===26?10:7);assert.equal(c.missionTurnCount,turns[d-1]);assert.equal(c.plannedOral,(d===26?11:12)+turns[d-1]);assert.equal(c.row.phases.find(p=>p.id==='lesson').instructions.find(x=>x.id==='hide-retrieve').oralAttempts,3);assert.match(api.brief(d),/30–40 минут — ориентир/);assert.match(api.html(d),/план практики/);assert.doesNotMatch(api.html(d),/достигнешь C1|гарантирован|без акцента|Пройди три ответа/);}
 for(const day of missions.days)for(const variant of day.variants){const c=api.context(day.day,{missionVariantId:variant.id}),phase=c.phases.find(p=>p.id==='mission');assert.equal(c.missionTurnCount,variant.turns.length);assert.equal(phase.instructions.find(x=>x.id==='scene').oralAttempts,variant.turns.length);assert.equal(c.plannedOral,(day.day===26?11:12)+variant.turns.length)}
});
test('Recovery defaults display actual content 19,20 or selected repair topic; explicit content override stays consistent',()=>{
 const api=env({repairDay:4,recovery:true});assert.equal(api.context(22).contentDay,19);assert.equal(api.context(23).contentDay,20);assert.equal(api.context(24).contentDay,4);assert.equal(api.context(24).row.goal,goals.lessons[3].goal);assert.match(api.brief(24),/тему дня 4/);assert.equal(api.context(22,{contentDay:22}).contentDay,22);assert.equal(api.context(22,{contentDay:22}).recovery,false);assert.equal(env({repairDay:100}).context(24).contentDay,1);assert.equal(env({recovery:false}).context(23).contentDay,23);
 assert.equal(api.context(22).missionDay,19);assert.equal(api.context(22).missionTurnCount,4);assert.equal(api.context(23).missionDay,20);assert.equal(api.context(24).missionDay,4);
 for(const [day,contentDay] of [[22,19],[22,22],[23,20],[23,23],[24,1],[24,23],[8,8]]){const e=env({recovery:true,repairDay:1,studio:{active:{day,step:2,contentDay}}});assert.equal(e.context(day).contentDay,contentDay);assert.equal(e.context(day).missionDay,contentDay);assert.equal(e.context(day,{contentDay:1}).contentDay,1)}
 assert.equal(env({recovery:true,studio:{active:{day:22,step:1,contentDay:20}}}).context(22).contentDay,19);assert.equal(env({recovery:true,studio:{active:{day:22,step:4,contentDay:22}}}).context(22).contentDay,19);assert.equal(env({repairDay:4,studio:{active:{day:24,step:2,contentDay:30}}}).context(24).contentDay,4);
});
test('Every lesson cycle gives a bounded single task; hidden cycle contains neither Spanish model nor audio control',()=>{
 const api=env();for(let d=1;d<=30;d++)for(let index=0;index<3;index++){const a=api.cycleHTML(d,index,0,{contentDay:d}),b=api.cycleHTML(d,index,1,{contentDay:d}),c=api.cycleHTML(d,index,2,{contentDay:d});assert.match(a,/Пойми на слух/);assert.match(b,/Повтори два раза/);assert.match(c,/Вспомни без текста/);assert.ok(c.includes(esc(plan.lessons[d-1].models[index].ru)));assert.ok(!c.includes(esc(plan.lessons[d-1].models[index].es)));assert.doesNotMatch(c,/data-audio|lang="es"/);assert.ok(a.length<700&&b.length<700&&c.length<850);}
});
test('Rendering every screen cannot mutate completion, first evidence, active sessions or personal state',()=>{
 const state={day:8,recovery:false,completed:[1,2],mastery:{days:{1:{first:{correct:false,aided:true}}}},studio:{active:{day:8,step:1}},learning:{sessions:{8:{stage:3}}},reader:{saved:['known']},library:{favorites:['phrase:hello']}};
 const before=JSON.stringify(state),api=env(state);for(let d=1;d<=30;d++){api.context(d);api.brief(d,{action:true});api.html(d);api.tomorrowHTML(d);for(let i=0;i<4;i++)api.phaseHTML(d,i);for(let i=0;i<3;i++)api.cycleHTML(d,i,2)}assert.equal(JSON.stringify(state),before);assert.match(api.brief(8,{action:true}),/data-studio-begin/);assert.doesNotMatch(api.brief(8),/data-studio-begin/);
});
test('Every own-answer task has closed practical Spanish/Russian support and exact original partner cues',()=>{
 const api=env(),norm=s=>s.normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 for(const row of plan.lessons){const support=row.transfer.support;assert.ok(support.frames.length>=2&&support.frames.length<=4);assert.ok(support.frames.every(f=>f.es.trim()&&f.ru.trim()));const html=api.phaseHTML(row.day,'own',{contentDay:row.day});assert.match(html,/<details class="daily-plan-transfer"><summary>После попытки:/);assert.doesNotMatch(html,/<details class="daily-plan-transfer"[^>]*\bopen\b/);for(const cue of support.partnerCues){assert.ok(cue.ru&&cue.label);if(cue.audio)assert.equal(norm(cue.es),norm(expanded.audio[cue.audio].text));}assert.match(support.evidence,/не подтверждает правильность/);}
 const day9=plan.lessons[8].transfer.support;assert.ok(day9.frames.some(f=>f.es==='¿Cuál es tu película favorita?'&&f.ru==='Какой твой любимый фильм?'));assert.ok(day9.frames.some(f=>f.es==='Mi película favorita es [название].'));
 const day13=plan.lessons[12].transfer.support;assert.ok(day13.frames.some(f=>f.es==='A veces voy a pie.'&&f.ru==='Иногда я хожу пешком.'));assert.ok(day13.frames.some(f=>f.es==='¿Te gusta viajar?'));
 const day16=plan.lessons[15].transfer.support;assert.deepEqual(day16.partnerCues.map(c=>c.es),['Estoy contento.','No puedo.']);assert.deepEqual(day16.frames.map(f=>f.es),['¡Qué bien!','¡Qué interesante!','Lo siento.','¿Por qué?']);assert.match(day16.frames[0].noteRu,/без аудиозаписи/);
});
test('Day26 presents all four exact listening clips before hidden transcripts, with honest self-check and no fabricated audio',()=>{
 const api=env(),row=plan.lessons[25],models=row.ownListening.models,html=api.phaseHTML(26,'own'),initial=html.split('<details class="daily-plan-listening-check">')[0];
 assert.deepEqual(models,expanded.lessons[25].examples);assert.equal(models.length,4);assert.equal((initial.match(/data-audio=/g)||[]).length,4);models.forEach((m,i)=>{assert.equal(m.es,expanded.audio[m.audio].text);assert.ok(initial.includes('Слушать реплику '+(i+1)));assert.ok(!initial.includes(esc(m.es)));assert.ok(!initial.includes(esc(m.ru)))});assert.match(initial,/Скорость четырёх реплик/);assert.match(initial,/value="0.5"/);assert.match(html,/После попытки: сверить услышанное/);assert.match(html,/точность устной речи здесь не оцениваются автоматически/);assert.equal(row.ownListening.verification,'self');assert.equal(row.ownListening.criteria.length,3);assert.equal(api.context(26).plannedListening,10);assert.equal(api.context(26).plannedOral,14);assert.doesNotMatch(api.phaseHTML(25,'own'),/daily-plan-listening-check/);
});
test('Day30 mission variation and delayed practice each use one bounded exchange; only own stage has the three final conversations',()=>{
 const row=plan.lessons[29],t=row.tomorrow,api=env(),html=api.tomorrowHTML(30);
 assert.equal(t.minutes,3);assert.equal(t.modelEs,'¿Qué vas a hacer mañana?');
 assert.match(t.transferPrompt,/только один трудный обмен/);assert.match(t.transferPrompt,/изменив один вопрос/);
 assert.match(t.transferPrompt,/сверяйся после попытки/);assert.match(t.transferPrompt,/Три разговора заново проходить не нужно/);
 assert.doesNotMatch(t.transferPrompt,/По две минуты|во втором круге/);
 assert.ok(html.includes(esc(t.transferPrompt)));assert.match(row.phases.find(p=>p.id==='own').instructions[0].instruction,/три разговора по две минуты/);
 assert.match(row.phases.find(p=>p.id==='own').instructions[0].instruction,/только один трудный обмен/);
 const baseline=JSON.parse(require('node:child_process').execFileSync('git',['show','d635122:course-daily-plan.json'],{encoding:'utf8'}));
 const missionChange=row.phases.find(p=>p.id==='mission').instructions.find(i=>i.id==='change');
 assert.match(missionChange.instruction,/только один трудный обмен/);assert.match(missionChange.instruction,/Измени один вопрос/);assert.match(missionChange.instruction,/ответь вслух один раз/);
 assert.match(missionChange.instruction,/Повторять весь разговор или три ситуации не нужно/);assert.doesNotMatch(missionChange.instruction,/По две минуты|во втором круге/);assert.equal(missionChange.oralAttempts,1);
 assert.ok(api.phaseHTML(30,'mission').includes(esc(missionChange.instruction)));
 baseline.lessons[29].tomorrow.transferPrompt=t.transferPrompt;
 baseline.lessons[29].phases.find(p=>p.id==='mission').instructions.find(i=>i.id==='change').instruction=missionChange.instruction;
 assert.deepEqual(plan,baseline,'Only two authorized day30 instruction strings change; models, metadata and progress contract stay unchanged');
});
test('Day30 extra dialogue own task is explicitly a short rehearsal and does not replace the final three scenes',()=>{
 const bank=read('exercise-bank.json'),row=bank.find(r=>r.day===30);
 assert.match(row.own,/^Дополнительная короткая репетиция, не замена итоговым трём сценам:/);
 assert.match(row.own,/около трёх минут/);assert.match(row.own,/познакомься, обсуди интерес, задай вопросы и назови план/);
 assert.match(row.own,/Затем другая сцена — договорённость о встрече/);
 const baseline=JSON.parse(require('node:child_process').execFileSync('git',['show','d635122:exercise-bank.json'],{encoding:'utf8'}));
 baseline.find(r=>r.day===30).own=row.own;assert.deepEqual(bank,baseline,'Only day30 optional own text changes; quiz answers and Spanish models stay unchanged');
});
test('Invalid routes and cycle indexes fail closed; dynamic educational text is escaped',()=>{
 const api=env();for(const d of [0,31,'1',null,NaN,Infinity]){assert.equal(api.context(d),null);assert.equal(api.html(d),'');assert.equal(api.estimate(d),0)}assert.equal(api.phaseHTML(1,'fake'),'');assert.equal(api.cycleHTML(1,3,0),'');assert.equal(api.cycleHTML(1,0,3),'');assert.equal(api.context(1,null).minutes,30);const dirty=JSON.parse(JSON.stringify(plan));dirty.lessons[0].goal='<script>boom()</script>';dirty.lessons[0].models[0].es='<img src=x onerror=boom()>';assert.doesNotMatch(env({recovery:false},dirty).html(1),/<script>|<img/);assert.match(env({recovery:false},dirty).html(1),/&lt;script&gt;/);
});
console.log(JSON.stringify({pass:true,groups:results.length,results},null,2));
