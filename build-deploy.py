"""Publish only runtime assets; preserve every native MP3 byte and attribution."""
from pathlib import Path
import json,shutil,hashlib
root=Path(__file__).parent;web=root/'web';dest=root/'docs';dest.mkdir(exist_ok=True)
runtime=['index.html','course.css','course-foundation.css','course-v3.css','course-v4.css','course-data.js','course.js','library.js','coach.js','progress.js','learning.js','speech.js','native.js','drills.js','course-v5.css','manifest.webmanifest','sw.js','mastery.js','adaptive.js','navigation.js','navigation.css','course-v7.css','course-v8.css','goals.js','studio.js','missions.js','recordings.js','workbook.js','course-v9.css','course-v10.css','alegreya.css','course-v11.css','experience.js','experience.css']
assets=['nunito-latin.woff2','nunito-cyrillic.woff2','Nunito-OFL.txt','onest-latin.woff2','onest-cyrillic.woff2','Onest-OFL.txt','onest-sources.json','lucide.min.js','lucide-LICENSE.txt','lumo-poses.webp','app-icon.svg','app-icon-192.png','app-icon-512.png','plaza.svg','alegreya-latin.woff2','alegreya-cyrillic.woff2','Alegreya-OFL.txt','alegreya-sources.json']
for name in runtime+['assets/'+x for x in assets]:
 p=web/name;assert p.exists(),name;out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
audio=json.loads((web/'assets/audio/ATTRIBUTION.json').read_text(encoding='utf8'))
items=audio['clips'] if isinstance(audio,dict) and 'clips' in audio else audio
if isinstance(items,dict):items=list(items.values())
for item in items:
 name=item['file'];p=web/name;assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'],name;out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,out)
for name in ['ATTRIBUTION.json','README.txt']:
 shutil.copy2(web/'assets/audio'/name,dest/'assets/audio'/name)
(dest/'.nojekyll').write_text('',encoding='utf8')
print('Publication build:',len(runtime),'runtime files;',len(items),'unchanged native clips.')
