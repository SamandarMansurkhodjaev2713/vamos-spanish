"""Verify guidance against independent task witnesses and licensed sound originals.

Run from any directory with Python 3.12. Does not modify course or saved progress.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def check(condition, message):
    if not condition:
        raise AssertionError(message)


guidance = load("course-guidance.json")
expanded = load("course-expanded.json")
bank = load("exercise-bank.json")
goals = load("course-goals.json")
lessons = guidance["lessons"]

# Independently read witnesses from the actual stage-3 and stage-4/5 models.
# In particular, day 3 is Más despacio, not the tempting third example Podrías.
builders = [
    "788477", "35146", "460273", "702971", "438291", "639147",
    "639147", "442545", "857926", "44238", "455085", "1062376",
    "707610", "441748", "34192", "442647", "505501", "513201",
    "437723", "438641", "439086", "502948", "502948", "460273",
    "527312", "435976", "454079", "438061", "873609", "442545",
]
recalls = [
    "444117", "38888", "439034", "704237", "441667", "732325",
    "788477", "45705", "444089", "441748", "707489", "609857",
    "442545", "48368", "937847", "48650", "437208", "517084",
    "609857", "515968", "609857", "503125", "455085", "453474",
    "517084", "702971", "444089", "48650", "437738", "557687",
]
missing = [
    "te", "tú", "despacio", "en", "inglés", "español", "llamo", "gusta",
    "gusta", "leer", "desayuno", "a", "gusta", "interesante", "contenta",
    "siento", "puedo", "un", "a", "a", "a", "mucho", "no", "repetir",
    "un", "en", "gusta", "siento", "vemos", "vas",
]
quiz_answers = [
    "¿Cómo te llamas?", "Возвращает вопрос собеседнику.", "¿Puedes repetir?",
    "В Мадриде.", "Estudio español.", "Я учу испанский.", "Soy de México.",
    "Не любит кино.", "Любимый фильм.", "Я предпочитаю музыку.", "Утром.",
    "Время действия.", "Занятие происходит иногда.",
    "Mi película favorita es [название].", "Человек сейчас устал.", "¿Por qué?",
    "Интерес совпал.", "Человек сегодня не может.", "Завтра.",
    "Mañana voy a estudiar.", "В два.", "Вчерашнему дню.", "Работа вчера.",
    "Vivo en Madrid.", "Простой вежливый заказ.", "Имя и происхождение.",
    "¿Cuál es tu película favorita?",
    "Ответить на понятую реплику и продолжить разговор.", "Hasta luego.",
    "Самостоятельный разговор с изменёнными вопросами.",
]

check([x["day"] for x in lessons] == list(range(1, 31)), "30 ordered unique days")
check(len({x["scene"] for x in lessons}) == 30, "Original specific contexts")
check(len({x["miniRule"]["title"] for x in lessons}) == 30, "Distinct rule titles")
check(len({x["commonMistakeRu"] for x in lessons}) == 30, "Distinct mistakes")

audio_ids = set()
for i, (g, e, b, goal) in enumerate(zip(lessons, expanded["lessons"], bank, goals["lessons"])):
    d = i + 1
    check(g["communicativeGoal"] == goal["goal"], f"day {d}: goal contract")
    check(2 <= len(g["outcomes"]) <= 3, f"day {d}: bounded actionable outcomes")
    check(len(g["introTips"]) == 3, f"day {d}: three intro models")
    for tip, model in zip(g["introTips"], e["examples"][:3]):
        check(all(tip[k] == model[k] for k in ("es", "ru", "audio")), f"day {d}: exact intro/audio pairing")
        check(25 <= len(tip["tipRu"]) <= 240, f"day {d}: concise actionable intro tip")
        audio_ids.add(tip["audio"])
    hints = g["practiceHints"]
    check(set(hints) == {"listening", "quiz", "builder", "gap", "recall", "oral"}, f"day {d}: all six task modes")
    check(hints["quiz"]["question"] == b["quiz"][0]["question"], f"day {d}: actual quiz question")
    check(b["quiz"][0]["options"][b["quiz"][0]["answer"]] == quiz_answers[i], f"day {d}: independent quiz semantic key")
    check(hints["listening"]["audio"] == e["examples"][0]["audio"], f"day {d}: actual listening model")
    for kind in ("builder", "oral"):
        check(hints[kind]["audio"] == builders[i], f"day {d}: {kind} independent native witness")
    for kind in ("gap", "recall"):
        check(hints[kind]["audio"] == recalls[i], f"day {d}: {kind} independent native witness")
    check(hints["gap"]["missingWord"] == missing[i], f"day {d}: exact missing word")
    check(re.search(r"(?<![A-Za-zÁ-ú])" + re.escape(missing[i]) + r"(?![A-Za-zÁ-ú])", hints["gap"]["hintRu"], re.I), f"day {d}: gap prose names actual missing model token")
    for kind in ("listening", "builder", "gap", "recall", "oral"):
        h = hints[kind]
        matches = [p for p in e["examples"] if p["audio"] == h["audio"]]
        check(len(matches) == 1, f"day {d}: {kind} source exists")
        p = matches[0]
        check(h["targetEs"] == p["es"] and h["targetRu"] == p["ru"], f"day {d}: {kind} exact text pair")
        check(20 <= len(h["hintRu"]) <= 800, f"day {d}: bounded useful hint")
        check(expanded["audio"][h["audio"]]["text"] == h["targetEs"], f"day {d}: {kind} actual licensed recording text")
        audio_ids.add(h["audio"])
    rule = g["miniRule"]
    check(rule["audio"] == builders[i], f"day {d}: mini-rule exact native example")
    source = next(p for p in e["examples"] if p["audio"] == builders[i])
    check(rule["exampleEs"] == source["es"] and rule["exampleRu"] == source["ru"], f"day {d}: rule/audio text pair")
    check(45 <= len(g["commonMistakeRu"]) <= 360, f"day {d}: concise concrete mistake")
    check(1 <= len(g["phraseFrames"]) <= 2, f"day {d}: small supplementary frame budget")
    for frame in g["phraseFrames"]:
        check(set(frame) == {"es", "ru", "noteRu"}, f"day {d}: supplementary text must not fake native audio")
    if "quizPrep" in g:
        check(set(g["quizPrep"]) == {"es", "ru", "noteRu"}, f"day {d}: text-only quiz preparation")
        check(all(g["quizPrep"].values()), f"day {d}: quiz preparation translation and scope")

# Earlier authoring mistakes would pass a structural target test but teach the wrong
# utterance. These independent prose witnesses specifically prevent that regression.
prose_witnesses = {
    2: ("встречный", "рад"),
    3: ("помедленнее", "из третьей записи"),
    7: ("Андреа", "проживания"),
    8: ("поп-музыка", "вопрос"),
    10: ("читать", "интересно"),
    11: ("завтракаю", "иду пешком"),
    18: ("хочу кофе", "я не могу"),
    20: ("французский", "вопрос третьей"),
    25: ("хочу кофе", "выбор воды"),
}
for d, (required, obsolete) in prose_witnesses.items():
    clue = lessons[d - 1]["practiceHints"]["recall"]["hintRu"]
    check(required in clue and obsolete not in clue, f"day {d}: recall clue describes actual alternate target")

# No hidden alternative-course assumption: explicit teaching for text-only quiz variants.
check("¿Puedes repetir?" in lessons[2]["introTips"][2]["tipRu"], "day 3: shorter quiz request prepared")
check("Estoy aprendiendo español" in lessons[5]["miniRule"]["explanation"], "day 6: learning text model prepared")
check("mi película favorita" in lessons[8]["miniRule"]["explanation"], "day 9: own vs su model")
check("a mí también" in lessons[16]["miniRule"]["explanation"], "day 17: a mí vs yo")
check([g["day"] for g in lessons if "quizPrep" in g] == [3, 6, 8, 9, 11, 16, 19, 22, 23, 27], "10 explicit prior-to-quiz text primers")

for aid in audio_ids:
    entry = expanded["audio"][aid]
    check(entry["unaltered"] and entry["license"] and entry["licenseUrl"], f"audio {aid}: provenance")
    path = ROOT / "web" / entry["file"]
    check(hashlib.sha256(path.read_bytes()).hexdigest() == entry["sha256"], f"audio {aid}: immutable original bytes")

print(f"PASS: 30 guidance lessons; 90 exact intro tips; 180 task hints; 30 quiz semantic keys; {len(audio_ids)} immutable native originals.")
print("PASS: independent builder/recall/gap witnesses, targeted wrong-prose regressions, text-only bridge models; no invented audio.")

check(lessons[8]["quizPrep"]["es"] == "Mi película favorita es…", "day9 personal mi frame before quiz")
check(lessons[22]["quizPrep"]["es"] == "Ayer trabajé. Mañana voy a estudiar.", "day23 optional past branch prepares skipped22 verb")
