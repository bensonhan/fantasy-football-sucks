const assert = require('node:assert/strict');
const test = require('node:test');
const Utils = require('../dist/charts/utils.js');

test('chart utilities share ranking, escaping, and labels', () => {
  const teams = [{name:'Low',analytics:{powerScore:10}},{name:'High',analytics:{powerScore:90}}];
  assert.deepEqual(Utils.sorted(teams).map(team => team.name), ['High','Low']);
  assert.deepEqual(teams.map(team => team.name), ['Low','High']);
  assert.equal(Utils.escapeHtml('<A & B>'), '&lt;A &amp; B&gt;');
  assert.equal(Utils.shortName('Very Long Team Name'), 'Very Long T…');
});
