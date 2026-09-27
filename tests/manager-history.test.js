const assert = require('node:assert/strict');
const test = require('node:test');
const History = require('../dist/charts/manager-history.js');

const current = {league_id:'new',season:'2026',status:'in_season',previous_league_id:'old',settings:{playoff_week_start:15,playoff_teams:2}};
const previous = {league_id:'old',season:'2025',status:'complete',previous_league_id:null,settings:{playoff_week_start:15,playoff_teams:2}};
const users = [{user_id:'a',display_name:'Alex'}, {user_id:'b',display_name:'Blair'},
  {user_id:'c',display_name:'Casey'}, {user_id:'d',display_name:'Drew'}];
const rosters = [100,95,90,85].map((points,i) => ({roster_id:i+1,owner_id:users[i].user_id,settings:{fpts:points,fpts_decimal:0}}));
const oldRosters = [120,105,90,80].map((points,i) => ({roster_id:i+1,owner_id:users[i].user_id,settings:{fpts:points,fpts_decimal:0}}));
const winners = [{p:1,r:1,w:2,l:1}];
const losers = [{p:1,r:1,w:3,l:4}];
const playoff = [{roster_id:1,points:10},{roster_id:2,points:20},{roster_id:3,points:15},{roster_id:4,points:5}];
const endpoints = {
  'league/old':previous, 'league/old/users':users, 'league/old/rosters':oldRosters,
  'league/old/winners_bracket':winners, 'league/old/losers_bracket':losers,
  'league/old/matchups/15':playoff
};

test('history aggregates playoff scores and final placements, excluding active years', async () => {
  const history = await History.loadChain(current,users,rosters,async path => endpoints[path]);
  assert.deepEqual(history.seasons.map(season => season.year), ['2026','2025']);
  assert.equal(history.seasons[0].rankable, undefined);
  assert.equal(history.seasons[1].rankable, true);
  const allTime = History.rank(history);
  assert.equal(allTime[0].name, 'Blair');
  assert.equal(allTime[0].points, 125);
  assert.equal(allTime[0].averageFinish, 1);
  assert.equal(allTime[1].name, 'Alex');
  assert.equal(allTime[1].points, 130);
  assert.equal(allTime[1].averageFinish, 2);
  assert.equal(allTime[0].score > allTime[1].score, true);
  assert.deepEqual(History.rank(history,'2026'), []);
  const html = History.markup(history);
  assert.match(html, /🥇/);
  assert.match(html, /🥈/);
  assert.match(html, /🥉/);
  assert.match(html, /history-row/);
  assert.match(html, /All seasons · 2025–2026/);
  assert.match(html, /2026 · pending/);
});

test('ranking score weights full-season points at 60% and final finish at 40%', () => {
  const season = History.normalizeSeason(previous,users,oldRosters);
  History.scoreSeason(season,[playoff],winners,losers);
  const byId = new Map(season.managers.map(manager => [manager.userId,manager]));
  assert.equal(byId.get('a').points, 130);
  assert.equal(byId.get('b').points, 125);
  assert.equal(byId.get('c').points, 105);
  assert.equal(byId.get('d').points, 85);
  assert.equal(byId.get('a').score, 86.67);
  assert.equal(byId.get('b').score, 93.33);
  assert.equal(byId.get('d').score, 0);
  assert.deepEqual([...History.placements(winners,losers,2)], [[2,1],[1,2],[3,3],[4,4]]);
});

test('all-time ranking adds season scores and uses commissioner-adjusted matchup points', () => {
  const first = History.normalizeSeason(previous,users,oldRosters);
  History.scoreSeason(first,[[{roster_id:1,points:10,custom_points:50}]],winners,losers);
  const second = History.normalizeSeason({...previous,league_id:'older',season:'2024'},users,oldRosters);
  History.scoreSeason(second,[playoff],winners,losers);
  const combined = History.rank({seasons:[first,second]});
  const alex = combined.find(manager => manager.userId === 'a');
  assert.equal(first.managers[0].points, 170);
  assert.equal(alex.points, 300);
  assert.equal(alex.score, Math.round((first.managers[0].score + second.managers[0].score) * 100) / 100);
  assert.equal(alex.seasons, 2);
});

