"""Run the actual builder in isolation; verify child CSS versions and parent invalidation."""
from pathlib import Path
import ast, hashlib, json, re, shutil, subprocess, sys, tempfile

root=Path(__file__).resolve().parent
report_dir=root/'.impeccable/review-v30'
report_dir.mkdir(parents=True,exist_ok=True)
checks=[]
def digest(content):return hashlib.sha256(content.replace(b'\r\n',b'\n')).hexdigest()[:12]
def imports(content):
 return [url for _,url in re.findall(r'@import\s+url\(\s*([\'\"])([^\'\"]+)\1\s*\)',content.decode('utf8'))]
def names(content):return [url.split('?')[0] for url in imports(content)]
def parent_hash(html):
 match=re.search(r'href="course\.css\?v=([a-f0-9]{12})"',html.decode('utf8'))
 assert match,'Missing parent course.css version';return match.group(1)
def reject(fn):
 try:fn()
 except AssertionError:return
 raise AssertionError('Invalid stylesheet dependency was accepted')

# Exercise the exact release validator without executing unrelated release/network checks.
tree=ast.parse((root/'check-release-v28.py').read_text(encoding='utf8'))
function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='verify_style_imports')
scope={'re':re,'hashlib':hashlib}
exec(compile(ast.Module(body=[function],type_ignores=[]),'release-validator-fixture','exec'),scope)
verify=scope['verify_style_imports']
before_names=names((root/'web/course.css').read_bytes())
assert before_names and len(before_names)==len(set(before_names))
with tempfile.TemporaryDirectory(prefix='style-versions-',dir=report_dir) as directory:
 fixture=Path(directory).resolve()
 # Temporary cleanup stays inside this explicitly named, verified fixture directory.
 assert fixture.parent==report_dir.resolve()
 web=fixture/'web';web.mkdir();(web/'assets').mkdir()
 shutil.copy2(root/'build-course-v2.py',fixture/'build-course-v2.py')
 for item in root.glob('*.json'):shutil.copy2(item,fixture/item.name)
 for item in (root/'web').iterdir():
  if item.is_file() and item.suffix in ['.css','.js','.html']:shutil.copy2(item,web/item.name)
 shutil.copy2(root/'web/assets/lucide.min.js',web/'assets/lucide.min.js')
 initial_files={p.relative_to(web).as_posix() for p in web.rglob('*') if p.is_file()}
 def build():subprocess.run([sys.executable,str(fixture/'build-course-v2.py')],cwd=fixture,check=True,capture_output=True)
 build();css=(web/'course.css').read_bytes();html=(web/'index.html').read_bytes()
 assert names(css)==before_names,'Import filenames/order changed'
 runtime_names=set(p.name for p in web.iterdir() if p.is_file())
 pairs=verify(css,lambda name:(web/name).read_bytes(),runtime_names)
 assert len(pairs)==len(before_names)
 for url,name in pairs:assert url==name+'?v='+digest((web/name).read_bytes())
 assert parent_hash(html)==digest(css)
 checks.append({'name':'All local import names/order preserved and exact LF child hashes used','imports':len(pairs)})
 build();assert (web/'course.css').read_bytes()==css;assert (web/'index.html').read_bytes()==html
 checks.append({'name':'Two actual complete builds are byte-idempotent'})
 victim='product-v28.css';assert victim in before_names
 child=web/victim;old=child.read_bytes();child.write_bytes(old+b'\n/* independent cache invalidation witness */\n')
 reject(lambda:verify(css,lambda name:(web/name).read_bytes(),runtime_names))
 build();changed_css=(web/'course.css').read_bytes();changed_html=(web/'index.html').read_bytes()
 assert names(changed_css)==before_names
 verify(changed_css,lambda name:(web/name).read_bytes(),runtime_names)
 changed_pairs=dict((name,url) for url,name in zip(imports(changed_css),names(changed_css)))
 original_pairs=dict((name,url) for url,name in pairs)
 assert changed_pairs[victim]!=original_pairs[victim]
 assert [n for n in before_names if changed_pairs[n]!=original_pairs[n]]==[victim]
 assert parent_hash(changed_html)!=parent_hash(html)
 assert parent_hash(changed_html)==digest(changed_css)
 checks.append({'name':'One child mutation invalidates its import URL and the parent HTML hash; stale source rejected'})
 build();assert (web/'course.css').read_bytes()==changed_css;assert (web/'index.html').read_bytes()==changed_html
 canonical=child.read_bytes().replace(b'\r\n',b'\n');child.write_bytes(canonical.replace(b'\n',b'\r\n'))
 build();assert (web/'course.css').read_bytes()==changed_css;assert (web/'index.html').read_bytes()==changed_html
 checks.append({'name':'CRLF checkout bytes and committed LF bytes have the same dependency versions'})
 committed={name:(web/name).read_bytes().replace(b'\r\n',b'\n') for name in before_names}
 assert verify(changed_css.replace(b'\r\n',b'\n'),lambda name:committed[name],runtime_names)==verify(changed_css,lambda name:(web/name).read_bytes(),runtime_names)
 wrong=changed_css.replace((victim+'?v='+digest(child.read_bytes())).encode(),(victim+'?v=000000000000').encode())
 reject(lambda:verify(wrong,lambda name:committed[name],runtime_names))
 unversioned=re.sub(rb'\?v=[a-f0-9]{12}',b'',changed_css)
 reject(lambda:verify(unversioned,lambda name:committed[name],runtime_names))
 reject(lambda:verify(changed_css,lambda name:committed[name],runtime_names-{victim}))
 checks.append({'name':'Committed LF verification rejects old digest, absent query and missing runtime child'})
 sw=(root/'web/sw.js').read_text(encoding='utf8')
 assert "canonical.searchParams.delete('v')" in sw
 assert '/\\.(?:js|css)$/.test(canonical.pathname)' in sw
 assert set(before_names)<=set(re.findall(r'[\'\"]([^\'\"]+\.css)[\'\"]',sw))
 assert {p.relative_to(web).as_posix() for p in web.rglob('*') if p.is_file()}==initial_files
 checks.append({'name':'Existing service worker canonicalizes version query; no runtime file list changes'})

report={'pass':True,'groups':len(checks),'checks':checks,'limits':'Isolated actual Python builder and source release validator. Does not inspect a physical browser cache or change primary generated files.'}
(report_dir/'style-versions-results.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('PASS '+str(len(checks))+' stylesheet version groups')
