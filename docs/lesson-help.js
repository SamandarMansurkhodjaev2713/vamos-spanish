/* Closed, task-specific editorial support; models use existing human recordings. */
window.VamosLessonHelp={
 create({data,esc,icon=()=>'',playButton=()=>''}){
  const norm=s=>String(s??'').normalize('NFC').replace(/\s+/g,' ').trim();
  const instructions={
   1:'Послушай запись. Выбери перевод услышанной реплики.',
   2:'Прочитай вопрос. Выбери реплику, которая подходит к ситуации.',
   3:'Нажимай слова по порядку. Нажми слово в ответе, чтобы вернуть его.',
   4:'Прочитай всю фразу и её смысл. Выбери слово для пропуска.',
   5:'Напиши фразу по памяти. Если не получается, открой подсказку и попробуй снова.',
   6:'Скажи фразу без образца. Затем послушай носителя и сравни со своей записью.'
  };
  const kinds={1:'listening',2:'quiz',3:'builder',4:'gap',5:'recall',6:'oral'};
  function html({day,stage,phrase,task,preparing=false}={}){
   if(!Number.isInteger(day)||day<1||day>30||!instructions[stage])return '';
   const g=data.guidance?.lessons?.find(l=>l.day===day);
   const e=data.expanded?.lessons?.find(l=>l.day===day);
   const p=stage===2?null:stage===1?e?.examples?.find(x=>x.audio===task?.audio):phrase;
   const rawHint=g?.practiceHints?.[kinds[stage]];
   const hint=stage===2?(norm(rawHint?.question)===norm(task?.question)?rawHint:null):
    (p&&norm(rawHint?.targetEs)===norm(p.es)&&rawHint?.audio===p.audio?rawHint:null);
   const model=p&&data.phraseCoaching?.lessons?.find(l=>l.day===day)?.models?.find(m=>m.audio===p.audio&&norm(m.es)===norm(p.es));
   const validAudio=p?.audio&&data.expanded?.audio?.[p.audio];
   const support=(stage===6?model?.useRu:hint?.hintRu)||model?.useRu||instructions[stage];
   const caution=model?.mistakeRu;
   const sample=p?`<details class="lesson-help-model" data-learning-support><summary>Открыть образец${icon('chevron-down')}</summary><div class="guidance-example"><p lang="es">${esc(p.es)}</p><p>${esc(p.ru)}</p></div>${validAudio?`${playButton(p.audio,'Слушать: '+p.es,true)}<p class="small">В записи: <span lang="es">${esc(p.es)}</span></p>`:'<p class="small">Для этого образца нет записи.</p>'}</details>`:'';
   const visibleHint=stage===6?(preparing?'Вспомни вопрос «Откуда ты?» и произнеси его.':model?.useRu||'Сначала ответь своими словами. Если застрял, открой речевую опору и повтори.'):hint?.hintRu||support||instructions[stage];
   return `<aside class="lesson-support" aria-label="Подсказка к заданию"><p class="lesson-support-hint">${icon('lightbulb')}<span>${esc(visibleHint)}</span></p><details class="lesson-help" data-learning-support><summary>Разобрать шаг и пример${icon('chevron-down')}</summary><div class="lesson-guidance"><p>${esc(instructions[stage])}</p>${support!==visibleHint?`<p>${esc(support)}</p>`:''}${caution?`<p><strong>Обрати внимание.</strong> ${esc(caution)}</p>`:''}${sample}${stage===6?'<p class="small">Запись и сравнение помогают заметить отличия. Они не оценивают акцент автоматически.</p>':''}</div></details></aside>`;
  }
  return {html};
 }
};
