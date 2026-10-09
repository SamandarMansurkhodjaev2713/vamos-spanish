/* Deferred File.text races exercise the production importer without touching browser data. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'web/progress.js'),'utf8'),results=[];
const copy=x=>JSON.parse(JSON.stringify(x)),button=key=>({hasAttribute:k=>k===key}),payload=(days,extra={})=>JSON.stringify({format:'vamos-backup-v1',state:{completed:days,...extra}});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function environment(){
 const now=Date.now(),state={completed:[3],cards:{},ratings:{3:'retry'},mistakes:{3:1},checkpoints:{},sceneRatings:{},library:{favorites:[],known:[],difficult:[],notes:{}},learning:{events:[],sessions:{}},profile:{nickname:'Саша'},reader:{saved:[],rows:{}},missions:{history:[{first:{correct:false,aided:false,time:now-2000},retries:[{correct:true,aided:false,time:now-1000}]}]}};
 const data={library:{items:[]},expanded:{vocabulary:[],lessons:[]}},calls={save:0,render:0,scroll:0},pass={sanitize:()=>({}),merge(){}},win={},context={window:win,document:{querySelector:()=>({scrollIntoView:()=>calls.scroll++})},Date,Blob,URL,setTimeout};
 vm.createContext(context);vm.runInContext(source,context);const api=win.VamosProgress.create({state,data,save:()=>calls.save++,toast(){},esc:String,icon:()=>'',render:()=>calls.render++,mastery:pass,adaptive:pass,studio:pass,missions:{...pass,merge:base=>base,close(){}},workbook:pass,profile:{sanitize:()=>({nickname:''})},pathway:pass,repair:pass,bridgeReview:pass,libraryPractice:{...pass,merge:base=>base},reader:{sanitize:raw=>({saved:raw?.saved||[],rows:raw?.rows||{}})}});
 const read=d=>api.change({id:'backup-file',files:[{size:100,text:()=>d.promise}]}),apply=()=>api.click(button('data-backup-apply')),cancel=()=>api.click(button('data-backup-cancel'));
 return {api,state,calls,read,apply,cancel};
}
async function test(name,fn){await fn();results.push({name,pass:true})}
(async()=>{
 await test('Only latest selected file can provide the preview and imported days; late valid file stays ignored',async()=>{
  const e=environment(),original=copy(e.state),first=deferred(),second=deferred(),old=e.read(first),latest=e.read(second);assert.match(e.api.html(),/Отменить чтение/);assert.doesNotMatch(e.api.html(),/data-backup-apply/);second.resolve(payload([1,2]));await latest;assert.match(e.api.html(),/Завершённых уроков: 2\. Карточек: 0\./);const renders=e.calls.render,scrolls=e.calls.scroll;first.resolve(payload([8]));await old;assert.match(e.api.html(),/Завершённых уроков: 2\. Карточек: 0\./);assert.equal(e.calls.render,renders);assert.equal(e.calls.scroll,scrolls);assert.deepEqual(e.state,original);assert.equal(e.apply(),true);assert.deepEqual(Array.from(e.state.completed),[1,2,3]);assert.equal(e.state.ratings[3],'retry');assert.deepEqual(e.state.missions,original.missions);
 });
 await test('Late old read rejection cannot remove the latest ready preview or show an irrelevant error',async()=>{
  const e=environment(),first=deferred(),second=deferred(),old=e.read(first),latest=e.read(second);second.resolve(payload([1,2]));await latest;first.reject(Error('old failed'));await old;assert.match(e.api.html(),/Завершённых уроков: 2\. Карточек: 0\./);assert.doesNotMatch(e.api.html(),/old failed|Не удалось прочитать/);
 });
 await test('Newest invalid file wins; an older successful file cannot resurrect a previously selected preview',async()=>{
  const e=environment(),first=deferred(),second=deferred(),old=e.read(first),latest=e.read(second);second.resolve('{');await latest;assert.match(e.api.html(),/Не удалось прочитать/);first.resolve(payload([1,2]));await old;assert.doesNotMatch(e.api.html(),/data-backup-apply/);assert.match(e.api.html(),/Не удалось прочитать/);assert.deepEqual(Array.from(e.state.completed),[3]);
 });
 await test('Cancel during file read prevents a later successful result from resurfacing or mutating any progress',async()=>{
  const e=environment(),before=copy(e.state),d=deferred(),pending=e.read(d);assert.match(e.api.html(),/data-backup-cancel/);e.cancel();assert.match(e.api.html(),/Импорт отменён/);const renders=e.calls.render;d.resolve(payload([1,2]));await pending;assert.match(e.api.html(),/Импорт отменён/);assert.doesNotMatch(e.api.html(),/data-backup-apply/);assert.equal(e.calls.render,renders);assert.equal(e.apply(),false);assert.deepEqual(e.state,before);
 });
 await test('Cancelled read rejection stays cancelled and a fresh selection after cancel is importable',async()=>{
  const e=environment(),d=deferred(),pending=e.read(d);e.cancel();d.reject(Error('cancelled file error'));await pending;assert.match(e.api.html(),/Импорт отменён/);assert.doesNotMatch(e.api.html(),/cancelled file error/);const newer=deferred(),read=e.read(newer);newer.resolve(payload([1]));await read;assert.match(e.api.html(),/Завершённых уроков: 1\. Карточек: 0\./);assert.equal(e.apply(),true);assert.deepEqual(Array.from(e.state.completed),[1,3]);
 });
 await test('A newly selected pending file removes the old Apply action; a stale Apply click cannot import old data',async()=>{
  const e=environment(),ready=deferred(),read=e.read(ready);ready.resolve(payload([1,2]));await read;assert.match(e.api.html(),/data-backup-apply/);const newer=deferred(),pending=e.read(newer);assert.doesNotMatch(e.api.html(),/data-backup-apply/);assert.equal(e.apply(),false);assert.deepEqual(Array.from(e.state.completed),[3]);newer.resolve(payload([4]));await pending;assert.equal(e.apply(),true);assert.deepEqual(Array.from(e.state.completed),[3,4]);
 });
 await test('After latest file Apply, older reads cannot re-open a preview or overwrite the confirmation',async()=>{
  const e=environment(),first=deferred(),second=deferred(),old=e.read(first),latest=e.read(second);second.resolve(payload([2]));await latest;e.apply();assert.match(e.api.html(),/Прогресс объединён/);first.resolve(payload([1]));await old;assert.doesNotMatch(e.api.html(),/data-backup-apply/);assert.match(e.api.html(),/Прогресс объединён/);assert.deepEqual(Array.from(e.state.completed),[2,3]);
 });
 await test('Oversize and wrong-format files fail without reading excess data or modifying learner evidence',async()=>{
  const e=environment(),before=copy(e.state);let reads=0;await e.api.change({id:'backup-file',files:[{size:8388609,text:async()=>{reads++;return payload([1])}}]});assert.equal(reads,0);assert.match(e.api.html(),/Файл слишком большой/);await e.api.change({id:'backup-file',files:[{size:100,text:async()=>JSON.stringify({format:'other',state:{completed:[1]}})}]});assert.match(e.api.html(),/Выбери файл, сохранённый/);assert.deepEqual(e.state,before);
 });
 const dir=path.join(__dirname,'.impeccable/review-v29');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'backup-check.json'),JSON.stringify({pass:true,groups:results,limits:'Production async importer in VM. Merge models are stubbed to preserve existing state; earliest-answer merge and browser focus are separately tested by other suites. No user files or storage modified.'},null,2));console.log(`PASS ${results.length} backup async/import groups`);
})().catch(e=>{console.error(e);process.exitCode=1});
