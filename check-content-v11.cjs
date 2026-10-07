/* A bounded text checker must not endorse disagreement or an unrelated task.
   Unknown means outside the prepared model, not universally invalid Spanish. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const data={missions:JSON.parse(fs.readFileSync('mission-data.json','utf8'))};
const source=fs.readFileSync('web/missions.js','utf8');
const button=(name,value='')=>({dataset:{[name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:value},hasAttribute:a=>a===name});
let checks=0;
function witness(day,variant,step,text,expected){
 const context={window:{},console};vm.createContext(context);vm.runInContext(source,context);
 const app=context.window.VamosMissions.create({state:{},data,esc:String,save(){},render(){},toast(){}});
 app.start(day,{variant});
 function answer(value){app.input({value,hasAttribute:a=>a==='data-mission-answer'});app.change(button('data-mission-oral','typed'));app.click(button('data-mission-check'));}
 for(let i=0;i<step;i++){answer(app.current.content.rule.forms[0]);app.click(button('data-mission-next'));}
 answer(text);const result=app.current.session.responses[step].latest;
 assert.equal(result.status,expected,`${variant}: ${text}`);checks++;
}
for(const day of data.missions.days)for(const v of day.variants)for(let i=0;i<v.turns.length;i++){
 if(v.turns[i].rule.kind!=='reason'||!v.turns[i].rule.patterns.length)continue;
 witness(day.day,v.id,i,'Me gusta leer porque es interesante.','supported');
 witness(day.day,v.id,i,'Me gusta viajar porque es divertido.','supported');
 witness(day.day,v.id,i,'Me gusta la música porque es divertido.','unknown');
 witness(day.day,v.id,i,'Me gusta agua porque es divertido.','unknown');
 witness(day.day,v.id,i,'Me gusta la música porque es divertida.',day.day===14?'unknown':'supported');
 // This is correct Spanish, but day14 explicitly asks about reading/travel.
 witness(day.day,v.id,i,'Prefiero el café porque es interesante.',day.day===10?'supported':'unknown');
 witness(day.day,v.id,i,'Me fascina leer porque descubro nuevas ideas.','unknown');
 witness(day.day,v.id,i,'Me gusta leer.','missing');
}
console.log(JSON.stringify({passed:true,checks,changedReasonRules:8,limits:'Finite supported models; unknown responses are not classified as grammatical errors. No acoustic or learning efficacy claim.'}));
