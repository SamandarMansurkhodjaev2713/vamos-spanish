/* Contextual recall of saved reading words. Self-report, never an automatic score. */
window.VamosReaderRecall={create(api){
 'use strict';
 const {esc,icon,playButton,words,reviews,onRate,render}=api;
 let opened=false,queue=[],shown=false,tried=0,session=0;
 const items=()=>{
  const seen=new Set();
  const source=words();
  return (Array.isArray(source)?source:[]).filter(w=>w&&typeof w.key==='string'&&w.key&&typeof w.es==='string'&&w.es.trim()&&typeof w.ru==='string'&&w.ru.trim()&&!seen.has(w.key)&&seen.add(w.key));
 };
 function current(){
  const available=new Map(items().map(w=>[w.key,w]));
  while(queue.length&&!available.has(queue[0])){queue.shift();shown=false;}
  return available.get(queue[0])||null;
 }
 function close(renderNow=true){opened=false;queue=[];shown=false;if(renderNow)render();}
 function start(options={}){
  const review=reviews()||{},now=Date.now();
  queue=items().map((w,index)=>({w,index,due:Number.isFinite(review[w.key]?.due)?review[w.key].due:0}))
   .filter(x=>options.all===true||x.due<=now).sort((a,b)=>a.due-b.due||a.index-b.index).slice(0,4).map(x=>x.w.key);
  opened=true;shown=false;tried=0;session++;render();return queue.length;
 }
 function html(){
  if(!opened)return '';
  const w=current(),back=`<button type="button" class="btn quiet" data-reader-recall-close>${icon('arrow-left')}Мои слова</button>`;
  if(!w)return `<section class="page reader-recall">${back}<div class="reader-recall-card"><h1>${tried?'Повторение завершено':'Сейчас повторять нечего'}</h1><p>${tried?'Попробовано слов и сочетаний: '+tried+'. Это твоя самооценка.':'Новые и запланированные на сегодня слова появятся здесь. Остальные можно повторить отдельно из «Моих слов».'}</p><button type="button" class="btn primary" data-reader-recall-close>К моим словам</button></div></section>`;
  const key=esc(w.key),context=w.context&&w.context!==w.es?`<p class="reader-recall-context" lang="es">${esc(w.context)}</p>`:'';
  const audio=shown?(w.audio?`<div class="reader-recall-audio"><p>${w.exactAudio?'В записи — выражение выше.':'В записи — всё предложение выше.'}</p>${playButton(w.audio,w.exactAudio?'Слушать выражение: '+w.es:'Слушать полное предложение: '+(w.context||w.es),true)}</div>`:'<p class="reader-source-note">Запись носителя для этого выражения пока не добавлена.</p>'):'';
  return `<section class="page reader-recall">${back}<div class="reader-recall-card"><h1>Вспомни смысл</h1><p class="reader-recall-progress" role="status">${tried+1} из ${tried+queue.length}</p><p>Сначала вспомни, затем проверь себя.</p><h2 lang="es">${esc(w.es)}</h2>${context}${shown?`<div class="reader-recall-meaning" aria-live="polite"><p>${esc(w.ru)}</p>${w.contextRu?`<p class="reader-recall-context">${esc(w.contextRu)}</p>`:''}</div>${audio}<p>Вспомнил без подсказки?</p><div class="reader-recall-actions"><button type="button" class="btn primary" data-reader-recall-rate="remembered" data-reader-recall-key="${key}" data-reader-recall-session="${session}">Вспомнил</button><button type="button" class="btn quiet" data-reader-recall-rate="again" data-reader-recall-key="${key}" data-reader-recall-session="${session}">Повторить ещё</button></div>`:`<button type="button" class="btn primary" data-reader-recall-reveal="${key}" data-reader-recall-session="${session}">Показать смысл</button>`}</div></section>`;
 }
 function click(button){
  const d=button?.dataset||{};
  if('readerRecallClose' in d){if(opened)close();return true;}
  if(!opened)return false;
  const w=current();
  if('readerRecallReveal' in d){if(w&&d.readerRecallReveal===w.key&&String(session)===d.readerRecallSession&&!shown){shown=true;render();}return true;}
  if('readerRecallRate' in d){
   if(!w||!shown||d.readerRecallKey!==w.key||String(session)!==d.readerRecallSession||!['remembered','again'].includes(d.readerRecallRate))return true;
   // Remove the current key before notifying; repeated/stale clicks cannot rate it twice.
   queue.shift();shown=false;tried++;onRate(w.key,d.readerRecallRate);render();return true;
  }
  return false;
 }
 return {start,active:()=>opened,html,click,close,contextKey:()=>opened?'reader-recall:'+session+':'+(current()?.key||'done')+':'+(shown?'shown':'hidden'):null};
}};
