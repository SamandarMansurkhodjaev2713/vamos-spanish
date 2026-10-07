/* Independent finite context witnesses: no claim about spontaneous speech. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const data={missions:JSON.parse(fs.readFileSync('mission-data.json','utf8'))};
const clips=JSON.parse(fs.readFileSync('web/assets/audio/ATTRIBUTION.json','utf8'));
const source=fs.readFileSync('web/missions.js','utf8');
const button=(name,value='')=>({dataset:{[name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:a=>a===name});
let witnesses=0;
function witness(day,variant,step,text,status,refuse=false){
 const ctx={window:{},console};vm.createContext(ctx);vm.runInContext(source,ctx);
 const app=ctx.window.VamosMissions.create({state:{},data,esc:String,save(){},render(){},toast(){}});app.start(day,{variant});
 const answer=value=>{app.input({value,hasAttribute:a=>a==='data-mission-answer'});app.change(button('data-mission-oral','typed'));app.click(button('data-mission-check'))};
 for(let i=0;i<step;i++){answer(refuse&&app.current.content.branch?'No, gracias.':app.current.content.rule.forms[0]);app.click(button('data-mission-next'))}
 answer(text);assert.equal(app.current.session.responses[step].latest.status,status,`${variant}, turn ${step+1}: ${text}`);witnesses++;
}
let repeats=0,evenings=0,tomorrows=0,transcripts=0;
for(const d of data.missions.days)for(const v of d.variants)for(let i=0;i<v.turns.length;i++){
 const turn=v.turns[i];
 for(const t of [turn,...Object.values(turn.branch||{}).map(b=>b.turn)]){assert.equal(t.partner.es,clips[t.partner.audio]?.text);transcripts++}
 if(d.day===3&&['d03-train-a','d03-control-a'].includes(v.id)&&i===2){assert.equal(turn.partner.es,'Me llamo Andrea.');assert.equal(turn.partner.audio,'788477');assert.notEqual(turn.partner.es,'Más despacio.');assert.notEqual(turn.partner.es,'¿Podrías repetir eso?');witness(d.day,v.id,i,'Gracias.','supported');witness(d.day,v.id,i,'Más despacio.','unknown');repeats++}
 if(turn.prompt.includes('вечер')){assert(turn.rule.forms.every(f=>!f.startsWith('Ayer ')));assert(turn.examples.every(f=>!f.startsWith('Ayer ')));assert(turn.rule.forms.some(f=>f.startsWith('Anoche ')));witness(d.day,v.id,i,turn.rule.forms[0],'supported');witness(d.day,v.id,i,turn.rule.forms[0].replace(/^Anoche /,'Ayer '),'unknown');evenings++}
 if(turn.branch?.refuse?.turn.prompt.includes('завтра')){const refused=turn.branch.refuse;assert(!refused.turn.rule.forms.includes('¿Quieres agua?'));assert(!refused.turn.examples.includes('¿Quieres agua?'));witness(d.day,v.id,refused.next,'¿Nos vemos mañana?','supported',true);witness(d.day,v.id,refused.next,'¿Quieres agua?','unknown',true);tomorrows++}
}
assert.equal(repeats,2);assert.equal(evenings,8);assert.equal(tomorrows,10);assert.equal(witnesses,40);assert.equal(transcripts,398);
console.log(JSON.stringify({passed:true,changedTurns:20,repeatedNativeClip:repeats,eveningContexts:evenings,tomorrowBranches:tomorrows,positiveAndNegativeWitnesses:witnesses,sourceTranscriptReferences:transcripts}));
