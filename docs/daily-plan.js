/* Read-only teaching directions. Viewing a plan never awards learning evidence. */
window.VamosDailyPlan={create(api){
 'use strict';
 const {data,state={},esc,icon=()=>'',playButton=()=>'',audioStatus=()=>'',audioCredit=()=>''}=api;
 const rows=new Map((Array.isArray(data.dailyPlan?.lessons)?data.dailyPlan.lessons:[]).filter(x=>Number.isInteger(x.day)&&x.day>=1&&x.day<=30).map(x=>[x.day,x]));
 const valid=n=>Number.isInteger(n)&&n>=1&&n<=30;
 const phaseIds=['review','lesson','mission','own'];
 const phaseNames={review:'Повторение',lesson:'Урок',mission:'Разговор',own:'Свой ответ'};
 function context(day,options={}){
  if(!valid(day)||!rows.has(day))return null;
  let contentDay=day;
  if(day===24)contentDay=valid(state.repairDay)&&state.repairDay<=23?state.repairDay:1;
  else if(state.recovery!==false&&[22,23].includes(day))contentDay=day===22?19:20;
  const active=state.studio?.active,captured=active?.contentDay;
  const bound=valid(captured)&&(day===22?[19,22].includes(captured):day===23?[20,23].includes(captured):day===24?captured<=23:captured===day);
  if(active?.day===day&&Number.isInteger(active.step)&&active.step>=0&&active.step<4&&bound)contentDay=captured;
  if(valid(options?.contentDay))contentDay=options.contentDay;
  const row=rows.get(contentDay);if(!row)return null;
  const reviewSkipped=options?.reviewSkipped===true||(options?.reviewSkipped!==false&&day===1);
  const missionDay=valid(options?.missionDay)?options.missionDay:contentDay;
  const missionVariants=data.missions?.days?.find(d=>d.day===missionDay)?.variants||[];
  const mission=missionVariants.find(v=>v.id===options?.missionVariantId)||missionVariants.find(v=>v.mode==='train');
  const missionTurnCount=Array.isArray(mission?.turns)?mission.turns.length:null;
  const phases=row.phases.filter(p=>!reviewSkipped||p.id!=='review').map(p=>p.id==='mission'?{...p,instructions:p.instructions.map(x=>x.id==='scene'?{...x,instruction:x.instruction.replace('Пройди три ответа разговорной сцены дня.','Пройди все реплики разговорной сцены дня.'),oralAttempts:missionTurnCount??x.oralAttempts}:x)}:p);
  const minutes=phases.reduce((n,p)=>n+p.minutes,0);
  return {day,contentDay,row,phases,minutes,missionDay,missionTurnCount,reviewSkipped,recovery:contentDay!==day,
   recoveryNotice:contentDay===day?'':day===24?'День восстановления: сегодня тренируем выбранную тему дня '+contentDay+'.':'Сегодня восстанавливаем тему дня '+contentDay+' вместо новых временных форм.',
   plannedListening:phases.reduce((n,p)=>n+p.instructions.reduce((sum,x)=>sum+x.listeningAttempts,0),0),
   plannedOral:phases.reduce((n,p)=>n+p.instructions.reduce((sum,x)=>sum+x.oralAttempts,0),0)};
 }
 function brief(day,options={}){
  const c=context(day,options);if(!c)return '';
  return `<section class="daily-plan-brief" aria-label="Задача занятия"><p class="daily-plan-time">День ${day} · около ${c.minutes} минут</p><p class="daily-plan-result">${esc(c.row.goal)}</p>${c.recoveryNotice?`<p class="daily-plan-recovery">${esc(c.recoveryNotice)}</p>`:''}<p class="daily-plan-dose">3 модели · 6 прослушиваний в уроке · ${esc(c.row.ownPracticeLabel)}</p>${options?.action===true?`<button type="button" class="btn primary" data-studio-begin>Начать занятие ${icon('arrow-right')}</button>`:''}<details class="daily-plan-details"><summary>Что делать по шагам</summary><div>${outline(c)}<p class="small">30–40 минут — ориентир. При затруднении повтори одну фразу или продолжи занятие позже.</p></div></details></section>`;
 }
 function modelsHTML(c){return `<ul class="daily-plan-models">${c.row.models.map(m=>`<li><div><span lang="es">${esc(m.es)}</span><p>${esc(m.ru)}</p></div>${playButton(m.audio,'Слушать: '+m.es,true)}</li>`).join('')}</ul>`;}
 function cycleHTML(day,modelIndex,cycle,options={}){
  const c=context(day,options);
  if(!c||!Number.isInteger(modelIndex)||modelIndex<0||modelIndex>2||!Number.isInteger(cycle)||cycle<0||cycle>2)return '';
  const m=c.row.models[modelIndex];
  const title=['Пойми на слух','Повтори два раза','Вспомни без текста'][cycle];
  const instruction=[
   'Послушай запись и сопоставь её с русским смыслом. Затем послушай ещё раз, отведя взгляд от испанского текста.',
   'Послушай образец и повтори вслух два раза. Сохраняй порядок слов и короткие паузы; если трудно, выбери темп 0,5×.',
   'Испанская фраза скрыта. Скажи по-испански: «'+m.ru+'». Только после попытки открой модель и сравни. Опора — нормальная часть обучения.'
  ][cycle];
  return `<aside class="daily-plan-cycle" aria-label="Фраза ${modelIndex+1} из 3"><p class="small">Фраза ${modelIndex+1} из 3 · действие ${cycle+1} из 3</p><h2>${esc(title)}</h2><p>${esc(instruction)}</p></aside>`;
 }
 function outline(c){return `<ol class="daily-plan-outline">${c.phases.map(p=>`<li><strong>${esc(phaseNames[p.id])}</strong><span>≈ ${p.minutes} мин</span><p>${esc(p.instructions[0].instruction)}</p></li>`).join('')}</ol>`;}
 function phaseHTML(day,phase,options={}){
  const c=context(day,options);if(!c)return '';
  const phaseId=Number.isInteger(phase)?phaseIds[phase]:phase;
  const p=c.phases.find(x=>x.id===phaseId);if(!p)return '';
  const headingId='daily-teacher-'+day+'-'+phaseId,compact=options.compact===true&&phaseId==='own';
  return `<aside class="daily-plan-teacher" aria-labelledby="${headingId}"><div class="daily-plan-phase-heading"><h2 id="${headingId}">${esc(compact?'Вторая попытка и сравнение':p.title)}</h2><span>≈ ${p.minutes} мин</span></div>${compact?'':`<p>${esc(p.instructions[0].instruction)}</p>`}${phaseId==='own'?ownListeningHTML(c):''}${p.instructions.length>1?`<details><summary>${phaseId==='lesson'?'После прослушивания':'Следующая попытка'}</summary><ol>${p.instructions.slice(1).map(x=>`<li>${esc(x.instruction)}</li>`).join('')}</ol></details>`:''}${phaseId==='own'?transferHTML(c):''}</aside>`;
 }
 function ownListeningHTML(c){
  const task=c.row.ownListening;if(!task)return '';
  return `<section class="daily-plan-listening" aria-label="Четыре реплики на слух"><h3>Сначала слушай без текста</h3><p>${esc(task.instructions)}</p><div class="daily-plan-audio-set">${task.models.map((m,i)=>`<div><span>Реплика ${i+1}</span>${playButton(m.audio,'Слушать реплику '+(i+1),true)}</div>`).join('')}</div><label class="daily-plan-speed">Темп<select data-audio-speed aria-label="Скорость четырёх реплик">${[.5,.75,.85,1,1.25].map(v=>`<option value="${v}" ${v===state.audioSpeed?'selected':''}>×${String(v).replace('.',',')}</option>`).join('')}</select></label>${audioStatus()}<details class="daily-plan-listening-check"><summary>После попытки: сверить услышанное</summary><ol>${task.models.map(m=>`<li><p lang="es">${esc(m.es)}</p><p>${esc(m.ru)}</p></li>`).join('')}</ol><ul>${task.criteria.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="small">Смысл сверяешь сам. Открытие текста — опора; факт прослушивания и точность устной речи здесь не оцениваются автоматически.</p><details><summary>Записи и лицензии</summary>${task.models.map(m=>audioCredit(m)).join('')}</details></details></section>`;
 }
 function transferHTML(c){
  const task=c.row.transfer,support=task.support;
  return `<details class="daily-plan-transfer"><summary>После попытки: проверить себя и найти опору</summary><p>${esc(task.prompt)}</p><ul>${task.criteria.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${support?`<div class="daily-plan-support"><h3>Короткие опоры</h3><ul class="daily-plan-frames">${support.frames.map(f=>`<li><p lang="es">${esc(f.es)}</p><p>${esc(f.ru)}</p>${f.noteRu?`<p class="small">${esc(f.noteRu)}</p>`:''}</li>`).join('')}</ul>${support.partnerCues.length?`<h3>Роль собеседника, если учишься один</h3><p>${esc(support.instructions)}</p><div class="daily-plan-partner-cues">${support.partnerCues.map(cue=>`<div><h4>${esc(cue.label)}</h4><p lang="es">${esc(cue.es)}</p><p>${esc(cue.ru)}</p>${cue.audio?playButton(cue.audio,'Слушать реплику собеседника: '+cue.es,true):'<p class="small">Текстовая учебная реплика; отдельной записи нет.</p>'}</div>`).join('')}</div>${c.row.ownListening?'':audioStatus()}<details><summary>Записи реплик и лицензии</summary>${support.partnerCues.filter(cue=>cue.audio).map(cue=>audioCredit(cue)).join('')}</details>`:''}<p class="small">${esc(support.evidence)}</p></div>`:''}<p class="small">Проверь смысл сам. Галочка в задании и понятная устная реплика — разные результаты.</p></details>`;
 }
 function tomorrowHTML(day,options={}){
  const c=context(day,options);if(!c)return '';
  const t=c.row.tomorrow;
  return `<section class="daily-plan-tomorrow"><h2>Завтра: 3 минуты до нового урока</h2><p>${esc(t.instruction)}</p><p class="daily-plan-recall">Скажи по-испански: <strong>${esc(t.promptRu)}</strong></p><details><summary>Образец — после своей попытки</summary><div><p lang="es">${esc(t.modelEs)}</p>${playButton(t.audio,'Слушать образец: '+t.modelEs,true)}</div></details><details><summary>Применить в другой ситуации</summary><p>${esc(t.transferPrompt)}</p></details><p class="small">${esc(t.scheduling)}</p></section>`;
 }
 function html(day,options={}){
  const c=context(day,options);if(!c)return '';
  return `<section class="daily-plan" aria-label="Методичка дня ${day}">${brief(day,options)}<details class="daily-plan-model-section"><summary>Три фразы дня</summary>${modelsHTML(c)}</details>${c.phases.map(p=>`<details class="daily-plan-phase"><summary>${esc(phaseNames[p.id])} · ≈ ${p.minutes} мин</summary>${phaseHTML(day,p.id,options)}</details>`).join('')}${tomorrowHTML(day,options)}<p class="small">${esc(c.row.evidenceNotice)}</p></section>`;
 }
  return {context,brief,cycleHTML,phaseHTML,tomorrowHTML,html,phases:(day,options)=>context(day,options)?.phases||[],estimate:(day,options)=>context(day,options)?.minutes||0};
}};
