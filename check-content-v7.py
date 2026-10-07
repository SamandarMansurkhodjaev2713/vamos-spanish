"""Finite content audit: editorial semantic keys + cross-source/media invariants.

These assertions are independent of the JavaScript grading implementation.
They verify the reviewed corpus, not all possible Spanish paraphrases or speech.
"""
import hashlib,json,re,unicodedata
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).parent
FILES=['course-blueprint.json','course-expanded.json','course-library.json','course-drills.json','exercise-bank.json']
raw={name:(ROOT/name).read_bytes() for name in FILES}
blue,expanded,library,drills,bank=[json.loads(raw[name]) for name in FILES]
attribution=json.loads((ROOT/'web/assets/audio/ATTRIBUTION.json').read_text(encoding='utf-8'))
checks=[]
def require(ok,label):
    assert ok,label
    checks.append(label)
def norm(t):
    return re.sub(r'\s+',' ',re.sub(r'[¿?¡!.,;:]','',unicodedata.normalize('NFC',t).casefold())).strip()

# Reviewed against each question's meaning, without reading answer indices.
# A changed key or replacement distractor cannot silently pass this list.
SEMANTIC_KEYS=[
 ('¿Cómo te llamas?','Me llamo…'),
 ('Возвращает вопрос собеседнику.','Bien, gracias. ¿Y tú?'),
 ('¿Puedes repetir?','Помедленнее, пожалуйста.'),
 ('В Мадриде.','Vivo en…'),
 ('Estudio español.','¿A qué te dedicas?'),
 ('Я учу испанский.','Hablo un poco de español.'),
 ('Soy de México.','Попросить повторить и ответить после повтора.'),
 ('Не любит кино.','Me gusta la música.'),
 ('Любимый фильм.','Собеседника о его любимом фильме.'),
 ('Я предпочитаю музыку.','Prefiero la música porque es interesante.'),
 ('Утром.','Normalmente estudio español.'),
 ('Время действия.','A las seis.'),
 ('Занятие происходит иногда.','¿Qué haces el fin de semana?'),
 ('Mi película favorita es [название].','Ответить на новый порядок вопросов и задать свои.'),
 ('Человек сейчас устал.','Estoy cansada.'),
 ('¿Por qué?','¡Qué bien!'),
 ('Интерес совпал.','A mí no.'),
 ('Человек сегодня не может.','Sí, me gustaría.'),
 ('Завтра.','¿A las seis?'),
 ('Mañana voy a estudiar.','Voy a trabajar.'),
 ('В два.','Попросить повторить, затем подтвердить услышанное.'),
 ('Вчерашнему дню.','Trabajé.'),
 ('Работа вчера.','Hoy.'),
 ('Vivo en Madrid.','Самостоятельно сказать после паузы в другой ситуации.'),
 ('Простой вежливый заказ.','Мне / для меня.'),
 ('Имя и происхождение.','¿De dónde eres?'),
 ('¿Cuál es tu película favorita?','Задавать уместные вопросы и реагировать по смыслу.'),
 ('Ответить на понятую реплику и продолжить разговор.','Más despacio, por favor.'),
 ('Hasta luego.','Спокойно повторить трудные модели в новых коротких ситуациях.'),
 ('Самостоятельный разговор с изменёнными вопросами.','Как допустимое действие; важно понять повтор и продолжить.'),
]
TRANSFER_KEYS=[
 'Me llamo Andrea.','Estoy bien.','¿Podrías repetir eso?','Vivo en Moscú.',
 '¿A qué te dedicas?','Hablo un poco de español.','Vivo en Moscú.','Me gusta viajar.',
 'Me gusta la música clásica.','Prefiero leer.','Hoy no trabajo.','¿A qué hora?',
 '¡Feliz fin de semana!','Prefiero leer.','Yo estoy cansado.','Es una buena idea.',
 'Yo también.','¿Quieres un café?','Ven a las dos.','¿Qué vas a hacer mañana?',
 'Ven a las dos.','Trabajé mucho.','Anoche estudié.','¿Podrías repetir eso?',
 'Un café, por favor.','Prefiero leer.','Quiero hablar contigo.','No lo sé.',
 'Hasta luego.','¿Qué vas a hacer mañana?',
]
TEXT_KEYS={
 'text:1':'Андреа','text:2':'В Москве','text:3':'Английский',
 'text:4':'Читать','text:5':'Классическая','text:6':'На два',
 'text:7':'Повторить медленнее','text:8':'Пешком','text:9':'Работать',
 'text:10':'Много работал','text:11':'Считает её хорошей','text:12':'Нет',
}
for array in [blue['lessons'],expanded['lessons'],bank]:
    require([x['day'] for x in array]==list(range(1,31)),'30 unique ordered days')
require(len(drills)==30,'30 transfer scenarios')
require(len(attribution)==72 and expanded['audio']==attribution,'72 original source records')
for audio,a in attribution.items():
    require(a['audioId']==audio and a['unaltered'],'valid original '+audio)
    require(hashlib.sha256((ROOT/'web'/a['file']).read_bytes()).hexdigest()==a['sha256'],'unchanged bytes '+audio)
    require(a['licenseUrl'].startswith('https://creativecommons.org/'),'license '+audio)

def validate_phrase(p,scope):
    require(p['audio'] in attribution,scope+' existing audio')
    require(p['es']==attribution[p['audio']]['text'],scope+' exact spoken text')
    require(bool(p['ru'].strip()),scope+' Russian meaning')
