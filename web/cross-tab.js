/* Three-way persistence: never mutate live learner objects or cached module references. */
window.VamosCrossTab={create(api){
 'use strict';
 const {key='vamos-course-v2',initialRaw=null,storage,onExternal=()=>{},onConflict=()=>{}}=api;
 const recoveryKey=key+':recovery-v1',MAX_BYTES=8388608,MAX_RECOVERIES=3,missing=Symbol('missing'),unsafe=new Set(['__proto__','constructor','prototype']);
 let base,lastSeen=initialRaw,destroyed=false,knownStored=initialRaw!==null&&initialRaw!==undefined;
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),has=(o,k)=>object(o)&&Object.prototype.hasOwnProperty.call(o,k),get=(o,k)=>has(o,k)?o[k]:missing;
 function clean(v,depth=0){if(depth>45)throw Error('depth');if(Array.isArray(v))return v.map(x=>clean(x,depth+1));if(object(v)){const out={};for(const k of Object.keys(v))if(!unsafe.has(k))out[k]=clean(v[k],depth+1);return out}if(v===null||['string','boolean'].includes(typeof v)||typeof v==='number'&&Number.isFinite(v))return v;throw Error('value')}
 function fits(text){if(typeof text!=='string'||text.length>MAX_BYTES)return false;let bytes=0;for(const char of text){const cp=char.codePointAt(0);bytes+=cp<128?1:cp<2048?2:cp<65536?3:4;if(bytes>MAX_BYTES)return false}return true}
 function parse(raw){if(raw===null||raw===undefined)return {};if(!fits(raw))throw Error('size');const v=clean(JSON.parse(raw));if(!object(v))throw Error('shape');return v}
 const clone=v=>v===missing?missing:clean(v),canon=v=>v===missing?'#missing':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':Array.isArray(v)?'['+v.map(canon).join(',')+']':JSON.stringify(v),same=(a,b)=>canon(a)===canon(b);
 const stamp=v=>object(v)?Math.max(0,...['time','at','startedAt','started','finished','completedAt'].map(k=>Number.isFinite(v[k])?v[k]:0)):0;
 function signal(detail){try{onConflict(detail)}catch{}}
 try{base=parse(initialRaw)}catch{base=null;signal({kind:'initial-invalid',recoveryKey})}
 function note(paths,path){if(paths.length<80&&!paths.includes(path))paths.push(path)}
 function setPath(path){return path==='completed'||/^library\.(favorites|known|difficult)$/.test(path)||path==='reader.saved'||path.endsWith('.translations')||path.endsWith('.seenVariants')||path.endsWith('.aids')}
 function setMerge(b,o,t,path){const original=new Map((Array.isArray(b)?b:[]).map(x=>[canon(x),x])),left=new Map(o.map(x=>[canon(x),x])),right=new Map(t.map(x=>[canon(x),x])),out=[];for(const [id,value]of new Map([...original,...right,...left])){const keep=path==='completed'?left.has(id)||right.has(id):left.has(id)===original.has(id)?right.has(id):left.has(id);if(keep)out.push(clone(value))}return out}
 function arrayKey(x,path,i){if(!object(x))return canon(x);if(path.endsWith('.records')&&Number.isInteger(x.seq))return 'seq:'+x.seq;if(typeof x.id==='string')return 'id:'+x.id;if(path.endsWith('.history')&&Number.isFinite(x.started))return 'session:'+x.day+':'+x.started;if(stamp(x))return 'at:'+stamp(x)+':'+(x.modelSet||'')+':'+(x.contentDay||'');return 'index:'+i}
 function journalPath(path){return /\.(history|events|records|attempts|retries|sessions)$/.test(path)&&path!=='learning.sessions'}
 function journal(b,o,t,path,paths){if(path==='libraryPractice.records'&&Array.isArray(b)&&b.length&&(!o.length||!t.length))return mergeBasic(b,o,t,path,paths);const map=a=>new Map((Array.isArray(a)?a:[]).map((x,i)=>[arrayKey(x,path,i),x])),bm=map(b),om=map(o),tm=map(t),out=[];for(const id of new Set([...bm.keys(),...tm.keys(),...om.keys()])){const ov=om.has(id)?om.get(id):missing,tv=tm.has(id)?tm.get(id):missing,bv=bm.has(id)?bm.get(id):missing;if(ov===missing&&tv===missing)continue;if(path==='libraryPractice.records'){const chosen=firstEvidence([bv,ov,tv]);if(chosen){if(object(ov)&&object(tv)&&!same(ov,tv))note(paths,path+'.'+id);out.push(clone(chosen));continue}}out.push(merge(bv,ov===missing?bv:ov,tv===missing?bv:tv,path+'.'+id,paths))}return out.filter(x=>x!==missing).sort((a,b)=>stamp(a)-stamp(b))}
 function firstEvidence(values){return values.filter(object).sort((a,b)=>stamp(a)-stamp(b)||Number(a.correct===true)-Number(b.correct===true)||Number(b.aided===true)-Number(a.aided===true))[0]}
 function session(b,o,t,path,paths){if(!object(o)||!object(t))return mergeBasic(b,o,t,path,paths);if(same(o,b))return clone(t);if(same(t,b))return clone(o);if(!same(o,t))note(paths,path);if(o.signature===t.signature){const score=v=>(Number(v.stage)||0)*100+(v.stage===0?(Number(v.introIndex)||0)*3+(Number(v.introCycles?.[v.introIndex])||0):0);if(score(o)!==score(t))return clone(score(o)>score(t)?o:t)}if(!same(o,t))note(paths,path);return clone((Number(o.time)||0)>=(Number(t.time)||0)?o:t)}
 const libraryId=v=>object(v)&&typeof v.sessionId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{7,119}$/.test(v.sessionId)?v.sessionId:null;
 function libraryContext(v){if(!object(v)||!Array.isArray(v.ids)||!v.ids.length)return {};return {...v,sessionId:libraryId(v)}}
 function libraryBoundary(b,o,t,path,paths){const oi=libraryId(o),ti=libraryId(t),bi=libraryId(b);if(oi&&oi===ti&&same(o?.ids,t?.ids))return missing;const oc=libraryContext(o),tc=libraryContext(t),bc=libraryContext(b);if(same(oc,tc))return clone(o);if(same(oc,bc))return clone(t);if(same(tc,bc))return clone(o);note(paths,path);if(oi===bi&&ti!==bi)return clone(t);return clone(o)}
 function closeMissions(out,b,o,t,paths){
  if(!Array.isArray(out.history)||!Array.isArray(out.sessions))return;const sources=[b,o,t].filter(object),rows=v=>Array.isArray(v)?v:[],donors=[...out.sessions,...sources.flatMap(s=>[...rows(s.sessions).slice(-30),...rows(s.history).slice(-120)])];
  const compatible=(a,h)=>object(a)&&a.id===h.id&&typeof h.variant==='string'&&a.variant===h.variant&&a.day===h.day&&a.startedAt===h.startedAt;
  const completed=h=>object(h)&&typeof h.id==='string'&&Number.isFinite(h.completedAt)&&h.completedAt>0;
  const attempt=(p,h)=>object(p)&&Number.isFinite(p.at)&&p.at>=h.startedAt&&p.at<=h.completedAt&&typeof p.text==='string'&&p.text.trim()&&['independent','hesitant','help','typed'].includes(p.oral);
  out.history=out.history.map(h=>{if(!completed(h)||!Array.isArray(h.responses))return h;const originals=sources.flatMap(s=>rows(s.history).slice(-120)).filter(a=>compatible(a,h)&&completed(a)),anchor=originals.sort((a,b)=>a.completedAt-b.completedAt)[0]||h,result=clone(anchor),matches=donors.filter(a=>compatible(a,result));
   for(let i=0;i<Math.min(result.responses.length,12);i++){const r=result.responses[i];if(!object(r)||!attempt(r.first,result))continue;const evidence=[r.first,...rows(r.retries).slice(-5)];for(const donor of matches){let previous=result.startedAt,valid=true;for(let j=0;j<=i;j++){const first=donor.responses?.[j]?.first;if(!attempt(first,result)||first.at<previous){valid=false;break}previous=first.at}if(valid){const d=donor.responses[i];evidence.push(d.first,...rows(d.retries).slice(-5))}}
    const sorted=[...new Map(evidence.filter(p=>attempt(p,result)).map(p=>[canon(p),p])).values()].sort((a,b)=>a.at-b.at||Number(a.status==='supported')-Number(b.status==='supported')||Number(a.oral==='independent')-Number(b.oral==='independent')||(rows(b.aids).length-rows(a.aids).length));if(!sorted.length)continue;r.first=clone(sorted[0]);r.retries=sorted.slice(1).slice(-5).map(clone);r.latest=clone(r.retries.at(-1)||r.first);
   }
   if(!same(result,h))note(paths,'missions.history.'+h.id+'.evidence');return result;
  });const done=new Map(out.history.filter(completed).map(h=>[h.id,h]));out.sessions=out.sessions.filter(s=>{const h=done.get(s?.id);if(!h)return true;if(s?.variant!==h.variant||s?.day!==h.day)note(paths,'missions.history.'+h.id+'.context');return false});
 }
 function mergeBasic(b,o,t,path,paths){if(same(o,t))return clone(o);if(same(o,b))return clone(t);if(same(t,b))return clone(o);note(paths,path);return clone(o)}
 function merge(b,o,t,path='',paths=[]){
  if(path==='libraryPractice'){const chosen=libraryBoundary(b,o,t,path,paths);if(chosen!==missing)return chosen}
  if(path.endsWith('.first')){const chosen=firstEvidence([b,o,t]);if(chosen){if(object(o)&&object(t)&&!same(o,t))note(paths,path);return clone(chosen)}}
  if(/^learning\.sessions\.\d+$/.test(path))return session(b,o,t,path,paths);
  if(Array.isArray(o)&&Array.isArray(t)&&setPath(path))return setMerge(b,o,t,path);
  if(Array.isArray(o)&&Array.isArray(t)&&journalPath(path))return journal(b,o,t,path,paths);
  if(object(o)&&object(t)){
   const out={};for(const k of new Set([...Object.keys(object(b)?b:{}),...Object.keys(t),...Object.keys(o)])){if(unsafe.has(k))continue;const v=merge(get(b,k),get(o,k),get(t,k),path?path+'.'+k:k,paths);if(v!==missing)out[k]=v}
   if(Array.isArray(o.responses)&&Array.isArray(t.responses)){out.responses=Array.from({length:Math.max(o.responses.length,t.responses.length)},(_,i)=>merge(b?.responses?.[i]??missing,o.responses[i]??missing,t.responses[i]??missing,path+'.responses.'+i,paths)).filter(x=>x!==missing)}
   if(object(out.first)&&Array.isArray(out.retries)){const attempts=[out.first,...out.retries,...[b?.first,o.first,t.first].filter(object)],dedup=new Map(attempts.map(a=>[canon(a),a]));out.retries=[...dedup.values()].filter(a=>!same(a,out.first)&&stamp(a)>=stamp(out.first)).sort((a,b)=>stamp(a)-stamp(b));if(has(o,'latest')||has(t,'latest'))out.latest=clone(out.retries.at(-1)||out.first)}
   if(/^cards\./.test(path)){if(Number.isFinite(o.due)&&Number.isFinite(t.due)&&!same(o.due,b?.due)&&!same(t.due,b?.due))out.due=Math.min(o.due,t.due);if(Number.isFinite(o.attempts)&&Number.isFinite(t.attempts))out.attempts=Math.max(o.attempts,t.attempts)}
   if(path==='missions')closeMissions(out,b,o,t,paths);
   return out;
  }
  return mergeBasic(b,o,t,path,paths);
 }
 function recovery(ours,theirs,paths){let prior={format:'vamos-cross-tab-recovery-v1',entries:[]};const raw=storage.getItem(recoveryKey);if(raw!==null&&raw!==undefined){const decoded=JSON.parse(raw);if(decoded?.format!=='vamos-cross-tab-recovery-v1'||!Array.isArray(decoded.entries))throw Error('recovery-invalid');prior=decoded}
  const date=new Date().toISOString(),backup=state=>({format:'vamos-backup-v1',date,state:clone(state)}),entry={date,paths,base:backup(base),ours:backup(ours),theirs:backup(theirs)};prior.entries=[...prior.entries.slice(-(MAX_RECOVERIES-1)),entry];let text=JSON.stringify(prior);while(!fits(text)&&prior.entries.length>1){prior.entries.shift();text=JSON.stringify(prior)}if(!fits(text))throw Error('recovery-size');storage.setItem(recoveryKey,text);
 }
 function write(state){if(destroyed||!base){signal({kind:'unavailable',recoveryKey});return false}let ours;try{ours=parse(JSON.stringify(state))}catch{signal({kind:'serialization',recoveryKey});return false}
  for(let attempt=0;attempt<3;attempt++){
   try{const raw=storage.getItem(key);if(raw===null&&knownStored)throw Error('storage-removed');const theirs=parse(raw),paths=[],merged=merge(base,ours,theirs,'',paths),serialized=JSON.stringify(merged);if(!fits(serialized))throw Error('size');if(paths.length)recovery(ours,theirs,paths);if(storage.getItem(key)!==raw)continue;storage.setItem(key,serialized);base=ours;lastSeen=serialized;knownStored=true;if(paths.length)signal({kind:'merged-conflict',paths,recoveryKey});if(!same(merged,ours))try{onExternal({kind:'merged',reloadNeeded:true,recoveryKey})}catch{}return true}
   catch(error){signal({kind:error?.message==='recovery-invalid'?'recovery-invalid':'write-blocked',reason:error?.message||'storage',recoveryKey});return false}
  }
  signal({kind:'busy',recoveryKey});return false;
 }
 function external(event){if(destroyed||event.key!==key||event.newValue===lastSeen||event.storageArea&&event.storageArea!==storage)return;lastSeen=event.newValue;if(knownStored&&event.newValue===null){signal({kind:'write-blocked',reason:'storage-removed',recoveryKey});return}try{parse(event.newValue)}catch{signal({kind:'external-invalid',recoveryKey});return}try{onExternal({kind:'external',reloadNeeded:true,recoveryKey})}catch{}}
 window.addEventListener?.('storage',external);
 function destroy(){destroyed=true;window.removeEventListener?.('storage',external)}
 return {write,destroy,recoveryKey};
}};
