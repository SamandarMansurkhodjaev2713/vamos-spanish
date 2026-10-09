/* Finite motion follows the learning action; it never records or awards progress. */
window.VamosProductMotion={create(api){
 'use strict';
 const {state,main}=api,reduce=window.matchMedia?.('(prefers-reduced-motion:reduce)'),active=new Set();let lastKey=null,destroyed=false;
 const allowed=()=>!destroyed&&state.motion!==false&&!document.hidden&&!reduce?.matches&&!document.documentElement.classList.contains('motion-off');
 function cancel(){for(const a of active)a.cancel();active.clear()}
 function play(el,frames,options){if(!el?.animate||!allowed())return;const a=el.animate(frames,{fill:'none',easing:'cubic-bezier(.16,1,.3,1)',...options});active.add(a);a.finished?.then(()=>active.delete(a),()=>active.delete(a));return a}
 /* Screen identity only: typing, filters, translations and answer selection stay still. */
 function surfaceKey(){
  const profile=main?.querySelector('[data-profile-panel]');if(profile)return 'profile:'+profile.dataset.profilePanel;
  const book=main?.querySelector('[data-reader-book]');if(book)return 'reader:book:'+book.dataset.readerBook;
  if(main?.querySelector('.reader-collection'))return 'reader:collection';
  if(main?.querySelector('.reader-catalog'))return 'reader:catalog';
  const detail=main?.querySelector('[data-lib-detail]');if(detail)return 'library:detail:'+detail.dataset.libDetail;
  if(main?.querySelector('.library'))return 'library:list';
  const speech=main?.querySelector('.speech-screens [data-speech-screen][aria-pressed="true"]');if(speech)return 'speech:'+speech.dataset.speechScreen+':'+(main?.querySelector('#speech-phrase')?.value||'0');
  return '';
 }
 function run({key,kind='screen',direction=1}={}){
  if(!allowed()){cancel();if(key!==undefined&&key!==null)lastKey=key;return false}if(key===undefined||key===null||key===lastKey)return false;const first=lastKey===null;lastKey=key;cancel();if(first||!allowed())return false;
  const page=kind==='panel'?main?.querySelector('.profile-content'):Array.from(main?.children||[]).find(el=>!el.classList.contains('session-band')&&!el.classList.contains('pending-voice')&&!el.classList.contains('section-trail'));if(!page)return false;
  if(kind==='panel')play(page,[{opacity:.85,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:240});
  else if(kind==='stage')play(page,[{opacity:.78,transform:`translateX(${direction<0?-12:12}px)`},{opacity:1,transform:'translateX(0)'}],{duration:280});
  else play(page,[{opacity:.8,transform:'translateY(10px)',clipPath:'inset(0 0 2% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0 0)'}],{duration:330});
  const selected=document.querySelector('.mobile-nav [aria-current="page"]');if(kind==='screen')play(selected,[{backgroundColor:'var(--paper)',transform:'translateY(1px)'},{backgroundColor:'var(--soft)',transform:'translateY(0)'}],{duration:260});
  return true;
 }
 function react(kind){cancel();if(!allowed())return false;
  const feedback=main?.querySelector('.feedback,.quiz-feedback,.mission-feedback,.library-feedback,.profile-memory'),lumo=feedback?.querySelector('.mascot')||main?.querySelector('.mascot');
  if(kind==='correct'||kind==='complete'){
   play(lumo,[{transform:'rotate(0) scale(1)'},{transform:'rotate(-4deg) scale(1.06)',offset:.4},{transform:'rotate(2deg) scale(1.02)',offset:.7},{transform:'rotate(0) scale(1)'}],{duration:320});
   play(feedback,[{clipPath:'inset(0 0 8% 0 round 16px)',opacity:.85},{clipPath:'inset(0 0 0 0 round 16px)',opacity:1}],{duration:300});
  }else if(kind==='retry'){
   play(lumo,[{transform:'rotate(0)'},{transform:'rotate(-5deg)',offset:.45},{transform:'rotate(0)'}],{duration:280});
   play(feedback,[{opacity:.75,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:220});
  }else return false;
  return true;
 }
 function visibility(){if(!allowed())cancel()}
 document.addEventListener('visibilitychange',visibility);reduce?.addEventListener?.('change',visibility);
 function destroy(){cancel();destroyed=true;document.removeEventListener('visibilitychange',visibility);reduce?.removeEventListener?.('change',visibility)}
 return {run,react,surfaceKey,destroy};
}};
