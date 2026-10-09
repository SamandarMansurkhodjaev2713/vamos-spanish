/* Optional device capabilities. Audio stays original; storage and permissions remain explicit. */
window.VamosNative={create(api){
 'use strict';
 const {state,data,esc,icon,save,toast,activeLesson}=api;
 state.native={awake:state.native?.awake===true};
 const scope=new URL('./',location.href),prefix='vamos-'+encodeURIComponent(scope.pathname)+'-',mediaCache=prefix+'audio';
 const clips=[...Object.values(data.expanded.audio),...Object.values(data.wordAudio?.clips||{})],display=matchMedia('(display-mode: standalone)');
 const supported='serviceWorker'in navigator&&'caches'in window,canVerify=!!window.crypto?.subtle;
 const canRecord=!!navigator.mediaDevices?.getUserMedia&&'MediaRecorder'in window;
 const canRecognize=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
 let ready=false,lockPending=false,registration=null,prompt=null,status='Проверяем поддержку офлайн-режима…',busy=false,downloaded=0,cancel=null,lock=null,updating=false,manifest=null,checking=false,storageError=false,wakeRefused=false;
 let installed=display.matches||navigator.standalone===true;
 const canShare=typeof navigator.share==='function',canCopy=typeof navigator.clipboard?.writeText==='function';
 const canFullscreen=typeof document.documentElement?.requestFullscreen==='function'&&typeof document.exitFullscreen==='function'&&document.fullscreenEnabled!==false;
 let sharing=false,fullscreenPending=false;
 function connectionStatus(){return navigator.onLine===false?'Сейчас без интернета. Открываются сохранённые разделы и записи.':'Есть соединение с сетью. Доступность интернета зависит от соединения.'}
 function lessonLink(){const url=new URL(location.hostname?.endsWith('github.io')?scope.href:'https://samandarmansurkhodjaev2713.github.io/vamos-spanish/');url.search='';url.hash='';url.searchParams.set('view','lesson');url.searchParams.set('day',String(Math.min(30,Math.max(1,Math.trunc(Number(state.day)||1)))));return url.href}
 function featureMessage(message){const el=document.getElementById('native-feature-status');if(el)el.textContent=message;toast(message)}
 async function shareLesson(){
  if(sharing)return;sharing=true;update();
  const url=lessonLink();
  try{if(canShare){await navigator.share({title:'¡Vamos! — урок испанского',url});featureMessage('Ссылка передана выбранному приложению.')}else if(canCopy){await navigator.clipboard.writeText(url);featureMessage('Ссылка на урок скопирована.')}else featureMessage('Браузер не умеет отправлять или копировать ссылку. Скопируй её из поля ниже.')}
  catch(error){featureMessage(error?.name==='AbortError'?'Отправка отменена.':canShare?'Не удалось отправить ссылку. Можно скопировать её из поля ниже.':'Не удалось скопировать ссылку. Скопируй её из поля ниже.')}
  finally{sharing=false;update()}
 }
 async function toggleFullscreen(){
  if(fullscreenPending)return;
  if(!canFullscreen){featureMessage('Полный экран недоступен в этом браузере.');return}
  fullscreenPending=true;update();
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}
  catch{featureMessage('Браузер не разрешил изменить режим экрана.')}
  finally{fullscreenPending=false;update()}
 }
 function installLabel(){return installed?'Открыто как приложение':prompt?'Установить ¡Vamos!':'Как добавить на главный экран'}
 function installStatus(){return installed?'Установка завершена. Учись в этом окне: прогресс сохраняется здесь.':prompt?'Браузер готов предложить установку. Нажми кнопку и подтверди её.':'Если браузер поддерживает установку, добавь курс через его меню. Инструкция ниже.'}
 function wakeStatus(){return !navigator.wakeLock?'Удержание экрана недоступно в этом браузере.':lock?'Экран удерживается, пока открыт урок.':state.native.awake&&wakeRefused?'Браузер не разрешил удержать экран. Настройка сохранена; попробуем при следующем входе в урок.':state.native.awake?'Включено для открытого урока. В других разделах и в фоне экран работает как обычно.':'Выключено. Можно включить для уроков; браузер может снять удержание при экономии батареи.'}
 function update(){
  const network=document.getElementById('native-network-status');if(network)network.textContent=connectionStatus();
  document.querySelectorAll('[data-native-share]').forEach(b=>{b.disabled=sharing;b.setAttribute('aria-busy',String(sharing));const label=canShare?'Поделиться уроком':canCopy?'Скопировать ссылку на урок':'Ссылка на урок';const span=b.querySelector?.('[data-native-share-label]');if(span)span.textContent=label;else b.textContent=label});
  document.querySelectorAll('[data-native-fullscreen]').forEach(b=>{b.disabled=!canFullscreen||fullscreenPending;b.setAttribute('aria-pressed',String(!!document.fullscreenElement));const label=document.fullscreenElement?'Выйти из полного экрана':'Открыть на весь экран',span=b.querySelector?.('[data-native-fullscreen-label]');if(span)span.textContent=label;else b.textContent=label});
  const link=document.getElementById('native-lesson-link');if(link)link.value=lessonLink();
  const el=document.getElementById('offline-status');if(el)el.textContent=status;
  document.querySelectorAll('[data-offline-download]').forEach(b=>{b.disabled=busy||checking||!supported||!ready||!canVerify||storageError;b.setAttribute('aria-busy',String(busy));const label=b.querySelector?.('[data-native-download-label]'),text=busy?'Сохраняем записи…':downloaded===clips.length?'Все записи сохранены':'Сохранить аудио офлайн';if(label)label.textContent=text;else b.textContent=text});
  const refresh=document.querySelector('[data-offline-refresh]');if(refresh)refresh.disabled=busy||checking||!supported||!ready;
  const install=document.querySelector('[data-native-install]');if(install){install.textContent=installLabel();install.disabled=installed}
  const installNote=document.getElementById('native-install-status');if(installNote)installNote.textContent=installStatus();
  const wake=document.getElementById('native-wake-status');if(wake)wake.textContent=wakeStatus();
  const cancelButton=document.querySelector('[data-offline-cancel]');if(cancelButton)cancelButton.hidden=!busy;
 }
 async function originals(){
  if(manifest)return manifest;
  const response=await fetch(new URL('assets/audio/ATTRIBUTION.json',scope));if(!response.ok)throw Error('manifest');
  const raw=await response.json(),byFile=new Map(Object.values(raw).map(p=>[p.file,p]));
  for(const clip of Object.values(data.wordAudio?.clips||{})){
   if(typeof clip.file!=='string'||!clip.file.startsWith('assets/')||clip.file.split('/').includes('..'))throw Error('manifest');
   byFile.set(clip.file,clip);
  }
  if(!clips.every(p=>/^[a-f\d]{64}$/.test(byFile.get(p.file)?.sha256||'')&&Number.isSafeInteger(byFile.get(p.file)?.bytes)&&byFile.get(p.file).bytes>0))throw Error('manifest');
  manifest=byFile;return manifest;
 }
 async function intact(response,item){
  if(!response||response.status!==200||!canVerify)return false;
  const expected=(await originals()).get(item.file),bytes=await response.clone().arrayBuffer();
  if(bytes.byteLength!==expected.bytes)return false;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  return hash===expected.sha256;
 }
 async function count(){
  const cache=await caches.open(mediaCache);await originals();let total=0,next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<clips.length){const item=clips[next++],url=new URL(item.file,scope).href,response=await cache.match(url);if(await intact(response,item))total++;else if(response)await cache.delete(url)}}));return total;
 }
 async function refresh(){
  if(busy||checking)return;
  if(!supported){status='Офлайн-хранилище недоступно. Учись с интернетом.';update();return}
  if(!ready){update();return}
  if(!canVerify){status='Браузер не поддерживает проверку аудиофайлов. Используй актуальный браузер с HTTPS для сохранения офлайн.';update();return}
  checking=true;status='Проверяем сохранённые записи…';update();
  try{downloaded=await count();storageError=false;status=`Проверено на устройстве: ${downloaded} из ${clips.length} оригинальных записей. ${downloaded===clips.length?'Все записи готовы к прослушиванию офлайн.':'Сохрани недостающие записи кнопкой ниже.'}`}
  catch{storageError=true;status='Не удалось проверить хранилище или список аудио. Проверь соединение и свободное место, затем нажми «Проверить».'}
  finally{checking=false;update()}
 }
 function html(){return `<section class="native-settings"><h2>Курс под рукой</h2><p id="native-network-status" class="note" role="status">${esc(connectionStatus())}</p><details class="native-group"><summary>Установить на главный экран</summary><div><p id="native-install-status" class="note">${esc(installStatus())}</p><button type="button" class="btn" data-native-install ${installed?'disabled':''}>${installLabel()}</button><details id="install-help"><summary>Инструкция и перенос прогресса</summary><div><p>iPhone/iPad: Safari → «Поделиться» → «На экран Домой».</p><p>Android и компьютер: меню браузера → «Установить приложение» или «Добавить на главный экран».</p><p>Быстрые действия у значка: Сегодня, Разговор, Словарь, Чтение — если система их поддерживает.</p><p>Перед установкой сохрани файл прогресса в настройках. На iPhone/iPad установленное приложение может иметь отдельное хранилище: открой его и импортируй копию, если уроки не перенеслись. Этот же файл подходит для другого устройства. Записи своего голоса скачиваются отдельно.</p></div></details></div></details><details class="native-group"><summary>Записи без интернета · ${clips.length}</summary><div><p class="note">Сохрани ${clips.length} оригинальных записей фраз и слов. Каждый файл проверяется по размеру и SHA-256. При отмене готовые файлы останутся; повторная загрузка добавит недостающие. Браузер может очистить кэш при нехватке места.</p><div class="transfer-actions"><button type="button" class="btn primary" data-offline-download ${busy||checking||!supported||!ready||!canVerify||storageError?'disabled':''} aria-busy="${busy}">${icon('download')}<span data-native-download-label>${busy?'Сохраняем записи…':downloaded===clips.length?'Все записи сохранены':'Сохранить аудио офлайн'}</span></button><button type="button" class="btn" data-offline-cancel ${!busy?'hidden':''}>Остановить загрузку</button><button type="button" class="btn quiet" data-offline-refresh ${busy||checking||!supported||!ready?'disabled':''}>${icon('refresh-cw')}Проверить</button></div><p id="offline-status" role="status">${esc(status)}</p></div></details><details class="native-group"><summary>Микрофон и экран</summary><div><p class="small">${canRecord?'Запись себя поддерживается. Микрофон включается только по кнопке записи в практике.':'Запись себя недоступна. Можно говорить вслух и сравнивать с носителем.'} ${canRecognize?'Распознавание слов доступно отдельно и может передавать звук сервису браузера.':'Распознавание слов недоступно в этом браузере.'} Оценка акцента не выполняется.</p><label class="setting-check"><input type="checkbox" id="native-awake" ${state.native.awake?'checked':''} ${!navigator.wakeLock?'disabled':''}>Не гасить экран во время урока</label><p id="native-wake-status" class="small" role="status">${esc(wakeStatus())}</p><button type="button" class="btn" data-native-fullscreen aria-pressed="${!!document.fullscreenElement}" ${!canFullscreen||fullscreenPending?'disabled':''}>${document.fullscreenElement?'Выйти из полного экрана':'Открыть на весь экран'}</button>${!canFullscreen?'<p class="small">Полный экран недоступен в этом браузере.</p>':''}</div></details><details class="native-group"><summary>Поделиться ссылкой на урок</summary><div><p class="small">Личные ответы и прогресс в ссылку не входят.</p><button type="button" class="btn" data-native-share aria-busy="${sharing}" ${sharing?'disabled':''}>${canShare?'Поделиться уроком':canCopy?'Скопировать ссылку на урок':'Ссылка на урок'}</button><label for="native-lesson-link">День ${Math.min(30,Math.max(1,Math.trunc(Number(state.day)||1)))}<input id="native-lesson-link" type="url" readonly value="${esc(lessonLink())}" autocomplete="off"></label></div></details><p id="native-feature-status" class="small" role="status"></p></section>`}

 async function download(){
  if(busy||checking||!supported||!ready||!canVerify||storageError){toast('Офлайн-хранилище ещё не готово. Проверь статус ниже.');return}
  busy=true;cancel=new AbortController();const signal=cancel.signal;status='Подготавливаем хранилище…';update();let success=0,failed=0,next=0,fatal=false;
  try{const cache=await caches.open(mediaCache);await originals();await Promise.all(Array.from({length:3},async()=>{while(next<clips.length&&!signal.aborted){const item=clips[next++],url=new URL(item.file,scope).href;try{if(!await intact(await cache.match(url),item)){const response=await fetch(url,{signal,cache:'reload'});if(!await intact(response,item))throw Error('integrity');if(signal.aborted)break;await cache.put(url,response)}success++}catch{if(!signal.aborted)failed++}status=`Сохранено ${success} из ${clips.length}${failed?`; не удалось: ${failed}`:''}.`;update()}}))}
  catch{fatal=true}
  finally{busy=false;cancel=null;await refresh();if(fatal)status+=' Сохранение не завершено: проверь соединение и свободное место.';if(failed)status+=` Не удалось загрузить: ${failed}. Повтори сохранение — готовые файлы останутся.`;if(signal.aborted)status+=' Загрузка остановлена. Готовые файлы сохранены.';update()}
 }
 function notice(){if(!registration?.waiting||!navigator.serviceWorker.controller)return;let el=document.getElementById('native-notice');if(!el){el=document.createElement('div');el.id='native-notice';el.className='native-notice';el.setAttribute('role','status');const layout=document.querySelector('.layout');if(!layout)return;layout.before(el)}el.innerHTML='<span>Доступно обновление курса. Сохранённый шаг останется.</span><button type="button" class="btn" data-native-update>Обновить</button>'}
 async function sync(){
  update();
  if(!navigator.wakeLock)return;const want=state.native.awake&&activeLesson()&&!document.hidden;
  if(!want){if(lock){const current=lock;lock=null;await current.release().catch(()=>{})}update();return}
  if(lock||lockPending)return;lockPending=true;
  try{const result=await navigator.wakeLock.request('screen');wakeRefused=false;if(!state.native.awake||!activeLesson()||document.hidden){await result.release();return}lock=result;result.addEventListener('release',()=>{if(lock===result)lock=null;update()})}catch{wakeRefused=true}finally{lockPending=false;update()}
 }
 function click(b){
  if(b.hasAttribute('data-native-share')){shareLesson();return true}
  if(b.hasAttribute('data-native-fullscreen')){toggleFullscreen();return true}
  if(b.hasAttribute('data-native-install')){if(installed)return true;if(prompt){const current=prompt;prompt=null;update();Promise.resolve().then(()=>current.prompt()).then(()=>current.userChoice).then(r=>{toast(r.outcome==='accepted'?'Установка подтверждена в браузере.':'Установка отменена. Можно продолжать во вкладке.');update()}).catch(()=>{toast('Открой инструкцию установки ниже.');update()})}else{const el=document.getElementById('install-help');if(el){el.open=true;el.scrollIntoView({block:'center'})}}return true}
  if(b.hasAttribute('data-offline-download')){download();return true}
  if(b.hasAttribute('data-offline-cancel')){cancel?.abort();return true}
  if(b.hasAttribute('data-offline-refresh')){refresh();return true}
  if(b.hasAttribute('data-native-update')){if(updating)return true;const waiting=registration?.waiting;if(!waiting){toast('Обновление уже применено. Перезагрузи страницу, если нужно.');return true}if(api.prepareReload){if(api.prepareReload()===false)return true}else if(save()===false)return true;updating=true;b.disabled=true;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting.postMessage({type:'ACTIVATE'});return true}
  return false;
 }
 function change(el){if(el.id==='native-awake'){state.native.awake=el.checked;save();sync();update();return true}return false}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;update()});window.addEventListener('appinstalled',()=>{installed=true;prompt=null;update()});display.addEventListener?.('change',e=>{installed=e.matches||navigator.standalone===true;update()});
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>{const current=lock;lock=null;current?.release().catch(()=>{})});
 window.addEventListener('online',update);window.addEventListener('offline',update);document.addEventListener('fullscreenchange',update);
 if(supported){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{registration=r;ready=!!r.active;notice();navigator.serviceWorker.ready.then(()=>{ready=true;refresh()});r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',notice));refresh()}).catch(()=>{status='Офлайн-режим пока не включился. Курс работает с интернетом.';update()})}else refresh();
 return {html,click,change,sync,audioCatalog:()=>clips.map(p=>({...p}))};
}};
