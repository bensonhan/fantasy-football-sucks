const assert = require('node:assert/strict');
const test = require('node:test');
const Regret = require('../dist/regret.js');

const players = {
  Q: {full_name: 'Quarterback', fantasy_positions: ['QB']},
  A: {full_name: 'Former back', fantasy_positions: ['RB']},
  B: {full_name: 'New back', fantasy_positions: ['RB']},
  W: {full_name: 'Waiver back', fantasy_positions: ['RB']},
  D: {full_name: 'Dropped back', fantasy_positions: ['RB']},
  K: {full_name: 'Jake Bates', fantasy_positions: ['K']}
};
const league = {roster_positions: ['QB', 'RB', 'BN'], scoring_settings: {rush_yd: .1}};

test('trade hindsight compares legal lineups and matchup outcomes', () => {
  const transactions = [{status: 'complete', type: 'trade', transaction_id: 'trade-1', leg: 1,
    roster_ids: [1, 2], adds: {B: 1, A: 2}, drops: {A: 1, B: 2}, status_updated: 1}];
  const weeks = [{week: 1, entries: [
    {roster_id: 1, matchup_id: 1, starters: ['Q', 'B'], players: ['Q', 'B'], players_points: {Q: 10, B: 5}, points: 15},
    {roster_id: 2, matchup_id: 1, players: ['A'], players_points: {A: 20}, points: 25}
  ]}];
  const result = Regret.analyze({transactions, weeks, statsByWeek: {}, players, league, currentWeek: 2}).get(1)[0];
  assert.equal(result.impact, -15);
  assert.equal(result.winChange, -1);
  assert.equal(result.estimated, false);
  assert.equal(result.receivedNames[0], 'New back');
  assert.equal(result.sentNames[0], 'Former back');
  assert.equal(result.rows[0].opponentPoints, 25);
});

test('unrostered dropped player is excluded instead of estimated', () => {
  const transactions = [{status: 'complete', type: 'waiver', transaction_id: 'waiver-1', leg: 1,
    roster_ids: [1], adds: {W: 1}, drops: {D: 1}, status_updated: 1}];
  const weeks = [{week: 1, entries: [
    {roster_id: 1, matchup_id: 1, starters: ['Q', 'W'], players: ['Q', 'W'], players_points: {Q: 10, W: 5}, points: 15},
    {roster_id: 2, matchup_id: 1, players: [], players_points: {}, points: 20}
  ]}];
  const result = Regret.analyze({transactions, weeks, statsByWeek: {1: {D: {rush_yd: 120}}}, players, league, currentWeek: 2}).get(1)[0];
  assert.equal(result.impact, 0);
  assert.equal(result.estimated, false);
  assert.equal(result.incomplete, true);
  assert.deepEqual(result.rows[0], {week: 1, incomplete: true, reason: 'no_data'});
});

test('an added player can fill a slot that would otherwise stay empty', () => {
  assert.equal(Regret.bestLineup(['Q', 'W'], {Q: 10, W: 5}, league.roster_positions, players), 15);
  assert.equal(Regret.bestLineup(['Q'], {Q: 10}, league.roster_positions, players), 10);
});

test('Week 1 result uses the actual lineup, not an optimized with-move lineup', () => {
  const transactions = [{status: 'complete', type: 'trade', transaction_id: 'trade-week-1', leg: 1,
    roster_ids: [1, 2], adds: {B: 1, A: 2}, drops: {A: 1, B: 2}, status_updated: 1}];
  const weeks = [{week: 1, entries: [
    {roster_id: 1, matchup_id: 1, starters: ['Q', 'B'], players: ['Q', 'B', 'W'], players_points: {Q: 10, B: 13.26, W: 40}, points: 146.36},
    {roster_id: 2, matchup_id: 1, starters: ['Q', 'A'], players: ['Q', 'A'], players_points: {Q: 10, A: 26.1}, points: 148.36}
  ]}];
  const row = Regret.analyze({transactions, weeks, statsByWeek: {}, players, league, currentWeek: 2}).get(1)[0].rows[0];
  assert.equal(row.withPoints, 146.36);
  assert.equal(row.withoutPoints, 159.2);
  assert.equal(row.impact, -12.84);
  assert.equal(row.winChange, -1);
});

test('same-week drop does not erase a pickup visible in the Week 1 lineup', () => {
  const transactions = [
    {status: 'complete', type: 'free_agent', transaction_id: 'add-k', leg: 1, roster_ids: [1], adds: {K: 1}, drops: null, status_updated: 1},
    {status: 'complete', type: 'free_agent', transaction_id: 'drop-k', leg: 1, roster_ids: [1], adds: null, drops: {K: 1}, status_updated: 2}
  ];
  const weeks = [{week: 1, entries: [
    {roster_id: 1, matchup_id: 1, starters: ['Q', 'B', 'K'], players: ['Q', 'B', 'K'], players_points: {Q: 10, B: 5, K: 7}, points: 22},
    {roster_id: 2, matchup_id: 1, points: 25}
  ]}];
  const move = Regret.analyze({transactions, weeks, statsByWeek: {}, players,
    league: {roster_positions: ['QB', 'RB', 'K']}, currentWeek: 2}).get(1).find(row => row.title === 'Added Jake Bates');
  assert.equal(move.rows.length, 1);
  assert.equal(move.rows[0].withPoints, 22);
  assert.equal(move.rows[0].withoutPoints, 15);
  assert.equal(move.impact, 7);
});

test('moves are ordered newest first within the same week', () => {
  const transactions = [
    {status: 'complete', type: 'free_agent', transaction_id: 'add-k', leg: 1, roster_ids: [1], adds: {K: 1}, drops: null, status_updated: 1, created: 1},
    {status: 'complete', type: 'free_agent', transaction_id: 'drop-k', leg: 1, roster_ids: [1], adds: null, drops: {K: 1}, status_updated: 2, created: 2}
  ];
  const moves = Regret.analyze({transactions, weeks: [], statsByWeek: {}, players,
    league: {roster_positions: ['QB', 'RB', 'K']}, currentWeek: 2}).get(1);
  assert.deepEqual(moves.map(move => move.title), ['Dropped Jake Bates', 'Added Jake Bates']);
});

test('a pick-only trade appears without a fabricated points grade', () => {
  const transactions = [{status: 'complete', type: 'trade', transaction_id: 'pick-1', leg: 1,
    roster_ids: [1, 2], adds: null, drops: null, draft_picks: [{season: '2027', round: 2, previous_owner_id: 1, owner_id: 2}], status_updated: 1}];
  const move = Regret.analyze({transactions, weeks: [], statsByWeek: {}, players, league, currentWeek: 2}).get(1)[0];
  assert.equal(move.unrated, true);
  assert.equal(move.rows.length, 0);
});
