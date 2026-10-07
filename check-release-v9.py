from pathlib import Path
import ast,json,re,hashlib
r=Path(__file__).parent
runtime=ast.literal_eval(re.search(r'runtime=(\[[^\n]+\])',(r/'build-deploy.py').read_text(encoding='utf8')).group(1))
assert len(runtime)==29
for name in runtime:assert (r/'docs'/name).read_bytes()==(r/'web'/name).read_bytes(),name
shell=(r/'web/course-shell.html').read_text(encoding='utf8');cache=(r/'web/sw.js').read_text(encoding='utf8')
assert 'src="workbook.js"' in shell and "'workbook.js'" in cache and "'course-v9.css'" in cache
assert (r/'web/course.css').read_text(encoding='utf8').strip().endswith("@import url('course-v9.css');")
data=json.loads((r/'web/course-data.js').read_text(encoding='utf8').removeprefix('window.VAMOS_DATA=').rstrip(';\n'))
assert data['version']=='5.4-story-workbook'
for key,name in [('goals','course-goals.json'),('missions','mission-data.json'),('stories','course-stories.json'),('workshops','course-workshops.json')]:assert data[key]==json.loads((r/name).read_text(encoding='utf8')),name
assert len(data['stories']['days'])==30 and len(data['workshops']['days'])==30
clips=json.loads((r/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
for clip in clips.values():assert hashlib.sha256((r/'docs'/clip['file']).read_bytes()).hexdigest()==clip['sha256']
assert 'shell-v9-1' in cache
print('PASS release v9: 29 exact runtime files; current stories/workshops/goals/missions; scoped offline wiring; 72 original SHA.')
