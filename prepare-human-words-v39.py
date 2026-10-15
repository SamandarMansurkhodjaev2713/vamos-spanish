"""Package checked human excerpts; never fabricate missing forms or change originals.

Inputs are private research checkpoints. Published provenance is per file.
Run again only after independently checking additional source candidates.
"""
from pathlib import Path
import array, hashlib, json, math, re, shutil, sys, unicodedata, wave

ROOT = Path(__file__).resolve().parent
read = lambda p: json.loads((ROOT / p).read_text(encoding='utf8'))
write = lambda p, x: (ROOT / p).write_text(json.dumps(x, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
normal = lambda s: unicodedata.normalize('NFC', s).lower().strip(' \t\n¿?¡!.,;:«»\"\'“”()')
extra = read('word-audio-extra-v38.json')
target = set(extra['audit']['missingWords'])
registry = {'version': 1, 'scope': 'Human-spoken excerpts, never synthesized. Extractions are labelled and licensed separately from unchanged source recordings.', 'clips': {}, 'words': {}}
registry['sourceExports'] = []
for name, url in [('audio.tar.bz2', 'https://downloads.tatoeba.org/exports/sentences_with_audio.tar.bz2'), ('spa.tsv.bz2', 'https://downloads.tatoeba.org/exports/per_language/spa/spa_sentences.tsv.bz2')]:
    content = (ROOT / '.cache/audio-corpus' / name).read_bytes()
    registry['sourceExports'].append({'url': url, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
dest = ROOT / 'web/assets/word-audio-human'
dest.mkdir(parents=True, exist_ok=True)

def package(word, source_file, item):
    assert word in target and word not in registry['words']
    assert item['unaltered'] is False and 'ND' not in item['license']
    assert item['kind'] == 'human-excerpt' and item['language'] == 'es'
    original = ROOT / source_file
    content = original.read_bytes()
    assert hashlib.sha256(content).hexdigest() == item['sha256']
    with wave.open(str(original)) as w:
        duration = w.getnframes() / w.getframerate()
        assert duration >= .15
        assert w.getsampwidth() == 2
        samples = array.array('h', w.readframes(w.getnframes()))
        if sys.byteorder != 'little': samples.byteswap()
    rms = math.sqrt(sum(value * value for value in samples) / len(samples)) / 32768
    assert rms > .0001, 'Silent excerpt: ' + word
    assert abs(duration - (item['endSeconds'] - item['startSeconds'])) < .04
    item['verification'].update({'durationSeconds': round(duration, 6), 'rmsAmplitude': round(rms, 6), 'peakAmplitude': round(max(abs(value) for value in samples) / 32768, 6)})
    slug = unicodedata.normalize('NFD', word).encode('ascii', 'ignore').decode() + '-' + hashlib.sha256(word.encode()).hexdigest()[:6]
    key = 'word-human:' + slug
    assert not any(clip['file'] == 'assets/word-audio-human/' + slug + '.wav' for clip in registry['clips'].values())
    item.update({'text': word, 'file': 'assets/word-audio-human/' + slug + '.wav', 'bytes': len(content)})
    shutil.copyfile(original, ROOT / 'web' / item['file'])
    registry['clips'][key] = item
    registry['words'][word] = key

for word, row in read('.cache/word-v39/tatoeba/candidates.json')['accepted'].items():
    source = row['source']
    assert source['license'] == 'CC BY-NC 4.0' and source['speaker'] == 'marcelostockle'
    for field in ['baseVerification', 'smallVerification']:
        assert [normal(w['word']) for s in row[field] for w in s['words'] if normal(w['word'])] == [word]
    original = ROOT / '.cache/word-v39/tatoeba' / (source['audioId'] + '.mp3')
    assert hashlib.sha256(original.read_bytes()).hexdigest() == row['sourceSha256']
    package(word, row['file'], {
        'kind': 'human-excerpt', 'language': 'es', 'unaltered': False,
        'speaker': 'marcelostockle (Marcelo Alejandro Stöckle Márquez)',
        'speakerUrl': 'https://tatoeba.org/en/user/profile/marcelostockle',
        'nativeVerified': True, 'nativeEvidence': 'Speaker profile explicitly lists native Chilean Spanish.',
        'sentenceUrl': 'https://tatoeba.org/en/sentences/show/' + source['sentenceId'],
        'sourceUrl': row['sourceUrl'], 'sourceText': source['text'],
        'sourceSha256': row['sourceSha256'], 'sourceBytes': row['sourceBytes'],
        'license': 'CC BY-NC 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by-nc/4.0/',
        'startSeconds': row['start'], 'endSeconds': row['end'], 'sha256': row['sha256'],
        'modification': 'One word extracted from human speech to PCM WAV; no generated voice, pitch change or time stretch.',
        'verification': {'sourceExactForm': True, 'blindRecognizerVariants': ['faster-whisper-base', 'faster-whisper-small'], 'isolatedExactForm': True, 'manuallyAuditioned': False}
    })

for row in read('.cache/word-v39/literary-candidates-checked.json')['candidates']:
    if not row.get('isolatedBlindAsr', {}).get('matchesExactly') or normal(row.get('isolatedBaseAsr', {}).get('text', '')) != row['word']:
        continue
    assert row['license'] == 'Public Domain Mark 1.0'
    assert hashlib.sha256((ROOT / 'web' / row['sourceFile']).read_bytes()).hexdigest() == row['sourceSha256']
    package(row['word'], row['candidateFile'], {
        'kind': 'human-excerpt', 'language': 'es', 'unaltered': False,
        'speaker': row['speaker'], 'speakerUrl': 'https://librivox.org/fabulas-literarias-by-tomas-de-iriarte/',
        'nativeVerified': False, 'sentenceUrl': 'https://librivox.org/fabulas-literarias-by-tomas-de-iriarte/',
        'sourceUrl': row['sourceUrl'], 'sourceText': row['sourceSegment'], 'sourceSha256': row['sourceSha256'],
        'license': row['license'], 'licenseUrl': row['licenseUrl'],
        'startSeconds': row['start'], 'endSeconds': row['end'], 'sha256': row['sha256'],
        'modification': row['changes'],
        'verification': {'sourceExactForm': True, 'blindRecognizerVariants': ['faster-whisper-base', 'faster-whisper-small'], 'isolatedExactForm': True, 'manuallyAuditioned': False}
    })

added = set(registry['words'])
registry['audit'] = {'newForms': len(added), 'coveredForms': extra['audit']['coveredWords'] + len(added), 'totalForms': len(extra['audit']['targetWords']), 'missingWords': sorted(target - added), 'coverageGroups': {}}
for key, group in extra['audit']['coverageGroups'].items():
    missing = set(group['missingWords']) - added
    registry['audit']['coverageGroups'][key] = {'totalForms': group['totalForms'], 'coveredForms': group['totalForms'] - len(missing), 'missingWords': sorted(missing)}
write('word-audio-human-v39.json', registry)
write('web/assets/word-audio-human/ATTRIBUTION.json', registry)

# Concrete handoff for future human recording, without displaying internal workflow to learners.
contexts = {}
def walk(x):
    if isinstance(x, dict):
        for k, value in x.items():
            if k in ['es', 'text'] and isinstance(value, str):
                for word in set(re.findall(r'[a-záéíóúüñ]+', value.lower())) & (target - added):
                    if len(contexts.setdefault(word, [])) < 3 and value not in contexts[word]: contexts[word].append(value)
            elif isinstance(value, (dict, list)): walk(value)
    elif isinstance(x, list):
        for value in x: walk(value)
for name in ['course-library.json', 'course-reader-beginner.json', 'course-stories.json', 'course-literature.json']:
    walk(read(name))
queue = {'scope': 'Exact remaining forms requiring licensed human recordings; no TTS or sentence substitution.', 'recordingInstructions': ['Record the exact accented form shown, not its infinitive.', 'Read naturally in Spanish, one word per file, with clean silence on both sides.', 'Keep the original WAV/MP3, named speaker, permission/license and source evidence.', 'Check each isolated recording by listening before approving it. Recognition alone is not phonetic quality assurance.'], 'count': len(target - added), 'items': [{'word': word, 'groups': [key for key, group in registry['audit']['coverageGroups'].items() if word in group['missingWords']], 'contexts': contexts.get(word, [])} for word in sorted(target - added)]}
write('word-audio-recording-queue-v39.json', queue)

audit = registry['audit']
dictionary = audit['coverageGroups']['dictionaryWordCards']
beginner = audit['coverageGroups']['beginner18']
readme = (ROOT / 'README.md').read_text(encoding='utf8')
readme = re.sub(r'\d+ отдельных словоформ', str(audit['coveredForms']) + ' отдельных словоформ', readme)
paragraph = f"""**Озвучка слов.** Сохранены 698 ранее опубликованных точных форм без изменения исходных файлов. Добавлены **{audit['newForms']} явно подписанных фрагментов человеческой речи**, выделенных только из источников с лицензиями, допускающими обработку. Всего доступны **{audit['coveredForms']} форм**: **{dictionary['coveredForms']} из {dictionary['totalForms']}** уникальных словоформ в словарных карточках и **{beginner['coveredForms']} из {beginner['totalForms']}** уникальных форм в 18 текстах A1–A2. **{queue['count']} форм пока без отдельной записи**; полная фраза не выдаётся за звук слова. Каждое слово сочетания нажимается отдельно; повторное нажатие запускает запись заново, перевод и место чтения сохраняются. Аудио разных авторов и вариантов испанского; родной язык отмечен только при наличии явного источника. Автоматическая сверка двух вариантов Whisper не заменяет прослушивание человеком. [Неизменённые оригиналы](word-audio-extra-v38.json) · [Новые фрагменты и покрытие](word-audio-human-v39.json) · [Точный список для дальнейшей человеческой записи](word-audio-recording-queue-v39.json)."""
readme, replaced = re.subn(r'\*\*Озвучка слов\.\*\*[^\n]*', lambda _: paragraph, readme)
assert replaced == 1
(ROOT / 'README.md').write_text(readme, encoding='utf8')
print(json.dumps({'newForms': len(added), 'remaining': queue['count'], 'coverage': {key: [g['coveredForms'], g['totalForms']] for key, g in registry['audit']['coverageGroups'].items()}}, ensure_ascii=False))
