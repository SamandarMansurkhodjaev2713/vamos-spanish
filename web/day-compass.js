/* A read-only day plan until an explicit learning action. Links are never completion. */
window.VamosDayCompass={create(api){
 'use strict';const {state,data,esc,icon=()=>'',mascot=()=>''}=api;
 const list=x=>Array.isArray(x)?x:[],valid=n=>Number.isInteger(n)&&n>=1&&n<=30;
 const lessons=new Map(list(data.lessons).filter(l=>valid(l.day)).map(l=>[l.day,l]));let selected=null;
 const latest=a=>a?.retries?.at(-1)||a?.first;
 const safeURL=s=>typeof s==='string'&&/^https:\/\/(?:www\.)?(?:tuespanol\.ru|videoele\.com|profedeele\.es|youtube\.com)\//.test(s);
 function videoFor(day){
  const curated=list(data.videoGuide?.items).filter(v=>list(v.suggestedCoreDays).includes(day)&&safeURL(v.url));
  const preferred=curated.find(v=>v.language==='ru-es')||curated.find(v=>v.language==='es');if(preferred)return preferred;
  const sourceId=({5:'jobs',9:'likes',14:'likes',16:'people',18:'weekend',19:'clock',20:'weekend',21:'weekend',26:'people',27:'people',29:'greetings',30:'likes'})[day];
  const source=list(data.sources).find(v=>v.id===sourceId&&safeURL(v.url));return source?{...source,language:'es',languageLabel:'Испанский · необязательно'}:null;
 }
 function evidence(day){
  const completed=list(state.completed).includes(day),saved=state.learning?.sessions?.[day];
  const repair=list(data.repair?.lessons).find(l=>l.day===day),review=list(repair?.tasks).map(t=>state.repairPractice?.answers?.[t.id]).filter(a=>a?.first);
  const reviewAnswers=review.length,reviewRecovered=review.filter(a=>(!a.first.correct||a.first.aided)&&latest(a)?.correct===true&&latest(a)?.aided===false).length;
  const mission=list(state.missions?.history).filter(h=>h?.day===day&&list(h.responses).some(r=>r?.first)).at(-1);
  const story=list(data.stories?.days).find(s=>s.day===day),work=state.workbook?.days?.[day];
  const storyCorrect=story?list(story.questions).filter(t=>latest(work?.answers?.[day+':story:'+t.id])?.correct===true).length:0;
  const spoken=work?.own?.story?.said===true;
  const own=list(state.studio?.history).filter(h=>h?.day===day&&h.step===4&&Number.isFinite(h.finished)&&h.finished>0&&['independent','help','retry'].includes(h.rating)).at(-1);
  return {reviewAnswers,reviewRecovered,lessonCompleted:completed,lessonStage:!completed&&Number.isInteger(saved?.stage)&&saved.stage>=0&&saved.stage<7?saved.stage:null,missionResponses:mission?list(mission.responses).filter(r=>r?.first).length:0,storyCorrect,storyTotal:list(story?.questions).length,storySpoken:spoken,ownRating:own?.rating||null};
 }
 function context(day=selected){
  if(!valid(day)||!lessons.has(day))return null;
  const lesson=lessons.get(day);
  const active=state.studio?.active,activeOther=valid(active?.day)&&Number.isInteger(active.step)&&active.step>=0&&active.step<4&&active.day!==day?active.day:null;
  const isRecovery=state.recovery!==false&&[22,23].includes(day),contentDay=day===24?(Number.isInteger(state.repairDay)&&state.repairDay>=1&&state.repairDay<=23?state.repairDay:1):isRecovery?(day===22?19:20):day;
  const effectiveGoal=list(data.goals?.lessons).find(g=>g.day===contentDay),effectiveLesson=lessons.get(contentDay),story=list(data.stories?.days).find(s=>s.day===contentDay);
  const requested=api.nextDay?.(),nextDay=valid(requested)?requested:valid(state.day)?state.day:1;
  const completed=list(state.completed).includes(day),openOnly=!!activeOther||completed||day!==nextDay;
  const model=list(data.expanded?.lessons).find(l=>l.day===contentDay),quote=list(model?.examples).find(p=>p.audio&&data.expanded?.audio?.[p.audio]?.text===p.es)||null;
  return {day,title:effectiveLesson?.title||lesson.title,goal:effectiveGoal?.goal||effectiveLesson?.goal||lesson.goal,minutes:((active?.day===day?!active.reviewSkipped:api.dueKeys?.().length)?35:30),previous:day>1?day-1:null,next:day<30?day+1:null,activeOther,openOnly,completed,contentDay,recovery:isRecovery,quote,video:videoFor(contentDay),story,check:effectiveLesson?.check||effectiveGoal?.personalPrompt||model?.mission||lesson.goal,record:evidence(contentDay),steps:[{id:'review',title:'Вернуть знакомое',minutes:5,detail:day===1?'В первом занятии этот этап пропускается: знакомых карточек ещё нет.':'Вспомни вчерашнюю фразу до образца. Если трудно, восстанови смысл и верни её после двух других заданий.'},{id:'lesson',title:'Разобрать модель и попробовать',minutes:13,detail:'Послушай точные записи, пойми различия и выполни задания урока. Две-три фразы лучше большого списка.'},{id:'mission',title:'Ответить собеседнику',minutes:10,detail:'Пройди сцену по цели дня. Сначала ответь по смыслу, затем поменяй один факт и дай другому следующий ход.'},{id:'speech',title:'Сказать о себе',minutes:7,detail:'Закрой образец. Скажи свою версию вслух, затем проверь одну трудность. Запись голоса и самооценка — по желанию.'}]};
 }
 const button=(action,text,extra='')=>`<button type="button" class="btn ${action==='begin'?'primary':'quiet'}" data-compass-action="${action}" data-compass-day="${selected}" ${extra}>${text}</button>`;
 function recordHTML(r,sourceDay){
  const own=({independent:'устная попытка отмечена без опоры',help:'устная попытка отмечена с опорой',retry:'отмечено желание повторить устный ответ'})[r.ownRating];
  return `<section class="compass-record" aria-labelledby="compass-record-title"><h3 id="compass-record-title">Что уже сохранено по теме дня ${sourceDay}</h3><dl><dt>Повторение</dt><dd>${r.reviewAnswers?r.reviewAnswers+' первых ответов; позже без новой помощи восстановлено '+r.reviewRecovered:'Пока нет сохранённых ответов в короткой практике'}</dd><dt>Урок</dt><dd>${r.lessonCompleted?'Выполнен по записи курса':r.lessonStage!==null?'Сохранён на шаге '+(r.lessonStage+1)+' из 7':'Пока нет завершённого урока'}</dd><dt>Разговор</dt><dd>${r.missionResponses?r.missionResponses+' ответов в сохранённой попытке':'Пока нет сохранённой разговорной попытки'}</dd><dt>История</dt><dd>${r.storyCorrect?r.storyCorrect+' из '+r.storyTotal+' заданий по смыслу верны':'Пока нет проверенных ответов'}${r.storySpoken?'; своя устная версия отмечена тобой':''}</dd><dt>Свой ответ</dt><dd>${own||'Пока нет отметки в завершённом занятии'}</dd></dl><p class="small">Открытие материала не добавляет выполнение. Устные отметки — твоя самооценка; сайт не подтверждает уровень и не оценивает акцент.</p></section>`;
 }
 function html(day){
  selected=valid(day)&&lessons.has(day)?day:null;const c=context();if(!c)return '';
  const l=lessons.get(day),ownCheck=c.check,video=c.video,videoText=video?`<div class="compass-video"><h3>${esc(video.language==='ru-es'?'Видео с объяснением по-русски':'Видео на испанском · по желанию')}</h3><p>${esc(video.title)}</p><p><strong>До:</strong> ${esc(video.before)}</p><p><strong>После:</strong> ${esc(video.after)}</p><p class="small">${esc(video.status||'Сведения взяты из каталога курса.')} Полный просмотр не обязателен и не закрывает задания.</p>${button('video','Открыть видео '+icon('external-link'))}</div>`:'<p class="small">На этот день подходящее проверенное видео не назначено. Для звука используй точные записи внутри урока.</p>';
  return `<section class="day-compass" aria-labelledby="day-compass-title"><button type="button" class="btn quiet compass-home" data-nav="home">${icon('arrow-left')} На главную</button><header class="compass-header"><div><p class="small">День ${day} из 30 · план на 35 минут</p><h1 id="day-compass-title">${esc(c.title)}</h1><p class="compass-goal">${esc(c.goal)}</p></div>${mascot('think')}</header>${c.activeOther?`<p class="compass-current">Сейчас сохраняется занятие дня ${c.activeOther}. Просмотр этого плана его не сбрасывает. Выбранный урок можно открыть отдельно; текущее занятие сохранится.</p>`:''}${c.recovery?`<p class="compass-current">Сейчас включён путь восстановления: день ${day} повторяет модели дня ${c.contentDay}. Планы, прошедшее время и восстановление не смешиваются автоматически.</p>`:''}${day===24?`<p class="compass-current">Это день восстановления: сейчас выбрана тема дня ${c.contentDay}. Выбрать другую тему можно внутри урока.</p>`:''}<div class="compass-start">${button('begin',c.openOnly?'Открыть выбранный урок '+icon('arrow-right'):'Начать / продолжить занятие '+icon('arrow-right'))}<span>Можно остановиться и продолжить позже.</span></div><ol class="compass-steps">${c.steps.map((s,i)=>`<li><span class="compass-number" aria-hidden="true">${i+1}</span><div><div class="compass-step-title"><h3>${esc(s.title)}</h3><span>${s.minutes} мин</span></div><p>${esc(s.detail)}</p></div></li>`).join('')}</ol><div class="compass-can"><h3>Попробуй после занятия</h3><p>${esc(ownCheck)}</p><p class="small">Сделай одну попытку без чтения. Если пока нужна опора, вернись к трудной фразе; это полезнее отметки за просмотр.</p></div><details class="compass-materials"><summary>Дополнительные материалы и практика</summary><div><p>Выбери один материал вместо части 13-минутного разбора. Дополнения не нужно проходить все за один день.</p><div class="compass-material-links">${button('review','Повторить отдельно')}${button('mission','Разговор отдельно')}${button('speech','Произношение отдельно')}${button('words',icon('book-open')+' Слова и точные записи')}${c.story?button('story',icon('book-open')+' История: '+esc(c.story.title)):''}</div>${videoText}</div></details>${recordHTML(c.record,c.contentDay)}<nav class="compass-day-nav" aria-label="Просмотреть соседний день">${c.previous?`<button type="button" class="btn quiet" data-day-plan="${c.previous}">${icon('arrow-left')} День ${c.previous}</button>`:''}${c.next?`<button type="button" class="btn quiet" data-day-plan="${c.next}">День ${c.next} ${icon('arrow-right')}</button>`:''}</nav></section>`;
 }
 function click(b){
  if(!b.hasAttribute('data-compass-action'))return false;
  const day=Number(b.getAttribute('data-compass-day')),action=b.getAttribute('data-compass-action');if(!valid(day)||!lessons.has(day)||day!==selected)return true;
  const c=context(day);if(action==='begin')api.beginDay?.(day);else if(action==='lesson')api.beginDay?.(day);else if(action==='review')api.openPractice?.('repair',day);else if(action==='mission')api.openPractice?.('mission',day);else if(action==='speech')api.openPractice?.('pronunciation',day);else if(action==='words')api.openWords?.(day);else if(action==='story'&&c.story){if(api.openReading)api.openReading(day);else api.openPractice?.('workbook',day);}else if(action==='video'&&c.video)api.openVideo?.(c.video,day);
  return true;
 }
 return {html,click,context};
}};
