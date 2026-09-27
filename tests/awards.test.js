const assert = require('node:assert/strict');
const test = require('node:test');
const Awards = require('../dist/charts/awards.js');

const teams = [
  {name:'Team A', analytics:{powerScore:80, weeklyScores:[{rank:1},{rank:2}], badBeats:1, thiefWins:0, consistency:4, defensePoints:12, defenseStarts:2}},
  {name:'Team B', analytics:{powerScore:70, weeklyScores:[{rank:2},{rank:1}], badBeats:0, thiefWins:2, consistency:8, defensePoints:19, defenseStarts:2}}
];

test('awards pick the cumulative started-D/ST leader', () => {
  const result = Awards.winners(teams);
  assert.equal(result.dWhisperer.name, 'Team B');
  assert.equal(result.juggernaut.name, 'Team A'); // Power score breaks the crown tie.
  const holder = {innerHTML:''};
  Awards.render(holder, teams, key => `<i>${key}</i>`);
  assert.match(holder.innerHTML, /“D” Whisperer/);
  assert.match(holder.innerHTML, /19\.0 started D\/ST points/);
  assert.match(holder.innerHTML, /awardDWhisperer/);
});

test('awards show an honest empty state without scored weeks', () => {
  assert.match(Awards.markup([]), /Sync a Sleeper league/);
  const noDefense = structuredClone(teams);
  noDefense.forEach(team => {team.analytics.defensePoints = 0; team.analytics.defenseStarts = 0;});
  assert.match(Awards.markup(noDefense), /Not yet awarded/);
});
