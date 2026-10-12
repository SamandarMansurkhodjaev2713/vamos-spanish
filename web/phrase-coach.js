/* Exact recorded models, finite editorial explanations and phase progress. */
window.VamosPhraseCoach={
 model(data,day,p){return data.phraseCoaching?.lessons?.find(l=>l.day===day)?.models?.find(m=>m.audio===p.audio&&m.es===p.es)||null;},
 html({data,day,phrase,esc,icon=()=>'',builder=false}){
  const m=this.model(data,day,phrase);if(!m)return '';
  return `<details class="phrase-coach" data-learning-support><summary>${icon('book-open')}<span>${builder?'Как построить эту фразу':'Как устроена эта фраза'}</span>${icon('chevron-down')}</summary><div class="phrase-coach-body"><p class="phrase-coach-use">${esc(m.useRu)}</p><dl class="phrase-coach-chunks">${m.chunks.map(c=>`<div><dt lang="es">${esc(c.es)}</dt><dd><strong>${esc(c.meaningRu)}</strong><p>${esc(c.noteRu)}</p></dd></div>`).join('')}</dl>${builder?'<p class="phrase-coach-instruction">Нажми слова по порядку. Чтобы исправить ответ, нажми на слово в собранной фразе.</p>':''}<p class="phrase-coach-tip"><strong>Обрати внимание.</strong> ${esc(m.mistakeRu)}</p>${m.contrast?`<div class="phrase-coach-contrast"><p lang="es">${esc(m.contrast.es)}</p><p>${esc(m.contrast.ru)}</p><p class="small">${esc(m.contrast.noteRu)}</p><p class="small">Дополнительный текстовый пример, без отдельной записи.</p></div>`:''}</div></details>`;
 },
 progress({stage,introIndex=0,introCycles=[0,0,0],introDone=[false,false,false]}){
  const completed=Math.max(0,Math.min(7,Number.isInteger(stage)?stage:0));
  const names=['Знакомые фразы','Слушание','Понимание','Порядок слов','Нужное слово','По памяти','Свой голос'];
  const actions=introCycles.slice(0,3).reduce((sum,n,i)=>sum+(introDone[i]===true?3:[0,1,2].includes(n)?n:0),0);
  const value=completed===0?Math.min(1,actions/9):completed;
  const label=completed===7?'Урок завершён':names[completed];
  const detail=completed===0?`Фраза ${introIndex+1} из 3 · ${['слушай','повтори','вспомни'][introCycles[introIndex]]||'слушай'}`:label;
  return {value,fraction:value/7,phase:Math.min(completed+1,7),label,detail,text:completed===7?'Все 7 этапов урока завершены':`Этап ${completed+1} из 7. ${detail}.`};
 }
};
