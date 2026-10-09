import json, shutil, urllib.request, re, hashlib
from pathlib import Path
base=Path(__file__).parent
web=base/'web'
archive=base/'.impeccable/archive/v1-app'
archive.mkdir(parents=True,exist_ok=True)
for name in ['web/index.html','build-vamos.py']:
 src=base/name;dest=archive/src.name
 if src.exists() and not dest.exists():shutil.copy2(src,dest)
data=json.loads((base/'course-blueprint.json').read_text(encoding='utf8'))
bank=json.loads((base/'exercise-bank.json').read_text(encoding='utf8'))
for lesson,practice in zip(data['lessons'],bank):lesson['practice']=practice
data['expanded']=json.loads((base/'course-expanded.json').read_text(encoding='utf8'))
if (base/'course-library.json').exists():data['library']=json.loads((base/'course-library.json').read_text(encoding='utf8'))
data['goals']=json.loads((base/'course-goals.json').read_text(encoding='utf8'))
data['missions']=json.loads((base/'mission-data.json').read_text(encoding='utf8'))
data['stories']=json.loads((base/'course-stories.json').read_text(encoding='utf8'))
data['workshops']=json.loads((base/'course-workshops.json').read_text(encoding='utf8'))
data['pathway']=json.loads((base/'pathway-data.json').read_text(encoding='utf8'))
data['videoGuide']=json.loads((base/'video-guide-v13.json').read_text(encoding='utf8'))
data['repair']=json.loads((base/'course-repair-v14.json').read_text(encoding='utf8'))

data['guidance']=json.loads((base/'course-guidance.json').read_text(encoding='utf8')) if (base/'course-guidance.json').exists() else {'lessons':[]}
data['wordAudio']=json.loads((base/'word-audio.json').read_text(encoding='utf8')) if (base/'word-audio.json').exists() else {'clips':{},'words':{}}
data['dailyPlan']=json.loads((base/'course-daily-plan.json').read_text(encoding='utf8'))
data['version']='6.15-guided-daily-practice'
data['status']='Личный курс с оригинальными записями, тренировкой фраз и локальной записью голоса. Учебный эффект и отсутствие акцента не гарантированы.'
(web/'course-data.js').write_text('window.VAMOS_DATA='+json.dumps(data,ensure_ascii=False).replace('</',r'<\/')+';\n',encoding='utf8')
lucide=web/'assets/lucide.min.js'
if not lucide.exists():
 with urllib.request.urlopen('https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js',timeout=30) as r:lucide.write_bytes(r.read())
print('Built course',data['version']+';',len(data['lessons']),'lessons;',len(data['expanded']['audio']),'human sentence clips;',len(data.get('library',{}).get('items',[])),'library entries.')

(web/'drills.js').write_text('window.VAMOS_DRILLS='+json.dumps(json.loads((base/'course-drills.json').read_text(encoding='utf8')),ensure_ascii=False)+';\n',encoding='utf8')

# Content versions prevent a long-lived browser from mixing releases.
def version_stylesheet_imports(css_path):
 # The parent's HTML version must change whenever an imported stylesheet changes.
 pattern=r'(@import\s+url\(\s*)([\'\"])([^\'\"]+\.css)(?:\?v=[a-f0-9]{12})?(\2\s*\))'
 def replace(match):
  name=match.group(3)
  if ':' in name or name.startswith('/'):return match.group(0)
  child=(css_path.parent/name).resolve()
  if not child.is_relative_to(web.resolve()) or not child.is_file():raise ValueError('Invalid local CSS import: '+name)
  digest=hashlib.sha256(child.read_bytes().replace(b'\r\n',b'\n')).hexdigest()[:12]
  return match.group(1)+match.group(2)+name+'?v='+digest+match.group(4)
 css_path.write_text(re.sub(pattern,replace,css_path.read_text(encoding='utf8')),encoding='utf8')
version_stylesheet_imports(web/'course.css')
def version_asset(match):
 path=web/match.group(2)
 # GitHub serves Git's LF-normalized text, even when this Windows checkout uses CRLF.
 digest=hashlib.sha256(path.read_bytes().replace(b'\r\n',b'\n')).hexdigest()[:12]
 return match.group(1)+match.group(2)+'?v='+digest+match.group(3)
shell=(web/'course-shell.html').read_text(encoding='utf8')
(web/'index.html').write_text(re.sub(r'((?:src|href)=")([^"?]+\.(?:js|css))(")',version_asset,shell),encoding='utf8')
