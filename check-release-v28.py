"""Verify finite content migration, original media, asset versions and published bytes."""
from pathlib import Path
import ast, json, hashlib, re, subprocess, sys, urllib.request, urllib.error, time
from concurrent.futures import ThreadPoolExecutor
def verify_style_imports(css_bytes,read_child,known_files):
 imports=re.findall(r'@import\s+url\(\s*([\'\"])([^\'\"]+)\1\s*\)',css_bytes.decode('utf8'))
 assert imports,'Missing stylesheet import list'
 versions=[]
 for _,url in imports:
  match=re.fullmatch(r'([^?#:]+\.css)\?v=([a-f0-9]{12})',url)
  assert match,'Unversioned or invalid local CSS import: '+url
  name,digest=match.groups();assert name in known_files,'Missing runtime stylesheet: '+name
  expected=hashlib.sha256(read_child(name).replace(b'\r\n',b'\n')).hexdigest()[:12]
  assert digest==expected,'Stale imported stylesheet: '+name
  versions.append((url,name))
 return versions
r=Path(__file__).parent
lists={}
for n in ast.parse((r/'build-deploy.py').read_text(encoding='utf8')).body:
 if isinstance(n,ast.Assign):
  for t in n.targets:
   if isinstance(t,ast.Name) and t.id in ['runtime','assets']:lists[t.id]=ast.literal_eval(n.value)
 if isinstance(n,ast.AugAssign) and isinstance(n.target,ast.Name) and n.target.id in lists:lists[n.target.id]+=ast.literal_eval(n.value)
files=lists['runtime']+['assets/'+x for x in lists['assets']]
for name in files:assert (r/'web'/name).read_bytes()==(r/'docs'/name).read_bytes(),name
def payload(s):return json.loads(s.removeprefix('window.VAMOS_DATA=').rstrip(';\n'))
data=payload((r/'web/course-data.js').read_text(encoding='utf8'))
assert data['version']=='6.15-guided-daily-practice'
previous=payload(subprocess.check_output(['git','show','b0d0421:web/course-data.js'],cwd=r).decode('utf8'))
for key,value in previous.items():
 if key=='lessons':
  expected=json.loads(json.dumps(value))
  expected[29]['practice']['own']='Дополнительная короткая репетиция, не замена итоговым трём сценам: новая беседа около трёх минут — познакомься, обсуди интерес, задай вопросы и назови план. Затем другая сцена — договорённость о встрече.'
  assert data[key]==expected,'Only the witnessed day30 optional rehearsal wording may change'
 elif key not in ['library','version','guidance','goals','missions']:assert data[key]==value,'Unexpected core source change: '+key
for key,name in [('library','course-library.json'),('guidance','course-guidance.json'),('wordAudio','word-audio.json'),('goals','course-goals.json'),('missions','mission-data.json')]:assert data[key]==json.loads((r/name).read_text(encoding='utf8'))
assert len(data['lessons'])==30 and len(data['library']['items'])==480
for old,current in zip(previous['library']['items'],data['library']['items'][:316]):
 if old['id']=='phrase:v16:por-la-manana':
  assert {k:v for k,v in current.items() if k!='usage'}=={k:v for k,v in old.items() if k!='usage'}
  assert current['usage']=='Por la mañana — утром. Самостоятельное mañana часто значит «завтра»; esta mañana — «сегодня утром». Значение зависит от сочетания и контекста.'
 else: assert current==old,old['id']
