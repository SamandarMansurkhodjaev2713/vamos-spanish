from pathlib import Path
import ast,json,hashlib,re
r=Path(__file__).parent;tree=ast.parse((r/'build-deploy.py').read_text(encoding='utf8'));lists={}
for n in tree.body:
 if isinstance(n,ast.Assign):
  for target in n.targets:
   if isinstance(target,ast.Name) and target.id in ['runtime','assets']:lists[target.id]=ast.literal_eval(n.value)
 if isinstance(n,ast.AugAssign) and isinstance(n.target,ast.Name) and n.target.id in lists:lists[n.target.id]+=ast.literal_eval(n.value)
files=lists['runtime']+['assets/'+x for x in lists['assets']]
for name in files:assert (r/'docs'/name).read_bytes()==(r/'web'/name).read_bytes(),name
data=json.loads((r/'web/course-data.js').read_text(encoding='utf8').removeprefix('window.VAMOS_DATA=').rstrip(';\n'))
assert data['version']=='6.3-library-recall'
assert data['library']==json.loads((r/'course-library.json').read_text(encoding='utf8'))
assert len(data['library']['items'])==316 and len(data['library']['categories'])==16
assert len(data['lessons'])==30 and len(data['pathway']['days'])==60 and len(data['pathway']['readings'])==10
for key,path in [('repair','course-repair-v14.json'),('pathway','pathway-data.json'),('videoGuide','video-guide-v13.json'),('missions','mission-data.json'),('stories','course-stories.json'),('workshops','course-workshops.json')]:assert data[key]==json.loads((r/path).read_text(encoding='utf8')),path
cache=(r/'web/sw.js').read_text(encoding='utf8');assert 'shell-v16-1' in cache and 'notificationclick' in cache
for name in ['meaning-choices.js','library-practice.js','library-v16.css','day-compass.js','day-compass.css','cafe.css','assets/lumo-cafe-v15.webp','assets/patio-tile-v15.svg','repair.js','repair.css','bridge-review.js','focus-home.js','focus-home.css','lesson-focus.css','profile.js','pathway.js','identity.js','welcome.js','videos.js','journey-ui.css','assets/lumo-welcome-v13.webp']:assert name in cache,name
audio=json.loads((r/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
for a in audio.values():assert hashlib.sha256((r/'docs'/a['file']).read_bytes()).hexdigest()==a['sha256']
assert len(audio)==72
assert (r/'web/course-shell.html').read_bytes()==(r/'web/index.html').read_bytes()
(r/'.impeccable/review-v16').mkdir(parents=True,exist_ok=True)
(r/'.impeccable/review-v16/release-files.json').write_text(json.dumps({'version':data['version'],'files':files},indent=2),encoding='utf8')
print('PASS release v16:',len(files),'runtime/assets; 90 days + 10 readings; 72 original SHA; native scoped cache.')
