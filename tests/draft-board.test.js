const assert = require('node:assert/strict');
const test = require('node:test');
const DraftBoard = require('../dist/charts/draft-board.js');

test('draft board groups picks by drafting roster and counts completed matchup production', () => {
  const draft = {season:'2026', metadata:{name:'League Draft'}, slot_to_roster_id:{1:2,2:1}};
  const picks = [
    {roster_id:1,round:1,pick_no:2,player_id:'a',metadata:{first_name:'Alex',last_name:'Runner',position:'RB'}},
    {roster_id:2,round:1,pick_no:1,player_id:'b',metadata:{first_name:'Bob',last_name:'Receiver',position:'WR'}},
    {roster_id:2,round:1,pick_no:3,player_id:'c',metadata:{first_name:'Chris',last_name:'Flex',position:'TE'}}
  ];
  const rosters = [{roster_id:1,players:['b']},{roster_id:2,players:['c']}];
  const weeks = [
    {week:1,entries:[{roster_id:1,starters:['a'],players_points:{a:12.5}},{roster_id:2,starters:['b'],players_points:{b:8,c:4}}]},
    {week:2,entries:[{roster_id:1,starters:['b'],players_points:{b:10}},{roster_id:2,starters:['c'],players_points:{c:7}}]},
    {week:3,entries:[{roster_id:1,starters:['b'],players_points:{b:99}}]}
  ];
  const board = DraftBoard.model(draft,picks,rosters,weeks,[{sleeperRosterId:1,name:'One'},{sleeperRosterId:2,name:'Two'}],3);
  assert.deepEqual(board.teams.map(team => team.name),['Two','One']);
  assert.equal(board.rounds[0][1]['2'].length,2);
  assert.match(DraftBoard.markup(board),/\+1 more pick/);
  assert.match(DraftBoard.markup(board),/class="draft-cell draft-cell-multi"/);
  assert.deepEqual(board.rounds[0][1]['2'][0].stats,{starts:2,points:18,startedPoints:18});
  assert.equal(board.rounds[0][1]['2'][0].retained,false);
  assert.equal(board.rounds[0][1]['1'][0].retained,false);
  assert.deepEqual(board.rounds[0][1]['1'][0].stats,{starts:1,points:12.5,startedPoints:12.5});
  assert.deepEqual(board.rounds[0][1]['2'][1].stats,{starts:1,points:11,startedPoints:7});
  assert.equal(board.rounds[0][1]['2'][1].pointsPerStart,7);
  assert.match(DraftBoard.markup(board),/18\.0 fantasy points/);
  assert.match(DraftBoard.markup(board),/draft-departed/);
  assert.match(DraftBoard.markup(board),/draft-ungraded/);
  assert.match(DraftBoard.markup(board),/class="draft-round-bubble"/);
  assert.match(DraftBoard.markup(board),/class="draft-header-bubble draft-corner-bubble"/);
  assert.equal((DraftBoard.markup(board).match(/class="draft-header-bubble"/g) || []).length,board.teams.length);
  assert.doesNotMatch(DraftBoard.markup(board),/<caption>/);
  assert.equal((DraftBoard.markup(board).match(/class="draft-left-label /g) || []).length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(board)).rounds,board.rounds);
});

test('draft board escapes player and team names', () => {
  const board = DraftBoard.model({season:'2026'},[{roster_id:1,round:1,player_id:'x',metadata:{first_name:'<img',last_name:'src=x>'}}],[{roster_id:1,players:['x']}],[],[{sleeperRosterId:1,name:'<script>'}],1);
  const html = DraftBoard.markup(board);
  assert.doesNotMatch(html,/<script>|<img/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/draft-ungraded/);
});

test('draft board keeps teams and rounds with no picks', () => {
  const board = DraftBoard.model({settings:{rounds:2}},[{roster_id:1,round:1,player_id:'x'}],
    [{roster_id:1,players:['x']},{roster_id:2,players:[]}],[],
    [{sleeperRosterId:1,name:'One'},{sleeperRosterId:2,name:'Two'}],1);
  assert.equal(board.teams.length,2);
  assert.deepEqual(board.rounds.map(([round]) => round),[1,2]);
  assert.equal(board.rounds[0][1]['1'][0].quality,null);
  assert.match(DraftBoard.markup(board),/Round 2/);
});

test('draft slots set column order even when first-round picks were traded', () => {
  const board = DraftBoard.model({slot_to_roster_id:{1:3,2:1,3:2}},
    [{roster_id:2,round:1,pick_no:1,player_id:'a'},{roster_id:1,round:1,pick_no:2,player_id:'b'}],
    [{roster_id:1,players:[]},{roster_id:2,players:[]},{roster_id:3,players:[]}],[],[],1);
  assert.deepEqual(board.teams.map(team => team.rosterId),['3','1','2']);
  assert.deepEqual(board.teams.map(team => team.slot),[1,2,3]);
  assert.match(DraftBoard.markup(board),/Slot 1/);
});

test('position grades use started points per start and departed picks stay gray', () => {
  const picks = ['a','b','c','d'].map((player_id,index) => ({roster_id:index+1,round:1,pick_no:index+1,player_id,metadata:{position:'WR'}}));
  const rosters = [{roster_id:1,players:['a']},{roster_id:2,players:['b']},{roster_id:3,players:[]},{roster_id:4,players:['d']}];
  const weeks = [{week:1,entries:[
    {roster_id:1,starters:['a'],players_points:{a:20}},
    {roster_id:2,starters:['b'],players_points:{b:10}},
    {roster_id:3,starters:['c'],players_points:{c:30}},
    {roster_id:4,starters:[],players_points:{d:40}}
  ]}];
  const board = DraftBoard.model({settings:{rounds:1}},picks,rosters,weeks,[],2);
  const cells = board.rounds[0][1];
  assert.equal(cells['1'][0].pointsPerStart,20);
  assert.equal(cells['2'][0].pointsPerStart,10);
  assert.equal(cells['4'][0].pointsPerStart,null);
  assert.equal(cells['4'][0].quality,null);
  assert.equal(cells['1'][0].quality,0.5);
  assert.equal(cells['2'][0].quality,0);
  assert.equal(cells['3'][0].quality,1);
  const html = DraftBoard.markup(board);
  assert.match(html,/draft-departed/);
  assert.match(html,/Dropped/);
  assert.match(html,/heat-1/);
  assert.match(html,/heat-3/);
  assert.match(html,/position percentile 50/);
  assert.doesNotMatch(html,/draft-reacquired/);
});

test('position percentile compares drafted players across rounds within each position', () => {
  const picks = [
    {roster_id:1,round:1,player_id:'te-high',metadata:{position:'TE'}},
    {roster_id:2,round:1,player_id:'wr-low',metadata:{position:'WR'}},
    {roster_id:3,round:2,player_id:'te-low',metadata:{position:'TE'}},
    {roster_id:4,round:2,player_id:'wr-high',metadata:{position:'WR'}}
  ];
  const rosters = picks.map((pick,index) => ({roster_id:index+1,players:[pick.player_id]}));
  const weeks = [{week:1,entries:picks.map(pick => ({roster_id:pick.roster_id,starters:[pick.player_id],players_points:{[pick.player_id]:{'te-high':12,'te-low':6,'wr-high':24,'wr-low':16}[pick.player_id]}}))}];
  const board = DraftBoard.model({settings:{rounds:2}},picks,rosters,weeks,[],2);
  const byPlayer = Object.fromEntries(board.rounds.flatMap(([,cells]) => Object.values(cells).flat()).map(pick => [pick.playerId,pick]));
  assert.equal(byPlayer['te-high'].quality,1);
  assert.equal(byPlayer['wr-high'].quality,1);
  assert.equal(byPlayer['te-low'].quality,0);
  assert.equal(byPlayer['wr-low'].quality,0);
});

test('departed picks distinguish a trade from a drop', () => {
  const draft = {last_picked:1000,settings:{rounds:1}};
  const picks = [{roster_id:1,round:1,player_id:'a'},{roster_id:2,round:1,player_id:'b'}];
  const rosters = [{roster_id:1,players:[]},{roster_id:2,players:[]}];
  const transactions = [
    {type:'trade',status:'complete',status_updated:2000,drops:{a:1},adds:{a:2}},
    {type:'free_agent',status:'complete',status_updated:3000,drops:{b:2}}
  ];
  const board = DraftBoard.model(draft,picks,rosters,[],[],1,transactions);
  assert.equal(board.rounds[0][1]['1'][0].departureLabel,'Traded');
  assert.equal(board.rounds[0][1]['2'][0].departureLabel,'Dropped');
  const html = DraftBoard.markup(board);
  assert.equal((html.match(/class="draft-pick draft-departed draft-pick-top/g) || []).length,2);
  assert.match(html,/class="draft-left-label draft-left-traded">Traded/);
  assert.match(html,/class="draft-left-label draft-left-dropped">Dropped/);
});

test('mobile team view includes every pick, empty rounds, and visible stats', () => {
  const board = DraftBoard.model({settings:{rounds:2},slot_to_roster_id:{1:1,2:2}},[
    {roster_id:1,round:1,pick_no:1,player_id:'a',metadata:{first_name:'Alex',position:'WR'}},
    {roster_id:1,round:1,pick_no:2,player_id:'b',metadata:{first_name:'Bob',position:'WR'}},
    {roster_id:2,round:1,pick_no:3,player_id:'c',metadata:{first_name:'Chris',position:'WR'}}
  ],[{roster_id:1,players:['a','b']},{roster_id:2,players:[]}],
  [{week:1,entries:[{starters:['a','b'],players_points:{a:20,b:10}}]}],
  [{sleeperRosterId:1,name:'<One>'},{sleeperRosterId:2,name:'Two'}],2);
  const mobile = DraftBoard.markup(board).split('<div class="draft-board-scroll"')[0];
  assert.match(mobile,/<label[^>]*>Drafting team<select/);
  assert.match(mobile,/<option value="1" selected>Slot 1 · &lt;One&gt;/);
  assert.equal((mobile.match(/<article /g) || []).length,2);
  assert.match(mobile,/<h4>Alex<\/h4>/);
  assert.match(mobile,/<h4>Bob<\/h4>/);
  assert.doesNotMatch(mobile,/<h4>Chris/);
  assert.match(mobile,/<dt>Fantasy points<\/dt><dd>20\.0<\/dd>/);
  assert.match(mobile,/<dt>Position percentile<\/dt><dd>100%<\/dd>/);
  assert.match(mobile,/Round 2<\/h3><p class="draft-mobile-empty">No pick this round/);
  const otherTeam = DraftBoard.markup(board,'2').split('<div class="draft-board-scroll"')[0];
  assert.match(otherTeam,/<option value="2" selected>/);
  assert.match(otherTeam,/<h4>Chris<\/h4>/);
  assert.match(otherTeam,/Dropped from drafting team/);
  assert.match(otherTeam,/<dd>No starts yet<\/dd>/);
  assert.match(otherTeam,/<dd>Pending<\/dd>/);
  assert.doesNotMatch(otherTeam,/<h4>Alex/);
});
