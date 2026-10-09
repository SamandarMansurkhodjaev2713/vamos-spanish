"""Finite packaging and optional published-byte check. No browser automation."""
from pathlib import Path
import ast, json, hashlib, re, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

r = Path(__file__).parent
tree = ast.parse((r / 'build-deploy.py').read_text(encoding='utf8'))
lists = {}
for n in tree.body:
    if isinstance(n, ast.Assign):
        for target in n.targets:
            if isinstance(target, ast.Name) and target.id in ['runtime', 'assets']:
                lists[target.id] = ast.literal_eval(n.value)
    if isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name) and n.target.id in lists:
        lists[n.target.id] += ast.literal_eval(n.value)
files = lists['runtime'] + ['assets/' + x for x in lists['assets']]
for name in files:
    assert (r / 'docs' / name).read_bytes() == (r / 'web' / name).read_bytes(), name

def payload(text):
    return json.loads(text.removeprefix('window.VAMOS_DATA=').rstrip(';\n'))

data = payload((r / 'web/course-data.js').read_text(encoding='utf8'))
assert data['version'] == '6.13-guided-conversations'
previous = payload(subprocess.check_output(['git', 'show', '0d679f9:web/course-data.js'], cwd=r).decode('utf8'))
expected = json.loads(json.dumps(previous))
expected['version'] = data['version']
# Only the reviewed day-2 practice and explicit goal contract fields changed.
expected['lessons'][1]['practice'] = data['lessons'][1]['practice']
for old, new in zip(expected['goals']['lessons'], data['goals']['lessons']):
    old['missionVerification']['component'] = new['missionVerification']['component']
    if old['day'] == 2:
        old['closedChecks'][1] = new['closedChecks'][1]
        old['missionVerification']['task'] = new['missionVerification']['task']
        old['personalPrompt'] = new['personalPrompt']
assert data == expected, 'Unexpected learning content change outside reviewed scope'
for key, name in [('repair', 'course-repair-v14.json'), ('pathway', 'pathway-data.json'),
                  ('videoGuide', 'video-guide-v13.json'), ('missions', 'mission-data.json'),
                  ('stories', 'course-stories.json'), ('workshops', 'course-workshops.json'),
                  ('library', 'course-library.json')]:
    assert data[key] == json.loads((r / name).read_text(encoding='utf8')), name
assert len(data['lessons']) == 30 and len(data['library']['items']) == 316
assert len(data['pathway']['days']) == 60 and len(data['pathway']['readings']) == 10
cache = (r / 'web/sw.js').read_text(encoding='utf8')
assert 'shell-v26-1' in cache and 'notificationclick' in cache
assert "canonical.searchParams.delete('v')" in cache and "cache:'reload'" in cache
audio = json.loads((r / 'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
assert len(audio) == 72
for a in audio.values():
    for folder in ['web', 'docs']:
        assert hashlib.sha256((r / folder / a['file']).read_bytes()).hexdigest() == a['sha256']
html = (r / 'web/index.html').read_text(encoding='utf8')
assert re.sub(r'\?v=[a-f0-9]{12}', '', html) == (r / 'web/course-shell.html').read_text(encoding='utf8')
for asset, digest in re.findall(r'(?:src|href)="([^"?]+\.(?:js|css))\?v=([a-f0-9]{12})"', html):
    assert hashlib.sha256((r / 'web' / asset).read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:12] == digest, asset
out = r / '.impeccable/review-v26'
out.mkdir(parents=True, exist_ok=True)
report = {'version': data['version'], 'files': files, 'nativeClips': 72, 'pass': True,
          'limits': ['Byte/metadata checks do not establish learning efficacy or acoustic quality.']}
(out / 'release-files.json').write_text(json.dumps(report, indent=2), encoding='utf8')
print(f'PASS local v26: {len(files)} runtime/assets; 72 original audio SHA; bounded content diff; versioned shell.')

if '--remote' in sys.argv:
    base = 'https://samandarmansurkhodjaev2713.github.io/vamos-spanish/'
    names = files + [a['file'] for a in audio.values()] + ['assets/audio/ATTRIBUTION.json', 'assets/audio/README.txt', '.nojekyll']
    expected_bytes = {name: subprocess.check_output(['git', 'show', 'HEAD:docs/' + name], cwd=r) for name in names}
    for asset, digest in re.findall(r'(?:src|href)="([^"?]+\.(?:js|css))\?v=([a-f0-9]{12})"', expected_bytes['index.html'].decode()):
        assert hashlib.sha256(expected_bytes[asset]).hexdigest()[:12] == digest, 'Committed asset digest: ' + asset
    def verify(name):
        request = urllib.request.Request(base + name, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read()
            assert content == expected_bytes[name], 'Published bytes differ: ' + name
            return {'file': name, 'status': response.status, 'sha256': hashlib.sha256(content).hexdigest()}
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(verify, names))
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=r).decode().strip()
    (out / 'published-bytes.json').write_text(json.dumps({'commit': commit, 'pass': True, 'files': results}, indent=2), encoding='utf8')
    print(f'PASS published v26: {len(results)} exact committed files at {commit}.')
