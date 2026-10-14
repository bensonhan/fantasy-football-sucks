const assert = require('node:assert/strict');
const test = require('node:test');
const Median = require('../dist/charts/median-rankings.js');

const team = (id, name, wins, losses, scores) => ({name, wins, losses, ties:0, sleeperRosterId:id,
  analytics:{weeklyScores:scores.map((score, index) => ({week:index + 1, score, rank:1}))}});

test('median record adds a win above the weekly median and a loss otherwise', () => {
  const teams = [team(1,'A',1,1,[100,50]), team(2,'B',1,1,[90,60]), team(3,'C',1,1,[80,70]), team(4,'D',1,1,[70,80])];
  const rows = Median.buildRows(teams), byName = Object.fromEntries(rows.map(row => [row.team.name, row]));
  assert.equal(byName.A.medianWins, 1); // Above the week 1 median (85), below week 2 (65).
  assert.equal(byName.A.medianLosses, 1);
  assert.equal(byName.D.medianWins, 1);
  assert.equal(byName.A.totalWins, 2);
  assert.equal(rows.length, 4);
});

test('median rankings are ordered by combined record and show movement', () => {
  const teams = [team(1,'Lucky',2,0,[50,50]), team(2,'Good',1,1,[100,100]), team(3,'Mid',1,1,[80,80]), team(4,'Bad',0,2,[10,10])];
  const rows = Median.buildRows(teams);
  assert.deepEqual(rows.map(row => row.team.name), ['Good','Mid','Lucky','Bad']);
  assert.equal(rows[0].change, 1); // Good moves up from actual #2.
  assert.equal(rows[1].change, 1); // Mid moves up from actual #3.
  assert.equal(rows[2].change, -2); // Lucky falls from actual #1.
  const html = Median.markup(teams);
  assert.match(html, /class="data-row-bubble">1\. Good<\/span>/);
  assert.match(html, /median-up/);
});

test('median rankings have an empty state', () => assert.match(Median.markup([]), /Sync a Sleeper league/));
