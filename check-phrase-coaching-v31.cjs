/* These checks verify source fidelity and shape, not acoustic quality or learning efficacy. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const coaching = read('course-phrase-coaching.json');
const expanded = read('course-expanded.json');
const attribution = read('web/assets/audio/ATTRIBUTION.json');
const checks = [];
function check(name, fn) { fn(); checks.push(name); }
const models = coaching.lessons.flatMap(l => l.models.map(m => ({day:l.day, ...m})));

check('Exactly the first three models of each of days 1–7, with unchanged Spanish, Russian and audio ID', () => {
  assert.equal(coaching.version, 1);
  assert.deepEqual(coaching.lessons.map(l => l.day), [1,2,3,4,5,6,7]);
  assert.equal(models.length, 21);
  for (const lesson of coaching.lessons) {
    assert.equal(lesson.models.length, 3);
    const source = expanded.lessons.find(l => l.day === lesson.day).examples.slice(0,3);
    assert.deepEqual(lesson.models.map(({es,ru,audio}) => ({es,ru,audio})), source);
  }
});

check('Every caption is the exact licensed recording caption and original media hash', () => {
  for (const model of models) {
    const source = expanded.audio[model.audio], license = attribution[model.audio];
    assert(source && license, `Missing licensed audio ${model.audio}`);
    assert.equal(source.text, model.es);
    assert.equal(license.text, model.es);
    assert.equal(license.unaltered, true);
    assert.equal(source.sha256, license.sha256);
    assert(license.speaker && license.license && license.licenseUrl);
    const file = fs.readFileSync(path.join(root, 'web', license.file));
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'), license.sha256);
  }
});

check('One to three meaningful chunks reconstruct every original Spanish model exactly', () => {
  for (const model of models) {
    assert(model.chunks.length >= 1 && model.chunks.length <= 3);
    assert.equal(model.chunks.map(c => c.es).join(' '), model.es);
    for (const chunk of model.chunks) {
      assert.equal(chunk.es, chunk.es.trim());
      for (const key of ['es','meaningRu','noteRu']) assert.equal(typeof chunk[key], 'string');
      assert.match(chunk.meaningRu, /[А-Яа-яЁё]/u);
      assert.match(chunk.noteRu, /[А-Яа-яЁё]/u);
      assert(chunk.meaningRu.length > 0 && chunk.noteRu.length > 0);
    }
  }
});

check('All coaching has a concrete use, misconception and fewer than 90 Russian words', () => {
  for (const model of models) {
    assert.match(model.useRu, /[А-Яа-яЁё]/u);
    assert.match(model.mistakeRu, /[А-Яа-яЁё]/u);
    const fields = [model.ru, model.useRu, model.mistakeRu,
      ...model.chunks.flatMap(c => [c.meaningRu,c.noteRu]),
      ...(model.contrast ? [model.contrast.ru,model.contrast.noteRu] : [])];
    const count = fields.join(' ').match(/[А-Яа-яЁё]+(?:[-–][А-Яа-яЁё]+)*/gu)?.length || 0;
    assert(count < 90, `Day ${model.day}: ${model.es}: ${count} words`);
    assert.doesNotMatch(fields.join(' '), /гарантирован|без акцента|лучше Duolingo|C1/iu);
  }
});

check('Contrasts are short text only; no synthesized audio or new media URLs are introduced', () => {
  for (const model of models) {
    assert.deepEqual(Object.keys(model).sort(),
      ['audio','chunks',...(model.contrast ? ['contrast'] : []),'day','es','mistakeRu','ru','useRu'].sort());
    assert.doesNotMatch(JSON.stringify(model), /https?:|speechSynthesis|tts/iu);
    if (model.contrast) {
      assert.deepEqual(Object.keys(model.contrast).sort(), ['es','ru','noteRu'].sort());
      assert(model.contrast.es && model.contrast.ru && model.contrast.noteRu);
      // Only one explicitly marked feminine state variant extends the known spoken models.
      assert(model.contrast.es === 'Estoy contenta.' ||
        expanded.lessons.slice(0, model.day).some(l => l.examples.some(e => e.es === model.contrast.es)));
    }
  }
});

console.log(JSON.stringify({pass:checks.length, models:models.length, checks}, null, 2));
