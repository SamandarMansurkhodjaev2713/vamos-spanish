/* Finite coverage from actual reader catalogue and dictionary, not guessed headwords. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),box={window:{},document:{querySelector:()=>null},Date,Map,Set,CSS:{escape:String}};vm.createContext(box);vm.runInContext(read('web/course-data.js'),box);vm.runInContext(read('web/reader.js'),box);
const data=box.window.VAMOS_DATA,reader=box.window.VamosReader.create({data,state:{day:1},esc:String,save:()=>{},render:()=>{}});
const words=text=>(text.normalize('NFC').toLocaleLowerCase('es').match(/[a-záéíóúüñ]+/g)||[]),unique=rows=>new Set(rows.flatMap(words));
const books=reader.catalog(),groups={beginner18:unique(books.filter(b=>b.kind==='beginner').flatMap(b=>b.lines.map(l=>l.es))),readings84:unique(books.flatMap(b=>b.lines.map(l=>l.es))),dictionaryWordCards:unique(data.library.items.filter(x=>x.type==='word').map(x=>x.es)),dictionaryAllForms:unique(data.library.items.flatMap(x=>x.type==='text'?x.lines.map(l=>l.es):[x.es]))};
const registry=data.wordAudioHuman,available=new Set([...Object.keys(data.wordAudio.words),...Object.keys(data.wordAudioExtra.words),...Object.keys(registry.words)]);
for(const clip of Object.values(data.expanded.audio)){const parts=words(clip.text);if(parts.length===1)available.add(parts[0]);}
const report={pass:true,groups:{}};
for(const[key,forms]of Object.entries(groups)){const expected=registry.audit.coverageGroups[key],missing=[...forms].filter(w=>!available.has(w)).sort();assert.equal(forms.size,expected.totalForms,key);assert.deepEqual(missing,JSON.parse(JSON.stringify(expected.missingWords)),key);report.groups[key]={total:forms.size,covered:forms.size-missing.length,remaining:missing.length};}
for(const[word,key]of Object.entries(registry.words)){const clip=registry.clips[key];assert.equal(clip.text,word);assert(words(clip.sourceText).includes(word),'Source exact form '+word);assert.equal(clip.kind,'human-excerpt');assert.equal(clip.unaltered,false);assert(!clip.license.includes('ND'));}
fs.mkdirSync('.impeccable/review-v39',{recursive:true});fs.writeFileSync('.impeccable/review-v39/coverage.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
