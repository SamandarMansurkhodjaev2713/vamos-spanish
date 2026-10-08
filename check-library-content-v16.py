"""Independent preservation, source and semantic witnesses for the v16 library.

Five content passes: meaning; grammar/accent; register/pragmatics;
audio provenance; practical coverage. These are finite authored witnesses,
not automatic translation quality, learner transfer or acoustic evaluation.
"""
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "course-library.json").read_text(encoding="utf-8"))
expanded = json.loads((ROOT / "course-expanded.json").read_text(encoding="utf-8"))
attribution = json.loads((ROOT / "web/assets/audio/ATTRIBUTION.json").read_text(encoding="utf-8"))
items = data["items"]
original, added = items[:196], items[196:]
ORIGINAL_SHA256 = "dd2e788af461ea750425f3ae02384701626b67a434b130a60b1bb82c4d95479f"
canonical = json.dumps(original, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
assert hashlib.sha256(canonical.encode()).hexdigest() == ORIGINAL_SHA256, "An existing item changed"
assert data["legacyTopics"] == ["Знакомство", "Интересы", "Каждый день", "Люди и планы", "Прошлое", "Кафе и разговор"]
assert len(added) == 120
assert Counter(i["type"] for i in added) == {"word": 40, "phrase": 36, "sentence": 44}
assert len(items) == 316
assert len({i["id"] for i in items}) == len(items)


def norm(text):
    return re.sub(r"\s+", " ", re.sub(r"[¿?¡!.,;:]", "", unicodedata.normalize("NFC", text).lower())).strip()


old_spanish = {norm(i["es"]) for i in original}
new_spanish = set()
categories = {c["id"]: c for c in data["categories"]}
assert len(categories) == 16
assert data["topics"] == [c["title"] for c in data["categories"]]
assert set(data["itemThemes"]) == {i["id"] for i in items}
assert all(value in categories for value in data["itemThemes"].values())
recorded = []
for item in added:
    assert ":v16:" in item["id"]
    assert item["reviewKey"] == "l:" + item["id"]
    assert type(item["day"]) is int and 1 <= item["day"] <= 30
    assert item["categoryId"] in categories
    assert item["topic"] == categories[item["categoryId"]]["title"]
    assert data["itemThemes"][item["id"]] == item["categoryId"]
    assert item["es"] and item["ru"] and item["context"] and item["contextRu"]
    assert len(item["usage"]) >= 30
    assert not re.search(r"[А-Яа-яЁё]", item["es"] + item["context"])
    assert unicodedata.normalize("NFC", item["es"]) == item["es"]
    assert norm(item["es"]) not in old_spanish, "New entry repeats existing Spanish: " + item["id"]
    assert norm(item["es"]) not in new_spanish, "Repeated new Spanish: " + item["id"]
    new_spanish.add(norm(item["es"]))
    assert item["accepted"] and item["es"] in item["accepted"]
    assert len({norm(a) for a in item["accepted"]}) == len(item["accepted"])
    assert not any(key in item for key in ["audioLabel", "synthesizedAudio", "aiVoice"])
    if item["audio"] is None:
        assert item["authored"] is True
        assert "без аудиозаписи" in item["provenance"]
    else:
        recorded.append(item)
        assert item["authored"] is False
        assert item["type"] == "phrase"
        source = expanded["audio"][item["audio"]]
        assert item["context"] == source["text"] == attribution[item["audio"]]["text"]
        assert norm(item["es"]) in norm(item["context"]), "Recorded chunk is not in exact context"
        assert (ROOT / "web/assets/audio" / (item["audio"] + ".mp3")).is_file()
assert len(recorded) == 7
assert len(expanded["audio"]) == len(attribution) == 72

by_id = {i["id"]: i for i in added}
word = lambda slug: by_id["word:v16:" + slug]
phrase = lambda slug: by_id["phrase:v16:" + slug]
sentence = lambda slug: by_id["sentence:v16:" + slug]

# Pass 1: translation distinguishes surname/name, need/payment and location/direction.
assert word("apellido")["ru"] == "фамилия"
assert "correo electrónico" in word("correo")["context"]
assert "при оплате" in phrase("con-tarjeta")["ru"]
assert sentence("card-payment")["ru"] == "Можно заплатить картой?"
assert sentence("street-centre")["ru"] == "Эта улица ведёт в центр?"
assert "туалет" in word("bano")["ru"]

# Pass 2: meaningful accents, agreement and prepositions retain their intended fact.
assert word("telefono")["es"] == "teléfono"
assert word("estacion")["es"] == "estación"
assert phrase("donde-esta")["es"] == "¿Dónde está?"
assert sentence("film-liked")["es"] == "Me gustó mucho la película."
assert "de diez euros" in word("precio")["context"]
assert "mucha hambre" in word("hambre")["usage"]
assert sentence("key-table")["es"] == "La llave está encima de la mesa."
assert sentence("tomato-half")["es"] == "Quisiera medio kilo de tomates."

# Pass 3: explicit register and reference prevent changing role or promise.
assert "usted" in sentence("ask-bill")["usage"].lower()
assert "tú" in phrase("me-ayudas")["usage"]
assert "не подтверждает уровень" in sentence("learn-spanish")["usage"]
assert "не диагноз" in sentence("not-well")["usage"]
assert "не новая запись" in sentence("coffee-milk")["usage"].lower()
assert "время" in phrase("a-las-dos")["usage"].lower()

# Pass 4 was independently cross-checked above against attribution, not app grading.
# Pass 5: practical themes carry different grammatical units; no empty group or CEFR award.
assert set(Counter(data["itemThemes"].values())) == set(categories)
assert all(c["description"] and len(c["description"]) > 20 for c in categories.values())
assert all(not re.search(r"сертификат|гарантия владения", i["provenance"]) for i in added)
assert data["contentExpansion"]["originalItemCount"] == 196
assert data["contentExpansion"]["addedItemCount"] == 120
print(json.dumps({"passed": True, "lenses": 5, "originalObjectsUnchanged": 196,
                  "added": dict(Counter(i["type"] for i in added)), "total": len(items),
                  "themes": len(categories), "exactRecordedContextChunks": len(recorded),
                  "authoredWithoutAudio": len(added) - len(recorded),
                  "suppliedHumanClips": len(attribution),
                  "limits": "Finite metadata/semantic witnesses, not native-teacher or acoustic validation."},
                 ensure_ascii=False))
