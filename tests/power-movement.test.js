const assert = require('node:assert/strict');
const test = require('node:test');
const Movement = require('../dist/charts/power-movement.js');

const teams = [
  {id:'a',name:'A & Co',analytics:{powerScore:80,rankHistory:[{week:1,rank:2,score:40},{week:2,rank:1,score:80}]}},
  {id:'b',name:'Team B',analytics:{powerScore:70,rankHistory:[{week:1,rank:1,score:70},{week:2,rank:2,score:50}]}}
];

test('power movement renders every team on one chart and tracks focus', () => {
  const {chart, legend} = Movement.markup(teams, 'a');
  assert.equal((chart.match(/class="shared-series"/g) || []).length, 2);
  assert.match(chart, /A &amp; Co/);
  assert.match(chart, /W1/);
  assert.match(chart, /W2/);
  assert.match(legend, /aria-pressed="true"/);
  assert.match(legend, /Show all teams/);
});

test('power movement has an empty state', () => {
  const result = Movement.markup([]);
  assert.match(result.chart, /Sync a Sleeper league/);
  assert.equal(result.legend, '');
});
