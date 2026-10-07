(function () {
 'use strict';
 window.VamosNavigation = {
  create(api) {
   const {esc, icon} = api;
   const sections = [['home','Маршрут','route'],['practice','Практика','messages-square'],['words','Словарь','book-open'],['materials','Материалы','notebook-tabs']];
   const practiceLabels = {mastery:'Без подсказок',drill:'Тренировка фраз',pronunciation:'Сказать и сравнить',review:'Повторение',scene:'Разговор на двоих',sound:'Слух и речь',dialogue:'Своя реплика',extra:'Упражнения',checkpoint:'Проверка навыков'};
   function selected() { return api.view() === 'lesson' ? 'home' : api.view(); }
   function footer() {
    return `<footer class="footer course-footer" aria-label="О курсе и навигация">
     <div class="course-footer-top">
      <div class="course-footer-about"><button type="button" class="footer-wordmark" data-footer-nav="home" aria-label="¡Vamos! — к маршруту"><span>¡</span>vamos<span>!</span></button><p>От знакомой фразы — к своему разговору.</p><span class="footer-rhythm">30 дней · 30–40 минут в день</span></div>
      <div class="course-footer-next"><strong>Есть ещё пять минут?</strong><p>Верни трудную фразу из памяти и произнеси её вслух.</p><button type="button" class="btn" data-footer-practice="review">${icon('rotate-ccw')}Повторить слова и фразы</button></div>
      <nav class="course-footer-nav" aria-label="Разделы курса">${sections.map(([id,label,symbol])=>`<button type="button" data-footer-nav="${id}" aria-current="${selected()===id?'page':'false'}">${icon(symbol)}<span>${label}</span>${icon('arrow-up-right')}</button>`).join('')}</nav>
     </div>
     <div class="course-footer-bottom"><p>Прогресс и подбор практики сохраняются в этом браузере. Копию прогресса можно сохранить в настройках.</p><div class="footer-utility"><button type="button" data-footer-nav="settings">${icon('sliders-horizontal')}Настройки и прогресс</button><button type="button" data-footer-tab="sources">${icon('headphones')}Записи и лицензии</button></div></div>
    </footer>`;
   }
   function sync() {
    const current = selected();
    document.querySelectorAll('[data-nav]').forEach(button=>button.setAttribute('aria-current', button.dataset.nav === current ? 'page' : 'false'));
    document.querySelectorAll('[data-footer-nav]').forEach(button=>button.setAttribute('aria-current', button.dataset.footerNav === current ? 'page' : 'false'));
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const settings = topbar.querySelector('[data-nav="settings"]');
    if (settings) {
     settings.classList.add('shell-settings');
     if (!settings.querySelector('.shell-settings-label')) {
      const label = document.createElement('span'); label.className = 'shell-settings-label'; label.textContent = 'Настройки'; settings.append(label);
     }
    }
    let context = topbar.querySelector('.shell-context');
    if (!context) { context = document.createElement('span'); context.className = 'shell-context'; topbar.querySelector('.logo')?.after(context); }
    const view = api.view();
    const section = sections.find(([id])=>id===view)?.[1];
    context.textContent = view==='lesson' ? `День ${Math.min(30,Math.max(1,Number(api.day())||1))}` : view==='settings' ? 'Настройки' : section || 'Маршрут';
    const main = document.getElementById('main');
    if (main && view==='practice' && api.practice()!=='menu') {
     let trail = main.querySelector('.section-trail');
     if (!trail) {
      trail = document.createElement('nav'); trail.className = 'section-trail'; trail.setAttribute('aria-label','Текущий раздел');
      trail.innerHTML = `<span>Практика</span><span aria-hidden="true">/</span><span>${esc(practiceLabels[api.practice()]||'Практика')}</span>`;
      main.prepend(trail);
     }
    }
   }
   return {footer, sync};
  }
 };
})();
