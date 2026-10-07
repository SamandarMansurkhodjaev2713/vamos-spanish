import json, shutil, urllib.request
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
data['version']='5.4-story-workbook'
data['status']='Личный курс с оригинальными записями, тренировкой фраз и локальной записью голоса. Учебный эффект и отсутствие акцента не гарантированы.'
(web/'course-data.js').write_text('window.VAMOS_DATA='+json.dumps(data,ensure_ascii=False).replace('</',r'<\/')+';\n',encoding='utf8')
lucide=web/'assets/lucide.min.js'
if not lucide.exists():
 with urllib.request.urlopen('https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js',timeout=30) as r:lucide.write_bytes(r.read())
(web/'index.html').write_text((web/'course-shell.html').read_text(encoding='utf8'),encoding='utf8')
print('Built standalone course v5;',len(data['lessons']),'lessons;',len(data['expanded']['audio']),'human clips;',len(data.get('library',{}).get('items',[])),'library entries.')

(web/'drills.js').write_text('window.VAMOS_DRILLS='+json.dumps(json.loads((base/'course-drills.json').read_text(encoding='utf8')),ensure_ascii=False)+';\n',encoding='utf8')
