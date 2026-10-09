/* Independent finite source, meaning and persisted-evidence witnesses for days13/16. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
// Pinned starting HEAD: the baseline must survive committing this review later.
const root=__dirname,revision='f18373bdcfd4c71017b106f9f46f40e7d2eff6e0',read=f=>fs.readFileSync(path.join(root,f),'utf8'),json=f=>JSON.parse(read(f));
const plain=x=>JSON.parse(JSON.stringify(x)),original=JSON.parse(execFileSync('git',['show',revision+':mission-data.json'],{cwd:root,encoding:'utf8',maxBuffer:12*1024*1024}));
const missions=json('mission-data.json'),guidance=json('course-guidance.json'),source=read('web/missions.js'),attr=json('web/assets/audio/ATTRIBUTION.json');
const report={passed:false,baseline:revision,scope:'Eight versioned13/16 scenes; finite semantic boundaries, unchanged starting HEAD data outside6/13/16, original audio identity, old first evidence and existing invitation intent routing.',checks:[],limits:'Prepared text, local source identity and persistence only. No acoustic, CEFR or learning-effect measurement.'};
const button=(name,value='')=>({dataset:{[name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:a=>a===name});
function harness(saved,data=missions){const state={missions:saved&&plain(saved)},ctx={window:{},console};vm.createContext(ctx);vm.runInContext(source,ctx);const app=ctx.window.VamosMissions.create({state,data:{missions:data,guidance},esc:String,save(){},render(){},toast(){}});return {app,state};}
function answer(h,text){h.app.input({value:text,hasAttribute:a=>a==='data-mission-answer'});h.app.change(button('data-mission-oral','typed'));h.app.click(button('data-mission-check'));return plain(h.app.current.session.responses[h.app.current.step].latest);}
const next=h=>h.app.click(button('data-mission-next'));
function at(day,id,step=0,data=missions){const h=harness(undefined,data);assert(h.app.start(day,{variant:id,resume:false}));assert.equal(h.app.current.variant,id);for(let i=0;i<step;i++){answer(h,h.app.current.content.rule.forms[0]);next(h);}return h;}
let semanticCount=0;
function semantic(day,id,step,text,expected){const h=at(day,id,step);assert.equal(answer(h,text).status,expected,id+' '+step+' '+text);semanticCount++;}
function check(name,fn){const detail=fn();report.checks.push({name,...detail});}
try{
 check('Strict HEAD baseline and exact legacy objects',()=>{
  const changed=[6,13,16];assert.equal(missions.days.length,original.days.length);
  for(const d of original.days){const now=missions.days.find(x=>x.day===d.day);if(!changed.includes(d.day)){assert.deepEqual(now,d,'Unchanged day'+d.day);continue;}assert.equal(now.day,d.day);assert.equal(now.title,d.title);assert.equal(now.variants.length,d.variants.length);}
  const expected=[...original.legacyVariants];for(const day of [13,16])for(const v of original.days.find(d=>d.day===day).variants){const replacement=missions.days.find(d=>d.day===day).variants.find(n=>n.supersedes===v.id);assert(replacement,v.id);assert.equal(replacement.id,`d${day}-${v.mode}-${v.id.includes('-a')?'a':'b'}-v30`);assert.equal(replacement.mode,v.mode);assert.equal(replacement.turns.length,3);expected.push({...v,day});}
  // Root's pre-existing v29 day6 repeat correction is the only separate HEAD change allowed.
  const old6=original.days.find(d=>d.day===6),new6=missions.days.find(d=>d.day===6);
  for(const v of old6.variants){if(v.id!=='d06-train-a'){assert.deepEqual(new6.variants.find(n=>n.id===v.id),v);continue;}const n=new6.variants.find(n=>n.id==='d06-train-a-v29');assert.equal(n.supersedes,v.id);for(const k of ['mode','goal','context','outcome'])assert.equal(n[k],v[k]);assert.deepEqual(n.turns.slice(0,2),v.turns.slice(0,2));assert.deepEqual(n.turns[2].partner,{audio:'636979',es:'Hablo español.',ru:'Я говорю по-испански.'});assert.deepEqual(n.turns[2].rule,v.turns[2].rule);assert.deepEqual(n.turns[2].examples,v.turns[2].examples);expected.push({...v,day:6});}
  const sort=a=>[...a].sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(sort(missions.legacyVariants),sort(expected));
  for(const k of Object.keys(original).filter(k=>!['days','legacyVariants'].includes(k)))assert.deepEqual(missions[k],original[k]);
  assert.equal(new Set(missions.days.flatMap(d=>d.variants.map(v=>v.id))).size,120);
  return {unrelatedDays:27,archived13and16:8,preExistingDay6Correction:true};
 });
 check('Original captions, Russian meanings and bytes including every branch',()=>{
  const expanded=json('course-expanded.json'),clips=Object.fromEntries(expanded.lessons.flatMap(d=>d.examples.map(p=>[p.audio,p])));let references=0;
  for(const d of missions.days)for(const v of d.variants)for(const turn of v.turns)for(const t of [turn,...Object.values(turn.branch||{}).map(x=>x.turn)]){const a=attr[t.partner.audio];assert(a);assert.equal(t.partner.es,a.text);if([13,16].includes(d.day))assert.equal(t.partner.ru,clips[t.partner.audio].ru,'New Russian caption retains source meaning');assert.equal(a.unaltered,true);const bytes=fs.readFileSync(path.join(root,'web',a.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);references++;}
  return {references};
 });
 check('Frequency meaning and asking an unknown interest in all13 variants',()=>{
  for(const mode of ['train','control'])for(const letter of ['a','b']){const id=`d13-${mode}-${letter}-v30`,v=missions.days.find(d=>d.day===13).variants.find(v=>v.id===id),f=mode==='train'?1:0,q=mode==='train'?2:1;
   semantic(13,id,f,'A veces voy a pie.','supported');semantic(13,id,f,'A veces desayuno aquí.','supported');semantic(13,id,f,'Normalmente voy a pie.','unknown');semantic(13,id,f,'Me gusta viajar.','unknown');semantic(13,id,f,'Sí, a veces.','unknown');
   assert(['Normalmente voy a pie.','Normalmente desayuno aquí.'].includes(v.turns[f].partner.es));assert.equal(v.turns[q].partner.es,'Me gusta viajar.');const object=mode==='control'&&letter==='b'?'leer':'la música';
   semantic(13,id,q,`¿Te gusta ${object}?`,'supported');semantic(13,id,q,`¿Y tú, te gusta ${object}?`,'supported');semantic(13,id,q,'¿Te gusta viajar?','unknown');semantic(13,id,q,'Me gusta la música.','unknown');
   assert(!v.turns.slice(0,q).some(t=>t.partner.es.includes('música')||t.partner.es.includes('leer')),'Asked interest is still unknown');
  }return {variantCount:4,semanticWitnesses:36};
 });
 check('Different positive/negative reactions and reason intent in all16 variants',()=>{
  for(const mode of ['train','control'])for(const letter of ['a','b']){const id=`d16-${mode}-${letter}-v30`,v=missions.days.find(d=>d.day===16).variants.find(v=>v.id===id),positive=mode==='control'&&letter==='a'?1:0,negative=1-positive;
   assert(['Estoy contento.','Estoy contenta.'].includes(v.turns[positive].partner.es));assert.equal(v.turns[negative].partner.es,'No puedo.');assert.match(v.context,/встреч/);assert.match(v.turns[negative].explanation,/возможности/);
   semantic(16,id,positive,'¡Qué bien!','supported');semantic(16,id,positive,'Lo siento.','unknown');semantic(16,id,positive,'No puedo.','unknown');
   semantic(16,id,negative,'Lo siento.','supported');semantic(16,id,negative,'¡Qué bien!','unknown');semantic(16,id,negative,'No quiero.','unknown');
   assert(['Me gusta viajar.','Prefiero leer.'].includes(v.turns[2].partner.es));semantic(16,id,2,'¿Por qué?','supported');semantic(16,id,2,'¡Qué interesante! ¿Por qué?','supported');semantic(16,id,2,'Porque es interesante.','unknown');semantic(16,id,2,'¿Y por qué no?','unknown');
  }return {variantCount:4,semanticWitnesses:40};
 });
 check('Every authored form accepted, wrong-first evidence remains locked',()=>{let forms=0;
  for(const day of [13,16])for(const v of missions.days.find(d=>d.day===day).variants){const h=at(day,v.id);for(let i=0;i<v.turns.length;i++){const first=answer(h,'Estoy pensando en otra cosa.');assert.equal(first.status,'unknown');for(const form of v.turns[i].rule.forms){assert.equal(answer(h,form).status,'supported');assert.deepEqual(plain(h.app.current.session.responses[i].first),first);forms++;}next(h);}assert(h.app.current.completed);const history=plain(h.app.sanitize(h.state.missions).history);assert.deepEqual(plain(harness(h.state.missions).state.missions.history),history);}return {forms,firstLocked:24};});
 check('Exact old histories and in-progress sessions resume archived variants',()=>{let resumed=0,histories=0;
  for(const day of [13,16])for(const v of original.days.find(d=>d.day===day).variants){const fixture={...original,days:[{day,title:'Original fixture',variants:[v]}]},h=at(day,v.id,0,fixture);const first=answer(h,v.turns[0].rule.forms[0]);next(h);const reloaded=harness(h.state.missions);assert(reloaded.app.start(day,{variant:v.id,control:v.mode==='control'}));assert.equal(reloaded.app.current.variant,v.id);assert.equal(reloaded.app.current.step,1);assert.deepEqual(plain(reloaded.app.current.session.responses[0].first),first);assert.deepEqual(plain(reloaded.app.current.content),v.turns[1]);resumed++;
   while(!h.app.current.completed){answer(h,h.app.current.content.rule.forms[0]);next(h);}const before=plain(h.app.sanitize(h.state.missions).history);assert.deepEqual(plain(harness(h.state.missions).state.missions.history),before);histories++;
  }return {resumed,histories};
 });
 check('Existing refusal/acceptance intent branches18/19 remain usable',()=>{let routes=0;
  for(const day of [18,19])for(const letter of ['a','b'])for(const intent of ['accept','refuse']){const id=`d${day}-control-${letter}`,h=at(day,id);const first=answer(h,'Prefiero pensarlo un momento.');assert.equal(first.intent,null);next(h);assert.equal(h.app.current.step,0);h.app.change(button('data-mission-intent',intent));next(h);const branch=missions.days.find(d=>d.day===day).variants.find(v=>v.id===id).turns[0].branch[intent].turn;assert.deepEqual(plain(h.app.current.content),branch);assert.equal(answer(h,branch.rule.forms[0]).status,'supported');assert.deepEqual(plain(h.app.current.session.responses[0].first),first);routes++;}return {routes};
 });
 check('Training preparation contracts; controls retain no training preparation',()=>{
  const expected={13:[{step:1,forms:['A veces voy a pie.','A veces desayuno aquí.']}],16:[{step:0,forms:['¡Qué bien!']},{step:1,forms:['Lo siento.']}]};let frames=0;
  for(const day of [13,16]){const prep=guidance.lessons.find(d=>d.day===day).missionPrep||[];for(const p of expected[day]){const item=prep.find(x=>x.step===p.step);assert(item,`Root integration missionPrep day${day} step${p.step}`);for(const form of p.forms)assert(item.frames.some(f=>f.es===form),form);for(const v of missions.days.find(d=>d.day===day).variants.filter(v=>v.mode==='train'))for(const frame of item.frames){semantic(day,v.id,p.step,frame.es,'supported');if(frame.audio)assert.equal(frame.es,attr[frame.audio].text,'Whole original preparation recording');frames++;}}
   const control=missions.days.find(d=>d.day===day).variants.find(v=>v.mode==='control'),h=at(day,control.id);assert(!h.app.html().includes('mission-preparation'));}
  return {frames};
 });
 report.semanticWitnesses=semanticCount;report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
report.hash=crypto.createHash('sha256').update(read('mission-data.json')).digest('hex');
fs.mkdirSync(path.join(root,'.impeccable/review-v30'),{recursive:true});fs.writeFileSync(path.join(root,'.impeccable/review-v30/mission-path-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
