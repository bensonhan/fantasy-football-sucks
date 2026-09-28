const assert = require('node:assert/strict');
const test = require('node:test');
const RegretView = require('../dist/charts/regret-view.js');

test('regret view keeps team, move, and week selection outside app.js', () => {
  const holder = {innerHTML:'', addEventListener(type, listener){this.onChange = listener;}, querySelector(){return {focus(){}};}};
  const label = {textContent:''};
  const view = RegretView.create(holder, label);
  const move = {id:'trade-1',rosterId:1,type:'trade',week:1,title:'Added Quarterback',receivedNames:['Quarterback'],sentNames:[],faab:[],picks:[],impact:-5,winChange:-1,rows:[
    {week:1,withPoints:100,withoutPoints:110,opponentPoints:105,impact:-10,winChange:-1},
    {week:2,withPoints:120,withoutPoints:115,opponentPoints:90,impact:5,winChange:0}
  ]};
  view.render({teams:[{id:'a',name:'Team A',sleeperRosterId:1,analytics:{powerScore:50}}],regretByRoster:{1:[move]},regretError:'',regretLoaded:true,isSyncing:false,selected:'a'});
  assert.equal(label.textContent, 'Team A');
  assert.match(holder.innerHTML, /regretTeamSelect/);
  assert.match(holder.innerHTML, /regretMoveSelect/);
  assert.match(holder.innerHTML, /regretWeekSelect/);
  assert.match(holder.innerHTML, /Win → Loss/);
  assert.equal((holder.innerHTML.match(/class="regret-week-card"/g) || []).length, 1);
  assert.match(holder.innerHTML, /<p class="regret-method">With-move points/);
  assert.doesNotMatch(holder.innerHTML, /<details class="regret-method">/);
  assert.match(holder.innerHTML, /<small>Actual<\/small>/);
  assert.match(holder.innerHTML, /<small>No move<\/small>/);
  assert.match(holder.innerHTML, /regret-comparison is-negative/);
  assert.match(holder.innerHTML, /regret-week-section is-negative/);
  assert.match(holder.innerHTML, /for="regretWeekSelect">Show<select/);
  holder.onChange({target:{id:'regretWeekSelect',value:'2'}});
  assert.match(holder.innerHTML, /<h4>Week 2<\/h4>/);
  assert.match(holder.innerHTML, /regret-week-section is-positive/);
  assert.doesNotMatch(holder.innerHTML, /Win → Loss/);
});

test('regret comparison uses a positive treatment when the move helped', () => {
  const holder = {innerHTML:'',addEventListener(){}};
  const label = {textContent:''};
  const move = {id:'waiver-1',rosterId:1,type:'waiver',week:2,title:'Added a winner',receivedNames:['Winner'],sentNames:[],faab:[],picks:[],impact:8,winChange:1,rows:[{week:2,withPoints:118,withoutPoints:110,opponentPoints:114,impact:8}]};
  RegretView.create(holder,label).render({teams:[{id:'a',name:'Team A',sleeperRosterId:1,analytics:{powerScore:50}}],regretByRoster:{1:[move]},regretError:'',regretLoaded:true,isSyncing:false,selected:'a'});
  assert.match(holder.innerHTML, /regret-comparison is-positive/);
});

test('regret view has an empty state', () => {
  const holder = {innerHTML:'',addEventListener(){}};
  const label = {textContent:''};
  RegretView.create(holder,label).render({teams:[],regretByRoster:{},regretError:'',regretLoaded:false,isSyncing:false,selected:null});
  assert.match(holder.innerHTML, /Sync a Sleeper league/);
});
