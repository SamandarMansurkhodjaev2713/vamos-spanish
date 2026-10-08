/* One study destination; counts describe recorded work, never language level. */
window.VamosFocusHome={create(api){
 'use strict';
 const {state,data,esc,icon=()=>'',mascot=()=>'',playButton=()=>'',footer=()=>'',nextDay=()=>1,dueKeys=()=>[],pathwaySummary=()=>({})}=api;
 const list=x=>Array.isArray(x)?x:[],dayOK=n=>Number.isInteger(n)&&n>=1&&n<=30;
 const chapters=[{title:'Знакомство',first:1,last:7},{title:'Интересы',first:8,last:14},{title:'Мои планы',first:15,last:21},{title:'Живой разговор',first:22,last:30}];
 const numberSet=(x,min,max)=>[...new Set(list(x).filter(n=>Number.isInteger(n)&&n>=min&&n<=max))];
 function context(){
  const completed=numberSet(state.completed,1,30),active=state.studio?.active,ongoing=active&&dayOK(active.day)&&Number.isInteger(active.step)&&active.step>=0&&active.step<4;
  const requested=nextDay(),day=ongoing?active.day:dayOK(requested)?requested:1,lesson=data.lessons?.find(l=>l.day===day)||data.lessons?.[0];
  const raw=pathwaySummary()||{},days=list(data.pathway?.days),extensionDone=numberSet(raw.completedDays,31,90).filter(n=>days.some(d=>d.day===n));
  const requestedExtension=api.continuation?.(),extension=requestedExtension&&Number.isInteger(requestedExtension.day)&&requestedExtension.day>=31&&requestedExtension.day<=90&&days.some(d=>d.day===requestedExtension.day)?requestedExtension:null;
  const chapter=Number.isInteger(state.chapter)&&state.chapter>=0&&state.chapter<4?state.chapter:chapters.findIndex(c=>day>=c.first&&day<=c.last);
  const contentDay=day===24&&dayOK(state.repairDay)?state.repairDay:state.recovery&&[22,23].includes(day)?day===22?19:20:day;
  const examples=list(data.expanded?.lessons?.[contentDay-1]?.examples),quote=examples[0]?.audio?examples[0]:null;
  let keys=[];try{keys=[...new Set(list(dueKeys()).filter(k=>typeof k==='string'))]}catch{}
  return {completed,active,ongoing,day,lesson,extension,extensionDone,chapter,quote,keys};
 }
 function html(){
  const c=context();if(!c.lesson)return '';const ext=c.extension,day=ext?.day||c.day,title=ext?.title||c.lesson.title;
  const skipped=!ext&&(c.active?.reviewSkipped||(!c.ongoing&&!c.keys.length));
  const step=c.ongoing?c.active.step:(skipped?1:0),saved=!ext&&state.learning?.sessions?.[c.day];
  const label=ext?'Продолжить курс':c.ongoing?['Продолжить повторение','Продолжить урок','Продолжить разговор','Сказать о себе'][step]:saved?'Продолжить урок':'Начать занятие';
  const outline=ext?list(ext.plan):[{title:'Повторение',minutes:5},{title:'Урок',minutes:13},{title:'Разговор',minutes:10},{title:'Свой ответ',minutes:7}];
  const chapter=chapters[c.chapter],topics=list(data.lessons).filter(l=>l.day>=chapter.first&&l.day<=chapter.last);
  const video=list(data.videoGuide?.items).find(v=>v.language==='ru-es'&&list(v.suggestedCoreDays).includes(c.day));
  return `<div class="page focus-home cafe-home guided-home">
   <section class="study-today" aria-labelledby="focus-study-title">
    <div class="study-meta"><span>День ${day} / ${ext?90:30}</span><span>≈ ${skipped?30:35} минут</span></div>
    <h1 id="focus-study-title">${esc(title)}</h1><p class="study-goal">${esc(ext?.goal||c.lesson.goal)}</p>
    <button type="button" class="btn primary focus-start" ${ext?'data-continue-pathway="'+ext.day+'"':'data-studio-begin'}>${label}${icon('arrow-right')}</button>
    <p class="study-save">${icon('bookmark')}Можно прерваться. Твоё место сохранится.</p>
    <ol class="study-steps" aria-label="Порядок занятия">${outline.slice(0,5).map((x,i)=>`<li class="${!ext&&skipped&&i===0?'is-skipped':!ext&&i<step?'is-done':!ext&&i===step?'is-current':''}" ${!ext&&i===step?'aria-current="step"':''}><span class="study-step-number">${!ext&&i<step&&!skipped?icon('check'):i+1}</span><span><strong>${esc(x.title)}</strong><small>${!ext&&skipped&&i===0?'Пока нечего повторять':!ext&&i<step?'Пройдено':!ext&&i===step?'Сейчас · '+x.minutes+' мин':x.minutes+' мин'}</small></span></li>`).join('')}</ol>
    <div class="study-mentor">${mascot('wave')}<p><strong>Лумо рядом</strong><span>Нужна помощь? Разберём текущую фразу.</span></p><button type="button" class="btn quiet" data-lumo="open" aria-label="Попросить Лумо объяснить">${icon('messages-square')}Спросить</button></div>
   </section>
   <details class="study-extras"><summary>Материалы дня ${icon('chevron-down')}</summary><div>${c.quote?`<div class="study-sample"><div><p lang="es">${esc(c.quote.es)}</p><small>${esc(c.quote.ru)}</small></div>${playButton(c.quote.audio,'Слушать: '+c.quote.es,true)}</div>`:''}<nav class="focus-materials" aria-label="Материалы текущего дня">${ext?`<button type="button" data-continue-pathway="${ext.day}">${icon('book-open')}Слова и модели</button>`:`<button type="button" data-profile-action="words" data-profile-day="${c.day}">${icon('book-open')}Слова дня</button><button type="button" data-profile-action="workbook" data-profile-day="${c.day}">${icon('book-open')}История дня</button>${video?`<a href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">${icon('play')}Видео на русском ${icon('external-link')}</a>`:''}`}</nav>${!ext?`<button type="button" class="btn quiet" data-day-plan="${c.day}">Полный план дня ${icon('arrow-right')}</button>`:''}</div></details>
   <section class="focus-topics cafe-route" aria-labelledby="focus-topics-title"><div class="focus-topics-head"><h2 id="focus-topics-title">Курс по дням</h2><span>${c.completed.length} / 30 уроков</span></div><div class="focus-chapters" role="group" aria-label="Глава курса">${chapters.map((ch,i)=>`<button type="button" data-chapter-nav="${i}" aria-pressed="${i===c.chapter}"><strong>${esc(ch.title)}</strong><small>${ch.first}–${ch.last}</small></button>`).join('')}</div><div class="focus-days cafe-days" role="group" aria-label="Дни главы ${esc(chapter.title)}">${topics.map(l=>`<button type="button" class="focus-topic ${c.completed.includes(l.day)?'done':''}" data-day-plan="${l.day}" ${l.day===c.day?'aria-current="step"':''}><span class="focus-topic-day">${c.completed.includes(l.day)?icon('check'):l.day}</span><span><strong>${esc(l.title)}</strong><small>${c.ongoing&&l.day===c.day?'Занятие продолжается':c.completed.includes(l.day)?'Урок пройден':l.day===c.day?'Следующий день':'Посмотреть день'}</small></span>${icon('chevron-right')}</button>`).join('')}</div></section>
   <nav class="study-more" aria-label="Другие способы учиться"><button type="button" data-open-reading>${icon('book-open')}Чтение по уровням${icon('arrow-right')}</button><button type="button" data-open-pathway>${icon('route')}Продолжение · дни 31–90${icon('arrow-right')}</button></nav>${footer()}</div>`;
 }
 return {html,context};
}};
