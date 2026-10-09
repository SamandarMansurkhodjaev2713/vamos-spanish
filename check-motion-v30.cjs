/* Production motion controller: DOM identity, bounded effects and cancellation. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'web/product-motion.js'),'utf8'),groups=[];
function test(name,fn){fn();groups.push(name)}
function environment(){
 const animations=[],listeners={},removed=[],nodes=new Map(),state={motion:true,completed:[1],missions:{history:[{id:'original',first:{correct:false}}]}},reduced={matches:false,addEventListener:(n,f)=>listeners.media=f,removeEventListener:(n,f)=>removed.push(['media',n,f])};let off=false;
 function element(name,dataset={}){return {name,dataset,classList:{contains:()=>false},querySelector:selector=>nodes.get(selector)||null,animate(frames,options){const animation={target:this,frames,options,cancelled:false,cancel(){this.cancelled=true},finished:new Promise(()=>{})};animations.push(animation);return animation}}}
 const page=element('actual-page'),pane=element('profile-content'),selected=element('selected-nav'),lumo=element('lumo'),feedback=element('feedback');
 const protectedBand=name=>({classList:{contains:value=>value===name},animate(){throw Error(name+' must stay still')}});
 const main={children:[protectedBand('session-band'),protectedBand('pending-voice'),protectedBand('section-trail'),page],querySelector:selector=>nodes.get(selector)||null};
 const document={hidden:false,documentElement:{classList:{contains:()=>off}},querySelector:selector=>selector==='.mobile-nav [aria-current="page"]'?selected:null,addEventListener:(n,f)=>listeners[n]=f,removeEventListener:(n,f)=>removed.push(['document',n,f])};
 const forbidden=()=>{throw Error('Motion cannot use storage, audio, microphone or permissions')};
 const context={window:{matchMedia:()=>reduced},document,localStorage:{setItem:forbidden,getItem:forbidden},Audio:forbidden,navigator:{mediaDevices:{getUserMedia:forbidden}}};vm.createContext(context);vm.runInContext(source,context);
 const api=context.window.VamosProductMotion.create({state,main});
 return {api,state,main,nodes,page,pane,selected,lumo,feedback,animations,listeners,removed,reduced,document,element,setOff:value=>off=value};
}
test('First identity is quiet; changing an actual profile pane animates only its content',()=>{
 const e=environment();e.nodes.set('[data-profile-panel]',e.element('identity',{profilePanel:'overview'}));e.nodes.set('.profile-content',e.pane);
 assert.equal(e.api.surfaceKey(),'profile:overview');assert.equal(e.api.run({key:'profile|'+e.api.surfaceKey(),kind:'panel'}),false);assert.equal(e.animations.length,0);
 e.nodes.get('[data-profile-panel]').dataset.profilePanel='settings';assert.equal(e.api.run({key:'profile|'+e.api.surfaceKey(),kind:'panel'}),true);assert.equal(e.animations.length,1);assert.equal(e.animations[0].target,e.pane);assert.equal(e.animations[0].options.duration,240);
 e.nodes.delete('.profile-content');e.nodes.get('[data-profile-panel]').dataset.profilePanel='history';assert.equal(e.api.run({key:'profile|'+e.api.surfaceKey(),kind:'panel'}),false);assert.equal(e.animations.length,1);assert.ok(e.animations[0].cancelled);
});
test('Library list and entry identities exclude query, filters, note text and selected words',()=>{
 const e=environment();e.nodes.set('.library',e.element('list'));e.nodes.set('#word-search',{value:''});assert.equal(e.api.surfaceKey(),'library:list');e.api.run({key:'library|'+e.api.surfaceKey()});
 for(const query of ['h','ho','hola']){e.nodes.get('#word-search').value=query;e.nodes.set('#lib-topic',{value:'travel'});assert.equal(e.api.run({key:'library|'+e.api.surfaceKey()}),false)}assert.equal(e.animations.length,0);
 e.nodes.delete('.library');e.nodes.set('[data-lib-detail]',e.element('entry',{libDetail:'phrase-9'}));assert.equal(e.api.surfaceKey(),'library:detail:phrase-9');e.api.run({key:'library|'+e.api.surfaceKey(),kind:'stage'});assert.equal(e.animations[0].target,e.page);
 e.nodes.set('#lib-note',{value:'My edited note'});e.nodes.set('[data-lib-select]',{checked:true});assert.equal(e.api.run({key:'library|'+e.api.surfaceKey()}),false);
 e.nodes.get('[data-lib-detail]').dataset.libDetail='phrase-10';assert.equal(e.api.run({key:'library|'+e.api.surfaceKey(),kind:'stage'}),true);
});
test('Reader book/chapter and return identities change; gloss, translation, answer and search do not',()=>{
 const e=environment();e.nodes.set('.reader-catalog',e.element('catalog'));e.api.run({key:'reader|'+e.api.surfaceKey()});e.nodes.set('#reader-search',{value:'café'});assert.equal(e.api.run({key:'reader|'+e.api.surfaceKey()}),false);
 e.nodes.delete('.reader-catalog');e.nodes.set('[data-reader-book]',e.element('book',{readerBook:'chapter-1'}));assert.equal(e.api.surfaceKey(),'reader:book:chapter-1');assert.equal(e.api.run({key:'reader|'+e.api.surfaceKey(),kind:'stage'}),true);
 for(const selector of ['[data-reader-word]','[data-reader-translate]','[data-reader-answer]']){e.nodes.set(selector,{value:'new',dataset:{selection:'2'}});assert.equal(e.api.run({key:'reader|'+e.api.surfaceKey()}),false)}
 e.nodes.get('[data-reader-book]').dataset.readerBook='chapter-2';assert.equal(e.api.run({key:'reader|'+e.api.surfaceKey(),kind:'stage'}),true);e.nodes.delete('[data-reader-book]');e.nodes.set('.reader-collection',e.element('collection'));assert.equal(e.api.surfaceKey(),'reader:collection');assert.equal(e.api.run({key:'reader|'+e.api.surfaceKey()}),true);
});
test('Speech screen and model choice change identity; consent, transcript and hiding text do not',()=>{
 const e=environment(),active=e.element('active',{speechScreen:'model'}),phrase={value:'0'};e.nodes.set('.speech-screens [data-speech-screen][aria-pressed="true"]',active);e.nodes.set('#speech-phrase',phrase);
 assert.equal(e.api.surfaceKey(),'speech:model:0');e.api.run({key:'speech|'+e.api.surfaceKey()});active.dataset.speechScreen='record';assert.equal(e.api.run({key:'speech|'+e.api.surfaceKey(),kind:'stage'}),true);
 for(const selector of ['#speech-consent','.speech-status','[data-speech-text]']){e.nodes.set(selector,{value:'changed'});assert.equal(e.api.run({key:'speech|'+e.api.surfaceKey()}),false)}
 active.dataset.speechScreen='words';assert.equal(e.api.run({key:'speech|'+e.api.surfaceKey(),kind:'stage'}),true);phrase.value='1';assert.equal(e.api.surfaceKey(),'speech:words:1');assert.equal(e.api.run({key:'speech|'+e.api.surfaceKey(),kind:'stage'}),true);
});
test('Route effects target real content after protected notices and stationary return trail; all effects finite ≤330ms',()=>{
 const e=environment(),before=JSON.stringify(e.state);e.api.run({key:'home'});assert.equal(e.api.run({key:'reader',kind:'screen'}),true);assert.deepEqual(e.animations.map(a=>a.target.name),['actual-page','selected-nav']);
 e.nodes.set('.feedback,.quiz-feedback,.mission-feedback,.library-feedback,.profile-memory',e.feedback);e.nodes.set('.mascot',e.lumo);for(const kind of ['correct','complete','retry'])assert.equal(e.api.react(kind),true);
 assert.ok(e.animations.every(a=>a.options.duration>0&&a.options.duration<=330&&a.options.fill==='none'&&!a.options.iterations));assert.equal(JSON.stringify(e.state),before);assert.equal(e.api.react('unrelated'),false);
});
test('Actual speech route shape skips the navigation trail and never falls back to animating notices alone',()=>{
 const e=environment();e.page.name='section.speech-studio';e.page.classList={contains:name=>name==='speech-studio'};const screen=e.element('speech-screen',{speechScreen:'model'});e.nodes.set('.speech-screens [data-speech-screen][aria-pressed="true"]',screen);e.nodes.set('#speech-phrase',{value:'0'});
 e.api.run({key:'practice:pronunciation:'+e.api.surfaceKey()});screen.dataset.speechScreen='record';assert.equal(e.api.run({key:'practice:pronunciation:'+e.api.surfaceKey()}),true);assert.equal(e.animations[0].target,e.page);assert.equal(e.animations[0].target.name,'section.speech-studio');assert.equal(e.animations[0].options.duration,330);
 e.main.children.pop();const count=e.animations.length;assert.equal(e.api.run({key:'notice-only'}),false);assert.equal(e.animations.length,count);assert.ok(e.animations.every(a=>a.cancelled));e.main.children=[];assert.equal(e.api.run({key:'empty-main'}),false);assert.equal(e.animations.length,count);
});
test('Hidden or reduced-motion events cancel immediately; disabled identities do not replay on return',()=>{
 const e=environment();e.api.run({key:'home'});e.api.run({key:'profile'});e.document.hidden=true;e.listeners.visibilitychange();assert.ok(e.animations.every(a=>a.cancelled));const count=e.animations.length;
 assert.equal(e.api.run({key:'hidden-panel',kind:'panel'}),false);e.document.hidden=false;assert.equal(e.api.run({key:'hidden-panel',kind:'panel'}),false);assert.equal(e.animations.length,count);
 e.api.run({key:'reader'});e.reduced.matches=true;e.listeners.media();assert.ok(e.animations.every(a=>a.cancelled));assert.equal(e.api.react('correct'),false);
});
test('Setting, CSS motion-off and destroy cancel without permission/audio/storage writes',()=>{
 const e=environment();e.api.run({key:'home'});e.api.run({key:'profile'});e.state.motion=false;assert.equal(e.api.run({key:'profile'}),false);assert.ok(e.animations.every(a=>a.cancelled));e.state.motion=true;e.api.run({key:'library'});e.setOff(true);assert.equal(e.api.react('retry'),false);assert.ok(e.animations.every(a=>a.cancelled));
 e.setOff(false);e.api.run({key:'speech'});e.api.destroy();assert.ok(e.animations.every(a=>a.cancelled));assert.equal(e.removed.length,2);assert.equal(e.api.run({key:'destroyed'}),false);assert.equal(e.api.react('complete'),false);
});
test('Surface contract matches actual authored production screens',()=>{
 for(const [file,pattern] of [['profile.js',/class="profile-content" data-profile-panel=/],['reader.js',/data-reader-book=/],['reader.js',/class="page reader-catalog"/],['reader.js',/class="page reader-collection"/],['library.js',/data-lib-detail=/],['library.js',/class="page library"/],['speech.js',/class="speech-screens"/],['speech.js',/data-speech-screen="\$\{id\}" aria-pressed=/],['speech.js',/id="speech-phrase"/]])assert.match(fs.readFileSync(path.join(__dirname,'web',file),'utf8'),pattern);
 assert.equal(environment().api.surfaceKey(),'');
});
test('Actual core wiring consumes one visual response after render with sounds disabled and uses panel identity',()=>{
 const e=environment(),course=fs.readFileSync(path.join(__dirname,'web/course.js'),'utf8'),sound=course.match(/ function sound\(kind\)\{[\s\S]*?(?= function stopAudio\()/)?.[0],hook=course.split(/\r?\n/).find(line=>line.includes('productMotion?.run('));assert(sound,'Actual sound function');assert(hook,'Actual render hook');
 e.nodes.set('[data-profile-panel]',e.element('identity',{profilePanel:'overview'}));e.nodes.set('.profile-content',e.pane);e.nodes.set('.feedback,.quiz-feedback,.mission-feedback,.library-feedback,.profile-memory',e.feedback);e.nodes.set('.mascot',e.lumo);
 const reactions=[],run=[],motion={surfaceKey:e.api.surfaceKey,run:args=>{run.push(args);return e.api.run(args)},react:kind=>{reactions.push(kind);return e.api.react(kind)}},forbidden=()=>{throw Error('Sound disabled must never create audio context')};
 const c={state:{sounds:false},document:e.document,window:{AudioContext:forbidden},productMotion:motion,pendingVisual:null,view:'profile',scene:'profile:',stage:0,introIndex:0,introCycles:[0],lastScene:null,audioContext:null};vm.createContext(c);vm.runInContext(sound+'\nfunction renderMotion(){'+hook+'}',c);
 c.renderMotion();assert.equal(run[0].kind,'panel');assert(run[0].key.includes('profile:overview'));assert.equal(e.animations.length,0);
 e.nodes.get('[data-profile-panel]').dataset.profilePanel='settings';c.renderMotion();assert.equal(e.animations[0].target,e.pane);assert(run[1].key.includes('profile:settings'));
 for(const [soundKind,expected]of [['correct','correct'],['finish','complete'],['wrong','retry']]){const before=reactions.length;c.sound(soundKind);assert.equal(c.pendingVisual,expected);c.renderMotion();assert.equal(c.pendingVisual,null);assert.equal(reactions.length,before+1);assert.equal(reactions.at(-1),expected);c.renderMotion();assert.equal(reactions.length,before+1,'Render cannot repeat consumed response')}
 c.sound('tap');c.renderMotion();assert.equal(reactions.length,3);assert.equal((course.match(/productMotion\?\.react\(/g)||[]).length,1,'Single production reaction consumer; no duplicate core answer effect');
});
const directory=path.join(__dirname,'.impeccable/review-v30');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'motion-check.json'),JSON.stringify({pass:true,groups,limits:'Production-source VM tests validate identity, targets and cancellation. Browser rendering, GPU/compositor timing and physical reduced-motion preferences require root UI verification.'},null,2));console.log(`PASS motion v30: ${groups.length} groups`);
