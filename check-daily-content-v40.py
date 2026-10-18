"""Check the daily media brief without rewriting historical learning evidence."""
import copy
import hashlib
import json
from pathlib import Path


def read(name):
    return json.loads(Path(name).read_text(encoding="utf-8"))


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


plan = read("course-daily-plan.json")
media = read("lesson-media-v38.json")
assert [x["day"] for x in plan["lessons"]] == list(range(1, 31))
assert [x["day"] for x in media["units"]] == list(range(1, 31))
resources = {x["id"]: x for x in media["resources"]}
# These targets name the facts to attend to, never the correct choice.
targets = {
    "first-class": ("шоколада", "конце"),
    "names": ("García", "apellido", "Патрисия"),
    "origin": ("мероприятии", "Перу"),
    "jobs": ("повар", "больницей"),
    "likes": ("пляжу", "футбола"),
    "clock": ("десять с половиной", "не знает время"),
    "calendar": ("выходными", "месяцев"),
    "present": ("кофе", "vivir"),
    "weekend": ("пятницам", "субботу"),
    "ser-estar": ("Севилья", "преподавательница"),
}
assert set(targets) == set(resources)
for day in plan["lessons"]:
    for kind in ("reading", "video"):
        role = day[kind]["role"]
        assert "Необязательное" not in role, (day["day"], kind)
        assert "вне" not in role and "16" in role and "35" in role
    phase = next(x for x in day["phases"] if x["id"] == "lesson")
    assert phase["minutes"] == 16
    assert any(x["id"] == "context-media" for x in phase["instructions"])
for unit in media["units"]:
    assert all(s in unit["beforeRu"] for s in targets[unit["videoResourceId"]]), unit["day"]
    resource = resources[unit["videoResourceId"]]
    assert len(resource["questions"]) == 2
    for q in resource["questions"] + [resource["delayedQuestion"]]:
        assert len(q["options"]) == 3 and 0 <= q["answer"] < 3
        assert "без списка" not in q["prompt"]

# All IDs, question keys, answers, options, audio, source URLs, source text,
# daily outcomes, durations and support frames must remain byte-equivalent
# as structured data. Only the audited instructional copy may differ.
protected_plan = copy.deepcopy(plan)
for lesson in protected_plan["lessons"]:
    lesson["reading"].pop("role", None)
    lesson["video"].pop("role", None)
assert digest(protected_plan) == "1c3f914c07b0a4eecc3b089f85f2355e4316693119ab2a4325cf51146b658380"
protected_media = copy.deepcopy(media)
for unit in protected_media["units"]:
    unit.pop("beforeRu", None)
for resource in protected_media["resources"]:
    resource["delayedQuestion"].pop("prompt", None)
assert digest(protected_media) == "61fd68a842dec85f935cca2f72f50e701ada2adaa5afd6e4889c86495c83fead"
print(json.dumps({"passed": True, "dailyRoles": 60, "videoBriefs": 30,
                  "resources": 10, "protectedLearningData": "unchanged"}))
