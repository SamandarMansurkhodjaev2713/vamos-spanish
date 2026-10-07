/* Editorial goal contracts. A successful model match is deliberately bounded. */
window.VamosGoals = { create(api) {
 'use strict';
 const {data,esc,icon,playButton,profile}=api;
 const rows=Array.isArray(data?.goals)?data.goals:(data?.goals?.lessons||[]);
 const normalize=value=>String(value??'').normalize('NFD').replace(/\u0301/g,'').normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
 const item=day=>rows.find(row=>row.day===Number(day));
 function contract(day){
  const row=item(day);if(!row)return '';
  const example=id=>data.expanded.audio[id];
  return `<details class="goal-contract"><summary>Цель и границы проверки</summary><div class="goal-contract-body"><p class="goal-contract-goal">${esc(row.goal)}</p><p class="small">${row.prerequisites.length?'Опоры: дни '+row.prerequisites.map(Number).join(', ')+'.':'Начинаем без предварительных моделей.'}</p><h3>Тренируем по записи</h3><ul>${row.trainedNativeIds.map(id=>{const a=example(id);return a?`<li><span lang="es">${esc(a.text)}</span> ${playButton(id,'Послушать '+a.text,true)}</li>`:''}).join('')}</ul><p class="note">${esc(row.nativeScope)}</p><h3>Узнаём в тексте</h3><p><span lang="es">${esc(row.textPattern)}</span></p><ul>${row.closedChecks.map(check=>`<li>${esc(check.question)} <span class="small">${esc(check.proves)}</span></li>`).join('')}</ul>${row.recognitionNativeIds.length?`<p class="small">Дополнительная запись для понимания: ${row.recognitionNativeIds.map(id=>esc(example(id)?.text||'')).join(' ')}</p>`:''}<h3>Проверяем самостоятельно</h3><p>${esc(row.missionVerification.task)}</p><p class="small">${esc(row.missionVerification.evidence)}</p><p class="note">${esc(row.limits.typed)} ${esc(row.limits.self)}</p></div></details>`;
 }
 function personal(day,providedProfile){
  const row=item(day);if(!row)return '';
  const p=providedProfile||(typeof profile==='function'?profile():profile)||{};
  // Personal values are reminders, not generated translations or verified answers.
  const reminders=[];
  if([1,7,26,29,30].includes(Number(day))&&typeof p.name==='string'&&p.name.trim())reminders.push('Твоё имя: '+p.name.trim().slice(0,100));
  if([4,7,26,30].includes(Number(day))&&typeof p.city==='string'&&p.city.trim())reminders.push('Твой город: '+p.city.trim().slice(0,100));
  const interest=[8,9,10,11,12,13,14,16,20,25,27,30].includes(Number(day))&&typeof p.interest==='string'?p.interest.trim().slice(0,200):'';
  if(interest)reminders.push('Твой интерес (записанная заметка): '+interest);
  return `<div class="goal-personal"><h3>Разминка перед своим ответом</h3><p>${esc(row.warmup)}</p><h3>Твой вариант</h3><p>${esc(row.personalPrompt)}</p>${reminders.length?`<p class="small">${esc(reminders.join(' · '))}</p>`:''}${interest?`<p class="small">Сравни заметку о своём интересе с моделью урока: ${esc(row.textPattern)}. Для ответа используй только знакомые слова; произвольная подстановка в модель отдельно не проверяется.</p>`:''}<p class="note">${esc(row.reviewContrast)}</p></div>`;
 }
 function feedback({day,stage,answer,target,correct}={}){
  if(correct!==false||!item(day))return '';
  const a=normalize(answer),t=normalize(target);if(!a||!t||a===t)return '';
  // Match a single known substitution in this exact target. Valid alternatives
  // such as "Quiero leer" for "Prefiero leer" get no invented diagnosis.
  if(/^voy a (estudiar|trabajar)(?:\s|$)/.test(t)&&a===t.replace(/^voy a /,'voy '))return 'В этой модели пропущено a: Voy a + действие в начальной форме. Скажи целиком, затем восстанови без образца.';
  if(/^me llamo\s/.test(t)&&a===t.replace(/^me llamo /,'me llamas '))return 'Чтобы назвать себя, используем me llamo. В me llamas глагол относится к tú: эта форма не сообщает твоё имя.';
  if(/^me llamo\s/.test(t)&&a===t.replace(/^me llamo /,'te llamo '))return 'Для своего имени нужна пара me llamo. Te llamo говорит о том, что я зову или звоню тебе; это другой смысл.';
  if(/^vivo en\s/.test(t)&&a===t.replace(/^vivo en /,'vivo de '))return 'Здесь речь о месте проживания: Vivo en + город. Vivo de имеет другой смысл и не подходит к этой задаче.';
  if(/^soy de\s/.test(t)&&a===t.replace(/^soy de /,'vivo en '))return 'Задача спрашивает происхождение, а Vivo en сообщает место проживания. Для этого образца восстанови Soy de + страна.';
  if(/^vivo en\s/.test(t)&&a===t.replace(/^vivo en /,'soy de '))return 'Задача спрашивает, где человек живёт. Soy de сообщает происхождение; для места проживания восстанови Vivo en.';
  if(/^estoy bien$/.test(t)&&a==='soy bien')return 'Для текущего самочувствия в этом ответе используем estoy: Estoy bien. Восстанови ответ целиком.';
  if(/^me gusta\s/.test(t)&&a===t.replace(/^me gusta /,'yo gusto '))return 'Для своего предпочтения здесь нужна модель me gusta + предмет или действие. Не заменяй её на yo gusto.';
  if(t==='a mi tambien'&&a==='yo tambien')return 'После положительного Me gusta… в этой задаче отвечаем A mí también. Yo también подходит к другой модели, например Prefiero leer; сверяйся с исходной репликой.';
  if(t==='yo tambien'&&a==='a mi tambien')return 'Здесь исходная реплика построена как Prefiero leer. В изученном коротком ответе используем Yo también; A mí también связано с моделью Me gusta….';
  if(t==='quieres un cafe'&&a==='quiero un cafe')return 'Quiero un café сообщает моё желание. Для предложения собеседнику в этом задании нужен вопрос ¿Quieres un café?';
  if(t==='quiero un cafe'&&a==='quieres un cafe')return '¿Quieres un café? спрашивает собеседника. Чтобы сообщить своё желание, восстанови Quiero un café.';
  if(t==='a las dos'&&a==='son las dos')return 'Son las dos сообщает, сколько сейчас времени. После ¿A qué hora? отвечаем о времени действия: A las dos.';
  if(t==='son las dos'&&a==='a las dos')return 'A las dos сообщает время действия. Чтобы сказать, сколько сейчас времени, нужна модель Son las dos.';
  if(t.includes(' porque ')&&a===t.replace(' porque ',' por que '))return 'В этой фразе причина соединяется через porque, одним словом. Отдельное ¿Por qué? — вопрос «почему?»; это другая задача.';
  if(t==='no lo se'&&a==='no entiendo eso')return 'No entiendo eso сообщает, что реплика непонятна. В этой задаче нужно сказать, что ответа не знаешь: No lo sé.';
  return '';
 }
 return {contract,feedback,personal,item};
}};
