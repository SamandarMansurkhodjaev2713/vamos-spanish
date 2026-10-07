/* Finite model-transfer witnesses through the real pathway checker. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const content=JSON.parse(fs.readFileSync('pathway-data.json','utf8'));
const source=fs.readFileSync('web/pathway.js','utf8');
const norm=s=>s.normalize('NFC').toLocaleLowerCase('es').replace(/[¿?¡!.,;:]/g,'').replace(/\s+/g,' ').trim();
const expectedFacts=new Map([
 [31,'lejos de'],[32,'ventana pequeña'],[33,'debajo de'],[34,'mis llaves'],[35,'muy tranquilos'],[36,'a las nueve'],[37,'al mercado'],[38,'a la izquierda'],[39,'giras a la derecha'],[40,'tres euros'],[41,'pan y queso'],[42,'un kilo'],[43,'me queda grande'],[44,'en efectivo'],[45,'esta camisa'],[46,'después de salir'],[47,'más temprano'],[48,'Antes de comer'],[49,'A veces'],[50,'el desayuno'],[51,'El domingo'],[52,'paseo mañana'],[53,'Hoy estoy libre'],[54,'menos tranquilo'],[55,'en autobús'],[56,'dos libros cortos'],[57,'una camisa nueva'],[58,'mi hermano'],[59,'y hablamos mucho'],[60,'el tren'],[61,'una ciudad'],[62,'a pie'],[63,'Estaba leyendo'],[64,'ahora trabajo de noche'],[65,'Hacía calor'],[66,'desde ayer'],[67,'tres días'],[68,'la primera frase'],[69,'a las nueve'],[70,'llegaré mañana'],[71,'cada mañana'],[72,'más dinero'],[73,'y no me gustaría'],[74,'la más cómoda'],[75,'tiempo mañana'],[76,'Deberíamos'],[77,'del lunes'],[78,'no puedo llamar'],[79,'este país'],[80,'las opciones'],[81,'los detalles hoy'],[82,'otra lámpara'],[83,'cerca de mi hermana'],[84,'todavía estaba abierta'],[85,'resultó bastante difícil'],[86,'por su comodidad'],[87,'seguimos ahora'],[88,'la última frase'],[89,'primero debemos pagar'],[90,'mis ideas']
]);
const button=(attr,value='')=>({hasAttribute:k=>k===attr,getAttribute:k=>k===attr?String(value):null});
function harness(day){
 const ctx={window:{},Date,Number,String,Array,Object,Map,RegExp};vm.createContext(ctx);vm.runInContext(source,ctx);
 const state={day:30};const m=ctx.window.VamosPathway.create({state,data:{pathway:content},esc:String,save(){},render(){},toast(){},footer:()=>'',playButton:()=>''});m.enter(day,'pathway');
 const click=(key,value)=>m.click(button('data-pw-'+key,value)),input=value=>m.input({id:'pathway-answer',value});
 return {m,state,click,input,latest:()=>state.pathway.days[day].answers.reply.retries.at(-1)||state.pathway.days[day].answers.reply.first};
}
let accepted=0,originalRejected=0;
for(const d of content.days){
 const reply=d.tasks.find(t=>t.id==='reply'),produce=d.tasks.find(t=>t.id==='produce'),meaning=d.tasks.find(t=>t.id==='meaning');
 // Lens 1: a changed condition is explicit; production remains bound to the original model.
 assert(reply&&reply.kind==='text'&&reply.transfer?.version===14);assert(reply.prompt.includes('Новое условие: '+reply.transfer.conditionRu));assert(reply.context.includes(reply.transfer.scaffold));assert(reply.transfer.translationRu.length>8);assert(produce.accepted.includes(d.model.es));assert.equal(reply.help,reply.accepted[0]);
 // Lens 2: each audited new factual slot appears and original facts are excluded.
 assert(reply.accepted.every(a=>norm(a)!==norm(d.model.es)));assert(reply.accepted.every(a=>a.includes(expectedFacts.get(d.day))),`new fact day ${d.day}`);assert(!('patterns'in reply));
 const h=harness(d.day);h.click('choice',meaning.answer);h.click('check');h.click('next');h.input(produce.accepted[0]);h.click('check');h.click('next');
 h.input(d.model.es);h.click('check');assert.equal(h.latest().correct,false,`old facts rejected day ${d.day}`);originalRejected++;h.click('next');assert.equal(h.state.pathway.days[d.day].position,2);
 // Lens 3: every finite accepted answer passes the existing module, preserving first-error evidence.
 for(const text of reply.accepted){h.input(text);h.click('check');assert.equal(h.latest().correct,true,`accepted transfer day ${d.day}`);assert.equal(h.state.pathway.days[d.day].answers.reply.first.correct,false);accepted++}
 // Lens 4: unrelated and unsupported answers remain outside the prepared model.
 h.input('Hola.');h.click('check');assert.equal(h.latest().correct,false);assert.equal(h.state.day,30);
}
// Lens 5: articles, contractions, number/gender, verb tense and intended discourse facts.
const answer=day=>content.days.find(d=>d.day===day).tasks.find(t=>t.id==='reply').accepted;
assert.deepEqual(answer(37),['Voy al mercado a pie.']);assert.deepEqual(answer(56),['Esta semana he leído dos libros cortos.']);assert.equal(answer(61).length,2);assert(answer(61).some(a=>a.includes('era niña')));assert.deepEqual(answer(74),['Entre estas dos opciones, elegiría la más cómoda.']);assert.deepEqual(answer(76),['Deberíamos guardar una copia antes de cambiar el documento.']);assert(answer(79)[0].includes('que explica'));assert(content.days.find(d=>d.day===79).tasks.find(t=>t.id==='reply').transfer.conditionRu.includes('знакомую существующую'));assert.deepEqual(answer(84),['Cuando llegamos, la tienda todavía estaba abierta.']);assert.equal(answer(88).length,2);assert(answer(88).some(a=>a.includes('estoy segura')));assert.deepEqual(answer(89),['Si te he entendido bien, primero debemos pagar y después reservar.']);
for(const [day,bad]of [[56,'Esta semana he leído dos libro corto.'],[74,'Entre estas dos opciones, elegiría la más cómodo.'],[76,'Deberías guardar una copia antes de cambiar el documento.'],[84,'Cuando llegamos, la tienda todavía estaba abierto.'],[88,'No estoy segura de haber entendido todos los detalles.']]){
 const d=content.days.find(d=>d.day===day),h=harness(day);h.click('choice',d.tasks[0].answer);h.click('check');h.click('next');h.input(d.tasks[1].accepted[0]);h.click('check');h.click('next');h.input(bad);h.click('check');assert.equal(h.latest().correct,false,`unsupported grammar/old fact ${day}`);
}
assert.equal(content.days.length,60);assert.equal(expectedFacts.size,60);assert.equal(accepted,62);assert.equal(originalRejected,60);
console.log(JSON.stringify({passed:true,lenses:5,changedReplyTasks:60,acceptedTransferModels:accepted,originalFactsRejected:originalRejected,extraGrammarAndMeaningNegatives:5,productionModelPreserved:true,limits:'Finite authored text checks; no acoustic or spontaneous-speech grading.'}));
