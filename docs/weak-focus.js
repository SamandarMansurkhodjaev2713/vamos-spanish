/* Read-only day29 suggestions from actual local practice; not a proficiency score. */
window.VamosWeakFocus={create(api){
 'use strict';
 const {state,data,esc,icon=()=>'',playButton=()=>'',startSet}=api;
 const list=x=>Array.isArray(x)?x:[],knownTimes=x=>Number.isFinite(x)&&x>0&&x<=Date.now()+60000;
 function metric(v){return v&&Number.isFinite(v.attempts)&&v.attempts>0&&v.attempts<=10000&&Number.isFinite(v.misses)&&v.misses>=0&&v.misses<=v.attempts&&Number.isFinite(v.aided)&&v.aided>=0&&v.aided<=v.attempts&&knownTimes(v.last)&&Number.isFinite(v.recent)&&v.recent>=0&&v.recent<=1?v:null;}
 function selection(day){
  if(day!==29)return {items:[],ordinary:false};
  const byAudio=new Map(),practised=new Set(),completed=new Set(list(state.completed).filter(d=>Number.isInteger(d)&&d>=1&&d<=29));
  for(const lesson of list(data.expanded?.lessons).filter(d=>Number.isInteger(d.day)&&d.day<=29).sort((a,b)=>a.day-b.day))for(const [i,p]of list(lesson.examples).entries()){
   if(typeof p.audio!=='string'||typeof p.es!=='string'||typeof p.ru!=='string')continue;
   if(!byAudio.has(p.audio))byAudio.set(p.audio,{...p,day:lesson.day});
   if(i<3&&completed.has(lesson.day))practised.add(p.audio);
  }
  const candidates=[];
  for(const [audio,p]of byAudio){const v=metric(state.adaptive?.phrases?.[audio]);if(v)practised.add(audio);
   const card=state.cards?.['p:'+audio],due=knownTimes(card?.due)&&card.due<=Date.now();if(!practised.has(audio))continue;
   const need=v?(1-v.recent)*.65+(v.misses+v.aided*.65)/(v.attempts+2)*.35:0,difficulty=state.adaptive?.enabled!==false&&v&&(v.misses>0||v.aided>0)&&need>=.35,score=difficulty?need:0;
   if(difficulty||due)candidates.push({...p,score,last:v?.last||card.due,reason:difficulty&&v?.aided>0?'В прошлых заданиях здесь требовалась опора.':difficulty&&v?.misses>0?'Раньше ответ не совпадал с подготовленной моделью.':'Для этой знакомой фразы подошло время повторения.'});
  }
  candidates.sort((a,b)=>b.score-a.score||a.last-b.last||a.day-b.day||a.audio.localeCompare(b.audio));
  if(candidates.length)return {items:candidates.slice(0,2),ordinary:false};
  const known=[...byAudio.values()].filter(p=>practised.has(p.audio)).sort((a,b)=>b.day-a.day||a.audio.localeCompare(b.audio));
  return {items:known.slice(0,2).map(p=>({...p,reason:'Обычная практика знакомой модели; слабость не установлена.'})),ordinary:true};
 }
 function keys(day){return selection(day).items.map(p=>'p:'+p.audio);}
 function html(day){if(day!==29)return '';const s=selection(day),count=s.items.length;
  return `<section class="weak-focus" data-weak-focus="29" aria-labelledby="weak-focus-title"><h2 id="weak-focus-title">${count===2?'Две фразы для своего ответа':count===1?'Фраза для своего ответа':'С чего начать повторение'}</h2><p>${s.ordinary?'Пока нет достаточных оснований выделить слабые места. '+(count?'Возьмём знакомые модели для обычной практики.':'Сначала пройди урок: после своих ответов здесь появятся конкретные фразы.'):'Выбрали по твоим прошлым ответам и повторениям на этом устройстве. Сначала восстанови смысл без образца, затем используй фразу в коротком разговоре.'}</p>${count?`<ol class="weak-focus-list">${s.items.map(p=>`<li class="weak-focus-item"><p class="weak-focus-prompt">Скажи по-испански: <strong>${esc(p.ru)}</strong></p><p class="weak-focus-reason">${esc(p.reason)}</p><details class="weak-focus-support"><summary>Сверить после своей попытки</summary><p lang="es">${esc(p.es)}</p>${playButton(p.audio,'Слушать точную модель: '+p.es,true)}<p class="small">Исходная модель дня ${p.day}. Личная версия ответа может отличаться; запись озвучивает эту точную фразу.</p></details></li>`).join('')}</ol><button type="button" class="btn" data-weak-focus-review="29">${icon('rotate-ccw')}Повторить ${count===2?'эти две фразы':'эту фразу'}</button><p class="small">Это подбор практики. Он не проверяет произношение, не подтверждает уровень и не меняет первые ответы.</p>`:''}</section>`;
 }
 function handleClick(b){if(!b?.hasAttribute?.('data-weak-focus-review')||b.dataset?.weakFocusReview!=='29')return false;const selected=keys(29);if(!selected.length||typeof startSet!=='function')return false;startSet([...selected]);return true;}
 return {html,keys,handleClick};
}};
