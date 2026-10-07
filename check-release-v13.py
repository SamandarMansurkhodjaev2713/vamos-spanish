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
assert data['version']=='6.0-daily-pathway'
assert len(data['lessons'])==30 and len(data['pathway']['days'])==60 and len(data['pathway']['readings'])==10
for key,path in [('pathway','pathway-data.json'),('videoGuide','video-guide-v13.json'),('missions','mission-data.json'),('stories','course-stories.json'),('workshops','course-workshops.json')]:assert data[key]==json.loads((r/path).read_text(encoding='utf8')),path
cache=(r/'web/sw.js').read_text(encoding='utf8');assert 'shell-v13-1' in cache and 'notificationclick' in cache
for name in ['profile.js','pathway.js','identity.js','welcome.js','videos.js','journey-ui.css','assets/lumo-welcome-v13.webp']:assert name in cache,name
audio=json.loads((r/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
for a in audio.values():assert hashlib.sha256((r/'docs'/a['file']).read_bytes()).hexdigest()==a['sha256']
assert len(audio)==72
assert (r/'web/course-shell.html').read_bytes()==(r/'web/index.html').read_bytes()
(r/'.impeccable/review-v13/release-files.json').write_text(json.dumps({'version':data['version'],'files':files},indent=2),encoding='utf8')
print('PASS release v13:',len(files),'runtime/assets; 90 days + 10 readings; 72 original SHA; native scoped cache.')
