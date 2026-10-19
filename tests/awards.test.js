const assert = require('node:assert/strict');
const test = require('node:test');
const Awards = require('../dist/charts/awards.js');

function leagueContext() {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../dist/app.js'), 'utf8');
  const context = vm.createContext({ScheduleMatrixChart:require('../dist/charts/schedule-matrix.js')});
  vm.runInContext(source.slice(source.indexOf('function analyzeLeague('), source.indexOf('function toast(')), context);
  return context;
}

const teams = [
  {name:'Team A', analytics:{powerScore:80, weeklyScores:[{rank:1,score:120},{rank:2,score:100}], badBeats:1, thiefWins:0, consistency:4, defensePoints:12, defenseStarts:2}},
  {name:'Team B', analytics:{powerScore:70, weeklyScores:[{rank:2,score:100},{rank:1,score:110}], badBeats:0, thiefWins:2, consistency:8, defensePoints:19, defenseStarts:2}}
];

test('awards pick the cumulative started-D/ST leader', () => {
  const result = Awards.winners(teams);
  assert.equal(result.dWhisperer.name, 'Team B');
  assert.equal(result.juggernaut.name, 'Team A'); // Season points break the crown tie.
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

test('replacement awards select kicker points and completed move leaders with season-points tiebreaks', () => {
  const candidates = structuredClone(teams);
  Object.assign(candidates[0].analytics, {kickerPoints:24, kickerStarts:2, waiverTransactions:3});
  Object.assign(candidates[1].analytics, {kickerPoints:18, kickerStarts:2, waiverTransactions:5});
  assert.equal(Awards.winners(candidates).kickerWhisperer.name, 'Team A');
  assert.equal(Awards.winners(candidates).waiverTransactions.name, 'Team B');
  const html = Awards.markup(candidates, key => `<i>${key}</i>`);
  assert.match(html, /Fantasy Futbol/);
  assert.match(html, /24\.0 started kicker points · 2 starts/);
  assert.match(html, /Commitment Issues/);
  assert.match(html, /5 completed transactions/);
  candidates[0].analytics.badBeats = 2;
  assert.match(Awards.markup(candidates), /2 above-median losses/);
  assert.match(html, /awardKickerWhisperer/);
  assert.match(html, /awardWaiverTransactions/);
  assert.doesNotMatch(html, /Metronome|Rollercoaster/);
  candidates[1].analytics.kickerPoints = 24;
  candidates[0].analytics.waiverTransactions = 5;
  assert.equal(Awards.winners(candidates).kickerWhisperer.name, 'Team A');
  assert.equal(Awards.winners(candidates).waiverTransactions.name, 'Team A');
});

test('transaction counts include trades, exclude unsuccessful claims, and deduplicate moves', () => {
  const candidates = structuredClone(teams);
  candidates.forEach((team, i) => {team.sleeperRosterId = i + 1;});
  const move = (id, type, status, roster_ids) => ({transaction_id:id, type, status, roster_ids});
  Awards.applyTransactions(candidates, [
    move('a', 'waiver', 'complete', [1]),
    move('a', 'waiver', 'complete', [1]),
    move('b', 'free_agent', 'complete', ['1', 1]),
    move('c', 'trade', 'complete', [1, 2]),
    move('d', 'waiver', 'failed', [2]),
    move('e', 'waiver', 'pending', [2]),
    move('f', 'waiver', 'complete', [2])
  ]);
  assert.deepEqual(candidates.map(team => team.analytics.waiverTransactions), [3, 2]);
  Awards.applyTransactions(candidates, []);
  assert.deepEqual(candidates.map(team => team.analytics.waiverTransactions), [0, 0]);
  assert.equal(Awards.winners(candidates).waiverTransactions, null);
  assert.match(Awards.markup(candidates), /No completed waiver, free-agent, or trade transactions yet/);
});

test('missing kicker or transaction data does not invent winners', () => {
  assert.equal(Awards.winners(teams).kickerWhisperer, null);
  assert.equal(Awards.winners(teams).waiverTransactions, null);
  assert.match(Awards.markup(teams), /No kicker starts yet/);
  assert.match(Awards.markup(teams), /Sync league to load transactions/);
});

test('league analytics count only completed-week starting kickers using league slots and scored points', () => {
  const context = leagueContext();
  const candidates = [{sleeperRosterId:1}, {sleeperRosterId:2}];
  const entry = (roster_id, kicker, kickerScore) => ({roster_id, matchup_id:1, points:100,
    starters:['qb', kicker, 'def'], players_points:{qb:20, [kicker]:kickerScore, def:8, benchKicker:30}});
  context.analyzeLeague(candidates, [
    {week:1, entries:[entry(1,'k1',12), entry(2,'k2',0)]},
    {week:2, entries:[{...entry(1,'k1',30), starters_points:[20,-1,8]}, entry(2,'0',100)]},
    {week:3, entries:[entry(1,'k1',50), entry(2,'k2',50)]}
  ], 3, {roster_positions:['QB','K','DEF'], settings:{}}, 'test');
  assert.equal(candidates[0].analytics.kickerPoints, 11);
  assert.equal(candidates[0].analytics.kickerStarts, 2);
  assert.equal(candidates[1].analytics.kickerPoints, 0);
  assert.equal(candidates[1].analytics.kickerStarts, 1);
  assert.equal(candidates[0].analytics.defensePoints, 16);
  assert.equal(context.startedPositionPoints(entry(1,'k1',12), ['QB','DEF'], 'K').starts, 0);
  assert.equal(context.startedPositionPoints({starters:['k']}, ['K'], 'K').starts, 0);
});


test('weekly scoring ties share first place regardless of roster order', () => {
  const context = leagueContext();
  const candidates = [1,2,3,4].map(id => ({name:`Team ${id}`, sleeperRosterId:id}));
  context.analyzeLeague(candidates, [{week:1, entries:[
    {roster_id:1, points:120}, {roster_id:2, points:120},
    {roster_id:3, points:100}, {roster_id:4, points:80}
  ]}], 2, {settings:{}}, 'ties');
  assert.deepEqual(candidates.map(team => team.analytics.weeklyScores[0].rank), [1,1,3,4]);
  candidates[0].analytics.weeklyScores.push({week:2, rank:2, score:90});
  candidates[1].analytics.weeklyScores.push({week:2, rank:2, score:100});
  assert.equal(Awards.winners(candidates).juggernaut.name, 'Team 2');
});

test('Heartbreak Kid and Escape Artist use strict median comparisons and completed head-to-head results', () => {
  const context = leagueContext();
  const candidates = [1,2,3,4].map(id => ({name:`Team ${id}`, sleeperRosterId:id}));
  const week = (number, scores) => ({week:number, entries:scores.map((points, i) =>
    ({roster_id:i+1, matchup_id:Math.floor(i/2)+1, points}))});
  context.analyzeLeague(candidates, [
    week(1, [120,110,60,50]), // Median 85: team 2 loses above it, team 3 wins below it.
    week(2, [100,100,100,100]), // Tied games count for neither award.
    week(3, [110,100,100,90]), // Median 100: exact-median wins and losses do not count.
    week(4, [120,110,60,50]) // Current week must not count.
  ], 4, {settings:{}}, 'median');
  assert.deepEqual(candidates.map(team => team.analytics.badBeats), [0,1,0,0]);
  assert.deepEqual(candidates.map(team => team.analytics.thiefWins), [0,0,1,0]);
  assert.equal(Awards.winners(candidates).heartbreak.name, 'Team 2');
  assert.equal(Awards.winners(candidates).escape.name, 'Team 3');
  assert.equal(candidates[0].analytics.weeklyScores.length, 3);
});

test('Heartbreak Kid and Escape Artist remain unawarded without qualifying games', () => {
  const candidates = structuredClone(teams);
  candidates.forEach(team => {team.analytics.badBeats = 0; team.analytics.thiefWins = 0;});
  const winners = Awards.winners(candidates);
  assert.equal(winners.heartbreak, null);
  assert.equal(winners.escape, null);
  assert.match(Awards.markup(candidates), /No above-median losses yet/);
  assert.match(Awards.markup(candidates), /No below-median wins yet/);
});

test('D/ST points retain negative and zero starts, exclude the bench, and break award ties by season points', () => {
  const context = leagueContext();
  const total = context.startedDefensePoints({starters:['qb','DEF'],
    starters_points:[25,-3], players_points:{DEF:9, benchDefense:40}}, ['QB','DEF']);
  assert.equal(total.points, -3);
  assert.equal(total.starts, 1);
  assert.equal(context.startedDefensePoints({starters:['DEF'], players_points:{DEF:0}}, ['DEF']).starts, 1);
  assert.equal(context.startedDefensePoints({starters:['0'], starters_points:[25]}, ['DEF']).starts, 0);
  const candidates = structuredClone(teams);
  candidates[0].analytics.defensePoints = 19;
  assert.equal(Awards.winners(candidates).dWhisperer.name, 'Team A');
});


test('every award selects one winner by season points ahead of power score, then roster ID', () => {
  const makeTeam = (id, powerScore, points) => ({name:`Team ${id}`, sleeperRosterId:id, analytics:{
    powerScore, weeklyScores:[{rank:1, score:points}], badBeats:1, thiefWins:1,
    kickerPoints:12, kickerStarts:1, defensePoints:10, defenseStarts:1, waiverTransactions:3
  }});
  const candidates = [makeTeam(1, 100, 90), makeTeam(2, 20, 110)];
  assert.ok(Object.values(Awards.winners(candidates)).every(winner => winner === candidates[1]));
  candidates[0].analytics.weeklyScores[0].score = 110;
  assert.ok(Object.values(Awards.winners([...candidates].reverse())).every(winner => winner === candidates[0]));
});


test('Commitment Issues can be won entirely with free-agent transactions', () => {
  const candidates = structuredClone(teams);
  candidates.forEach((team, i) => {team.sleeperRosterId = i + 1;});
  Awards.applyTransactions(candidates, [
    {transaction_id:'claim', type:'waiver', status:'complete', roster_ids:[1], adds:{playerA:1}},
    {transaction_id:'add', type:'free_agent', status:'complete', roster_ids:[2], adds:{playerB:2}, drops:null},
    {transaction_id:'drop', type:'free_agent', status:'complete', roster_ids:[2], adds:null, drops:{playerC:2}},
    {transaction_id:'swap', type:'free_agent', status:'complete', roster_ids:[2], adds:{playerD:2}, drops:{playerB:2}}
  ]);
  assert.deepEqual(candidates.map(team => team.analytics.waiverTransactions), [1, 3]);
  assert.equal(Awards.winners(candidates).waiverTransactions, candidates[1]);
  const card = Awards.markup(candidates).split('<article').find(section => section.includes('Commitment Issues'));
  assert.match(card, /Team B/);
  assert.match(card, /3 completed transactions/);
  assert.match(Awards.metricInfo.awardWaiverTransactions.body, /waiver claims, free-agent transactions, and trades/);
});

test('Commitment Issues ignores failed and pending free-agent transactions and counts duplicates once', () => {
  const candidates = structuredClone(teams);
  candidates.forEach((team, i) => {team.sleeperRosterId = i + 1;});
  const completed = {transaction_id:'swap', type:'free_agent', status:'complete', roster_ids:[1],
    adds:{playerA:1, playerB:1}, drops:{playerC:1, playerD:1}};
  Awards.applyTransactions(candidates, [
    completed, structuredClone(completed),
    {...completed, transaction_id:'pending', status:'pending', roster_ids:[2]},
    {...completed, transaction_id:'failed', status:'failed', roster_ids:[2]},
    {...completed, transaction_id:'commissioner', type:'commissioner', roster_ids:[1,2]}
  ]);
  assert.deepEqual(candidates.map(team => team.analytics.waiverTransactions), [1, 0]);
  assert.equal(Awards.winners(candidates).waiverTransactions, candidates[0]);
  assert.match(Awards.markup(candidates), /1 completed transaction</);
});


test('Commitment Issues counts each completed trade once for each participating team', () => {
  const candidates = structuredClone(teams);
  candidates.forEach((team, i) => {team.sleeperRosterId = i + 1;});
  const trade = {transaction_id:'players', type:'trade', status:'complete', roster_ids:[1,2,2],
    adds:{playerA:1, playerB:2}, drops:{playerA:2, playerB:1}};
  Awards.applyTransactions(candidates, [
    trade, structuredClone(trade),
    {...trade, transaction_id:'picks', adds:null, drops:null, draft_picks:[{owner_id:1, previous_owner_id:2}]},
    {...trade, transaction_id:'faab', adds:null, drops:null, waiver_budget:[{sender:1, receiver:2, amount:10}]},
    {...trade, transaction_id:'pending', status:'pending'},
    {...trade, transaction_id:'failed', status:'failed'},
    {...trade, transaction_id:'canceled', status:'canceled'},
    {transaction_id:'extra', type:'trade', status:'complete', roster_ids:[2,99]}
  ]);
  assert.deepEqual(candidates.map(team => team.analytics.waiverTransactions), [3,4]);
  assert.equal(Awards.winners(candidates).waiverTransactions, candidates[1]);
  assert.match(Awards.markup(candidates), /4 completed transactions/);
});
