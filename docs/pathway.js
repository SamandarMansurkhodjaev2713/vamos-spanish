/* Independent continuation and graded reading. No state.day mutation; no synthetic audio. */
window.VamosPathway={create(api){
 'use strict';
 const {state,esc,save,render,toast}=api;
 const content=api.data.pathway||api.data, days=new Map(content.days.map(d=>[d.day,d])), books=new Map(content.readings.map(r=>[r.id,r]));
 const words=new Map(content.readings.flatMap(r=>r.glossary.map((g,i)=>[r.id+':'+i,{...g,book:r.title}])));
 const wordTask=key=>({id:'recall',kind:'text',accepted:[words.get(key).es]});
 const norm=s=>String(s??'').normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 const safeTime=t=>Number.isFinite(t)&&t>0&&t<=Date.now()+60000;
 const tasksFor=d=>[...d.tasks,...books.get(d.readingId).tasks.map(t=>({...t,id:'reading-'+t.id,reading:true}))];
 const latest=a=>a?.retries?.at(-1)||a?.first;
 const empty=()=>({answers:{},drafts:{},position:0,oral:{attempted:false,rating:null,note:''},translation:false,showModel:false,showText:false,gloss:null});
 const isCorrect=(t,value)=>t.kind==='choice'?Number.isInteger(value)&&value===t.answer:typeof value==='string'&&t.accepted.some(a=>norm(a)===norm(value));
 function cleanRow(raw,tasks){
  const out=empty();if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  const string=x=>typeof x==='string'?x.slice(0,1000):'';
  out.translation=raw.translation===true;out.showModel=raw.showModel===true;out.showText=raw.showText===true;
  for(const t of tasks){
   const d=raw.drafts?.[t.id];
   if(d&&typeof d==='object')out.drafts[t.id]={value:t.kind==='choice'?(Number.isInteger(d.value)&&d.value>=0&&d.value<t.options.length?d.value:null):string(d.value),aided:d.aided===true||d.help===true,help:d.help===true,dirty:d.dirty===true};
   const a=raw.answers?.[t.id];
   const clean=e=>{if(!e||!safeTime(e.time))return null;const value=t.kind==='choice'?(Number.isInteger(e.value)&&e.value>=0&&e.value<t.options.length?e.value:null):string(e.value);if(value===null||value==='')return null;return {value,correct:isCorrect(t,value),aided:e.aided===true,time:e.time};};
   const first=clean(a?.first);if(!first)continue;
   const retries=(Array.isArray(a.retries)?a.retries:[]).map(clean).filter(e=>e&&e.time>=first.time).slice(-8);
   out.answers[t.id]={first,retries};
   const dr=out.drafts[t.id]??={value:t.kind==='choice'?null:'',aided:false,help:false,dirty:false};
   dr.aided||=first.aided||!first.correct||retries.some(e=>e.aided||!e.correct);
  }
  const blocked=tasks.findIndex(t=>!latest(out.answers[t.id])?.correct);
  for(const t of tasks)if((out.showModel&&['meaning','produce','reply'].includes(t.id))||(out.translation&&(t.reading||['meaning','recall'].includes(t.id)))||(out.showText&&t.id.includes('recall'))){const dr=out.drafts[t.id]??=({value:t.kind==='choice'?null:'',aided:false,help:false,dirty:false});dr.aided=true;}
  out.position=Math.min(Math.max(0,Math.floor(Number(raw.position)||0)),blocked<0?tasks.length:blocked);
  const o=raw.oral;if(o&&typeof o==='object')out.oral={attempted:o.attempted===true,rating:Number.isInteger(o.rating)&&o.rating>=0&&o.rating<=2?o.rating:null,note:string(o.note)};
  return out;
 }
 function sanitize(raw){
  const out={version:13,selectedDay:days.has(raw?.selectedDay)?raw.selectedDay:31,selectedReading:books.has(raw?.selectedReading)?raw.selectedReading:content.readings[0].id,level:['Все','A1','A2','B1','B2','C1'].includes(raw?.level)?raw.level:'Все',days:{},readings:{},words:{},selectedWord:null};
  for(const [day,d]of days)if(raw?.days?.[day])out.days[day]=cleanRow(raw.days[day],tasksFor(d));
  for(const [id,r]of books)if(raw?.readings?.[id])out.readings[id]=cleanRow(raw.readings[id],r.tasks);
  for(const key of words.keys())if(raw?.words?.[key]){const v=raw.words[key],r=cleanRow(v,[wordTask(key)]);r.rating=Number.isInteger(v.rating)&&v.rating>=0&&v.rating<=2?v.rating:null;r.due=latest(r.answers.recall)&&Number.isFinite(v.due)&&v.due>=0&&v.due<=Date.now()+366*86400000?v.due:0;out.words[key]=r;}
  if(words.has(raw?.selectedWord)&&out.words[raw.selectedWord])out.selectedWord=raw.selectedWord;
  return out;
 }
 state.pathway=sanitize(state.pathway);
 function merge(raw){
  const incoming=sanitize(raw);
  for(const [bucket,entries]of Object.entries({days:incoming.days,readings:incoming.readings,words:incoming.words}))for(const [id,value]of Object.entries(entries)){
   const old=state.pathway[bucket][id];if(!old){state.pathway[bucket][id]=value;continue;}
   for(const [key,a]of Object.entries(value.answers)){const prev=old.answers[key];if(!prev){old.answers[key]=a;continue;}const all=[prev.first,...prev.retries,a.first,...a.retries].sort((x,y)=>x.time-y.time||Number(x.correct)-Number(y.correct));const unique=all.filter((x,i)=>all.findIndex(y=>y.time===x.time&&y.value===x.value&&y.aided===x.aided)===i);old.answers[key]={first:unique[0],retries:unique.slice(1).slice(-8)};}
   for(const [key,d]of Object.entries(value.drafts)){if(!old.drafts[key])old.drafts[key]=d;else old.drafts[key].aided||=d.aided||d.help;}
   if(bucket==='words'&&value.due)old.due=old.due?Math.min(old.due,value.due):value.due;
  }
  state.pathway=sanitize(state.pathway);save();
 }
 let mode='pathway';
 const day=()=>days.get(state.pathway.selectedDay), book=()=>books.get(state.pathway.selectedReading);
 const tasks=()=>mode==='reading'?book().tasks:tasksFor(day());
 const row=()=>mode==='reading'?(state.pathway.readings[book().id]??=empty()):(state.pathway.days[day().day]??=empty());
 const current=()=>tasks()[row().position];
 const draft=t=>row().drafts[t.id]??=({value:t.kind==='choice'?null:'',aided:false,help:false,dirty:false});
 const completed=(r,ts,oral)=>!!r&&ts.every(t=>latest(r.answers?.[t.id])?.correct===true)&&(!oral||(r.oral?.attempted===true&&Number.isInteger(r.oral.rating)&&r.oral.rating>=0&&r.oral.rating<=2));
 function summary(){return {completedDays:content.days.filter(d=>completed(state.pathway.days[d.day],tasksFor(d),true)).map(d=>d.day),completedReadings:content.readings.filter(r=>completed(state.pathway.readings[r.id],r.tasks,false)).map(r=>r.id),selectedDay:state.pathway.selectedDay,savedWords:Object.keys(state.pathway.words),dueWords:Object.keys(state.pathway.words).filter(k=>!state.pathway.words[k].due||state.pathway.words[k].due<=Date.now())};}
 function aid(ids){for(const t of tasks())if(!ids||ids.includes(t.id))draft(t).aided=true;}
 function viewSnapshot(source){
  if(typeof document==='undefined'||typeof window==='undefined'||typeof window.scrollTo!=='function')return null;
  const el=source||document.activeElement;let selector=null;
  if(el?.id)selector='#'+CSS.escape(el.id);else if(el?.attributes){const a=[...el.attributes].find(a=>a.name.startsWith('data-pw-'));if(a)selector='['+a.name+'="'+CSS.escape(a.value)+'"]';}
  return {selector,x:window.scrollX,y:window.scrollY,top:el?.getBoundingClientRect?.().top,details:[...document.querySelectorAll('.pathway-page details')].map((d,i)=>d.open?i:-1).filter(i=>i>=0)};
 }
 function update(source,transition=false){
  const snap=viewSnapshot(source);let scrollRoot,anchoring;if(snap){scrollRoot=document.documentElement;anchoring=scrollRoot.style.overflowAnchor;scrollRoot.style.overflowAnchor='none';requestAnimationFrame(()=>requestAnimationFrame(()=>{scrollRoot.style.overflowAnchor=anchoring;}));}save();render();if(!snap)return;
  if(transition){const target=document.querySelector('.pathway-page .workbook-task h2')||document.querySelector('.pathway-page .workbook-own h2')||document.querySelector('.pathway-page .story-sheet h2,.pathway-page .feedback');if(target){target.tabIndex=-1;target.focus({preventScroll:true});window.scrollTo({left:snap.x,top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-100),behavior:'instant'});}return;}
  const details=[...document.querySelectorAll('.pathway-page details')];snap.details.forEach(i=>{if(details[i])details[i].open=true;});
  const target=snap.selector?document.querySelector(snap.selector):null;
  target?.focus({preventScroll:true});const anchored=target&&Number.isFinite(snap.top);const shift=anchored?target.getBoundingClientRect().top-snap.top:0;
  window.scrollTo({left:snap.x,top:Math.max(0,(anchored?window.scrollY:snap.y)+shift),behavior:'instant'});
 }

 function evidence(t,value){const r=row(),dr=draft(t),e={value,correct:isCorrect(t,value),aided:dr.aided||dr.help,time:Date.now()};const old=r.answers[t.id];if(!old)r.answers[t.id]={first:e,retries:[]};else old.retries.push(e),old.retries=old.retries.slice(-8);dr.dirty=false;if(!e.correct)dr.aided=true;return e;}
 function textHTML(r){
  const terms=[...r.glossary].sort((a,b)=>b.es.length-a.es.length);let source=r.text,html='',pos=0;
  const re=new RegExp(terms.map(g=>g.es.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'giu');
  for(const match of source.matchAll(re)){const before=source[match.index-1]||'',after=source[match.index+match[0].length]||'';if(/\p{L}/u.test(before)||/\p{L}/u.test(after))continue;const i=r.glossary.findIndex(g=>g.es.toLocaleLowerCase('es')===match[0].toLocaleLowerCase('es'));if(i<0)continue;html+=esc(source.slice(pos,match.index))+`<button class="btn quiet pathway-word" type="button" data-pw-gloss="${i}" lang="es">${esc(match[0])}</button>`;pos=match.index+match[0].length;}
  return html+esc(source.slice(pos));
 }
 function readingHTML(r,t){const rr=row(),recall=t?.id.includes('recall'),visible=!recall||rr.showText;
  return `<section class="story-sheet"><h2>${esc(r.title)} · ${esc(r.level)}</h2>${visible?`<p class="pathway-text" lang="es">${textHTML(r)}</p>`:'<p>Текст спрятан для воспроизведения по памяти.</p>'}${recall?`<button type="button" class="btn quiet" data-pw-text>${rr.showText?'Скрыть текст':'Подсмотреть текст'}</button>`:''}<button type="button" class="btn quiet" data-pw-translation aria-pressed="${rr.translation}">${rr.translation?'Скрыть перевод':'Запросить перевод'}</button>${rr.translation?`<p>${esc(r.translation)}</p>`:''}${Number.isInteger(rr.gloss)&&r.glossary[rr.gloss]?`<p role="status"><strong lang="es">${esc(r.glossary[rr.gloss].es)}</strong> — ${esc(r.glossary[rr.gloss].ru)}</p><button type="button" class="btn quiet" data-pw-save-word="${esc(r.id+':'+rr.gloss)}">${state.pathway.words[r.id+':'+rr.gloss]?'Сохранено для повторения':'Сохранить для повторения'}</button>`:''}</section>`;
 }
 function wordHTML(){
  const keys=Object.keys(state.pathway.words);if(!keys.length)return '<p class="small">Нажми на слово в тексте и сохрани его: оно появится здесь для повторения.</p>';
  const key=keys.includes(state.pathway.selectedWord)?state.pathway.selectedWord:keys[0];state.pathway.selectedWord=key;const w=words.get(key),r=state.pathway.words[key],dr=r.drafts.recall??=({value:'',aided:false,help:false,dirty:true}),last=dr.dirty?null:latest(r.answers.recall);
  return `<section class="workbook-task"><h2>Мои слова · повторение</h2><p>Сохранено: ${keys.length}; пора повторить: ${summary().dueWords.length}. Точная запись носителя для этих слов не добавлена.</p><label>Слово из текста<select id="pathway-word-review" class="select">${keys.map(k=>`<option value="${esc(k)}" ${k===key?'selected':''}>${esc(words.get(k).ru+' · '+words.get(k).book)}</option>`).join('')}</select></label><p>Вспомни по-испански: <strong>${esc(w.ru)}</strong></p><label>Слово или сочетание<input id="pathway-word-answer" class="field" lang="es" maxlength="1000" value="${esc(dr.value)}" autocomplete="off"></label><button type="button" class="btn primary" data-pw-word-check>Проверить слово</button><button type="button" class="btn quiet" data-pw-word-help>${dr.help?'Скрыть слово':'Подсмотреть слово'}</button>${dr.help?`<p lang="es">${esc(w.es)}</p>`:''}${last?`<p role="status">${last.correct?'Совпало с сохранённым словом.':'Пока не совпало: попробуй ещё или открой слово.'} ${r.answers.recall.first.correct?'':'Первая ошибка сохранена.'}</p><label>После попытки<select id="pathway-word-rating" class="select"><option value="">Выбери самооценку</option>${['Нужно повторить завтра','Узнаю, но вспоминаю с трудом','Вспомнил уверенно'].map((x,i)=>`<option value="${i}" ${r.rating===i?'selected':''}>${x}</option>`).join('')}</select></label>`:''}${r.due?`<p class="small">Следующее повторение: ${esc(new Date(r.due).toLocaleDateString('ru-RU'))}. Дата — расписание практики, не обещание запоминания.</p>`:''}</section>`;
 }
 function taskHTML(t){const dr=draft(t),a=row().answers[t.id],last=dr.dirty?null:latest(a);return `<section class="workbook-task"><p class="small">Проверяем подготовленную модель: ${row().position+1} / ${tasks().length}</p><h2>${esc(t.prompt)}</h2>${t.context?`<p${/\p{Script=Cyrillic}/u.test(t.context)?'':' lang="es"'}>${esc(t.context)}</p>`:''}${t.kind==='choice'?`<div class="options">${t.options.map((x,i)=>`<button type="button" class="option" data-pw-choice="${i}" aria-pressed="${dr.value===i}">${esc(x)}</button>`).join('')}</div>`:`<label>Ответ по-испански<input class="field" id="pathway-answer" lang="es" autocomplete="off" spellcheck="false" maxlength="1000" value="${esc(dr.value)}"></label><p class="small">В этом упражнении принимается указанная модель с теми же фактами. Регистр и пунктуация не важны; значимые ударения сохраняются.</p>`}${last?`<div class="feedback ${last.correct?'':'wrong'}" role="status"><strong>${last.correct?'По ключу — верно':'Ответ не совпал с моделью'}</strong><p>${esc(t.explanation)}</p><p class="small">${a.first.correct?(a.first.aided?'Первая попытка — с помощью.':'Первая попытка — без помощи.'):'Первый ответ сохранён как ошибка. Исправление не стирает его.'}</p></div>`:''}<div class="workbook-actions"><button type="button" class="btn primary" data-pw-check>Проверить</button>${last?.correct?'<button type="button" class="btn" data-pw-next>Дальше</button>':''}<button type="button" class="btn quiet" data-pw-help aria-expanded="${dr.help}">${dr.help?'Скрыть помощь':'Помощь'}</button></div>${dr.help?`<p class="note">${esc(t.help)}</p>`:''}</section>`;}
 function html(kind='pathway'){
  mode=kind==='reading'?'reading':'pathway';const r=row(),t=current(),d=day(),rb=mode==='reading'?book():books.get(d.readingId),s=summary();
  const scope=`<details class="pathway-scope"><summary>Что входит и как выбрать сложность</summary><p>${esc(content.scope)}</p></details>`;
  const nav=`<div class="section-head"><h1>${mode==='reading'?'Чтение':'Дни 31–90'}</h1></div>${mode==='reading'?'':'<p class="page-intro">Новая модель и своя реплика каждый день.</p>'}`;
  const selectors=mode==='reading'?`<label>Сложность<select id="pathway-level" class="select">${['Все','A1','A2','B1','B2','C1'].map(l=>`<option ${l===state.pathway.level?'selected':''}>${l}</option>`).join('')}</select></label><label>Текст<select id="pathway-reading" class="select">${content.readings.filter(b=>state.pathway.level==='Все'||b.level===state.pathway.level).map(b=>`<option value="${esc(b.id)}" ${b.id===book().id?'selected':''}>${esc(b.level+' · '+b.title)}</option>`).join('')}</select></label><p>Проверено текстов: ${s.completedReadings.length} / ${books.size}. B2/C1 — отдельные образцы для любопытства, к ним можно вернуться позже.</p>`:`<label>День продолжения<select id="pathway-day" class="select">${content.days.map(x=>`<option value="${x.day}" ${x.day===d.day?'selected':''}>${x.day} · ${esc(x.title)}${s.completedDays.includes(x.day)?' ✓':''}</option>`).join('')}</select></label><h2>${esc(d.phase+' · '+d.title)}</h2><p>${esc(d.goal)}</p><details class="pathway-prep"><summary>Слова дня и подготовка</summary><p>Выполнено: ${s.completedDays.length} из 60.</p><p>Перед этим: ${d.prerequisite===30?'базовый день 30':'день '+d.prerequisite}. Если трудно, повтори его и продолжи завтра.</p><details class="pathway-plan"><summary>План на 35 минут</summary><ol>${d.plan.map(p=>`<li>${esc(p.title)} · ${p.minutes} мин</li>`).join('')}</ol></details><dl>${d.vocabulary.map(v=>`<dt lang="es">${esc(v.es)}</dt><dd>${esc(v.ru)}</dd>`).join('')}</dl></details><button type="button" class="btn quiet" data-pw-model>${r.showModel?'Скрыть модель':'Изучить модель и правило'}</button>${r.showModel?`<div class="note"><p lang="es">${esc(d.model.es)}</p><p>${esc(d.model.ru)}</p><p>${esc(d.model.rule)}</p></div>`:''}<p class="small">Помощь и просмотр образца сохраняются в истории попытки, даже если затем скрыть их.</p>`;
  const main=t?`${mode==='reading'||t.reading?readingHTML(rb,t):''}${taskHTML(t)}`:mode==='reading'?`<div class="feedback" role="status">Смысл проверен, фраза восстановлена. Это выполнение двух заданий, не подтверждение уровня.</div><button type="button" class="btn" data-pw-revisit>Ещё раз без образца</button>`:`<section class="workbook-own"><h2>Две устные попытки</h2><p>${esc(d.oral.prompt)}</p><label><input type="checkbox" data-pw-oral ${r.oral.attempted?'checked':''}>Я действительно сказал ответ и версию с изменённым фактом вслух.</label><label>Как получилось?<select id="pathway-rating" class="select"><option value="">Выбери после попытки</option>${d.oral.selfRatings.map((x,i)=>`<option value="${i}" ${r.oral.rating===i?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Моя версия / что повторить<textarea id="pathway-note" class="field" maxlength="1000">${esc(r.oral.note)}</textarea></label><p>${esc(d.oral.notice)}</p><p role="status">${completed(r,tasksFor(d),true)?'Все подготовленные задания и устная попытка отмечены. День выполнен.':'День завершится после реальной устной попытки и выбранной самооценки.'}</p>${completed(r,tasksFor(d),true)&&d.day<90?'<button type="button" class="btn primary" data-pw-following>К следующему дню</button>':''}<button type="button" class="btn quiet" data-pw-revisit>Повторить задания</button></section>`;
  const extra=mode==='pathway'?`<section class="workbook-audio"><h2>Произношение · отдельный знакомый пример</h2><p lang="es">${esc(d.nativeReview.es)}</p><p>${esc(d.nativeReview.ru)}</p>${api.playButton?api.playButton(d.nativeReview.audio,'Слушать именно: '+d.nativeReview.es,true):''}<p class="small">Это запись носителя из дня ${d.nativeReview.day}, она не озвучивает новую модель. Прослушай и повтори, затем произнеси новую модель самостоятельно.</p>${(d.videos||[]).map(v=>`<div class="note"><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.title)}</a><p>${esc(v.status)}</p><p>До просмотра: ${esc(v.before)}</p><p>После: ${esc(v.after)}</p><p class="small">Необязательно: замени до 5 минут чтения; достаточно короткого фрагмента. Просмотр не закрывает задания.</p></div>`).join('')}</section>`:'';
  return `<section class="reading workbook-page pathway-page ${mode==='reading'?'reading-mode':''}">${nav}${mode==='reading'?`<details class="reading-choice"><summary>${esc(rb.level+' · '+rb.title)} · сменить текст</summary><div class="workbook-toolbar">${selectors}</div></details>`:''}<div class="pathway-guide">${api.mascot?api.mascot('think'):''}<p>${mode==='reading'?'Нажми на незнакомое слово — разберём его вместе.':'Изучи модель, затем ответь собеседнику без образца.'}</p></div>${mode==='reading'?'':`<div class="workbook-toolbar">${selectors}</div>`}${main}${extra}${mode==='reading'?wordHTML():''}${scope}<details><summary>Границы программы</summary><ul>${content.limits.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>${api.footer?api.footer():''}</section>`;
 }
 function click(b){
  const attrs=['choice','check','next','help','model','translation','text','gloss','following','revisit','save-word','word-help','word-check'];if(!attrs.some(x=>b.hasAttribute('data-pw-'+x)))return false;
  if(b.hasAttribute('data-pw-save-word')){const key=b.getAttribute('data-pw-save-word');if(words.has(key)){state.pathway.words[key]??={...empty(),rating:null,due:0};state.pathway.selectedWord=key;update(b);}return true;}
  if(b.hasAttribute('data-pw-word-help')||b.hasAttribute('data-pw-word-check')){const key=state.pathway.selectedWord,r=state.pathway.words[key];if(!r||!words.has(key))return true;const d=r.drafts.recall??=({value:'',aided:false,help:false,dirty:true});if(b.hasAttribute('data-pw-word-help')){d.help=!d.help;if(d.help)d.aided=true;}else if(d.value.trim()){const e={value:d.value,correct:isCorrect(wordTask(key),d.value),aided:d.aided||d.help,time:Date.now()};if(!r.answers.recall)r.answers.recall={first:e,retries:[]};else r.answers.recall.retries.push(e),r.answers.recall.retries=r.answers.recall.retries.slice(-8);d.dirty=false;if(!e.correct)d.aided=true;r.rating=null;r.due=0;}update(b);return true;}
  const r=row(),t=current();
  if(b.hasAttribute('data-pw-model')){r.showModel=!r.showModel;if(r.showModel)aid(['meaning','produce','reply']);update(b);return true;}
  if(b.hasAttribute('data-pw-translation')){r.translation=!r.translation;if(r.translation)aid(mode==='reading'?['meaning','recall']:['reading-meaning','reading-recall']);update(b);return true;}
  if(b.hasAttribute('data-pw-text')){r.showText=!r.showText;if(r.showText&&t)draft(t).aided=true;update(b);return true;}
  if(b.hasAttribute('data-pw-gloss')){const n=Number(b.getAttribute('data-pw-gloss')),br=mode==='reading'?book():books.get(day().readingId);if(Number.isInteger(n)&&n>=0&&n<br.glossary.length){r.gloss=n;if(t)draft(t).aided=true;update(b);}return true;}
  if(b.hasAttribute('data-pw-following')){if(completed(r,tasksFor(day()),true)&&days.has(day().day+1)){state.pathway.selectedDay++;update(b,true);}return true;}
  if(b.hasAttribute('data-pw-revisit')){r.position=0;r.showModel=false;r.translation=false;r.showText=false;for(const dr of Object.values(r.drafts)){dr.value=typeof dr.value==='number'?null:'';dr.help=false;dr.dirty=true;}update(b,true);return true;}
  if(!t)return true;const dr=draft(t);
  if(b.hasAttribute('data-pw-choice')){const n=Number(b.getAttribute('data-pw-choice'));if(t.kind==='choice'&&Number.isInteger(n)&&n>=0&&n<t.options.length){dr.value=n;dr.dirty=true;update(b);}return true;}
  if(b.hasAttribute('data-pw-help')){dr.help=!dr.help;if(dr.help)dr.aided=true;update(b);return true;}
  if(b.hasAttribute('data-pw-check')){if(t.kind==='choice'?dr.value===null:!String(dr.value).trim()){toast?.('Сначала дай ответ.');return true;}evidence(t,dr.value);update(b);return true;}
  if(b.hasAttribute('data-pw-next')){if(!dr.dirty&&latest(r.answers[t.id])?.correct){r.position=Math.min(tasks().length,r.position+1);r.translation=false;r.showText=false;r.showModel=false;r.gloss=null;update(b,true);}return true;}
  return true;
 }
 function change(el){
  if(el.id==='pathway-word-review'){if(words.has(el.value)&&state.pathway.words[el.value]){state.pathway.selectedWord=el.value;update(el);}return true;}
  if(el.id==='pathway-word-rating'){const r=state.pathway.words[state.pathway.selectedWord],n=el.value===''?null:Number(el.value),last=latest(r?.answers.recall);if(r&&last&&!r.drafts.recall?.dirty){r.rating=Number.isInteger(n)&&n>=0&&n<=2?n:null;r.due=r.rating===null?0:Date.now()+((!last.correct||last.aided||n===0)?1:n===1?3:7)*86400000;update(el);}return true;}
  if(el.id==='pathway-day'){const n=Number(el.value);if(days.has(n)){state.pathway.selectedDay=n;update(el,true);}return true;}
  if(el.id==='pathway-reading'){if(books.has(el.value)){state.pathway.selectedReading=el.value;update(el,true);}return true;}
  if(el.id==='pathway-level'){if(['Все','A1','A2','B1','B2','C1'].includes(el.value)){state.pathway.level=el.value;const matches=content.readings.filter(b=>el.value==='Все'||b.level===el.value);if(!matches.some(b=>b.id===book().id))state.pathway.selectedReading=matches[0].id;update(el,true);}return true;}
  if(el.hasAttribute('data-pw-oral')){row().oral.attempted=el.checked===true;update(el);return true;}
  if(el.id==='pathway-rating'){const n=el.value===''?null:Number(el.value);row().oral.rating=Number.isInteger(n)&&n>=0&&n<=2?n:null;update(el);return true;}
  return false;
 }
 function input(el){if(el.id==='pathway-word-answer'){const r=state.pathway.words[state.pathway.selectedWord];if(r){const d=r.drafts.recall??=({value:'',aided:false,help:false,dirty:true});d.value=el.value.slice(0,1000);d.dirty=true;save();}return true;}if(el.id==='pathway-answer'&&current()?.kind==='text'){const d=draft(current());d.value=el.value.slice(0,1000);d.dirty=true;save();return true;}if(el.id==='pathway-note'){row().oral.note=el.value.slice(0,1000);save();return true;}return false;}
 function enter(selected=31,kind='pathway'){mode=kind==='reading'?'reading':'pathway';if(mode==='reading'&&books.has(selected))state.pathway.selectedReading=selected;else if(mode==='pathway'&&days.has(Number(selected)))state.pathway.selectedDay=Number(selected);row();save();}
 function context(){const d=day(),b=book(),t=current(),a=t?row().answers[t.id]:null;return {extension:true,pathDay:mode==='reading'?b.id:d.day,result:latest(a)?{correct:latest(a).correct}:null,extensionLesson:mode==='reading'?{mission:'Прочитай текст, проверь смысл. Для воспроизведения текст скрывается. Перевод и подсказки отмечаются в попытке.',pattern:'',explanation:'Нажми на слово в тексте для значения. Сохрани его для повторения; запись носителя для этого авторского текста пока не добавлена.',examples:[]}:{mission:'День '+d.day+' · '+d.goal,pattern:d.model.es,explanation:d.model.rule,examples:[{...d.nativeReview}]}}}
 return {html,click,change,input,summary,sanitize,merge,enter,context,markHelp:()=>{if(current()){draft(current()).aided=true;save();}}};
}};
