const assert = require('node:assert/strict');
const test = require('node:test');
const Profiles = require('../dist/charts/scoring-profiles.js');

const teams = [
  {name:'Low <Team>', analytics:{powerScore:90, consistency:10, weeklyScores:[{score:80},{score:100}]}},
  {name:'High Team', analytics:{powerScore:80, consistency:5, weeklyScores:[{score:120},{score:140}]}}
];

test('profiles sort by average and share a single scoring scale', () => {
  const data = Profiles.model(teams);
  assert.deepEqual(data.rows.map(row => row.team.name), ['High Team', 'Low <Team>']);
  assert.equal(data.leagueAverage, 110);
  assert.ok(data.domainMin < 80 && data.domainMax > 140);
  const holder = {innerHTML:''};
  Profiles.render(holder, teams);
  assert.match(holder.innerHTML, /profile-range-fill/);
  assert.match(holder.innerHTML, /profile-average-mark/);
  assert.match(holder.innerHTML, /Low &lt;Team&gt;/);
  assert.ok(holder.innerHTML.indexOf('High Team') < holder.innerHTML.indexOf('Low &lt;Team&gt;'));
});

test('profiles have an empty state', () => assert.match(Profiles.markup([]), /Sync a Sleeper league/));
