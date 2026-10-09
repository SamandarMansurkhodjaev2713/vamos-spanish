"""Curate unchanged Spanish word recordings with verifiable Commons attribution."""
from pathlib import Path
import json, urllib.request, urllib.parse, urllib.error, hashlib, re, unicodedata, time
ROOT=Path(__file__).parent
UA={'User-Agent':'VamosSpanish/1.0 (https://github.com/SamandarMansurkhodjaev2713/vamos-spanish)'}
def api(**params):
    url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'format':'json',**params})
    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40) as r:return json.load(r)
members=api(action='query',list='categorymembers',cmtitle='Category:Lingua_Libre_pronunciation_by_Rodelar',cmtype='file',cmlimit=500)['query']['categorymembers']
desired='agua,a,ahí,bueno,comer,con,cuándo,cómo,decir,derecha,dormir,dos,día,dónde,en,eso,esto,fruta,frío,grande,hacer,hoy,ir,izquierda,leche,libro,madre,mañana,mesa,mujer,nombre,no,noche,nosotros,nuevo,padre,pequeño,persona,rojo,sal,sí,sol,tres,tú,uno,verde,venir,ver,yo,pan,niño,niña,negro,blanco,cinco,cuatro,quién,qué,caliente,cerca,correcto,caminar,amigo,amiga,casa,ciudad,tiempo'.split(',')
titles={x['title'].split('-Rodelar-',1)[-1].removesuffix('.wav').lower():x['title'] for x in members}
chosen=[titles[w] for w in desired if w in titles]
clips={}; words={}; dest=ROOT/'web/assets/word-audio';dest.mkdir(exist_ok=True)
for offset in range(0,len(chosen),20):
    pages=api(action='query',titles='|'.join(chosen[offset:offset+20]),prop='imageinfo',iiprop='url|size|sha1|mime|extmetadata')['query']['pages']
    for p in pages.values():
        title=p['title']; word=title.split('-Rodelar-',1)[1].removesuffix('.wav').lower(); info=p['imageinfo'][0]; meta=info['extmetadata']
        license=meta['LicenseShortName']['value']; assert license=='CC BY-SA 4.0',(word,license)
        assert 'Rodelar' in meta['Artist']['value']
        assert info['mime'] in ['audio/x-wav','audio/wav']
        assert title.startswith('File:LL-Q1321 (spa)-Rodelar-')
        url=info['url'];assert url.startswith('https://upload.wikimedia.org/')
        slug=unicodedata.normalize('NFD',word).encode('ascii','ignore').decode();name=slug+'.wav'
        # Keep accented and unaccented words distinct, including si/sí and tu/tú.
        if word!=slug:name=slug+'-'+hashlib.sha256(word.encode()).hexdigest()[:6]+'.wav'
        key='word-'+name.removesuffix('.wav')
        # Windows reserves these names even when a filename has an extension.
        if Path(name).stem.upper() in {'CON','PRN','AUX','NUL',*('COM'+str(n) for n in range(1,10)),*('LPT'+str(n) for n in range(1,10))}:name='audio-'+name
        path=dest/name
        if not path.exists():
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=40) as r:path.write_bytes(r.read())
                    break
                except urllib.error.HTTPError as error:
                    if error.code!=429:raise
                    if attempt==2:raise
                    time.sleep(max(30,int(error.headers.get('Retry-After','30'))))
            time.sleep(2)
        content=path.read_bytes();assert len(content)==info['size'];assert hashlib.sha1(content).hexdigest()==info['sha1']
        clips[key]={'text':word,'file':'assets/word-audio/'+name,'speaker':'Rodelar','speakerUrl':'https://commons.wikimedia.org/wiki/User:Rodelar','sentenceUrl':info['descriptionurl'],'sourceUrl':url,'license':license,'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','bytes':len(content),'sha1':info['sha1'],'sha256':hashlib.sha256(content).hexdigest(),'originalTitle':title,'language':'es','unaltered':True}
        words[word]=key
manifest={'version':1,'source':'Lingua Libre / Wikimedia Commons','description':'Original Spanish word recordings by Rodelar. WAV files redistributed without alteration; attribution and share-alike license are linked per recording.','clips':clips,'words':words}
(ROOT/'word-audio.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(dest/'ATTRIBUTION.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'clips':len(clips),'bytes':sum(x['bytes'] for x in clips.values()),'words':sorted(words)},ensure_ascii=False))