def validate_mc(x,expected,scope):
    require(x['question'].strip() and x['feedback'].strip(),scope+' question and explanation')
    require(0<=x['answer']<len(x['options']),scope+' answer index')
    require(len(set(map(norm,x['options'])))==len(x['options']),scope+' no duplicate options')
    require(x['options'][x['answer']]==expected,scope+' independently reviewed meaning key')
    require(sum(o==expected for o in x['options'])==1,scope+' unique semantic key')

for i,(lesson,e,practice,drill) in enumerate(zip(blue['lessons'],expanded['lessons'],bank,drills)):
    day=i+1
    require(len(e['examples'])==4,f'day {day} four examples')
    for n,p in enumerate(e['examples']):validate_phrase(p,f'day {day} example {n+1}')
    require(len(set(norm(p['ru']) for p in e['examples']))==4,f'day {day} generated listening/translation unique options')
    require(sum(p['es']==e['build'] for p in e['examples'])==1,f'day {day} token/blank/recall model has one audio target')
    require(0<=drill['index']<4 and e['examples'][drill['index']]['es']==TRANSFER_KEYS[i],f'day {day} independently reviewed transfer target')
    require(drill['prompt'].strip(),f'day {day} transfer contextual prompt')
    require(len(practice['quiz'])==2,f'day {day} two authored quizzes')
    for n,q in enumerate(practice['quiz']):validate_mc(q,SEMANTIC_KEYS[i][n],f'day {day} quiz {n+1}')
    for key in ['rule','sound','goal','scene','check','repair']:
        require(bool(lesson[key].strip()),f'day {day} editorial {key}')
    for key in ['pattern','explanation','pronunciation','mission']:
        require(bool(e[key].strip()),f'day {day} editorial {key}')
    require(all(1<=p<day for p in lesson.get('prerequisites',[])),f'day {day} no future prerequisites')

items=library['items'];require(len(items)==196,'196 library items')
require(len(set(x['id'] for x in items))==196,'unique stable library IDs')
require(Counter(x['type'] for x in items)=={'word':81,'phrase':35,'sentence':68,'text':12},'library finite coverage')
vocab={x['es']:x for x in expanded['vocabulary']}
for x in items:
    require(1<=x['day']<=30,x['id']+' valid day')
    if x['type']=='text':
        require(x['es']==' '.join(p['es'] for p in x['lines']),x['id']+' Spanish aggregate exact')
        require(x['ru']==' '.join(p['ru'] for p in x['lines']),x['id']+' Russian aggregate exact')
        require(len(x['lines'])>=4,x['id']+' meaningful short scene')
        for n,p in enumerate(x['lines']):validate_phrase(p,x['id']+f' line {n+1}')
        require(all(p['speaker'] in ['А','Б'] for p in x['lines']) if x['format']=='Диалог' else all(p['speaker'] is None for p in x['lines']),x['id']+' role assignment')
        validate_mc(x,TEXT_KEYS[x['id']],x['id'])
    else:
        validate_phrase({'audio':x['audio'],'es':x['context'],'ru':x['contextRu']},x['id'])
        require(re.search(r'(?<!\w)'+re.escape(x['es'])+r'(?!\w)',x['context'],re.I) is not None,x['id']+' highlighted unit in spoken context')
        if x['type']=='sentence' or x['id'].startswith('phrase:') and x['id'][7:].isdigit():
            require(x['es']==x['context'] and x['ru']==x['contextRu'],x['id']+' full sentence matches card')
        if x['es'] in vocab:
            require(x['ru']==vocab[x['es']]['ru'],x['id']+' parallel vocabulary meaning')

# Specific semantic regressions that numeric key tests cannot detect.
require('Prefiero leer' in drills[16]['prompt'] and 'любит чтение' not in drills[16]['prompt'],'Yo también scenario uses subject assertion')
texts={x['id']:x for x in items if x['type']=='text'}
SCENE_READY_DAYS={'text:1':1,'text:2':8,'text:3':6,'text:4':10,'text:5':16,'text:6':19,'text:7':6,'text:8':11,'text:9':20,'text:10':23,'text:11':19,'text:12':29}
for key,day in SCENE_READY_DAYS.items():require(texts[key]['day']>=day,key+' availability after reviewed prerequisites')
require('Yo también.' not in texts['text:5']['es'],'gustar conversation does not teach mismatched Yo también')
require('Б' in texts['text:9']['question'],'two-plan question names speaker')
require('Почему' not in texts['text:10']['question'],'reading checks explicit fact, not inferred cause')
require('два слога: a-gua' in expanded['lessons'][24]['pronunciation'],'agua syllable explanation corrected')
require('a la una / es la una' in blue['lessons'][11]['rule'],'time rule includes singular exception')
require('qu обозначает /k/' in expanded['lessons'][17]['pronunciation'],'quiero pronunciation names the digraph')
require('новом голосе' not in blue['lessons'][25]['goal'] and 'одного носителя' in blue['lessons'][25]['scene'],'day 26 does not promise another native voice absent from course')
require('подготовленном видеоматериале' not in blue['lessons'][12]['tasks'][0],'optional unreviewed video is not called prepared mandatory content')

out=ROOT/'.impeccable/review-v7';out.mkdir(parents=True,exist_ok=True)
result={'status':'pass','checks':len(checks),'coverage':{'days':30,'authoredQuizzes':60,'expandedExamples':120,'transferScenarios':30,'libraryItems':196,'shortTexts':12,'roleChoices':24,'grammarModels':30,'originalClips':72},'dataHashes':{n:hashlib.sha256(b).hexdigest() for n,b in raw.items()},'limits':'Finite reviewed corpus and authored keys; not proof that every paraphrase, future edit, or acoustic pronunciation is error-free.'}
(out/'content-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
