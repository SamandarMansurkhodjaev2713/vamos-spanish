/* Prepared library recall. Accents matter; this is not a general Spanish judge. */
window.VamosLibraryPractice={create(api){
 'use strict';
 const {state,data,esc,icon,save,toast}=api,items=new Map(data.library.items.filter(x=>x.type!=='text').map(x=>[x.id,x]));
 const normalize=v=>String(v??'').normalize('NFC').toLocaleLowerCase('es').replace(/\p{P}/gu,'').replace(/[\p{Z}\s]+/gu,' ').trim();
 const correct=(id,value)=>!!normalize(value)&&(items.get(id)?.accepted||[items.get(id)?.es]).some(x=>normalize(x)===normalize(value));
 const wordAudio=x=>x?.type==='word'?data.wordAudio?.words?.[x.es.normalize('NFC').toLocaleLowerCase('es').trim()]:null;
 let sessionSerial=0;
 const validSessionId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(v);
 const newSessionId=()=>{const uuid=globalThis.crypto?.randomUUID?.();return 'lp-'+(uuid||Date.now().toString(36)+'-'+(++sessionSerial).toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2))};
 const empty=()=>({sessionId:null,active:false,label:'',ids:[],queue:[],records:[],draft:{value:'',help:false,aided:false,checked:false},serial:0});
 function sanitize(raw){
  const out=empty();if(!raw||typeof raw!=='object')return out;
  out.ids=[...new Set((Array.isArray(raw.ids)?raw.ids:[]).filter(id=>items.has(id)))].slice(0,8);if(!out.ids.length)return out;
  out.sessionId=validSessionId(raw.sessionId)?raw.sessionId:null;out.label=String(raw.label||'Из словаря').slice(0,120);
  out.records=(Array.isArray(raw.records)?raw.records:[]).filter(r=>r&&out.ids.includes(r.id)&&Number.isInteger(r.seq)&&r.seq>=0&&r.seq<500&&Number.isFinite(r.time)&&r.time>=0&&r.time<=Date.now()).slice(0,18).map(r=>({id:r.id,seq:r.seq,value:String(r.value??'').slice(0,1000),aided:!!r.aided,time:r.time,correct:correct(r.id,r.value)})).filter((r,i,all)=>all.findIndex(x=>x.seq===r.seq)===i);
  const sequences=new Set();out.queue=(Array.isArray(raw.queue)?raw.queue:[]).filter(q=>q&&out.ids.includes(q.id)&&Number.isInteger(q.seq)&&q.seq>=0&&q.seq<500&&!sequences.has(q.seq)&&(sequences.add(q.seq),true)).slice(0,Math.max(0,19-out.records.length)).map(q=>({id:q.id,seq:q.seq}));
  out.queue=out.queue.filter(q=>!out.records.some(r=>r.seq===q.seq&&r.id!==q.id));
  const d=raw.draft||{};out.draft={value:String(d.value??'').slice(0,1000),help:!!d.help,aided:!!d.aided||!!d.help,checked:!!out.queue.length&&out.records.some(r=>r.seq===out.queue[0].seq&&r.id===out.queue[0].id)};
  out.queue=out.queue.slice(0,Math.max(0,18-out.records.length+(out.draft.checked?1:0)));
  if(out.queue.length&&out.records.some(r=>r.id===out.queue[0].id&&(!r.correct||r.aided)))out.draft.aided=true;
  if(out.draft.checked)out.draft.value=out.records.find(r=>r.seq===out.queue[0].seq).value;
  out.serial=Math.max(0,...out.records.map(r=>r.seq+1),...out.queue.map(q=>q.seq+1));out.active=!!raw.active;return out;
 }
 function merge(a,b){const left=sanitize(a),right=sanitize(b);if(!left.ids.length)return right;if(!right.ids.length)return left;
  // A set of words is not a session identity. Legacy backups cannot prove they are the same approach.
  const same=left.sessionId&&left.sessionId===right.sessionId&&left.ids.join('|')===right.ids.join('|');if(!same)return left;
  const existing=new Set(left.records.map(r=>r.seq));left.records.push(...right.records.filter(r=>!existing.has(r.seq)));left.records=left.records.slice(0,18);return sanitize(left);
 }
 state.libraryPractice=sanitize(state.libraryPractice);
 const session=()=>state.libraryPractice,current=()=>items.get(session().queue[0]?.id);
 const persist=()=>save?.();
 function refresh(selector){const y=typeof window!=='undefined'?window.scrollY:0;api.render?.();if(typeof document!=='undefined'){document.querySelector(selector||'#lp-answer')?.focus({preventScroll:true});window.scrollTo({top:y,behavior:'instant'});}}
 function start(chosen,label='Из словаря'){const ids=[...new Set((chosen||[]).map(x=>typeof x==='string'?x:x.id).filter(id=>items.has(id)))].slice(0,8);if(!ids.length){toast?.('Выбери слова или фразы: тексты читаются отдельно.');return false;}state.libraryPractice={...empty(),sessionId:newSessionId(),active:true,label:String(label).slice(0,120),ids,queue:ids.map((id,seq)=>({id,seq})),serial:ids.length};persist();return true;}
 function stop(){session().active=false;persist();}
 function markHelp(){if(current()&&!session().draft.checked){session().draft.aided=true;persist();}return !!current();}
 function summary(){const s=session(),first=s.ids.map(id=>s.records.find(r=>r.id===id)).filter(Boolean);return {seen:first.length,independent:first.filter(r=>r.correct&&!r.aided).length,aided:first.filter(r=>r.aided).length,errors:first.filter(r=>!r.correct).length,corrected:s.ids.filter(id=>{const a=s.records.filter(r=>r.id===id);return a.length>1&&!a[0].correct&&a.at(-1).correct;}).length,attempts:s.records.length};}
 function context(){const x=current(),word=wordAudio(x);return x?{extension:true,pathDay:'library:'+x.id,extensionLesson:{mission:'Вспомни по-испански: '+x.ru,pattern:x.es,explanation:x.usage||'Здесь проверяется подготовленная карточка. Другой верный испанский ответ может не совпасть с ключом.',examples:[...(word?[{es:x.es,ru:x.ru,audio:word,recordingKind:'word'}]:[]),...(x.audio?[{es:x.context||x.es,ru:x.contextRu||x.ru,audio:x.audio,recordingKind:'phrase'}]:[])]},day:x.day,libraryItem:x}:null;}
 function render(){const s=session(),x=current(),stats=summary();if(!s.active)return '';
  const heading=`<div class="section-head"><h1>Вспомнить по-испански</h1><button class="btn quiet" type="button" data-lp-stop>${icon?.('arrow-left')||''}К словарю</button></div><p>${esc(s.label)} · карточек в наборе: ${s.ids.length}</p>`;
  if(!x)return `<section class="reading library-practice">${heading}<h2>Короткий подход завершён</h2><p>Без помощи с первой попытки: ${stats.independent} из ${s.ids.length}. Первых ошибок: ${stats.errors}; исправлено позднее: ${stats.corrected}. Первых попыток с помощью: ${stats.aided}.</p><p>Это результат этих карточек, а не оценка свободной речи. ${stats.seen<s.ids.length?'Лимит попыток достигнут; часть карточек ещё не проверена.':''}</p>${api.footer?.()||''}</section>`;
  const d=s.draft,last=s.records.find(r=>r.seq===s.queue[0].seq),shown=d.help||d.checked,directWord=wordAudio(x);const retryMessage=s.ids.length<3?'В этом наборе мало разных карточек; повтор отложен минимум на 10 минут.':'Карточка вернётся после двух разных слов, если осталось место в подходе.';
  return `<section class="reading library-practice">${heading}<p class="small">Проверено карточек: ${stats.seen} из ${s.ids.length} · попытка ${Math.min(18,s.records.length+(d.checked?0:1))}</p><section class="lp-question"><h2 class="lp-prompt">${esc(x.ru)}</h2><p>Вспомни именно подготовленное слово или фразу. Ударения á, é, í, ó, ú и ñ важны; регистр и пунктуация не важны.</p><label for="lp-answer">Ответ по-испански</label><input id="lp-answer" class="field" lang="es" autocomplete="off" maxlength="1000" value="${esc(d.value)}" ${d.checked?'readonly':''}>${!d.checked?`<div class="lp-characters" role="group" aria-label="Испанские буквы">${['á','é','í','ó','ú','ü','ñ','¿','¡'].map(c=>`<button type="button" data-lp-char="${c}" aria-label="Вставить ${c}">${c}</button>`).join('')}</div>`:''}<div class="workbook-actions lp-actions">${d.checked?'<button class="btn primary" type="button" data-lp-next>Дальше</button>':'<button class="btn primary" type="button" data-lp-check>Проверить</button>'}<button class="btn quiet" type="button" data-lp-help>${d.help?'Скрыть образец':'Помощь'}</button></div></section>${shown?`<div class="note lp-model"><p class="lp-answer-model" lang="es">${esc(x.es)}</p>${x.usage?`<p>${esc(x.usage)}</p>`:''}${x.context?`<p lang="es">${esc(x.context)}</p><p>${esc(x.contextRu||'')}</p>`:''}<p>Другие выражения могут быть верными по-испански, но здесь сверяем эту модель.</p></div>`:''}${last?`<p class="feedback lp-feedback ${last.correct?'': 'wrong'}" role="status">${last.correct?'Совпало с ключом.':'Пока не совпало. Ошибка сохранена. '+retryMessage} ${last.aided?'Эта попытка — с помощью.':''}</p>`:''}${shown&&directWord?`<div class="recorded-context lp-word-audio"><p>Запись слова:</p><p lang="es">${esc(x.es)}</p>${api.playButton?.(directWord,'Слушать слово: '+x.es)||''}</div>`:''}${shown&&x.audio?`<div class="recorded-context lp-phrase-audio"><p>В записи звучит вся фраза:</p><p lang="es">${esc(x.context||x.es)}</p>${api.playButton?.(x.audio,'Слушать всю фразу: '+(x.context||x.es))||''}</div>`:''}${shown&&(directWord||x.audio)?api.audioControls?.()||'':''}${api.audioStatus?.()||''}${shown&&(directWord||x.audio)?`<details class="lp-audio-sources"><summary>Записи и лицензии</summary>${directWord?api.audioCredit?.({audio:directWord})||'':''}${x.audio?api.audioCredit?.(x)||'':''}</details>`:''}<p class="small">Первая попытка сохраняется. Исправление после ошибки не считается самостоятельным ответом с первого раза.</p>${api.footer?.()||''}</section>`;
 }
 function handleInput(el){if(el.id!=='lp-answer'||!current()||session().draft.checked)return false;session().draft.value=String(el.value).slice(0,1000);persist();return true;}
 function handleClick(b){const s=session(),x=current();if(b.hasAttribute('data-lp-stop')){stop();api.render?.();return true;}if(!x)return false;
  if(b.hasAttribute('data-lp-char')){if(s.draft.checked)return true;const input=document.getElementById('lp-answer'),char=b.dataset.lpChar;if(!input||!['á','é','í','ó','ú','ü','ñ','¿','¡'].includes(char))return true;const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(input.value.length-end+start+char.length>1000)return true;input.setRangeText(char,start,end,'end');s.draft.value=input.value;persist();input.focus({preventScroll:true});return true;}
  if(b.hasAttribute('data-lp-help')){s.draft.help=!s.draft.help;s.draft.aided=true;persist();refresh('[data-lp-help]');return true;}
  if(b.hasAttribute('data-lp-check')){if(s.draft.checked||s.records.length>=18)return true;if(!normalize(s.draft.value)){toast?.('Сначала напиши ответ или открой помощь.');return true;}const r={id:x.id,seq:s.queue[0].seq,value:s.draft.value,aided:s.draft.aided||s.draft.help,correct:correct(x.id,s.draft.value),time:Date.now()};s.records.push(r);s.draft.checked=true;if(!r.correct)s.draft.aided=true;api.observe?.(x,{...r,deferUntil:!r.correct&&s.ids.length<3?Date.now()+600000:0});api.sound?.(r.correct?'correct':'wrong');persist();refresh('[data-lp-next]');return true;}
  if(b.hasAttribute('data-lp-next')){if(!s.draft.checked)return true;const last=s.records.find(r=>r.seq===s.queue[0].seq);s.queue.shift();if(!last.correct&&s.records.length<18&&s.ids.length>=3){
    // Schedule after two distinct other IDs. Smaller pools defer instead of claiming spaced retrieval.
    const distinct=new Set(),needed=Math.min(2,s.ids.length-1);let index=0;
    while(index<s.queue.length&&distinct.size<needed){if(s.queue[index].id!==x.id)distinct.add(s.queue[index].id);index++;}
    for(const id of s.ids)if(distinct.size<needed&&id!==x.id&&!distinct.has(id)){s.queue.push({id,seq:s.serial++});distinct.add(id);index=s.queue.length;}
    if(s.records.length+index<18)s.queue.splice(index,0,{id:x.id,seq:s.serial++});
   }s.queue=s.queue.slice(0,18-s.records.length);s.draft={value:'',help:false,aided:s.records.some(r=>r.id===s.queue[0]?.id&&(!r.correct||r.aided)),checked:false};persist();refresh();return true;}
  return false;
 }
 return {start,active:()=>session().active,render,handleClick,handleInput,handleChange:()=>false,stop,context,markHelp,sanitize,merge,audioContextKey:()=>current()?'library-practice:'+current().id:null,summary};
}};
