/* A small, resumable reading/video cycle. Opening a resource never proves learning. */
window.VamosLessonMedia={create(api){
 'use strict';
 const {data,state,esc,icon,save,render,playButton,playSequence,footer}=api,units=data.lessonMedia?.units||[],resources=data.lessonMedia?.resources||[];
 const validDay=n=>Number.isInteger(n)&&n>=1&&n<=30,now=()=>Date.now(),validTime=n=>Number.isFinite(n)&&n>0&&n<=now()+60000,norm=s=>String(s).normalize('NFC').toLocaleLowerCase('es'),DELAY=20*3600000;
 const unit=d=>units.find(u=>u.day===d),resource=u=>resources.find(v=>v.id===u?.videoResourceId),story=u=>data.stories?.days?.find(s=>'story:'+s.day===u?.reading?.id);
 const questions=d=>{const u=unit(d),v=resource(u);return [...(u?.reading?.questions||[]),...(v?.questions||[])];};
 const safeUrl=(s,pdf=false)=>{try{const u=new URL(s);return u.protocol==='https:'&&['videoele.com','www.videoele.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&(pdf?/^\/Archivos\/[A-Za-z0-9_-]+\.pdf$/:/^\/[A-Za-z0-9_-]+\.html$/).test(u.pathname)?u.href:null;}catch{return null;}};
 const safeVideo=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{11}$/.test(s)?s:null;
 const attempt=(a,q)=>q&&Number.isInteger(a?.value)&&a.value>=0&&a.value<q.options.length&&validTime(a.time)?{value:a.value,correct:a.value===q.answer,aided:a.aided===true,time:a.time}:null;
 const safeAnswers=(raw,qs)=>Object.fromEntries(qs.map(q=>[q.id,attempt(raw?.[q.id],q)]).filter(([,a])=>a));
 const currentAttempt=(r,q)=>q?(r.retries[q.id]||r.answers[q.id]):null;
 function gate(r,qs){const wanted=Number.isInteger(r.cursor)&&r.cursor>=0&&r.cursor<=6?r.cursor:0;for(const [i,limit]of [[0,2],[1,3],[2,5],[3,6]])if(wanted>=limit&&!currentAttempt(r,qs[i])?.correct)return limit-1;return wanted;}
 function cleanRow(raw,d){
  const qs=questions(d),answers=safeAnswers(raw?.answers,qs),candidate=safeAnswers(raw?.retries,qs),retries={};
  for(const q of qs)if(answers[q.id]&&candidate[q.id]?.time>=answers[q.id].time)retries[q.id]={...candidate[q.id],aided:candidate[q.id].aided||answers[q.id].aided||!answers[q.id].correct};
  const all=qs.length===4&&qs.every(q=>(retries[q.id]||answers[q.id])?.correct),finished=all&&raw?.transfer===true&&validTime(raw.finished)?raw.finished:null;
  const out={answers,retries,opened:raw?.opened===true,videoOpened:raw?.videoOpened===true,readingAided:raw?.readingAided===true,videoAided:raw?.videoAided===true,transfer:raw?.transfer===true,done:finished!==null,finished,updatedAt:validTime(raw?.updatedAt)?raw.updatedAt:0,cursor:raw?.cursor};
  for(let i=0;i<qs.length;i++)if([answers[qs[i].id],retries[qs[i].id]].some(a=>a&&(!a.correct||a.aided)))out[i<2?'readingAided':'videoAided']=true;
  out.cursor=finished!==null?6:gate(out,qs);return out;
 }
 function eligible(rows,id,at=now()){return units.some(u=>u.videoResourceId===id&&rows[u.day]?.done&&validTime(rows[u.day].finished)&&at-rows[u.day].finished>=DELAY);}
 function sanitize(raw){
  const rows={};for(const u of units)if(raw?.rows?.[u.day]&&validDay(u.day))rows[u.day]=cleanRow(raw.rows[u.day],u.day);
  const reviews={},reviewRetries={};for(const v of resources){const a=attempt(raw?.reviews?.[v.id],v.delayedQuestion);if(a&&eligible(rows,v.id)&&eligible(rows,v.id,a.time)){reviews[v.id]=a;const retry=attempt(raw?.reviewRetries?.[v.id],v.delayedQuestion);if(retry&&retry.time>=a.time&&eligible(rows,v.id,retry.time))reviewRetries[v.id]={...retry,aided:true};}}
  return {rows,reviews,reviewRetries};
 }
 state.lessonMedia=sanitize(state.lessonMedia);
 let day=1,index=0,selected=null,result=null,translations=new Set(),videoLoaded=false,delayed=null;
 const row=()=>state.lessonMedia.rows[day]||(state.lessonMedia.rows[day]=cleanRow({},day));
 const phase=()=>index<3?'readingAided':'videoAided';
 function touch(){row().cursor=index;row().updatedAt=now();save();}
 function markAid(){row()[phase()]=true;touch();}
 function currentQuestion(){const u=unit(day),v=resource(u);return delayed?.question||([1,2].includes(index)?u?.reading.questions[index-1]:[4,5].includes(index)?v?.questions[index-4]:null);}
 function loadAttempt(){const q=currentQuestion(),a=q?(delayed?state.lessonMedia.reviewRetries[delayed.resource.id]||state.lessonMedia.reviews[delayed.resource.id]:currentAttempt(row(),q)):null;selected=a?.value??null;result=a?{correct:a.correct}:null;}
 function enter(d){if(!validDay(d)||!unit(d))return false;day=d;const r=row();r.opened=true;index=r.cursor;translations=new Set();videoLoaded=false;delayed=null;
  for(const u of units){const v=resource(u),a=v&&(state.lessonMedia.reviewRetries[v.id]||state.lessonMedia.reviews[v.id]);if(v?.delayedQuestion&&eligible(state.lessonMedia.rows,v.id)&&!a?.correct){delayed={resource:v,question:v.delayedQuestion};break;}}
  loadAttempt();touch();return true;
 }
 const exact=w=>data.wordAudioHuman?.words?.[norm(w)]||data.wordAudioExtra?.words?.[norm(w)]||data.wordAudio?.words?.[norm(w)];
 function text(es){return String(es).split(/([\p{L}]+(?:['’][\p{L}]+)?)/u).map(p=>/\p{L}/u.test(p)?`<button type="button" class="media-word" lang="es" data-media-word="${esc(p)}" aria-label="Слушать слово: ${esc(p)}">${esc(p)}</button>`:esc(p)).join('');}
 function header(title,sub){const scheduled=validDay(api.logicalDay?.())?api.logicalDay():day;return `<div class="media-heading"><p class="small">День ${scheduled}${scheduled!==day?` · повтор темы ${day}`:""} · чтение и видео${delayed?' · отложенная проверка':` · ${Math.min(index+1,7)} / 7`}</p><h1 tabindex="-1">${esc(title)}</h1><p>${esc(sub)}</p></div>`;}
 function questionHTML(q){const first=delayed?state.lessonMedia.reviews[delayed.resource.id]:row().answers[q.id];return `${header(delayed?'Вспомни без подсказки':'Проверь смысл',q.prompt)}<div class="options">${q.options.map((o,i)=>`<button type="button" class="option" data-media-answer="${i}" aria-pressed="${selected===i}" ${result?.correct?'disabled':''}>${esc(o)}</button>`).join('')}</div><button type="button" class="btn primary" data-media-check ${selected===null?'disabled':''}>${result?.correct?'Дальше':'Проверить'}</button>${result?`<div class="feedback ${result.correct?'':'wrong'}" role="status"><h2>${result.correct?'Верно':'Вернись к смыслу'}</h2><p>${esc(q.feedback)}</p>${first?`<p class="small">Первая попытка${delayed?' после задержки':''}: ${first.correct?'верно':'ошибка'}${first.aided?' · с опорой':''}. Исправление сохраняется отдельно.</p>`:''}</div>`:''}${!delayed?`<button type="button" class="btn quiet" data-media-source>Вернуться к ${index<3?'тексту':'видео'} · с опорой</button>`:''}`;}
 function html(){const u=unit(day),v=resource(u),s=story(u);if(!u||!v||!s)return `<section class="reading"><h1>Материал пока недоступен</h1><button type="button" class="btn" data-nav="home">К урокам</button></section>`;let body='';
  if(delayed)body=questionHTML(delayed.question);
  else if(index===0)body=`${header(s.title,'Прочитай короткую сцену. Затем скроем текст и зададим два вопроса.')}${api.audioControls?.()||''}${api.audioStatus?.()||''}${s.lines.map((l,i)=>`<div class="media-line">${l.role||l.speaker?`<p class="small media-speaker">${esc(l.role||l.speaker)}</p>`:""}<p lang="es">${text(l.es)}</p><button type="button" class="btn quiet" data-media-translation="${i}">${translations.has(i)?'Скрыть перевод':'Перевод предложения'}</button>${translations.has(i)?`<p>${esc(l.ru)}</p>`:''}${l.audio?playButton(l.audio,'Слушать предложение: '+l.es,true):''}${l.audio?api.audioCredit?.({audio:l.audio})||'':''}</div>`).join('')}<p class="small">На слове — отдельная человеческая запись, если она есть в каталоге. Не все предложения этой сцены записаны: у доступных есть своя кнопка звука.</p><button type="button" class="btn primary" data-media-next>Скрыть текст · к вопросам</button>`;
  else if([1,2,4,5].includes(index))body=questionHTML(currentQuestion());
  else if(index===3){const url=safeUrl(v.url),transcript=safeUrl(v.transcriptUrl,true),video=safeVideo(v.youtubeId);body=`${header(v.title,u.beforeRu)}${u.repeatRu?`<p class="note">${esc(u.repeatRu)}</p>`:''}${video?videoLoaded?`<div class="media-video"><iframe title="${esc(v.title)}" src="https://www.youtube-nocookie.com/embed/${video}" allow="fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`:`<button type="button" class="btn primary" data-media-load-video>Открыть плеер видео</button>`:'<p class="note">Плеер этого материала сейчас недоступен.</p>'}${url?`<a class="btn quiet" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-media-video-link>Если плеер недоступен: к оригиналу ${icon('external-link')}</a>`:''}<p class="small">${esc(v.author||'Agustín Iruela · VideoEle')} · CC BY-NC-ND 4.0. <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/" target="_blank" rel="noopener noreferrer">Лицензия исходного материала</a>.</p><p class="small">Видео на испанском; задача и вопросы — по-русски. Если быстро, открой настройки плеера → «Скорость» → 0,5×. Три минуты — ориентир для поиска ответа, не длительность полного ролика. Открытие плеера не означает, что материал понят.</p>${transcript?`<details data-media-transcript><summary>Транскрипция автора · опора</summary><a href="${esc(transcript)}" target="_blank" rel="noopener noreferrer" data-media-transcript-link>Открыть исходную транскрипцию</a><p>${esc(v.verifiedScope)}</p></details>`:''}<button type="button" class="btn primary" data-media-next>К вопросам по видео</button>`;}
  else body=`${header('Теперь используй сам',u.transferRu)}<label class="media-self"><input type="checkbox" data-media-transfer ${row().transfer?'checked':''} ${row().done?'disabled':''}>Я сказал свою реплику вслух.</label><p class="small">Это твоя отметка. Вопросы проверяют факты текста и видео, а не весь уровень языка. Проверка памяти появится в следующем занятии, спустя примерно сутки (не раньше чем через 20 часов).</p><button type="button" class="btn primary" data-media-finish ${row().transfer?'':'disabled'}>${row().done?'Продолжить занятие':'Сохранить результат и перейти к разговору'}</button>`;
  return `<section class="reading lesson-media"><button type="button" class="btn quiet" data-nav="home">${icon('arrow-left')}К урокам</button>${body}<p id="media-status" class="small" role="status"></p>${footer()}</section>`;
 }
 function refresh(top=false){const y=window.scrollY,active=document.activeElement,attr=['data-media-answer','data-media-check','data-media-translation','data-media-transfer','data-media-load-video'].find(k=>active?.hasAttribute?.(k)),value=attr?active.getAttribute(attr):null;render();if(top){window.scrollTo({top:0,behavior:'instant'});document.querySelector('.media-heading h1')?.focus({preventScroll:true});}else{if(attr){const target=[...document.querySelectorAll?.('['+attr+']')||[]].find(el=>el.getAttribute(attr)===value);target?.focus?.({preventScroll:true});}window.scrollTo({top:y,behavior:'instant'});}}
 function move(next){index=next;loadAttempt();touch();refresh(true);}
 function click(b){
  if(b.hasAttribute('data-media-word')){const clip=exact(b.dataset.mediaWord);if(clip)playSequence([clip],b,{restart:true});else{const status=document.querySelector('#media-status');if(status)status.textContent='Для «'+b.dataset.mediaWord+'» отдельная человеческая запись пока не найдена.';}return true;}
  if(b.hasAttribute('data-media-answer')){const q=currentQuestion(),v=Number(b.dataset.mediaAnswer);if(q&&!result?.correct&&Number.isInteger(v)&&v>=0&&v<q.options.length){selected=v;result=null;refresh();}return true;}
  if(b.hasAttribute('data-media-check')){const q=currentQuestion();if(!q||selected===null)return true;
   if(result?.correct){if(delayed){delayed=null;loadAttempt();touch();refresh(true);}else move(index+1);return true;}
   const previous=delayed?state.lessonMedia.reviews[delayed.resource.id]:row().answers[q.id],previousRetry=delayed?state.lessonMedia.reviewRetries[delayed.resource.id]:row().retries[q.id];
   const a={value:selected,correct:selected===q.answer,aided:delayed?!!(previous||previousRetry):row()[phase()],time:now()};
   if(delayed){const id=delayed.resource.id;if(!state.lessonMedia.reviews[id])state.lessonMedia.reviews[id]=a;else state.lessonMedia.reviewRetries[id]=a;}
   else{if(!row().answers[q.id])row().answers[q.id]=a;else row().retries[q.id]=a;if(!a.correct)row()[phase()]=true;}
   result={correct:a.correct};touch();refresh();return true;
  }
  if(delayed)return ['data-media-next','data-media-source','data-media-load-video','data-media-video-link','data-media-translation','data-media-finish','data-media-transcript-link'].some(a=>b.hasAttribute(a));
  if(b.hasAttribute('data-media-translation')){if(index!==0)return true;const i=Number(b.dataset.mediaTranslation);if(!Number.isInteger(i)||i<0||i>=story(unit(day)).lines.length)return true;markAid();translations.has(i)?translations.delete(i):translations.add(i);refresh();return true;}
  if(b.hasAttribute('data-media-next')){if(index===0){const qs=unit(day).reading.questions;move(!currentAttempt(row(),qs[0])?.correct?1:!currentAttempt(row(),qs[1])?.correct?2:3);}else if(index===3){const qs=resource(unit(day)).questions;move(!currentAttempt(row(),qs[0])?.correct?4:!currentAttempt(row(),qs[1])?.correct?5:6);}return true;}
  if(b.hasAttribute('data-media-source')){if([1,2,4,5].includes(index)){markAid();move(index<3?0:3);}return true;}
  if(b.hasAttribute('data-media-load-video')){if(index===3&&safeVideo(resource(unit(day)).youtubeId)){videoLoaded=true;row().videoOpened=true;touch();refresh();}return true;}
  if(b.hasAttribute('data-media-video-link')){if(index!==3||!safeUrl(resource(unit(day)).url))return true;row().videoOpened=true;touch();return false;}
  if(b.hasAttribute('data-media-transcript-link')){if(index===3&&safeUrl(resource(unit(day)).transcriptUrl,true)){markAid();return false;}return true;}
  if(b.hasAttribute('data-media-finish')){const qs=questions(day);if(index===6&&row().transfer&&qs.length===4&&qs.every(q=>currentAttempt(row(),q)?.correct)){row().done=true;row().finished=row().finished||now();touch();api.finished?.(day);}return true;}
  return false;
 }
 function change(el){if(!el.hasAttribute('data-media-transfer'))return false;if(!delayed&&index===6&&!row().done){row().transfer=el.checked===true;touch();refresh();}return true;}
 function toggle(el){if(el.open&&el.hasAttribute('data-media-transcript')&&!delayed&&index===3){markAid();return true;}return false;}
 function merge(raw){
  const a=sanitize(state.lessonMedia),b=sanitize(raw),rows={};
  const sort=(x,y)=>x.time-y.time||Number(x.correct)-Number(y.correct)||Number(y.aided)-Number(x.aided)||x.value-y.value,latestSort=(x,y)=>x.time-y.time||Number(y.correct)-Number(x.correct)||Number(x.aided)-Number(y.aided)||x.value-y.value;
  function combine(firstA,firstB,retryA,retryB){const firsts=[firstA,firstB].filter(Boolean).sort(sort);if(!firsts.length)return {};const first=firsts[0],later=[...firsts.slice(1),retryA,retryB].filter(x=>x&&x.time>=first.time&&!(x.time===first.time&&x.value===first.value&&x.aided===first.aided)).sort(latestSort);return {first,retry:later.at(-1)};}
  for(const u of units){const x=a.rows[u.day],y=b.rows[u.day];if(!x&&!y)continue;if(!x||!y){rows[u.day]=x||y;continue;}const latest=y.updatedAt>x.updatedAt?y:x,r={...latest,answers:{},retries:{},opened:x.opened||y.opened,videoOpened:x.videoOpened||y.videoOpened,readingAided:x.readingAided||y.readingAided,videoAided:x.videoAided||y.videoAided,transfer:x.done||y.done||latest.transfer,finished:[x.finished,y.finished].filter(validTime).sort((a,b)=>a-b)[0]??null};
   for(const q of questions(u.day)){const m=combine(x.answers[q.id],y.answers[q.id],x.retries[q.id],y.retries[q.id]);if(m.first)r.answers[q.id]=m.first;if(m.retry)r.retries[q.id]=m.retry;}rows[u.day]=r;
  }
  const reviews={},reviewRetries={};for(const v of resources){const m=combine(a.reviews[v.id],b.reviews[v.id],a.reviewRetries[v.id],b.reviewRetries[v.id]);if(m.first)reviews[v.id]=m.first;if(m.retry)reviewRetries[v.id]=m.retry;}
  state.lessonMedia=sanitize({rows,reviews,reviewRetries});const r=state.lessonMedia.rows[day];if(r){index=r.cursor;loadAttempt();}save();return state.lessonMedia;
 }
 return {enter,html,click,change,toggle,sanitize,merge,context:()=>({day,index,delayed:!!delayed}),done:d=>state.lessonMedia.rows[d]?.done===true};
}};
