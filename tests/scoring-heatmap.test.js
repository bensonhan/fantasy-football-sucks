const assert = require('node:assert/strict');
const test = require('node:test');
const Heatmap = require('../dist/charts/scoring-heatmap.js');

test('heatmap grades rank, sorts weeks, and leaves missing weeks blank', () => {
  const teams = [
    {name:'A', analytics:{powerScore:90, weeklyScores:[{week:2,score:101,rank:1},{week:1,score:99,rank:2}]}},
    {name:'B', analytics:{powerScore:80, weeklyScores:[{week:1,score:105,rank:1}]}}
  ];
  assert.equal(Heatmap.bucket(1, 2), 5);
  assert.equal(Heatmap.bucket(2, 2), 1);
  assert.deepEqual(Heatmap.model(teams).weeks, Array.from({length:17}, (_, index) => index + 1));
  const holder = {innerHTML:''};
  Heatmap.render(holder, teams);
  assert.match(holder.innerHTML, /heat-5/);
  assert.match(holder.innerHTML, /heat-1/);
  assert.match(holder.innerHTML, /class="data-row-bubble">A<\/span>/);
  assert.match(holder.innerHTML, /class="data-corner-bubble">Team<\/span>/);
  assert.match(holder.innerHTML, /<td class="heat-cell heat-empty" aria-label="B, Week 2: no score yet"><\/td>/);
  assert.match(holder.innerHTML, /class="data-header-bubble">W17<\/span>/);
  assert.match(holder.innerHTML, /class="data-header-bubble">W1<\/span>/);
  assert.ok(holder.innerHTML.indexOf('>W1<') < holder.innerHTML.indexOf('>W2<'));
});

test('heatmap has an empty state', () => assert.match(Heatmap.markup([]), /Sync a Sleeper league/));

test('heatmap shows all 17 weeks so the season can scroll horizontally', () => {
  const weeklyScores = Array.from({length:14}, (_, index) => ({week:index + 1, score:100 + index, rank:1}));
  const html = Heatmap.markup([{name:'A', analytics:{powerScore:90, weeklyScores}}]);
  assert.match(html, /class="data-table heatmap-table" style="width:1344px"/);
  assert.equal((html.match(/class="data-header-bubble">W\d+<\/span>/g) || []).length,17);
});
