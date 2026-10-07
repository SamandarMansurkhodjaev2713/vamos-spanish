/* Finite, authored speaking missions. Local text checks never grade a recording. */
window.VamosMissions={create(api){
 'use strict';
 const {state,data,esc,icon=()=>'',mascot=()=>'',playButton=()=>'',audioControls=()=>'',footer=()=>'',render=()=>{},save=()=>{},toast=()=>{},recorderHTML=()=>''}=api;
 const catalog=data.missions?.days||[], byVariant=new Map(catalog.flatMap(d=>d.variants.map(v=>[v.id,{...v,day:d.day}])));
 const oralValues=['independent','hesitant','help','typed'], aids=['transcript','translation','explanation','example','replay'];
 const MAX_HISTORY=120,MAX_SESSIONS=30,DAY=86400000;
 const norm=s=>String(s||'').normalize('NFC').toLocaleLowerCase('es').replace(/[áéíóú]/g,c=>({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[c])).replace(/[¿?¡!.,;:]/g,' ').replace(/\s+/g,' ').trim();
 const stamp=x=>Number.isFinite(x)&&x>0&&x<=Date.now()+300000?x:null;
 const unique=(a,allowed)=>[...new Set((Array.isArray(a)?a:[]).filter(x=>allowed.includes(x)))];
 const text=x=>typeof x==='string'?x.slice(0,500):'';
 const timestamp=()=>Date.now();
 function draw(selector){render();if(selector&&typeof document!=='undefined'){const focus=()=>document.querySelector(selector)?.focus({preventScroll:true});if(typeof requestAnimationFrame==='function')requestAnimationFrame(focus);else focus();}}
 function turnFor(s,i){const v=byVariant.get(s.variant);if(!v)return null;let t=v.turns[i];for(let j=0;j<i;j++){const b=v.turns[j].branch,r=s.responses[j],p=r?.first,intent=p?.intent||r?.branchIntent;if(b&&p&&b[intent]?.next===i)t=b[intent].turn;}return t;}
 function check(t,value){
  const n=norm(value);if(!n)return {status:'empty',intent:null};
  const matched=t.rule.forms.some(f=>norm(f)===n)||t.rule.patterns.some(p=>{try{return new RegExp('^(?:'+normPattern(p)+')$','u').test(n)}catch{return false}});
  let status=matched?'supported':'unknown';
  if(t.rule.required.some(w=>!n.split(' ').includes(norm(w))))status='missing';
  // A failed personal slot is outside this narrow checker; it is never declared bad Spanish.
  const intent=matched&&t.rule.kind==='choice'?(n.startsWith('no ')?'refuse':'accept'):null;
  return {status,intent};
 }
 function normPattern(p){return String(p).replace(/[áéíóú]/g,c=>({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[c]));}
 function sanitize(raw){
  const clean={version:1,sessions:[],history:[],seenVariants:[]};if(!raw||typeof raw!=='object')return clean;
  function session(x,completed){
   if(!x||typeof x!=='object'||!byVariant.has(x.variant))return null;
   const v=byVariant.get(x.variant),start=stamp(x.startedAt);if(!start||x.day!==v.day||x.control!==(v.mode==='control')||typeof x.id!=='string'||!/^m-\d+-[a-z0-9-]+$/.test(x.id)||x.id.length>90)return null;
   const s={id:x.id,day:v.day,variant:v.id,control:v.mode==='control',startedAt:start,exposed:x.exposed===true,step:0,responses:[],completedAt:null,dueAt:null,dueVariant:null};
   const len=v.turns.length;
   for(let i=0;i<len;i++){
    const r=Array.isArray(x.responses)?x.responses[i]:null;if(!r)break;
    const t=turnFor(s,i);const z={draft:text(r.draft),oral:oralValues.includes(r.oral)?r.oral:'',aids:unique(r.aids,aids),plays:Math.min(99,Math.max(0,Math.floor(Number(r.plays)||0))),first:null,retries:[],latest:null};
    function response(p){if(!p||typeof p!=='object'||!stamp(p.at)||p.at<start||!oralValues.includes(p.oral)||!text(p.text).trim())return null;const val=text(p.text),result=check(t,val);if(result.status==='empty')return null;return {text:val,at:p.at,oral:p.oral,aids:unique(p.aids,aids),status:result.status,intent:result.intent};}
    z.first=response(r.first);if(r.first&&(!z.first||i>0&&z.first.at<s.responses[i-1].first.at))break;z.branchIntent=t.branch&&['accept','refuse'].includes(r.branchIntent)?r.branchIntent:null;
    z.retries=(Array.isArray(r.retries)?r.retries:[]).slice(-5).map(response).filter(p=>p&&z.first&&p.at>=z.first.at);z.latest=z.retries.at(-1)||z.first;
    s.responses.push(z);if(!z.first)break;
   }
   const submitted=s.responses.filter(r=>r.first).length;
   s.step=Math.min(Math.max(0,Math.floor(Number(x.step)||0)),Math.min(submitted,len-1));
   if(completed){const at=stamp(x.completedAt);if(!at||at<start||submitted!==len||s.responses.some(r=>r.first.at>at||r.retries.some(p=>p.at>at)))return null;s.completedAt=at;s.step=len-1;const due=byVariant.get(x.dueVariant);if(due&&due.day===s.day&&due.mode==='control'&&Number.isFinite(x.dueAt)&&x.dueAt===at+DAY){s.dueVariant=due.id;s.dueAt=x.dueAt;}}
   return s;
  }
  const seen=new Set();for(const x of (Array.isArray(raw.history)?raw.history:[]).slice(-MAX_HISTORY)){const s=session(x,true);if(s&&!seen.has(s.id)){seen.add(s.id);clean.history.push(s);}}
  for(const x of (Array.isArray(raw.sessions)?raw.sessions:[]).slice(-MAX_SESSIONS)){const s=session(x,false);if(s&&!seen.has(s.id)){seen.add(s.id);clean.sessions.push(s);}}
  clean.seenVariants=[...new Set([...(Array.isArray(raw.seenVariants)?raw.seenVariants:[]).filter(id=>byVariant.has(id)),...clean.history.map(s=>s.variant),...clean.sessions.map(s=>s.variant)])].slice(0,byVariant.size);
  // Due means fresh when scheduled. Reject a imported due variant already exposed before its completion.
  for(const h of clean.history){if(h.dueVariant&&clean.history.some(p=>p.variant===h.dueVariant&&p.startedAt<=h.completedAt)){h.dueAt=null;h.dueVariant=null;}}
  return clean;
 }
 function merge(base,incoming){
  const a=sanitize(base),b=sanitize(incoming),existing=new Map([...a.sessions,...a.history].map(s=>[s.id,s]));
  function preserve(s){const old=existing.get(s.id);if(!old||old.variant!==s.variant)return s;if(old.completedAt)return old;const result=JSON.parse(JSON.stringify(s));for(let i=0;i<old.responses.length;i++)if(old.responses[i].first){result.responses[i]=result.responses[i]||old.responses[i];result.responses[i].first=old.responses[i].first;result.responses[i].latest=result.responses[i].retries.at(-1)||old.responses[i].first;}return result;}
  const hist=new Map(a.history.map(s=>[s.id,s]));for(const s of b.history)if(!hist.has(s.id))hist.set(s.id,preserve(s));const sessions=new Map(a.sessions.map(s=>[s.id,s]));for(const s of b.sessions)if(!hist.has(s.id))sessions.set(s.id,preserve(s));return sanitize({history:[...hist.values()].slice(-MAX_HISTORY),sessions:[...sessions.values()].filter(s=>!hist.has(s.id)).slice(-MAX_SESSIONS),seenVariants:[...a.seenVariants,...b.seenVariants]});
 }

 state.missions=sanitize(state.missions);let active=null,draft='',oral='',feedback=null,reveals=new Set(),explanationOpen=false;
 const commit=()=>{save();};
 function current(){if(!active)return null;const v=byVariant.get(active.variant);return {day:active.day,control:active.control,variant:active.variant,step:active.step,completed:!!active.completedAt,dueAt:active.dueAt,exposed:active.exposed,goal:v.goal,content:turnFor(active,active.step),session:JSON.parse(JSON.stringify(active))};}
 function start(day,{control=false,variant,resume=true}={}){
  const d=catalog.find(x=>x.day===Number(day));if(!d)return false;
  const previous=resume&&state.missions.sessions.findLast(s=>s.day===Number(day)&&s.control===control&&(!variant||s.variant===variant));if(previous){active=previous;const r=active.responses[active.step];draft=r?.draft||r?.latest?.text||'';oral=r?.oral||r?.latest?.oral||'';feedback=r?.latest||null;reveals.clear();explanationOpen=false;draw('.mission-heading h1');return true;}
  const used=new Set([...state.missions.seenVariants,...state.missions.history.map(s=>s.variant),...state.missions.sessions.map(s=>s.variant)]);
  let v=d.variants.find(v=>v.id===variant);if(!v){const due=state.missions.history.find(s=>s.day===Number(day)&&s.dueAt&&s.dueAt<=timestamp()&&!used.has(s.dueVariant));v=control&&due?d.variants.find(x=>x.id===due.dueVariant):d.variants.find(v=>v.mode===(control?'control':'train')&&!used.has(v.id));v=v||d.variants.find(v=>v.mode===(control?'control':'train'));}
  if(!v)return false;
  const now=timestamp();active={id:'m-'+now+'-'+v.id+'-'+Math.random().toString(36).slice(2,8),day:Number(day),variant:v.id,control:v.mode==='control',startedAt:now,exposed:used.has(v.id),step:0,responses:[],completedAt:null,dueAt:null,dueVariant:null};
  if(!state.missions.seenVariants.includes(v.id))state.missions.seenVariants.push(v.id);state.missions.sessions.push(active);state.missions.sessions=state.missions.sessions.slice(-MAX_SESSIONS);draft='';oral='';feedback=null;reveals.clear();explanationOpen=false;commit();draw('.mission-heading h1');return true;
 }
 function responseSlot(){let r=active.responses[active.step];if(!r){r={draft:'',oral:'',aids:[],plays:0,first:null,retries:[],latest:null};active.responses[active.step]=r;}return r;}
 function aid(kind){if(!active||active.completedAt)return;const r=responseSlot();if(!r.aids.includes(kind)){r.aids.push(kind);commit();}}
 function caption(status){return status==='supported'?'Текст подходит к подготовленной модели':status==='missing'?'В этом ходе ещё нужна причина через porque':'Свободный ответ вне подготовленной проверки';}
 function submit(){
  if(!active||active.completedAt)return;const t=turnFor(active,active.step),r=responseSlot();if(!draft.trim()){toast('Напиши, что сказал, или введи ответ без записи.');return;}if(!oral){toast('Выбери свою оценку устного ответа или «Только написал».');return;}
  const result=check(t,draft),entry={text:draft.slice(0,500),at:timestamp(),oral,aids:[...r.aids],status:result.status,intent:result.intent};
  if(!r.first)r.first=entry;else{r.retries.push(entry);r.retries=r.retries.slice(-5);}r.latest=entry;feedback=entry;commit();draw('.mission-feedback');
 }
 function next(){
  if(!active||!responseSlot().first)return;const v=byVariant.get(active.variant),t=turnFor(active,active.step),r=responseSlot();
  // A branch needs an explicit finite intent. Unknown wording stays in this turn until the learner selects the intended meaning.
  if(t.branch&&!r.first.intent&&!r.branchIntent){toast('Для продолжения выбери смысл своего ответа: согласие или отказ.');return;}
  if(active.step<v.turns.length-1){active.step++;draft='';oral='';feedback=null;reveals.clear();explanationOpen=false;commit();draw('.mission-prompt h2');return;}
  active.completedAt=timestamp();const used=new Set([...state.missions.seenVariants,...state.missions.history.map(s=>s.variant),...state.missions.sessions.map(s=>s.variant)]);const fresh=catalog.find(d=>d.day===active.day).variants.find(v=>v.mode==='control'&&!used.has(v.id));active.dueVariant=fresh?.id||null;active.dueAt=fresh?active.completedAt+DAY:null;
  state.missions.history.push(JSON.parse(JSON.stringify(active)));state.missions.history=state.missions.history.slice(-MAX_HISTORY);state.missions.sessions=state.missions.sessions.filter(s=>s.id!==active.id);commit();draw('.mission-outcome h2');
 }
 function feedbackHTML(t,r){if(!feedback)return '';const p=feedback;return `<div class="mission-feedback" data-result="${p.status}" role="status" tabindex="-1"><h3>${caption(p.status)}</h3><p>${p.status==='supported'?'Проверен только написанный текст. Эта отметка ничего не говорит о звучании записи.':p.status==='missing'?'Соедини выбор и объяснение в одной реплике. Можно поправить ответ; первый ответ сохранится.':'Это ограничение проверки, а не доказательство ошибки. Сравни смысл с задачей; можешь уточнить текст или продолжить с этой отметкой.'}</p>${t.branch&&!r.first.intent?`<fieldset class="mission-intent"><legend>Какой смысл ты хотел передать?</legend><label><input type="radio" name="mission-intent" data-mission-intent="accept" ${r.branchIntent==='accept'?'checked':''}>Согласие</label><label><input type="radio" name="mission-intent" data-mission-intent="refuse" ${r.branchIntent==='refuse'?'checked':''}>Отказ</label></fieldset>`:''}<p class="small">Первый ответ: ${esc(caption(r.first.status))}${r.first.aids.length?' · с помощью':' · без раскрытия помощи'}.</p></div>`;}
 function sceneName(variant){const row=catalog.find(d=>d.variants.some(v=>v.id===variant));return 'сцена '+(row.variants.findIndex(v=>v.id===variant)+1);}
 function resultHTML(v){const first=active.responses.map(r=>r.first),matched=first.filter(x=>x.status==='supported').length,help=first.filter(x=>x.aids.length||x.oral==='help').length,spoken=first.filter(x=>x.oral!=='typed').length;return `<section class="mission-outcome"><h2 tabindex="-1">Этот разговор завершён</h2><p>${esc(v.outcome)}</p><dl><dt>Подготовленные текстовые модели, первый ответ</dt><dd>${matched} из ${first.length}</dd><dt>Первые ответы с раскрытой помощью или устной подсказкой</dt><dd>${help} из ${first.length}</dd><dt>Ты отметил устную попытку</dt><dd>${spoken} из ${first.length}</dd></dl><p>Эти результаты относятся к дню ${active.day} и этой попытке (${esc(sceneName(active.variant))}). Они не определяют общий уровень испанского.</p><p>${active.dueAt?'Новый контрольный вариант доступен через 24 часа: '+esc(new Date(active.dueAt).toLocaleString('ru-RU'))+'.':'Все подготовленные контрольные варианты этого дня уже встречались. Повторная сцена будет отмечена как знакомая.'}</p><details class="mission-support"><summary>Посмотреть первые ответы</summary>${first.map((x,i)=>`<p><strong>${i+1}.</strong> <span lang="es">${esc(x.text)}</span><br>${esc(caption(x.status))} · ${esc(({independent:'сказал сам',hesitant:'сказал с паузами',help:'сказал с помощью',typed:'только написал'})[x.oral])}${x.aids.length?' · помощь: '+esc(x.aids.join(', ')):''}</p>`).join('')}</details><div class="mission-actions"><button type="button" class="btn primary" data-mission-finish>Закончить миссию ${icon('check')}</button><button type="button" class="btn quiet" data-mission-restart>Ещё одна сцена</button></div></section>`;}
 function html(){
  if(!active)return '';const v=byVariant.get(active.variant),t=turnFor(active,active.step),r=responseSlot();
  const header=`<div class="section-head"><button type="button" class="btn quiet" data-mission-close>${icon('arrow-left')}К практике</button><span>${active.control?'Контрольный вариант':'Тренировка'}</span></div><header class="mission-heading"><h1 tabindex="-1">${esc(v.goal)}</h1><p class="mission-context">${esc(v.context)}</p></header><p class="mission-progress">День ${active.day} · ${esc(sceneName(active.variant))}${active.exposed?' · этот вариант уже встречался':' · новый вариант'}${active.completedAt?'':' · твой ход '+(active.step+1)+' из '+v.turns.length}</p>`;
  const body=active.completedAt?resultHTML(v):`<article class="mission-turn"><div class="mission-partner">${mascot('think','mission-mascot')}<div><h2>Собеседник</h2><p>Сначала слушай оригинальную запись. Текст и смысл можно раскрыть отдельно.</p><div data-mission-audio="${esc(t.partner.audio)}">${playButton(t.partner.audio,'Слушать реплику собеседника',true)}</div><div class="mission-support"><button type="button" class="btn quiet" data-mission-reveal="transcript" aria-expanded="${reveals.has('transcript')}">${reveals.has('transcript')?'Скрыть текст':'Показать испанский текст'}</button><button type="button" class="btn quiet" data-mission-reveal="translation" aria-expanded="${reveals.has('translation')}">${reveals.has('translation')?'Скрыть смысл':'Показать русский смысл'}</button>${reveals.has('transcript')?`<p lang="es" data-line-audio="${esc(t.partner.audio)}">${esc(t.partner.es)}</p>`:''}${reveals.has('translation')?`<p>${esc(t.partner.ru)}</p>`:''}</div></div></div><div class="mission-prompt"><h2 tabindex="-1">Твой ход</h2><p>${esc(t.prompt)}</p></div><div class="mission-response"><p class="small">Скажи ответ вслух. Запись — по желанию, остаётся в браузере. Можно просто написать; распознавания речи здесь нет.</p>${recorderHTML()}<fieldset class="mission-oral"><legend>Как получился устный ответ? Это твоя оценка.</legend>${[['independent','Сказал сам'],['hesitant','Сказал с паузами'],['help','Сказал с помощью'],['typed','Только написал']].map(([val,label])=>`<label><input type="radio" name="mission-oral" data-mission-oral="${val}" ${oral===val?'checked':''}>${label}</label>`).join('')}</fieldset><label for="mission-answer">Что ты сказал? Или напиши ответ на испанском.<textarea class="field" id="mission-answer" data-mission-answer rows="3" maxlength="500" lang="es" spellcheck="false">${esc(draft)}</textarea></label></div>${feedbackHTML(t,r)}<div class="mission-actions"><button type="button" class="btn ${r.first?'':'primary'}" data-mission-check>${r.first?'Проверить уточнение':'Проверить текст'}</button>${r.first?`<button type="button" class="btn primary" data-mission-next>${active.step===v.turns.length-1?'Завершить разговор':'Следующая реплика'} ${icon('arrow-right')}</button>`:''}</div><div class="mission-support"><button type="button" class="btn quiet" data-mission-explanation aria-expanded="${explanationOpen}">${icon('lightbulb')}Разобрать этот ход</button>${explanationOpen?`<div><p>${esc(t.explanation)}</p><p class="small">Примеры ответа ученика ниже — текст без новой аудиозаписи.</p><button type="button" class="btn quiet" data-mission-reveal="example" aria-expanded="${reveals.has('example')}">Показать допустимые примеры</button>${reveals.has('example')?t.examples.map(x=>`<p lang="es">${esc(x)}</p>`).join(''):''}</div>`:''}</div></article>`;
  return `<section class="page reading mission-page" data-chapter="${active.day<=10?1:active.day<=20?2:3}">${header}${audioControls()}${body}${footer()}</section>`;
 }
 function click(b){if(!b?.dataset)return false;
  if(active&&!active.completedAt&&b.hasAttribute?.('data-audio')&&b.closest?.('[data-mission-audio]')){const r=responseSlot();r.plays++;if(r.plays>1)aid('replay');commit();return false;}
  if(b.hasAttribute?.('data-mission-close')){close();api.onComplete?.({closed:true});return true;}
  if(!active)return false;
  if(b.hasAttribute?.('data-mission-check')){submit();return true;}
  if(b.hasAttribute?.('data-mission-next')){next();return true;}
  if(b.hasAttribute?.('data-mission-reveal')){const kind=b.dataset.missionReveal;if(!['transcript','translation','example'].includes(kind))return true;aid(kind);reveals.has(kind)?reveals.delete(kind):reveals.add(kind);draw('[data-mission-reveal="'+kind+'"]');return true;}
  if(b.hasAttribute?.('data-mission-explanation')){aid('explanation');explanationOpen=!explanationOpen;draw('[data-mission-explanation]');return true;}
  if(b.hasAttribute?.('data-mission-restart')){start(active.day,{control:active.control,resume:false});return true;}
  if(b.hasAttribute?.('data-mission-finish')){const result=current();api.onComplete?.(result);return true;}
  return false;
 }
 function input(el){if(el?.hasAttribute?.('data-mission-answer')){draft=String(el.value||'').slice(0,500);if(active&&!active.completedAt){responseSlot().draft=draft;commit();}return true;}return false;}
 function change(el){if(!active)return false;if(el?.hasAttribute?.('data-mission-oral')){const val=el.dataset.missionOral;if(oralValues.includes(val)){oral=val;responseSlot().oral=oral;commit();}return true;}if(el?.hasAttribute?.('data-mission-intent')){const val=el.dataset.missionIntent;if(['accept','refuse'].includes(val)){responseSlot().branchIntent=val;commit();}return true;}return false;}
 function close(){active=null;draft='';oral='';feedback=null;reveals.clear();}
 return {html,start,click,input,change,sanitize,merge,get current(){return current();},close};
}};
