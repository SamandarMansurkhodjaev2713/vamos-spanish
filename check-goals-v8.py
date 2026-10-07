"""Independent source/contract audit; makes no learning-outcome claims."""
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
load = lambda name: json.loads((BASE / name).read_text(encoding='utf8'))
blueprint = load('course-blueprint.json')
expanded = load('course-expanded.json')
bank = load('exercise-bank.json')
goals = load('course-goals.json')
assert len(goals['lessons']) == 30
assert [row['day'] for row in goals['lessons']] == list(range(1, 31))
assert len({row['warmup'] for row in goals['lessons']}) == 30
assert len({row['personalPrompt'] for row in goals['lessons']}) == 30
assert len({row['reviewContrast'] for row in goals['lessons']}) == 30
for row, lesson, examples, exercises in zip(goals['lessons'], blueprint['lessons'], expanded['lessons'], bank):
    day = row['day']
    assert day == lesson['day'] == examples['day'] == exercises['day']
    assert row['goal'] == lesson['goal']
    assert row['prerequisites'] == lesson['prerequisites']
    assert all(isinstance(n, int) and 1 <= n < day for n in row['prerequisites'])
    assert row['activePatterns'] == [a['es'] for a in examples['examples'][:3]]
    assert row['textPattern'] == examples['pattern']
    assert row['trainedNativeIds'] == [a['audio'] for a in examples['examples'][:3]]
    assert row['recognitionNativeIds'] == [a['audio'] for a in examples['examples'][3:]]
    for example in examples['examples']:
        clip = expanded['audio'][example['audio']]
        assert clip['text'] == example['es'], (day, example)
        path = BASE / 'web' / clip['file']
        assert path.is_file() and path.stat().st_size == clip['bytes']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == clip['sha256']
        assert clip['unaltered'] is True and clip['license'] and clip['licenseUrl']
    assert len(row['closedChecks']) == len(exercises['quiz']) == 2
    for check, quiz in zip(row['closedChecks'], exercises['quiz']):
        assert check['question'] == quiz['question']
        assert check['expected'] == quiz['options'][quiz['answer']]
        assert check['proves'] == 'Узнавание изученного различия: ' + quiz['feedback']
    assert row['missionVerification']['task'] == exercises['own']
    assert row['missionVerification']['expandedMission'] == examples['mission']
    assert row['missionVerification']['component'] == 'lesson-stage-6'
    assert row['missionVerification']['automated'] is False
    for key in ('warmup', 'personalPrompt', 'reviewContrast', 'nativeScope'):
        assert len(row[key]) > 20 and '<' not in row[key], (day, key)
    assert 'одну заданную модель' in row['limits']['typed']
    assert 'не подтверждают' in row['limits']['self']

# The strongest mismatch risks have explicit, accurate boundaries.
assert 'Porque есть' in goals['lessons'][9]['nativeScope']
assert not any('porque' in text.lower() for text in goals['lessons'][9]['activePatterns'])
assert 'чужой' in goals['lessons'][8]['reviewContrast']
assert 'A mí también' in goals['lessons'][16]['nativeScope']
assert 'Новый голос' in goals['lessons'][25]['nativeScope']
assert 'прошлое не считается освоенным' in goals['lessons'][21]['nativeScope']
print('PASS: 30 source-grounded goals; 120 audio references/hashes; 60 exact quiz contracts; 30 missions/prompts/contrasts; critical boundaries.')
