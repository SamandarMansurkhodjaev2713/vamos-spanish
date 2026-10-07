/* Optional device capabilities. Audio stays original; storage and permissions remain explicit. */
window.VamosNative={create(api){
 'use strict';
 const {state,data,esc,icon,save,toast,activeLesson}=api;
 state.native={awake:state.native?.awake===true};
 const scope=new URL('./',location.href),prefix='vamos-'+encodeURIComponent(scope.pathname)+'-',mediaCache=prefix+'audio';
 const clips=Object.values(data.expanded.audio),display=matchMedia('(display-mode: standalone)');
 const supported='serviceWorker'in navigator&&'caches'in window,canVerify=!!window.crypto?.subtle;
 const canRecord=!!navigator.mediaDevices?.getUserMedia&&'MediaRecorder'in window;
 const canRecognize=!!(window.SpeechRecognition||window.webkitSpeechRecognition);
 let ready=false,lockPending=false,registration=null,prompt=null,status='Проверяем поддержку офлайн-режима…',busy=false,downloaded=0,cancel=null,lock=null,updating=false,manifest=null,checking=false,storageError=false,wakeRefused=false;
 let installed=display.matches||navigator.standalone===true;
 function installLabel(){return installed?'Открыто как приложение':prompt?'Установить ¡Vamos!':'Как добавить на главный экран'}
 function installStatus(){return installed?'Установка завершена. Учись в этом окне: прогресс сохраняется здесь.':prompt?'Браузер готов предложить установку. Нажми кнопку и подтверди её.':'Если браузер поддерживает установку, добавь курс через его меню. Инструкция ниже.'}
 function wakeStatus(){return !navigator.wakeLock?'Удержание экрана недоступно в этом браузере.':lock?'Экран удерживается, пока открыт урок.':state.native.awake&&wakeRefused?'Браузер не разрешил удержать экран. Настройка сохранена; попробуем при следующем входе в урок.':state.native.awake?'Включено для открытого урока. В других разделах и в фоне экран работает как обычно.':'Выключено. Можно включить для уроков; браузер может снять удержание при экономии батареи.'}
 function update(){
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
 function html(){return `<section class="native-settings"><h2>Курс под рукой</h2><p>Установка, офлайн-аудио и экран — отдельные возможности. Ни одна из них не включает микрофон автоматически.</p><h3>На главном экране</h3><p id="native-install-status" class="note">${esc(installStatus())}</p><button type="button" class="btn" data-native-install ${installed?'disabled':''}>${installLabel()}</button><details id="install-help"><summary>Как установить и где будет прогресс</summary><div><p>iPhone/iPad: открой сайт в Safari → «Поделиться» → «На экран Домой».</p><p>Android и компьютер: открой меню браузера → «Установить приложение» или «Добавить на главный экран». Если пункта нет, продолжай во вкладке.</p><p>Быстрые действия у значка: занятие, повторение и речь — если система их поддерживает.</p><p>Прогресс хранится в этом браузере. Перед сменой браузера или устройства открой «Настройки» → «Курс на другом устройстве», сохрани файл прогресса и импортируй его на новом устройстве.</p></div></details><h3>Записи носителя без интернета</h3><p class="note">Сохранение загрузит ${clips.length} оригинальных MP3 с проверкой целостности. При отмене готовые файлы останутся; повторная загрузка добавит недостающие. Браузер может очистить кэш при нехватке места.</p><div class="transfer-actions"><button type="button" class="btn primary" data-offline-download ${busy||checking||!supported||!ready||!canVerify||storageError?'disabled':''} aria-busy="${busy}">${icon('download')}<span data-native-download-label>${busy?'Сохраняем записи…':downloaded===clips.length?'Все записи сохранены':'Сохранить аудио офлайн'}</span></button><button type="button" class="btn" data-offline-cancel ${!busy?'hidden':''}>Остановить загрузку</button><button type="button" class="btn quiet" data-offline-refresh ${busy||checking||!supported||!ready?'disabled':''}>${icon('refresh-cw')}Проверить</button></div><p id="offline-status" role="status">${esc(status)}</p><h3>Микрофон и экран</h3><p class="small">${canRecord?'Запись себя поддерживается. Микрофон включается только по кнопке записи в практике.':'Запись себя недоступна в этом браузере. Можно произносить фразы вслух и сравнивать с носителем.'} ${canRecognize?'Распознавание слов доступно в речевой практике: включается отдельно и может использовать сервис браузера с передачей звука.':'Распознавание слов недоступно. Слушать носителя и заниматься без него можно.'} Эти возможности не оценивают акцент.</p><label class="setting-check"><input type="checkbox" id="native-awake" ${state.native.awake?'checked':''} ${!navigator.wakeLock?'disabled':''}>Не гасить экран во время урока</label><p id="native-wake-status" class="small" role="status">${esc(wakeStatus())}</p></section>`}
 async function download(){
  if(busy||checking||!supported||!ready||!canVerify||storageError){toast('Офлайн-хранилище ещё не готово. Проверь статус ниже.');return}
  busy=true;cancel=new AbortController();const signal=cancel.signal;status='Подготавливаем хранилище…';update();let success=0,failed=0,next=0,fatal=false;
  try{const cache=await caches.open(mediaCache);await originals();await Promise.all(Array.from({length:3},async()=>{while(next<clips.length&&!signal.aborted){const item=clips[next++],url=new URL(item.file,scope).href;try{if(!await intact(await cache.match(url),item)){const response=await fetch(url,{signal,cache:'reload'});if(!await intact(response,item))throw Error('integrity');if(signal.aborted)break;await cache.put(url,response)}success++}catch{if(!signal.aborted)failed++}status=`Сохранено ${success} из ${clips.length}${failed?`; не удалось: ${failed}`:''}.`;update()}}))}
  catch{fatal=true}
  finally{busy=false;cancel=null;await refresh();if(fatal)status+=' Сохранение не завершено: проверь соединение и свободное место.';if(failed)status+=` Не удалось загрузить: ${failed}. Повтори сохранение — готовые файлы останутся.`;if(signal.aborted)status+=' Загрузка остановлена. Готовые файлы сохранены.';update()}
 }
 function notice(){if(!registration?.waiting||!navigator.serviceWorker.controller)return;let el=document.getElementById('native-notice');if(!el){el=document.createElement('div');el.id='native-notice';el.className='native-notice';el.setAttribute('role','status');const layout=document.querySelector('.layout');if(!layout)return;layout.before(el)}el.innerHTML='<span>Доступно обновление курса. Сохранённый шаг останется.</span><button type="button" class="btn" data-native-update>Обновить</button>'}
 async function sync(){
  if(!navigator.wakeLock)return;const want=state.native.awake&&activeLesson()&&!document.hidden;
  if(!want){if(lock){const current=lock;lock=null;await current.release().catch(()=>{})}update();return}
  if(lock||lockPending)return;lockPending=true;
  try{const result=await navigator.wakeLock.request('screen');wakeRefused=false;if(!state.native.awake||!activeLesson()||document.hidden){await result.release();return}lock=result;result.addEventListener('release',()=>{if(lock===result)lock=null;update()})}catch{wakeRefused=true}finally{lockPending=false;update()}
 }
 function click(b){
  if(b.hasAttribute('data-native-install')){if(installed)return true;if(prompt){const current=prompt;prompt=null;update();Promise.resolve().then(()=>current.prompt()).then(()=>current.userChoice).then(r=>{toast(r.outcome==='accepted'?'Установка подтверждена в браузере.':'Установка отменена. Можно продолжать во вкладке.');update()}).catch(()=>{toast('Открой инструкцию установки ниже.');update()})}else{const el=document.getElementById('install-help');if(el){el.open=true;el.scrollIntoView({block:'center'})}}return true}
  if(b.hasAttribute('data-offline-download')){download();return true}
  if(b.hasAttribute('data-offline-cancel')){cancel?.abort();return true}
  if(b.hasAttribute('data-offline-refresh')){refresh();return true}
  if(b.hasAttribute('data-native-update')){if(updating)return true;const waiting=registration?.waiting;if(!waiting){toast('Обновление уже применено. Перезагрузи страницу, если нужно.');return true}save();updating=true;b.disabled=true;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waiting.postMessage({type:'ACTIVATE'});return true}
  return false;
 }
 function change(el){if(el.id==='native-awake'){state.native.awake=el.checked;save();sync();update();return true}return false}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;update()});window.addEventListener('appinstalled',()=>{installed=true;prompt=null;update()});display.addEventListener?.('change',e=>{installed=e.matches||navigator.standalone===true;update()});
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',()=>{const current=lock;lock=null;current?.release().catch(()=>{})});
 if(supported){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{registration=r;ready=!!r.active;notice();navigator.serviceWorker.ready.then(()=>{ready=true;refresh()});r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',notice));refresh()}).catch(()=>{status='Офлайн-режим пока не включился. Курс работает с интернетом.';update()})}else refresh();
 return {html,click,change,sync};
}};
