"""Balance partner turns while using only original, already licensed recordings."""
from pathlib import Path
import json
root=Path(__file__).parent
p=root/'course-library.json';d=json.loads(p.read_text(encoding='utf8'))
clips={}
for x in d['items']:
 if x['type']!='text':clips[x['audio']]={'es':x['context'],'ru':x['contextRu'],'audio':x['audio'],'day':x['day']}
scripts={
 'text:1':[('А','437710'),('Б','437710'),('А','788477'),('Б','40637'),('А','732325'),('Б','639147'),('А','873609'),('Б','437738')],
 'text:5':[('А','444089'),('Б','460472'),('Б','38888'),('А','436033'),('А','441560')],
 'text:7':[('А','732325'),('Б','639147'),('А','438291'),('Б','460273'),('Б','453474'),('А','438291'),('Б','439034'),('А','438291'),('Б','437777')],
 'text:9':[('А','557687'),('Б','438641'),('Б','38888'),('А','515968'),('Б','437738'),('А','873609')],
 'text:11':[('А','513201'),('Б','442647'),('Б','439086'),('А','609857'),('Б','437723'),('А','437738')]
}
for x in d['items']:
 if x['id'] in scripts:
  x['lines']=[dict(clips[audio],speaker=role) for role,audio in scripts[x['id']]]
  x['es']=' '.join(p['es'] for p in x['lines']);x['ru']=' '.join(p['ru'] for p in x['lines'])
  if x['id']=='text:11':x['mission']='Предложи встречу на кофе. Подтверди согласие, уточни время и договорись. Во второй попытке измени напиток или время.'
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Five scenes refined: real partner replies, balanced roles, original clips unchanged.')
