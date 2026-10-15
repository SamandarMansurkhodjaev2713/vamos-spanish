const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8')),data={library:json('course-library.json'),wordAudio:json('word-audio.json'),wordAudioExtra:json('word-audio-extra-v38.json'),wordAudioHuman:json('word-audio-human-v39.json')},box={window:{},scrollY:100,scrollTo:()=>{},document:{querySelector:()=>({focus:()=>{}})}};vm.createContext(box);vm.runInContext(fs.readFileSync('web/daily-word.js','utf8'),box);
let count=0;
for(const x of data.library.items.filter(x=>x.type==='word')){
 const key=x.es.normalize('NFC').toLocaleLowerCase('es').trim(),id=data.wordAudioHuman.words[key]||data.wordAudioExtra.words[key]||data.wordAudio.words[key];
 const state={cards:{},library:{favorites:[x.id]},completed:[1,2]},before=JSON.stringify(state);
 const widget=box.window.VamosDailyWord.create({data:{...data,library:{items:[x]}},state,esc:String,icon:()=>'',playButton:(id,label)=>`<button data-audio="${id}">${label}</button>`,render:()=>{},train:()=>{},day:()=>x.day});
 const html=widget.html();if(id){assert(html.includes('data-audio="'+id+'"'),x.es);assert(html.includes('Слушать слово: '+x.es));count++;}else if(x.audio){assert(html.includes('Слушать контекст: '+x.context));assert(html.includes('В записи:'));}
 widget.click({hasAttribute:name=>name==='data-daily-word-reveal'});assert(widget.html().includes(x.ru));assert.equal(JSON.stringify(state),before);
}
assert(count>=212);console.log('PASS '+count+' exact human daily-word paths; missing forms keep full-context label; viewing/revealing does not alter evidence.');
