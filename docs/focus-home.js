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
  const c=context();if(!c.lesson)return '';const ext=c.extension,day=ext?.day||c.day,title=ext?.title||c.lesson.title,screen=api.screen?.()==='course'?'course':'today';
  const controlDay=c.ongoing?c.active?.controlReviewDay:api.dueControl?.(),skipped=!ext&&(c.ongoing?c.active.reviewSkipped:!c.keys.length&&!controlDay),step=c.ongoing?c.active.step:(skipped?1:0);
  const outline=ext?list(ext.plan):[{title:'Повторить',minutes:5},{title:'Урок',minutes:13},{title:'Разговор',minutes:10},{title:'Свой ответ',minutes:7}];
  const tabs=`<div class="learn-tabs" role="group" aria-label="Выбрать экран уроков"><button type="button" data-home-screen="today" aria-pressed="${screen==='today'}">Сегодня</button><button type="button" data-home-screen="course" aria-pressed="${screen==='course'}">Все уроки</button></div>`;
  if(screen==='course'){
   const chapter=chapters[c.chapter],topics=list(data.lessons).filter(l=>l.day>=chapter.first&&l.day<=chapter.last);
   return `<section class="focus-home guided-home course-picker">${tabs}<h1>Все уроки</h1><section class="focus-topics cafe-route" aria-label="Курс по дням"><div class="focus-chapters" role="group" aria-label="Глава курса">${chapters.map((ch,i)=>`<button type="button" data-chapter-nav="${i}" aria-pressed="${i===c.chapter}"><strong>${esc(ch.title)}</strong><small>Дни ${ch.first}–${ch.last}</small></button>`).join('')}</div><div class="focus-days cafe-days" role="group" aria-label="Дни главы ${esc(chapter.title)}">${topics.map(l=>`<button type="button" class="focus-topic ${c.completed.includes(l.day)?'done':''}" data-day-plan="${l.day}" ${l.day===c.day?'aria-current="step"':''}><span class="focus-topic-day">${c.completed.includes(l.day)?icon('check'):l.day}</span><span><strong>${esc(l.title)}</strong><small>${c.ongoing&&l.day===c.day?'Занятие продолжается':c.completed.includes(l.day)?'Урок пройден':'День '+l.day}</small></span>${icon('chevron-right')}</button>`).join('')}</div></section><details class="course-continuation"><summary>Курс после 30-го дня</summary><button type="button" class="btn" data-open-pathway>Дни 31–90 ${icon('arrow-right')}</button></details>${footer()}</section>`;
  }
  const label=ext?'Продолжить курс':c.ongoing||state.learning?.sessions?.[c.day]?'Продолжить занятие':'Начать занятие';
  return `<section class="focus-home guided-home today-screen">${tabs}<section class="study-today" aria-labelledby="focus-study-title"><div class="study-meta"><span>День ${day} / ${ext?90:30}</span><span>≈ ${skipped?30:35} мин</span></div><h1 id="focus-study-title">${esc(title)}</h1><p class="study-goal">${esc(ext?.goal||data.guidance?.lessons?.find(g=>g.day===c.day)?.communicativeGoal||c.lesson.goal)}</p><button type="button" class="btn primary focus-start" ${ext?'data-continue-pathway="'+ext.day+'"':'data-studio-begin'}>${label}${icon('arrow-right')}</button><ol class="study-steps" aria-label="Порядок занятия">${outline.slice(0,5).map((x,i)=>({x,i})).filter(({i})=>ext||!skipped||i!==0).map(({x,i},j)=>`<li class="${!ext&&i<step?'is-done':!ext&&i===step?'is-current':''}" ${!ext&&i===step?'aria-current="step"':''}><span class="study-step-number">${!ext&&i<step?icon('check'):j+1}</span><span><strong>${esc(x.title)}</strong></span></li>`).join('')}</ol><div class="study-mentor">${mascot('wave')}<p>${controlDay?'Начнём со знакомого разговора дня '+controlDay+': вспомни фразы после паузы.':c.day===1?'Сегодня познакомимся. Три фразы — и твой первый разговор.':c.day===2?'Сегодня поддержим разговор: как дела — и встречный вопрос.':(data.guidance?.lessons?.find(g=>g.day===c.day)?.introTips?.[0]?.tipRu||'Я помогу с трудной фразой.')}</p><button type="button" class="btn quiet" data-lumo="open">Помощь ${icon('messages-square')}</button></div>${c.quote?`<div class="study-sample"><div><p lang="es">${esc(c.quote.es)}</p><span>${esc(c.quote.ru)}</span></div>${playButton(c.quote.audio,'Слушать: '+c.quote.es,true)}</div>`:''}<button type="button" class="btn quiet study-resources" ${ext?'data-continue-pathway="'+ext.day+'"':'data-day-plan="'+c.day+'"'}>Слова, чтение и видео дня ${icon('arrow-right')}</button></section>${footer()}</section>`;
 }
 return {html,context};
}};
