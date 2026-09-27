const assert = require('node:assert/strict');
const test = require('node:test');
const Matrix = require('../dist/charts/schedule-matrix.js');

test('schedule swap records use the borrowed opponent and preserve actual records', () => {
  const ids = [1, 2, 3, 4];
  const past = [{week:1, entries:[
    {roster_id:1,matchup_id:1,points:100}, {roster_id:2,matchup_id:1,points:90},
    {roster_id:3,matchup_id:2,points:80}, {roster_id:4,matchup_id:2,points:70}
  ]}];
  const records = Matrix.buildRecords(ids, past);
  assert.equal(records[1][1].wins, 1);
  assert.equal(records[3][1].losses, 1); // Team 3 plays Team 2 on Team 1's schedule.
  assert.equal(records[2][3].wins, 1); // Team 2 plays Team 4 on Team 3's schedule.
  const teams = ids.map(id => ({name:`Team ${id}`,sleeperRosterId:id,analytics:{powerScore:5-id,scheduleRecords:records[id]}}));
  const holder = {innerHTML:''};
  Matrix.render(holder, teams);
  assert.match(holder.innerHTML, /matrix-actual/);
  assert.match(holder.innerHTML, /with Team 1's schedule/);
});

test('schedule matrix has an empty state', () => assert.match(Matrix.markup([]), /Sync a Sleeper league/));
