/* Finite capability tests; no screenshots and no real OS permission claims. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('web/native.js','utf8'),tick=()=>new Promise(r=>setTimeout(r,0));
function harness({share,copy,fullscreen=false,day=1,url='http://127.0.0.1:8768/?private=secret'}={}){
 const win=new EventTarget(),doc=new EventTarget(),media=new EventTarget(),messages=[],shared=[],copied=[],nodes=new Map();
 const button=()=>({disabled:false,textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v}});
 for(const id of ['native-network-status','native-feature-status','native-lesson-link'])nodes.set(id,{textContent:'',value:''});
 const shareButton=button(),screenButton=button();
 doc.getElementById=id=>nodes.get(id);doc.querySelector=()=>null;doc.querySelectorAll=s=>s==='[data-native-share]'?[shareButton]:s==='[data-native-fullscreen]'?[screenButton]:[];
 let requests=0,exits=0;
 doc.documentElement={};doc.fullscreenEnabled=fullscreen;doc.fullscreenElement=null;
 if(fullscreen){doc.documentElement.requestFullscreen=async()=>{requests++;doc.fullscreenElement=doc.documentElement;doc.dispatchEvent(new Event('fullscreenchange'))};doc.exitFullscreen=async()=>{exits++;doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'))}}
 media.matches=false;
 const nav={onLine:true};if(share)nav.share=async payload=>{shared.push(payload);return share(payload)};if(copy)nav.clipboard={writeText:async text=>{copied.push(text);return copy(text)}};
 const parsed=new URL(url),ctx={window:win,document:doc,navigator:nav,location:parsed,matchMedia:()=>media,URL,console};vm.createContext(ctx);vm.runInContext(source,ctx);
 const native=win.VamosNative.create({state:{day,profile:{name:'PRIVATE'},native:{}},data:{expanded:{audio:{}}},esc:String,icon:()=>'',save(){},toast:t=>messages.push(t),activeLesson:()=>false});
 const click=key=>native.click({hasAttribute:k=>k===key});
 return {native,click,win,doc,nav,messages,shared,copied,nodes,shareButton,screenButton,get requests(){return requests},get exits(){return exits}};
}
(async()=>{
 const passed=[];
 let h=harness({share:async()=>{},day:22});assert.equal(h.shared.length,0);h.click('data-native-share');await tick();assert.equal(h.shared.length,1);const payload=h.shared[0],url=new URL(payload.url);assert.equal(url.origin,'https://samandarmansurkhodjaev2713.github.io');assert.equal(url.pathname,'/vamos-spanish/');assert.deepEqual([...url.searchParams],[['view','lesson'],['day','22']]);assert.deepEqual(Object.keys(payload).sort(),['title','url']);assert.match(h.messages.at(-1),/передана/);passed.push('Explicit share contains only public day URL and title, with no automatic sharing');
 h=harness({share:async()=>{throw Object.assign(Error(),{name:'AbortError'})},copy:async()=>{}});h.click('data-native-share');await tick();assert.match(h.messages.at(-1),/отменена/);assert.equal(h.copied.length,0);assert(!h.shareButton.disabled);passed.push('Cancelled share does not silently copy or claim success');
 h=harness({share:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'})}});h.click('data-native-share');await tick();assert.match(h.messages.at(-1),/Не удалось отправить/);passed.push('Share denial reports failure');
 h=harness({copy:async()=>{},day:100,url:'https://samandarmansurkhodjaev2713.github.io/vamos-spanish/?profile=private#secret'});h.click('data-native-share');await tick();assert.equal(new URL(h.copied[0]).search,'?view=lesson&day=30');assert.match(h.messages.at(-1),/скопирована/);passed.push('Clipboard fallback is explicit, clamps day and clears query/hash');
 h=harness({copy:async()=>{throw Error('denied')},day:-1});h.click('data-native-share');await tick();assert.equal(new URL(h.copied[0]).searchParams.get('day'),'1');assert.match(h.messages.at(-1),/Не удалось скопировать/);passed.push('Clipboard refusal never reports success');
 h=harness();assert(h.native.html().includes('readonly'));h.click('data-native-share');await tick();assert.match(h.messages.at(-1),/Скопируй/);h.click('data-native-fullscreen');await tick();assert.match(h.messages.at(-1),/недоступен/);assert.equal(h.screenButton.attrs['aria-pressed'],'false');passed.push('Absent capabilities offer manual URL and clear fullscreen unsupported state');
 h=harness({fullscreen:true});assert.equal(h.requests,0);h.click('data-native-fullscreen');await tick();assert.equal(h.requests,1);assert.equal(h.screenButton.attrs['aria-pressed'],'true');assert.match(h.screenButton.textContent,/Выйти/);h.doc.fullscreenElement=null;h.doc.dispatchEvent(new Event('fullscreenchange'));assert.equal(h.screenButton.attrs['aria-pressed'],'false');h.click('data-native-fullscreen');await tick();h.click('data-native-fullscreen');await tick();assert.equal(h.exits,1);assert.equal(h.screenButton.attrs['aria-pressed'],'false');passed.push('Fullscreen only by click; OS escape and explicit exit refresh button state');
 h=harness({fullscreen:true});h.doc.documentElement.requestFullscreen=async()=>{throw Error('denied')};h.click('data-native-fullscreen');await tick();assert.equal(h.screenButton.attrs['aria-pressed'],'false');assert(!h.screenButton.disabled);assert.match(h.messages.at(-1),/не разрешил/);passed.push('Fullscreen denial leaves the actual state and retry available');
 h=harness();h.nav.onLine=false;h.win.dispatchEvent(new Event('offline'));assert.match(h.nodes.get('native-network-status').textContent,/без интернета/);h.nav.onLine=true;h.win.dispatchEvent(new Event('online'));assert.match(h.nodes.get('native-network-status').textContent,/соединение с сетью/);passed.push('Network indicators refresh on offline/online without claiming server reachability');
 fs.mkdirSync('.impeccable/review-v11',{recursive:true});fs.writeFileSync('.impeccable/review-v11/native-verification.json',JSON.stringify({passed:true,cases:passed,limits:'Mock capability transitions; not a real OS share sheet or mobile fullscreen guarantee.'},null,2));console.log('PASS native v11:',passed.length,'capability/failure cases');
})().catch(e=>{console.error(e);process.exit(1)});
