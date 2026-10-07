/* Course navigation shares the current study context at every width. */
window.VamosNavigation={create(api){
 'use strict';
 const {esc,icon}=api;
 const sections=[['home','Учиться','Следующий урок и все 30 дней','route'],['practice','Практика','Вспомнить, услышать и сказать','messages-square'],['words','Словарь','Слова, фразы и маленькие истории','book-open'],['materials','Помощь','Объяснения, истории, видео и записи','notebook-tabs'],['settings','Настройки','Звук, оформление, офлайн и прогресс','sliders-horizontal']];
 const labels={workbook:'Истории и мастерская',daily:'Занятие на сегодня',mission:'Разговорная миссия',personal:'Мой испанский',recordings:'Мои записи',mastery:'Контроль памяти',drill:'Тренировка фраз',pronunciation:'Сказать и сравнить',review:'Повторение',scene:'Разговор на двоих',sound:'Слух и речь',dialogue:'Своя реплика',extra:'Квизы',checkpoint:'Разговорная проверка'};
 const selected=()=>api.view()==='lesson'?'home':api.view();
 let dialog=null,continuation=null;

 function footer(){return `<footer class="footer course-footer quiet-footer"><p><strong>¡Vamos!</strong><span>По чуть-чуть. Каждый день.</span></p><nav class="footer-shortcuts" aria-label="Разделы внизу страницы">${sections.filter(([id])=>['practice','words','materials'].includes(id)).map(([id,label])=>`<button type="button" data-footer-nav="${id}" aria-current="${selected()===id?'page':'false'}">${label}</button>`).join('')}</nav><div class="footer-utility"><button type="button" data-menu-open aria-label="Открыть меню курса" aria-expanded="false" aria-controls="course-menu">${icon('menu')}Разделы курса</button><button type="button" data-footer-tab="sources">${icon('headphones')}Записи и лицензии</button></div></footer>`}

 function ensure(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='course-menu';dialog.className='menu-drawer';dialog.setAttribute('aria-labelledby','menu-title');document.getElementById('app').append(dialog);
  dialog.addEventListener('keydown',e=>{
   if(e.key!=='Tab')return;
   const nodes=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length),first=nodes[0],last=nodes.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  });
  dialog.addEventListener('close',()=>{continuation=null;document.querySelectorAll('[data-menu-open]').forEach(b=>b.setAttribute('aria-expanded','false'))});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 }

 function contents(){
  const proposed=api.nextSession?.();
  continuation=proposed&&typeof proposed.open==='function'&&typeof proposed.label==='string'?proposed:null;
  const nextLabel=continuation?continuation.label:`Начать занятие ${Math.min(30,Math.max(1,Number(api.next?.()||api.day())||1))}`;
  return `<div class="menu-heading"><div><h2 id="menu-title">Куда пойдём?</h2><p>Один шаг за раз.</p></div><button type="button" class="btn quiet icon" data-menu-close aria-label="Закрыть меню">${icon('x')}</button></div><nav class="menu-sections" aria-label="Разделы курса">${sections.map(([id,label,desc,symbol])=>`<button type="button" data-nav="${id}" aria-current="${selected()===id?'page':'false'}">${icon(symbol)}<span><strong>${label}</strong><small>${desc}</small></span>${icon('arrow-right')}</button>`).join('')}</nav><div class="menu-next"><span>Продолжить обучение</span><button type="button" class="btn primary wide" data-menu-lesson>${icon('play')}${esc(nextLabel)}</button></div><p class="menu-note">Прогресс остаётся на устройстве. Для переноса сохрани копию в настройках.</p>`;
 }

 function open(){ensure();if(dialog.open)return;api.onOpen?.();dialog.innerHTML=contents();window.lucide?.createIcons({attrs:{width:22,height:22}});dialog.showModal();document.querySelectorAll('[data-menu-open]').forEach(b=>b.setAttribute('aria-expanded','true'))}
 function close(){if(dialog?.open)dialog.close()}
 function click(b){
  if(b.hasAttribute('data-menu-open')){open();return true}
  if(b.hasAttribute('data-menu-close')){close();return true}
  if(b.hasAttribute('data-menu-lesson')){const next=continuation,d=api.next?.()||api.day();close();if(next)next.open();else if(api.startStudy)api.startStudy();else api.openLesson(d);return true}
  if(b.dataset.nav||b.dataset.footerNav||b.dataset.footerTab)close();
  return false;
 }

 function sync(){
  const current=selected(),view=api.view(),kind=api.practice();
  document.querySelectorAll('[data-nav],[data-footer-nav]').forEach(b=>b.setAttribute('aria-current',(b.dataset.nav||b.dataset.footerNav)===current?'page':'false'));
  const topbar=document.querySelector('.topbar');
  if(topbar){
   let context=topbar.querySelector('.shell-context');
   if(!context){context=document.createElement('span');context.className='shell-context';topbar.querySelector('.logo').after(context)}
   const section=sections.find(([id])=>id===view)?.[1]||'Маршрут';
   const text=view==='lesson'?`День ${api.day()}`:view==='practice'&&kind!=='menu'?labels[kind]||'Практика':section;
   context.textContent=text;context.title=text;context.setAttribute('aria-label',text);
  }
  const main=document.getElementById('main');
  if(view==='practice'&&kind!=='menu'&&main){
   let trail=main.querySelector('.section-trail');
   if(!trail){trail=document.createElement('div');trail.className='section-trail';main.prepend(trail)}
   trail.innerHTML=`<button type="button" class="btn quiet" data-nav="practice">${icon('arrow-left')}Все тренировки</button>`;
  }
 }
 ensure();return {footer,sync,click,close};
}};