assert len(data['guidance']['lessons'])==30
assert data['dailyPlan']==json.loads((r/'course-daily-plan.json').read_text(encoding='utf8')) and len(data['dailyPlan']['lessons'])==30
audio=json.loads((r/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'));words=json.loads((r/'word-audio.json').read_text(encoding='utf8'))
assert len(audio)==72 and len(words['clips'])==51
assert words==json.loads((r/'web/assets/word-audio/ATTRIBUTION.json').read_text(encoding='utf8'))
assert words==json.loads((r/'docs/assets/word-audio/ATTRIBUTION.json').read_text(encoding='utf8'))
for collection in [audio,words['clips']]:
 for a in collection.values():
  assert a['unaltered'] is True
  for folder in ['web','docs']:
   content=(r/folder/a['file']).read_bytes();assert len(content)==a['bytes'];assert hashlib.sha256(content).hexdigest()==a['sha256']
  if a['file'].endswith('.wav'):
   assert Path(a['file']).stem.upper() not in {'CON','PRN','AUX','NUL',*('COM'+str(n) for n in range(1,10)),*('LPT'+str(n) for n in range(1,10))},'Non-portable filename: '+a['file']
   assert a['license']=='CC BY-SA 4.0' and a['language']=='es' and a['speaker']=='Rodelar'
   assert a['sourceUrl'].startswith('https://upload.wikimedia.org/')
   assert hashlib.sha1(content).hexdigest()==a['sha1']
for word,key in words['words'].items():assert words['clips'][key]['text']==word
html=(r/'web/index.html').read_text(encoding='utf8')
assert re.sub(r'\?v=[a-f0-9]{12}','',html)==(r/'web/course-shell.html').read_text(encoding='utf8')
for asset,digest in re.findall(r'(?:src|href)="([^"?]+\.(?:js|css))\?v=([a-f0-9]{12})"',html):assert hashlib.sha256((r/'web'/asset).read_bytes().replace(b'\r\n',b'\n')).hexdigest()[:12]==digest,asset
style_imports=verify_style_imports((r/'web/course.css').read_bytes(),lambda name:(r/'web'/name).read_bytes(),files)
assert verify_style_imports((r/'docs/course.css').read_bytes(),lambda name:(r/'docs'/name).read_bytes(),files)==style_imports
sw=(r/'web/sw.js').read_text(encoding='utf8');assert 'shell-v28-' in sw and 'word-audio' in sw and "canonical.searchParams.delete('v')" in sw
out=r/'.impeccable/review-v28';out.mkdir(parents=True,exist_ok=True)
report={'pass':True,'version':data['version'],'runtimeAndAssets':len(files),'originalClips':72,'wordClips':51,'entries':480,'files':files,'versionedStyleImports':len(style_imports),'limits':['Finite content/byte checks do not establish acoustic quality or learning efficacy.']}
(out/'release-files.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(f'PASS local v28: {len(files)} runtime/assets; 123 original media hashes; 316 legacy identities preserved,315 unchanged and1 witnessed usage correction; 164 new entries; versioned shell.')
if '--remote' in sys.argv:
 base='https://samandarmansurkhodjaev2713.github.io/vamos-spanish/'
 names=files+[a['file'] for a in audio.values()]+[a['file'] for a in words['clips'].values()]+['assets/audio/ATTRIBUTION.json','assets/audio/README.txt','assets/word-audio/ATTRIBUTION.json','.nojekyll']
 expected={n:subprocess.check_output(['git','show','HEAD:docs/'+n],cwd=r) for n in names}
 for asset,digest in re.findall(r'(?:src|href)="([^"?]+\.(?:js|css))\?v=([a-f0-9]{12})"',expected['index.html'].decode()):assert hashlib.sha256(expected[asset]).hexdigest()[:12]==digest
 for url,name in verify_style_imports(expected['course.css'],lambda name:expected[name],files):
  expected[url]=expected[name];names.append(url)
 def verify(name):
  request=urllib.request.Request(base+name,headers={'Cache-Control':'no-cache'})
  for attempt in range(1,4):
   try:
    with urllib.request.urlopen(request,timeout=20) as response:content=response.read()
    break
   except urllib.error.HTTPError as error:
    if error.code not in {429,500,502,503,504} or attempt==3:raise RuntimeError(f'{name}: HTTP {error.code} after {attempt} attempt(s)') from error
   except (urllib.error.URLError,TimeoutError) as error:
    if attempt==3:raise RuntimeError(f'{name}: transport failure after {attempt} attempts') from error
   time.sleep(attempt)
  assert content==expected[name],name
  return {'file':name,'sha256':hashlib.sha256(content).hexdigest(),'attempts':attempt}
 with ThreadPoolExecutor(max_workers=4) as pool:verified=list(pool.map(verify,names))
 report.update({'commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r).decode().strip(),'verifiedFiles':verified})
 (out/'published-bytes.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 print(f'PASS published v28: {len(verified)} files equal committed Git bytes.')
