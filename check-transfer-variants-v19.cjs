/* Semantic transfer alternatives must not broaden exact phrase recall. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const noop = () => {};
const results = [];

function probe(surface, day, answer, kind = 'transfer') {
 const window = {}, observations = [];
 const document = {querySelector: selector => selector === '[data-drill-check]' ? {disabled: false, innerHTML: ''} : null};
 const context = {window, document, Date, requestAnimationFrame: noop};
 vm.createContext(context);
 for (const file of ['course-data.js', 'drills.js', 'learning.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, surface, file), 'utf8'), context);
 }
 const data = window.VAMOS_DATA, drill = window.VAMOS_DRILLS[day - 1];
 const target = data.expanded.lessons[day - 1].examples[drill.index];
 const phrases = [target, ...data.expanded.lessons[day - 1].examples.filter(p => p.audio !== target.audio)].slice(0, 3);
 const state = {day, completed: [], cards: {}};
 const app = window.VamosLearning.create({
  data, state, esc: s => s, icon: () => '', mascot: () => '', playButton: () => '',
  audioControls: () => '', audioStatus: () => '', footer: () => '',
  save: noop, render: noop, toast: noop, dueKeys: () => [], chapters: [],
  navigate: noop, openLesson: noop, learningDay: () => day, sound: noop,
  adaptive: {plan: () => ({phrases, focus: kind === 'transfer' ? 'situation' : 'recall', reason: ''}), observe: v => observations.push(v)}
 });
 app.startDrill();
 app.input({id: 'drill-answer', value: answer});
 app.click({dataset: {}, hasAttribute: key => key === 'data-drill-check'});
 assert.equal(observations.length, 1);
 assert.equal(observations[0].skill, kind === 'transfer' ? 'situation' : 'recall');
 return {surface, day, kind, answer, correct: observations[0].correct, html: app.drillHTML(), state, target, app};
}

const positives = [
 [2, 'Estoy bien.'], [2, 'Bien, gracias.'], [2, 'Bien.'],
 [3, '¿Podrías repetir eso?'], [3, '¿Puedes repetir?'], [3, '¿Puedes repetir eso?'],
 [3, '¿Podrías repetir?'], [3, '¿Puedes repetir, por favor?'],
 [3, '¿Puedes repetir eso, por favor?'], [3, '¿Podrías repetir, por favor?'],
 [3, '¿Podrías repetir eso, por favor?'], [3, 'PUEDES REPETIR ESO, POR FAVOR'],
 [6, 'Hablo un poco de español.'], [6, 'Hablo español, un poco.']
];
const negatives = [
 [2, 'Estoy contento.'], [2, 'Estoy mal.'], [2, '¿Y tú?'],
 [3, 'Más despacio.'], [3, 'No entiendo.'], [3, 'Lo siento.'],
 [3, '¿Puedo repetir?'], [3, '¿Puedes repetir eso? No entiendo.'],
 [6, 'Hablo español.'], [6, 'No hablo español.'], [6, 'Hablo un poco de inglés.']
];
for (const surface of ['web', 'docs']) {
 for (const [day, answer] of positives) {
  const r = probe(surface, day, answer);
  assert.equal(r.correct, true, `${surface} day ${day}: must accept ${answer}`);
  assert.match(r.html, /Подходит!/);
  assert(r.html.includes(r.target.es), 'Accepted variant must keep exact human audio phrase label');
  assert.equal(Object.keys(r.state.cards).length, 0, 'Supported transfer must not schedule false-error repair');
  r.app.click({dataset: {}, hasAttribute: key => key === 'data-drill-check'});
  assert.match(r.app.drillHTML(), /Шаг 2 из 7/, 'Supported variant allows progress');
  results.push({surface, day, kind: 'transfer', answer, correct: true});
 }
 for (const [day, answer] of negatives) {
  const r = probe(surface, day, answer);
  assert.equal(r.correct, false, `${surface} day ${day}: must reject different intent ${answer}`);
  assert.match(r.html, /Разберём и повторим/);
  assert(r.state.cards['p:' + r.target.audio], 'Actual mismatch enters phrase repair');
  results.push({surface, day, kind: 'transfer', answer, correct: false});
 }
 for (const [day, answer] of positives) {
  const r = probe(surface, day, answer, 'recall');
  const canonical = answer === r.target.es;
  assert.equal(r.correct, canonical, `${surface} day ${day}: transfer whitelist must not leak to exact recall (${answer})`);
  results.push({surface, day, kind: 'recall', answer, correct: r.correct});
 }
}
const output = path.join(__dirname, '.impeccable', 'review-v19', 'transfer-variants-result.json');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, JSON.stringify({passed: true, cases: results.length, results}, null, 2));
console.log(`PASS transfer variants v19: ${results.length} real-module checks across web/docs; narrow semantic alternatives, wrong-intent rejection, progress, exact audio label and strict recall.`);
