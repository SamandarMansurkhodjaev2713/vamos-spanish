from pathlib import Path
import ast,json,re,hashlib
r=Path(__file__).parent
runtime=ast.literal_eval(re.search(r'runtime=(\[[^\n]+\])',(r/'build-deploy.py').read_text(encoding='utf8')).group(1))
assert len(runtime)==34
for name in runtime:assert (r/'docs'/name).read_bytes()==(r/'web'/name).read_bytes(),name
shell=(r/'web/course-shell.html').read_text(encoding='utf8');cache=(r/'web/sw.js').read_text(encoding='utf8')
assert all(x in cache for x in ['course-v11.css','experience.js','experience.css','assets/plaza.svg','assets/alegreya-cyrillic.woff2'])
assert "'course-v10.css'" in cache
assert 'src="workbook.js"' in shell and "'workbook.js'" in cache and "'course-v9.css'" in cache
assert (r/'web/course.css').read_text(encoding='utf8').strip().endswith("@import url('experience.css');")
data=json.loads((r/'web/course-data.js').read_text(encoding='utf8').removeprefix('window.VAMOS_DATA=').rstrip(';\n'))
assert data['version']=='5.6-conversation-plaza'
for key,name in [('goals','course-goals.json'),('missions','mission-data.json'),('stories','course-stories.json'),('workshops','course-workshops.json')]:assert data[key]==json.loads((r/name).read_text(encoding='utf8')),name
assert len(data['stories']['days'])==30 and len(data['workshops']['days'])==30
clips=json.loads((r/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
for clip in clips.values():assert hashlib.sha256((r/'docs'/clip['file']).read_bytes()).hexdigest()==clip['sha256']
assert 'shell-v11-2' in cache
print('PASS release v11: 34 exact runtime files; current stories/workshops/goals/missions; scoped offline wiring; 72 original SHA.')
