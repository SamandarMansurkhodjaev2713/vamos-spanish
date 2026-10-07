const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const source=fs.readFileSync('web/identity.js','utf8'),tick=()=>new Promise(r=>setTimeout(r,0));
function harness(options={}){
 const win=new EventTarget(),doc=new EventTarget(),favicon={href:''},manifest={href:''},messages=[],notifications=[],badges=[],intervals=[];
 win.isSecureContext=options.secure!==false;win.matchMedia=()=>({matches:options.installed!==false});win.setInterval=fn=>{intervals.push(fn);return 1};
 class Notification{static permission=options.permission||'default';static async requestPermission(){notifications.push('permission');if(options.permissionError)throw Error('permission');return Notification.permission=options.requestResult||'denied'}constructor(title,props){if(options.notifyError)throw Error('notify');notifications.push({title,props})}close(){}}
 if(options.supported!==false)win.Notification=Notification;
 doc.hidden=options.hidden===true;doc.querySelector=s=>s==='link[rel="icon"]'?favicon:s==='link[rel="manifest"]'?manifest:null;doc.querySelectorAll=()=>[];doc.head={appendChild(){}};doc.createElement=()=>({});
 const nav={onLine:options.online!==false,setAppBadge:async n=>{badges.push(n);if(options.badgeError)throw Error('badge')},clearAppBadge:async()=>{badges.push(0);if(options.badgeError)throw Error('badge')}};
 if(options.worker)nav.serviceWorker={getRegistration:async()=>({showNotification:async(title,props)=>{if(options.notifyError)throw Error('notify');notifications.push({title,props})}})};
 const state={completed:[],identity:{time:'00:00',...(options.identity||{})}},context={view:'home',stage:0},keys=['a','b'];let saves=0;
 const ctx={window:win,document:doc,navigator:nav,location:new URL('https://example.com/course/'),URL,Date,console};vm.createContext(ctx);vm.runInContext(source,ctx);
 const identity=win.VamosIdentity.create({state,esc:String,save(){saves++},toast:m=>messages.push(m),dueKeys:()=>keys,context:()=>context,render(){}});
 const click=key=>identity.click({getAttribute:k=>k==='data-identity-pose'&&key.startsWith('pose:')?key.slice(5):null,hasAttribute:k=>k===key});
 return {identity,click,Notification,win,doc,nav,state,context,keys,messages,notifications,badges,intervals,favicon,manifest,get saves(){return saves}};
}
(async()=>{
 // Pass 1: permissions denied, dismissed, unavailable, or rejected never enable reminders.
 for(const options of [{requestResult:'denied'},{requestResult:'default'},{permissionError:true},{supported:false},{secure:false}]){const h=harness(options);h.click('data-identity-reminder');await tick();assert.equal(h.state.identity.reminder,false);assert.equal(h.notifications.filter(n=>typeof n==='object').length,0);assert.match(h.identity.html(),/Когда сайт закрыт или свёрнут/)}
 const denied=harness({permission:'denied'});assert.match(denied.identity.html(),/Уведомления запрещены/);
 // Pass 2: reminder is visible-page-only, once per local day, and concurrent sync is deduplicated.
 const h=harness({permission:'granted',identity:{reminder:true},worker:true});await Promise.all([h.identity.sync(),h.identity.sync()]);assert.equal(h.notifications.length,1);assert.match(h.notifications[0].props.body,/2 карточек/);assert.match(h.state.identity.lastDate,/^\d{4}-\d{2}-\d{2}$/);await h.identity.sync();h.intervals[0]();await tick();assert.equal(h.notifications.length,1);
 const hidden=harness({permission:'granted',hidden:true,identity:{reminder:true}});await hidden.identity.sync();assert.equal(hidden.notifications.length,0);assert.equal(hidden.state.identity.lastDate,'');hidden.doc.hidden=false;await hidden.identity.sync();assert.equal(hidden.notifications.length,1);
 const reload=harness({permission:'granted',identity:{reminder:true,lastDate:h.state.identity.lastDate}});await reload.identity.sync();assert.equal(reload.notifications.length,0);
 const broken=harness({permission:'granted',notifyError:true,identity:{reminder:true}});await broken.identity.sync();await broken.identity.sync();assert.equal(broken.messages.length,1);assert.match(broken.identity.html(),/не смог показать/);
 // Pass 3: opt-in badge, installed context, errors, due count, and clear-on-disable.
 const badge=harness();await badge.identity.sync();assert.deepEqual(badge.badges,[0]);badge.identity.change({id:'identity-badge',checked:true});await tick();assert.deepEqual(badge.badges,[0,2]);badge.keys.pop();await badge.identity.sync();assert.equal(badge.badges.at(-1),1);badge.identity.change({id:'identity-badge',checked:false});await tick();assert.equal(badge.badges.at(-1),0);
 const refused=harness({badgeError:true,identity:{badge:true}});await refused.identity.sync();await refused.identity.sync();assert.deepEqual(refused.badges,[2]);assert.match(refused.identity.html(),/не разрешила обновить/);
 const tab=harness({installed:false,identity:{badge:true}});await tab.identity.sync();assert.deepEqual(tab.badges,[]);
 // Pass 4: session favicon reacts to study state; install choice uses a separate manifest.
 const icon=harness();await icon.identity.sync();assert.match(icon.favicon.href,/think\.png$/);icon.keys.length=0;await icon.identity.sync();assert.match(icon.favicon.href,/wave\.png$/);icon.context.view='lesson';icon.context.stage=7;await icon.identity.sync();assert.match(icon.favicon.href,/joy\.png$/);icon.context.view='home';icon.context.stage=0;icon.state.completed=[1,2,3,4,5];await icon.identity.sync();assert.match(icon.favicon.href,/proud\.png$/);assert(icon.click('pose:joy'));assert.match(icon.manifest.href,/manifest-lumo-joy\.webmanifest$/);assert.equal(icon.state.identity.installPose,'joy');const off=harness({online:false});assert.match(off.identity.html(),/Без сети/);
 // Pass 5: PNG dimensions, all pose variants, source provenance and same PWA id.
 const pngSize=file=>{const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)]};
 const manifest=JSON.parse(fs.readFileSync('web/manifest.webmanifest'));assert.equal(manifest.theme_color,'#465c4c');assert.equal(manifest.shortcuts.length,4);
 for(const pose of ['wave','joy','think','proud']){assert.deepEqual(pngSize(`web/assets/favicon-lumo-${pose}.png`),[64,64]);const variant=JSON.parse(fs.readFileSync(`web/manifest-lumo-${pose}.webmanifest`));assert.equal(variant.id,manifest.id);for(const size of [192,512]){assert.deepEqual(pngSize(`web/assets/app-icon-lumo-${pose}-${size}.png`),[size,size]);assert(variant.icons.some(i=>i.src===`assets/app-icon-lumo-${pose}-${size}.png`))}}
 for(const size of [192,512])assert.deepEqual(pngSize(`web/assets/app-icon-lumo-${size}.png`),[size,size]);
 const provenance=JSON.parse(fs.readFileSync('identity-assets-v13.json'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(provenance.source)).digest('hex'),provenance.sourceSHA256);assert.equal(Object.keys(provenance.crops).length,4);assert(source.includes('Когда сайт закрыт или свёрнут'));assert(!source.includes('pushManager.subscribe'));
 console.log('PASS identity v13: five critical passes — permissions, visible reminder deduplication, badge failure/clear, dynamic favicon, icon provenance and manifests.');
})().catch(e=>{console.error(e);process.exit(1)});
