from pathlib import Path
import json,re
r=Path(__file__).parent
rt=re.search(r"runtime=(\[[^\n]+\])",(r/'build-deploy.py').read_text()).group(1)
import ast
files=ast.literal_eval(rt)
assert len(files)==27
for name in files:assert (r/'docs'/name).read_bytes()==(r/'web'/name).read_bytes(),name
shell=(r/'web/course-shell.html').read_text(encoding='utf8')
for name in ['goals.js','studio.js','missions.js','recordings.js']:
 assert 'src="'+name+'"' in shell
 assert "'"+name+"'" in (r/'web/sw.js').read_text()
assert (r/'web/course.css').read_text().strip().endswith("@import url('course-v8.css');")
source=(r/'web/course-data.js').read_text(encoding='utf8');data=json.loads(source.removeprefix('window.VAMOS_DATA=').rstrip(';\n'))
assert data['version']=='5.3-conversation-studio'
assert data['goals']==json.loads((r/'course-goals.json').read_text(encoding='utf8'))
assert data['missions']==json.loads((r/'mission-data.json').read_text(encoding='utf8'))
assert len(data['goals']['lessons'])==30 and sum(len(d['variants']) for d in data['missions']['days'])==120
assert 'shell-v8-1' in (r/'docs/sw.js').read_text()
print('PASS release v8: 27 copied runtime files, shell/cache wiring, exact current 30 goals / 120 mission variants.')