test('season dropdown shows a pending message for a year without final standings', async () => {
  const history = await History.loadChain(current,users,rosters,async path => endpoints[path]);
  const holder = {innerHTML:'',addEventListener(type,listener){this.onChange=listener;},querySelector(){return {focus(){}};}};
  const view = History.create(holder);
  view.render(history);
  assert.match(holder.innerHTML, /Blair/);
  holder.onChange({target:{id:'historyYearSelect',value:'2026'}});
  assert.match(holder.innerHTML, /Final standings are not available/);
  assert.doesNotMatch(holder.innerHTML, /history-podium/);
  holder.onChange({target:{id:'historyYearSelect',value:'2025'}});
  assert.match(holder.innerHTML, /#1 final finish/);
});

test('leaderboard dropdown switches total points, titles, and completed-season average', async () => {
  const history = await History.loadChain(current,users,rosters,async path => endpoints[path]);
  const holder = {innerHTML:'',addEventListener(type,listener){this.onChange=listener;},querySelector(){return {focus(){}};}};
  History.create(holder).render(history);
  const select = value => holder.onChange({target:{id:'historyMetricSelect',value}});
  select('points');
  assert.equal(History.rank(history,'','points')[0].name, 'Alex');
  assert.equal(History.rank(history,'','points')[0].points, 230);
  assert.equal(History.rank(history,'','points')[0].pointsPerSeason, 130);
  assert.match(holder.innerHTML, /All-time points/);
  assert.match(holder.innerHTML, /includes current season/);
  holder.onChange({target:{id:'historyYearSelect',value:'2026'}});
  assert.equal(History.rank(history,'2026','points')[0].points, 100);
  assert.doesNotMatch(holder.innerHTML, /Final standings are not available/);
  select('trophies');
  assert.deepEqual(History.rank(history,'','trophies').map(manager => manager.name), ['Blair']);
  assert.match(holder.innerHTML, /Final standings are not available/);
  holder.onChange({target:{id:'historyYearSelect',value:''}});
  assert.match(holder.innerHTML, /1 <span>title<\/span>/);
  assert.doesNotMatch(holder.innerHTML, /history-place-2/);
  select('perSeason');
  assert.equal(History.rank(history,'','perSeason')[0].name, 'Alex');
  assert.equal(History.rank(history,'','perSeason')[0].pointsPerSeason, 130);
  assert.match(holder.innerHTML, /130\.00 <span>pts \/ season<\/span>/);
});

test('per-season average divides by completed seasons and trophies count wins', () => {
  const first = History.normalizeSeason(previous,users,oldRosters);
  const second = History.normalizeSeason({...previous,league_id:'older',season:'2024'},users,oldRosters);
  History.scoreSeason(first,[playoff],winners,losers);
  History.scoreSeason(second,[playoff],[{p:1,r:1,w:1,l:2}],losers);
  const history = {seasons:[first,second]};
  const alex = History.rank(history,'','perSeason').find(manager => manager.userId === 'a');
  assert.equal(alex.pointsPerSeason, 130);
  assert.equal(alex.completedSeasons, 2);
  const champions = History.rank(history,'','trophies');
  assert.deepEqual(champions.map(manager => [manager.name,manager.trophies]), [['Alex',1],['Blair',1]]);
});

test('missing playoff data does not turn regular-season points into a final ranking', async () => {
  const history = await History.loadChain(current,users,rosters,async path => {
    if (path.includes('winners_bracket')) throw new Error('Network unavailable');
    return endpoints[path];
  });
  assert.equal(history.seasons.length, 2);
  assert.deepEqual(History.rank(history), []);
  assert.match(History.markup(history), /Some history may be incomplete/);
});
