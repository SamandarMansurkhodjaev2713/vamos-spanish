"""Fetch unchanged, individually attributed recordings for beginner reading."""
from pathlib import Path
import json,hashlib,urllib.request,time
from concurrent.futures import ThreadPoolExecutor
r=Path(__file__).parent;p=r/'course-reader-beginner.json'
data=json.loads(p.read_text(encoding='utf8'))
if 'audio' in data:data['clips']=data.pop('audio')['clips']
for book in data['books']:
 book['es']=' '.join(l['es'] for l in book['lines'])
 book['ru']=' '.join(l['ru'] for l in book['lines'])
def fetch(pair):
 key,a=pair
 assert a['license']=='CC BY-NC-ND 3.0' and a['speaker']=='arh'
 aid=str(a['audioId']);sid=str(a['sentenceId'])
 a.update(file='assets/beginner-audio/'+aid+'.mp3',url='https://tatoeba.org/audio/download/'+aid,sentenceUrl='https://tatoeba.org/en/sentences/show/'+sid,speakerUrl='https://tatoeba.org/en/user/profile/arh',licenseUrl='https://creativecommons.org/licenses/by-nc-nd/3.0/',unaltered=True)
 dest=r/'web'/a['file'];dest.parent.mkdir(parents=True,exist_ok=True)
 if not dest.exists():
  for attempt in range(4):
   try:
    req=urllib.request.Request(a['url'],headers={'User-Agent':'VamosSpanish/1.0 (noncommercial educational audio attribution)'})
    with urllib.request.urlopen(req,timeout=35) as response:content=response.read()
    assert len(content)>500 and (content[:3]==b'ID3' or content[0]==255),'Not MP3: '+aid
    dest.write_bytes(content);break
   except Exception:
    if attempt==3:raise
    time.sleep(1+attempt)
 content=dest.read_bytes();a.update(bytes=len(content),sha256=hashlib.sha256(content).hexdigest())
 return key,a
data['clips']=dict(ThreadPoolExecutor(max_workers=4).map(fetch,data['clips'].items()))
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(r/'web/assets/beginner-audio/ATTRIBUTION.json').write_text(json.dumps(data['clips'],ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Verified unchanged originals:',len(data['clips']))
