/* Authored semantic exclusions: Russian farewell paraphrases must never be wrong choices for each other. */
window.VamosMeaningChoices=(()=>{
 'use strict';
 const groups=[['873609','437738']]; // Hasta luego. / Nos vemos. — До встречи. / Увидимся.
 function options(data,target,examples,max=4){
  if(!target||typeof target.ru!=='string'||!target.ru.trim())return [];
  const count=Number.isFinite(Number(max))?Math.max(1,Math.min(8,Math.floor(Number(max)))):4;
  const aliases=new Set(groups.find(g=>g.includes(String(target.audio)))||[String(target.audio)]);
  const result=[target.ru],seen=new Set(result);
  const all=(data.expanded?.lessons||[]).flatMap(l=>Array.isArray(l.examples)?l.examples:[]);
  for(const candidate of[...(Array.isArray(examples)?examples:[]),...all]){
   if(result.length>=count)break;
   if(!candidate||typeof candidate.ru!=='string'||!candidate.ru.trim()||seen.has(candidate.ru)||aliases.has(String(candidate.audio)))continue;
   seen.add(candidate.ru);result.push(candidate.ru);
  }
  return result;
 }
 return {options};
})();
