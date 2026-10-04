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
  assert.match(holder.innerHTML, /class="data-row-bubble">Team 1<\/span>/);
  assert.match(holder.innerHTML, /class="data-corner-bubble">Scoring team<\/span>/);
  assert.match(holder.innerHTML, /class="data-header-bubble">Team 1<\/span>/);
  assert.match(holder.innerHTML, /with Team 1's schedule/);
});

test('schedule matrix has an empty state', () => assert.match(Matrix.markup([]), /Sync a Sleeper league/));

test('schedule matrix colors swapped records relative to the actual record', () => {
  const teams = [
    {name:'Alpha',sleeperRosterId:1,analytics:{powerScore:3,scheduleRecords:{
      1:{wins:5,losses:3,ties:0},
      2:{wins:6,losses:2,ties:0},
      3:{wins:4,losses:3,ties:2}
    }}},
    {name:'Bravo',sleeperRosterId:2,analytics:{powerScore:2,scheduleRecords:{
      1:{wins:3,losses:5,ties:0}, 2:{wins:4,losses:4,ties:0}, 3:{wins:2,losses:6,ties:0}
    }}},
    {name:'Charlie',sleeperRosterId:3,analytics:{powerScore:1,scheduleRecords:{
      1:{wins:4,losses:4,ties:0}, 2:{wins:5,losses:3,ties:0}, 3:{wins:6,losses:2,ties:0}
    }}}
  ];
  const html = Matrix.markup(teams);
  assert.match(html, /class="matrix-cell matrix-same matrix-actual"[^>]*Alpha with Alpha's schedule/);
  assert.match(html, /class="matrix-cell matrix-good"[^>]*Alpha with Bravo's schedule/);
  assert.match(html, /class="matrix-cell matrix-same"[^>]*Alpha with Charlie's schedule/);
  assert.match(html, /class="matrix-cell matrix-bad"[^>]*Bravo with Alpha's schedule/);
});
