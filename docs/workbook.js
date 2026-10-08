/* Authored reading and finite model practice. Spoken attempts remain self-assessments. */
window.VamosWorkbook={create(api){
 'use strict';
 const {state,data,esc,icon,mascot,playButton,footer,save,render,toast,observe,sound}=api;
 const catalog=new Map(), byDay=new Map();
 for(const s of data.stories.days){const w=data.workshops.days.find(x=>x.day===s.day);byDay.set(s.day,{story:s,workshop:w});for(const [section,tasks]of [['story',s.questions],['workshop',w.tasks]])tasks.forEach(t=>catalog.set(s.day+':'+section+':'+t.id,{...t,day:s.day,section}));}
 const normalize=s=>String(s??'').normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').normalize('NFD').replace(/\u0301/g,'').normalize('NFC').replace(/\s+/g,' ').trim();
 const validTime=n=>Number.isFinite(n)&&n>0&&n<=Date.now()+60000;
 function sanitize(raw){
  const out={version:1,days:{}};
  for(let day=1;day<=30;day++){
   const v=raw?.days?.[day];if(!v||typeof v!=='object'||Array.isArray(v))continue;
   const row={section:['story','workshop'].includes(v.section)?v.section:'story',positions:{story:0,workshop:0},answers:{},drafts:{},translation:v.translation===true,own:{},saved:v.saved===true};
   for(const section of ['story','workshop']){
    const tasks=section==='story'?byDay.get(day).story.questions:byDay.get(day).workshop.tasks;
    row.positions[section]=Math.max(0,Math.min(tasks.length,Math.floor(Number(v.positions?.[section])||0)));
    const own=v.own?.[section];if(own)row.own[section]={text:typeof own.text==='string'?own.text.slice(0,2000):'',said:own.said===true,help:own.help===true};
    for(const t of tasks){
     const key=day+':'+section+':'+t.id, a=v.answers?.[key], d=v.drafts?.[key];
     if(d&&typeof d==='object')row.drafts[key]={choice:Number.isInteger(d.choice)&&d.choice>=0&&d.choice<t.options?.length?d.choice:null,tokens:Array.isArray(d.tokens)?[...new Set(d.tokens.filter(i=>Number.isInteger(i)&&i>=0&&i<t.tokens?.length))].slice(0,8):[],help:d.help===true,aided:d.aided===true,dirty:d.dirty===true};
     if(!a?.first||!validTime(a.first.time)||typeof a.first.correct!=='boolean')continue;
     const clean=x=>({correct:x.correct===true,aided:x.aided===true,time:x.time});
     row.answers[key]={first:clean(a.first),retries:(Array.isArray(a.retries)?a.retries:[]).filter(x=>validTime(x?.time)&&typeof x.correct==='boolean'&&x.time>=a.first.time).slice(-5).map(clean),due:Number.isFinite(a.due)&&a.due>=0&&a.due<=Date.now()+366*86400000?a.due:0};
    }
    // A cursor cannot skip an unanswered or incorrect prepared task after reload/import.
    const blocked=tasks.findIndex(t=>!latest(row.answers[day+':'+section+':'+t.id])?.correct);
    if(blocked>=0)row.positions[section]=Math.min(row.positions[section],blocked);
   }
   out.days[day]=row;
  }
  return out;
 }
 function latest(a){return a?.retries?.at(-1)||a?.first;}
 state.workbook=sanitize(state.workbook);
 let reviewKey=null,reviewEvidence=null;
 const row=()=>state.workbook.days[state.day]??=({section:'story',positions:{story:0,workshop:0},answers:{},drafts:{},translation:false,own:{},saved:false});
 const items=()=>byDay.get(state.day);
 const tasks=()=>row().section==='story'?items().story.questions:items().workshop.tasks;
 const task=()=>reviewKey?catalog.get(reviewKey):tasks()[row().positions[row().section]];
 const taskKey=t=>t.day?`${t.day}:${t.section}:${t.id}`:`${state.day}:${row().section}:${t.id}`;
 function draft(t){return row().drafts[taskKey(t)]??=({choice:null,tokens:[],help:false});}
 function own(){return row().own[row().section]??=({text:'',said:false,help:false});}
 function focus(selector='h1'){const el=document.querySelector('.workbook-page '+selector);if(el){if(!el.matches('button,input,select,textarea'))el.tabIndex=-1;el.focus({preventScroll:true});}}
 function redraw(selector,source,transition=false){
  if(typeof document==='undefined'||typeof window==='undefined'||typeof window.scrollTo!=='function'){render();return;}
  const el=source||document.activeElement,x=window.scrollX,y=window.scrollY,top=el?.getBoundingClientRect?.().top;
  let anchor=selector;if(!anchor&&el?.id)anchor='#'+CSS.escape(el.id);if(!anchor&&el?.attributes){const a=[...el.attributes].find(a=>a.name.startsWith('data-wb-')||a.name==='data-workbook-translation');if(a)anchor='['+a.name+'="'+CSS.escape(a.value)+'"]';}
  const openDetails=[...document.querySelectorAll('.workbook-page details')].map((d,i)=>d.open?i:-1).filter(i=>i>=0);
  const scrollRoot=document.documentElement,anchoring=scrollRoot.style.overflowAnchor;scrollRoot.style.overflowAnchor='none';requestAnimationFrame(()=>requestAnimationFrame(()=>{scrollRoot.style.overflowAnchor=anchoring;}));
  render();
  if(transition){const target=document.querySelector('.workbook-page '+(selector||'#workbook-task-title'))||document.querySelector('.workbook-page .workbook-own h2');if(target){target.tabIndex=-1;target.focus({preventScroll:true});window.scrollTo({left:x,top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-100),behavior:'instant'});}return;}
  const details=[...document.querySelectorAll('.workbook-page details')];openDetails.forEach(i=>{if(details[i])details[i].open=true;});
  const target=(anchor?document.querySelector('.workbook-page '+anchor):null)||(source?.hasAttribute?.('data-wb-check')?document.querySelector('.workbook-page [data-wb-next]'):null);target?.focus({preventScroll:true});
  const anchored=target&&Number.isFinite(top);const shift=anchored?target.getBoundingClientRect().top-top:0;window.scrollTo({left:x,top:Math.max(0,(anchored?window.scrollY:y)+shift),behavior:'instant'});
 }
 function enter(day=state.day){if(byDay.has(day))state.day=day;reviewKey=null;reviewEvidence=null;row();save();}
 function due(){return Object.entries(state.workbook.days).flatMap(([,r])=>Object.entries(r.answers).filter(([,a])=>a.due>0&&a.due<=Date.now()).map(([key,a])=>({key,due:a.due}))).sort((a,b)=>a.due-b.due);}
 function merge(raw){
  const incoming=sanitize(raw);
  for(const [day,v]of Object.entries(incoming.days)){
   if(!state.workbook.days[day]){state.workbook.days[day]=v;continue;}
   const current=state.workbook.days[day];
   for(const [key,a]of Object.entries(v.answers)){
    const old=current.answers[key];if(!old){current.answers[key]=a;continue;}
    const evidence=[old.first,...old.retries,a.first,...a.retries].sort((x,y)=>x.time-y.time||Number(x.correct)-Number(y.correct));
    const unique=evidence.filter((x,i,all)=>all.findIndex(y=>y.time===x.time&&y.correct===x.correct&&y.aided===x.aided)===i);
    current.answers[key]={first:unique[0],retries:unique.slice(1).slice(-5),due:old.due&&a.due?Math.min(old.due,a.due):old.due||a.due};
   }
   for(const section of ['story','workshop'])if(!current.own[section]?.text&&v.own[section])current.own[section]=v.own[section];
   current.saved||=v.saved;
  }
  state.workbook=sanitize(state.workbook);reviewKey=null;
 }
 function preview(day){const s=byDay.get(day)?.story;if(!s)return '';return `<details class="workbook-preview"><summary>Эта модель в живой истории</summary><div><h3>${esc(s.title)}</h3><p>${esc(s.scene)}</p><p>${esc(s.goal)}</p><button type="button" class="btn" data-workbook-open="${day}">${icon('book-open')}Читать и попробовать</button><p class="small">5–7 минут по желанию. Можно заменить часть дополнительной практики.</p></div></details>`;}
 function entry(){return `<article class="workbook-entry"><h2>История, в которой нужен твой ответ</h2><p>Одна сцена — одно решение. Читай, разбирай смысл и превращай знакомую модель в свой ответ.</p><button type="button" class="btn" data-workbook-open="${state.day}">${icon('book-open')}История дня ${state.day}</button><p class="small">30 связанных эпизодов · 90 заданий в мастерских · свой ответ вместо заученного чужого.</p></article>`;}
 function storyHTML(s){return `<section class="story-sheet"><h2>${esc(s.title)}</h2><p>${esc(s.scene)}</p><p class="story-goal"><strong>Твоя задача:</strong> ${esc(s.goal)}</p><div class="story-dialogue">${s.lines.map((l,i)=>`<div class="story-line ${i%2?'reply':''}"><span class="story-role">${esc(l.role)}</span><div><p lang="es">${esc(l.es)}</p>${row().translation?`<p class="story-translation">${esc(l.ru)}</p>`:''}</div>${l.audio?playButton(l.audio,'Слушать точную реплику: '+l.es):''}</div>`).join('')}</div><button type="button" class="btn quiet" data-workbook-translation aria-pressed="${row().translation}">${icon('languages')}${row().translation?'Скрыть перевод':'Помочь с переводом'}</button><p class="small">Авторская сцена. Кнопка звука есть только у реплик с точной записью носителя.</p><details class="workbook-glossary"><summary>Нужные сочетания · ${s.glossary.length}</summary><dl>${s.glossary.map(x=>`<dt lang="es">${esc(x.es)}</dt><dd>${esc(x.ru)}${x.note?`<small>${esc(x.note)}</small>`:''}</dd>`).join('')}</dl></details></section>`;}
 function workshopHTML(w){const t=w.tool;return `<section class="model-sheet"><h2>${esc(w.title)}</h2><p>${esc(w.hook)}</p><div class="workbook-model"><p lang="es">${esc(t.model)}</p><p>${esc(t.meaning)}</p></div><p>${esc(t.how)}</p><details class="model-parts"><summary>Смысл по частям</summary><dl>${t.parts.map(p=>`<dt lang="es">${esc(p.es)}</dt><dd>${esc(p.ru)}</dd>`).join('')}</dl></details><details class="meaning-contrast"><summary>Похожая фраза — другой смысл</summary><div>${[t.contrast.a,t.contrast.b].map(p=>`<p><strong lang="es">${esc(p.es)}</strong><br>${esc(p.ru)}</p>`).join('')}<p>${esc(t.contrast.explanation)}</p></div></details><details class="model-pitfall"><summary>Одна привычная ошибка</summary><div><p>В этой модели: <span lang="es">${esc(t.pitfall.wrong)}</span> → <strong lang="es">${esc(t.pitfall.right)}</strong></p><p>${esc(t.pitfall.explanation)}</p></div></details></section>`;}
 function taskHTML(t){
  const key=taskKey(t),d=draft(t),a=row().answers[key],last=latest(a),feedback=d.dirty?null:reviewKey?reviewEvidence:last;
  const ready=t.kind==='build'?d.tokens.length===t.tokens.length:d.choice!==null;
  const solution=t.kind==='build'?t.accepted[0]:t.options[t.answer];
  const controls=t.kind==='build'?`<div class="workbook-build" role="group" aria-label="Собранная фраза">${d.tokens.length?d.tokens.map((i,p)=>`<button class="btn token" type="button" data-wb-remove="${p}" aria-label="Убрать ${esc(t.tokens[i])}" lang="es">${esc(t.tokens[i])}</button>`).join(''):'<p>Нажимай на части, чтобы собрать заданную модель.</p>'}</div><div class="workbook-bank" role="group" aria-label="Части предложения">${t.tokens.map((x,i)=>({x,i})).sort((a,b)=>a.x.localeCompare(b.x,'es')||a.i-b.i).filter(x=>!d.tokens.includes(x.i)).map(x=>`<button class="btn token" type="button" data-wb-token="${x.i}" lang="es">${esc(x.x)}</button>`).join('')}</div><p class="small">Используй все части. Здесь проверяем именно указанную модель; другие порядки слов в языке тоже возможны.</p>`:`<div class="options">${t.options.map((x,i)=>`<button class="option" type="button" data-wb-choice="${i}" lang="${row().section==='workshop'?'es':'ru'}" aria-pressed="${d.choice===i}">${esc(x)}</button>`).join('')}</div>`;
  return `<section class="workbook-task" aria-labelledby="workbook-task-title"><p class="small">${reviewKey?'Повтор знакомого задания · самостоятельную речь не оценивает':'Задание '+(row().positions[row().section]+1)+' из '+tasks().length}</p><h2 id="workbook-task-title">${esc(t.kind==='build'?'Восстанови изученную модель из всех частей':t.prompt)}</h2>${t.context?`<p class="task-context">${esc(t.kind==='build'?'Сначала собери по памяти. Если трудно — открой модель выше или попроси объяснение.':t.context)}</p>`:''}${controls}${feedback?`<div class="feedback ${feedback.correct?'':'wrong'}" role="status"><h3>${feedback.correct?'По этой модели — верно':'Посмотри на смысл и попробуй ещё'}</h3><p>${esc(t.explanation)}</p>${!feedback.correct?`<p><strong lang="${row().section==='workshop'?'es':'ru'}">${esc(solution)}</strong></p>`:''}<p class="small">${a.first.correct&&!a.first.aided?'Первый ответ совпал с подготовленным ключом.':a.first.correct?'Первый ответ с помощью.':'Первый ответ сохранён как ошибка; исправление его не стирает.'}</p></div>`:''}<div class="workbook-actions">${feedback?.correct?`<button type="button" class="btn primary" data-wb-next>${reviewKey?'Вернуться к материалу':'Следующий шаг'}${icon('arrow-right')}</button>`:`<button type="button" class="btn primary" data-wb-check ${ready?'':'disabled'}>Проверить ${icon('check')}</button>`}<button type="button" class="btn quiet" data-wb-help aria-expanded="${d.help}">${icon('lightbulb')}Объясни мне</button></div>${d.help?`<div class="workbook-help" role="status"><p>${esc(t.explanation)}</p><p><strong lang="${row().section==='workshop'?'es':'ru'}">${esc(solution)}</strong></p><p class="small">Закрой подсказку и попробуй восстановить смысл.</p></div>`:''}</section>`;
 }
 function ownHTML(){const r=row(),s=r.section==='story'?items().story.own:items().workshop.challenge,o=own();return `<section class="workbook-own"><div class="workbook-coach">${mascot('proud')}<div><h2>Теперь — твоя реплика</h2><p>${esc(s.prompt)}</p></div></div><p><strong>Поменяй условие:</strong> ${esc(s.variation||s.change)}</p><label for="workbook-own">Твой ответ по-испански · можно сначала сказать вслух<textarea id="workbook-own" class="field" rows="3" lang="es" spellcheck="false" maxlength="2000" placeholder="Напиши опору для своей фразы…">${esc(o.text)}</textarea></label><button type="button" class="btn quiet" data-wb-own-help aria-expanded="${o.help}">${o.help?'Скрыть пример':'Помоги начать'}</button>${o.help?`<p class="workbook-own-example" lang="es">${esc(s.example)}</p>`:''}<label class="workbook-self"><input type="checkbox" data-wb-said ${o.said?'checked':''}>Я сказал свою версию вслух, затем изменил одну деталь.</label><p class="small">Это твоя отметка. Свободную фразу здесь не оцениваем автоматически; черновик сохраняется на устройстве.</p><button type="button" class="btn primary" data-wb-section="${r.section==='story'?'workshop':'story'}">${r.section==='story'?'Разобрать модель':'Вернуться к истории'}${icon('arrow-right')}</button><button type="button" class="btn quiet" data-day="${state.day}">К уроку дня ${state.day}</button></section>`;}
 function notebook(){const list=Object.entries(state.workbook.days).filter(([,r])=>r.saved);return `<details class="workbook-notebook"><summary>Мои полезные связки · ${list.length}</summary>${list.length?list.map(([day])=>{const t=byDay.get(Number(day)).workshop.takeaway;return `<article><h3>День ${day}</h3><p lang="es">${esc(t.es)}</p><p>${esc(t.ru)}</p><p class="small">${esc(t.useWhen)}</p><button type="button" class="btn quiet" data-workbook-open="${day}">Открыть пример в контексте</button></article>`;}).join(''):'<p>Сохрани одну полезную связку после истории и возвращайся к ней в контексте.</p>'}</details>`;}
 function html(){
  const r=row(),s=items().story,w=items().workshop,t=task(),pending=due(),sampleDay=state.day===22?19:state.day===23?20:state.day===24?3:state.day,known=data.expanded.lessons[sampleDay-1].examples[0];
  return `<section class="reading workbook-page"><div class="section-head"><h1>Истории и мастерская фраз</h1><button class="btn quiet" type="button" data-practice="menu">${icon('arrow-left')}К практике</button></div><p class="page-intro">Одна сцена или одна мастерская за 5–7 минут. Замени ими часть дополнительной тренировки: весь материал за один подход проходить не нужно.</p><div class="workbook-toolbar"><label>День истории<select class="select" id="workbook-day">${data.stories.days.map(x=>`<option value="${x.day}" ${x.day===state.day?'selected':''}>${x.day} · ${esc(x.title)}</option>`).join('')}</select></label><div class="workbook-switch" role="group" aria-label="Вид материала">${[['story','История'],['workshop','Мастерская']].map(([key,name])=>`<button type="button" class="btn ${r.section===key?'selected':''}" data-wb-section="${key}" aria-pressed="${r.section===key}">${name}</button>`).join('')}</div></div>${pending.length?`<div class="workbook-repeat"><p>К повторению: ${pending.length} знакомых заданий с ошибкой или помощью.</p><button type="button" class="btn quiet" data-wb-review>Вернуться к трудному ${icon('rotate-ccw')}</button></div>`:''}${reviewKey?`<p class="note">Повтор дня ${state.day} · ответь без предыдущего разбора. Это тот же подготовленный контекст.</p>`:r.section==='story'?storyHTML(s):t?.kind==='build'?'<details class="workbook-recall-model" data-wb-model-help><summary>Посмотреть модель перед сборкой</summary>'+workshopHTML(w)+'</details>':workshopHTML(w)}${t?taskHTML(t):ownHTML()}<details class="workbook-after"><summary>Зачем это в разговоре</summary><div><p>${esc(s.whyUseful)}</p>${s.callback.day?`<p>${esc(s.callback.prompt)}</p><button type="button" class="btn quiet" data-workbook-open="${s.callback.day}">Вспомнить историю дня ${s.callback.day}</button>`:''}<h3>Одна связка с собой</h3><p lang="es">${esc(w.takeaway.es)}</p><p>${esc(w.takeaway.ru)}</p><p class="small">${esc(w.takeaway.useWhen)}</p><button type="button" class="btn" data-wb-save aria-pressed="${r.saved}">${icon('bookmark')}${r.saved?'Убрать из моих связок':'Сохранить связку'}</button></div></details><details class="workbook-audio"><summary>Отдельный пример с записью носителя</summary><div><p lang="es">${esc(known.es)}</p><p>${esc(known.ru)}</p>${playButton(known.audio,'Слушать именно: '+known.es,true)}<p class="small">Это точный пример из урока. Он не озвучивает другие строки истории.</p>${api.audioControls()}<p id="audio-status" class="audio-status" role="status" aria-live="polite"></p></div></details>${notebook()}${footer()}</section>`;
 }
 function click(b){
  if(b.hasAttribute('data-workbook-open')){api.open(Number(b.dataset.workbookOpen));return true;}
  if(!api.active())return false;
  const r=row(),t=task();
  if(b.hasAttribute('data-wb-section')){if(!['story','workshop'].includes(b.dataset.wbSection))return true;r.section=b.dataset.wbSection;reviewKey=null;save();redraw('#workbook-task-title',b,true);return true;}
  if(b.hasAttribute('data-workbook-translation')){r.translation=!r.translation;if(r.translation)for(const q of items().story.questions)draft(q).aided=true;save();redraw('[data-workbook-translation]',b);return true;}
  if(b.hasAttribute('data-wb-save')){r.saved=!r.saved;save();redraw('[data-wb-save]',b);toast(r.saved?'Связка сохранена с контекстом.':'Связка убрана из списка.');return true;}
  if(b.hasAttribute('data-wb-review')){const first=due()[0];if(first){const target=catalog.get(first.key);state.day=target.day;api.onDayChange?.(state.day);row().section=target.section;reviewKey=first.key;reviewEvidence=null;row().drafts[first.key]={choice:null,tokens:[],help:false};save();redraw('#workbook-task-title',b,true);}return true;}
  if(b.hasAttribute('data-wb-own-help')){own().help=!own().help;save();redraw('[data-wb-own-help]',b);return true;}
  if(!t)return false;
  const d=draft(t),key=taskKey(t);
  if(b.hasAttribute('data-wb-choice')){const n=Number(b.dataset.wbChoice);if(Number.isInteger(n)&&n>=0&&n<t.options?.length){d.choice=n;d.dirty=true;save();redraw(`[data-wb-choice="${n}"]`,b);}return true;}
  if(b.hasAttribute('data-wb-token')){const n=Number(b.dataset.wbToken);if(Number.isInteger(n)&&n>=0&&n<t.tokens?.length&&!d.tokens.includes(n)){d.tokens.push(n);d.dirty=true;save();redraw(`[data-wb-remove="${d.tokens.length-1}"]`,b);}return true;}
  if(b.hasAttribute('data-wb-remove')){const n=Number(b.dataset.wbRemove);if(Number.isInteger(n)&&n>=0&&n<d.tokens.length){const token=d.tokens.splice(n,1)[0];d.dirty=true;save();redraw(`[data-wb-token="${token}"]`,b);}return true;}
  if(b.hasAttribute('data-wb-help')){d.help=!d.help;if(d.help)d.aided=true;save();redraw('[data-wb-help]',b);return true;}
  if(b.hasAttribute('data-wb-check')){
   if(t.kind==='build'?d.tokens.length!==t.tokens.length:d.choice===null)return true;
   const correct=t.kind==='build'?t.accepted.some(x=>normalize(x)===normalize(d.tokens.map(i=>t.tokens[i]).join(' '))):d.choice===t.answer;
   const evidence={correct,aided:d.help||d.aided===true||(!reviewKey&&r.section==='story'&&r.translation),time:Date.now()},old=r.answers[key];
   if(!old){r.answers[key]={first:evidence,retries:[],due:!correct||evidence.aided?Date.now()+600000:0};observe({id:'workbook:'+key,day:state.day,audio:null,skill:t.kind==='build'?'order':r.section==='story'?'meaning':'situation',correct,aided:evidence.aided});}
   else{old.retries.push(evidence);old.retries=old.retries.slice(-5);if(reviewKey)old.due=correct&&!evidence.aided?0:Date.now()+600000;else if(!correct||evidence.aided)old.due=Date.now()+600000;}
   if(reviewKey)reviewEvidence=evidence;d.dirty=false;
   if(!correct)d.aided=true;
   save();sound(correct?'correct':'wrong');redraw('[data-wb-check]',b);return true;
  }
  if(b.hasAttribute('data-wb-next')){if(d.dirty||!(reviewKey?reviewEvidence:latest(r.answers[key]))?.correct)return true;if(reviewKey){reviewKey=null;reviewEvidence=null;}else r.positions[r.section]=Math.min(tasks().length,r.positions[r.section]+1);save();redraw('#workbook-task-title',b,true);return true;}
  return false;
 }
 function change(el){if(el.id==='workbook-day'){const d=Number(el.value);if(byDay.has(d))api.open(d);return true;}if(el.hasAttribute('data-wb-said')&&api.active()){own().said=el.checked;save();return true;}return false;}
 function input(el){if(el.id==='workbook-own'&&api.active()){own().text=el.value.slice(0,2000);save();return true;}return false;}
 function toggle(el){if(api.active()&&el.open&&el.hasAttribute('data-wb-model-help')&&task()){draft(task()).aided=true;save();}}
 return {markHelp:()=>{if(api.active()&&task()){draft(task()).aided=true;save()}},enter,html,preview,entry,click,change,input,toggle,sanitize,merge,due};
}};
