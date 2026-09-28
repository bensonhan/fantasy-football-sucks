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
  assert.match(holder.innerHTML, /profile-svg/);
  assert.match(holder.innerHTML, /profile-range/);
  assert.match(holder.innerHTML, /profile-average/);
  assert.equal((holder.innerHTML.match(/profile-frame/g) || []).length, 1);
  assert.equal((holder.innerHTML.match(/profile-league"/g) || []).length, 1);
  assert.match(holder.innerHTML, /class="profile-league"[^>]+y1="12"[^>]+y2="136"/);
  assert.ok(holder.innerHTML.lastIndexOf('class="profile-league"') > holder.innerHTML.lastIndexOf('class="profile-chart-row"'));
  assert.doesNotMatch(holder.innerHTML, /profile-chart-legend/);
  assert.doesNotMatch(holder.innerHTML, /<div class="profile-guide"/);
  assert.doesNotMatch(holder.innerHTML, /League avg/);
  assert.doesNotMatch(holder.innerHTML, /<article class="profile-row"/);
  assert.doesNotMatch(holder.innerHTML, /profile-rank/);
  assert.match(holder.innerHTML, />Weekly points<\/text>/);
  assert.doesNotMatch(holder.innerHTML, /one shared scale/i);
  assert.match(holder.innerHTML, /Low &lt;Team&gt;/);
  assert.ok(holder.innerHTML.indexOf('High Team') < holder.innerHTML.indexOf('Low &lt;Team&gt;'));
});

test('nearby profile values put floor and ceiling outside the range', () => {
  const closeTeam = [{name:'Close Scores', analytics:{powerScore:1, consistency:.3, weeklyScores:[{score:100},{score:100.6}]}}];
  const markup = Profiles.markup(closeTeam);
  assert.match(markup, /profile-floor-value[^>]+text-anchor="end"/);
  assert.match(markup, /profile-ceiling-value[^>]+text-anchor="start"/);
  assert.doesNotMatch(markup, /profile-value-leader/);
});

test('profiles have an empty state', () => assert.match(Profiles.markup([]), /Sync a Sleeper league/));
