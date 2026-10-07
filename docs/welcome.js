window.VamosWelcome={create({state,data,esc,icon,playButton,save,stopAudio}){
 let dialog;

 const phrase=data.expanded.lessons[0].examples.find(a=>a.es==='Hola.')||data.expanded.lessons[0].examples[0];
 function open(){if(!dialog){dialog=document.createElement('dialog');dialog.className='welcome-dialog';dialog.setAttribute('aria-labelledby','welcome-title');document.getElementById('app').append(dialog);dialog.addEventListener('close',()=>{state.welcomeSeen=true;save();stopAudio()});}dialog.innerHTML=`<div class="welcome-cover"><img src="assets/lumo-welcome-v13.webp" width="1672" height="941" alt="Лумо за учебным столом в испанском дворике"><button type="button" class="welcome-close" data-welcome-close aria-label="Закрыть приветствие">${icon('x')}</button></div><div class="welcome-copy"><p class="eyebrow">¡Vamos! · испанский для жизни</p><h1 id="welcome-title">Каждый разговор<br>начинается с hola.</h1><p>Я Лумо. Помогу разобраться в задании, вспомнить фразу и сделать следующий шаг.</p><div class="welcome-audio"><span lang="es">${esc(phrase.es)}</span><span>${esc(phrase.ru)}</span>${playButton(phrase.audio,'Послушать приветствие носителя: '+phrase.es)}<small>Оригинальная запись носителя · звук по нажатию</small></div><button type="button" class="btn primary wide" data-welcome-close>К моему испанскому ${icon('arrow-right')}</button><p class="small">Один понятный шаг. В своём темпе.</p></div>`;window.lucide?.createIcons();dialog.showModal();dialog.querySelector('[data-welcome-close]')?.focus();}
 function click(b){if(b.hasAttribute('data-welcome-open')){open();return true}if(b.hasAttribute('data-welcome-close')){state.welcomeSeen=true;save();dialog?.close();return true}return false}
 function first(){if(!state.welcomeSeen)open()}
 return {open,click,first};
}};
