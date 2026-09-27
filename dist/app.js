const DEFAULT_SLEEPER_LEAGUE_ID='1389375528988852224',REGRET_CACHE_VERSION=4;
const AUTO_SYNC_DAYS=new Set([0,1,4]),AUTO_SYNC_MAX_AGE_MS=60*60*1000;
let teams=load(); let selected=teams[0]?.id; let sleeperConnection=loadSleeper(); let isSyncing=false;
let regretByRoster=loadRegret(),regretError='',regretLoaded=hasCachedRegret();
let managerHistory=ManagerHistory.readCache(sleeperConnection?.leagueId);
const $=s=>document.querySelector(s), rankList=$('#rankList'), editor=$('#editor');
const themeToggle=$('#themeToggle');
function setTheme(theme,{persist=true}={}){const dark=theme==='dark';document.documentElement.dataset.theme=dark?'dark':'light';themeToggle.setAttribute('aria-pressed',String(dark));themeToggle.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');themeToggle.title=dark?'Switch to light mode':'Switch to dark mode';if(persist){try{localStorage.setItem('power-board-theme',dark?'dark':'light')}catch{}}}
setTheme(document.documentElement.dataset.theme==='dark'?'dark':'light',{persist:false});
themeToggle.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
function load(){try{const saved=JSON.parse(localStorage.getItem('power-board-teams'));return Array.isArray(saved)&&saved.every(team=>team?.sleeperRosterId!=null)?saved:[]}catch{return []}}
function loadSleeper(){try{return JSON.parse(localStorage.getItem('power-board-sleeper'))||null}catch{return null}}
function loadRegret(){try{const saved=JSON.parse(localStorage.getItem('power-board-regret'));return saved?.leagueId===loadSleeper()?.leagueId&&saved.version===REGRET_CACHE_VERSION?saved.rows||{}:{}}catch{return {}}}
function hasCachedRegret(){try{const saved=JSON.parse(localStorage.getItem('power-board-regret'));return saved?.leagueId===loadSleeper()?.leagueId&&saved.version===REGRET_CACHE_VERSION}catch{return false}}
function save(){localStorage.setItem('power-board-teams',JSON.stringify(teams))}
function score(t){return ChartUtils.score(t)}
function sorted(){return ChartUtils.sorted(teams)}
function render(){
  const list=sorted();
  if(!list.length){
    rankList.innerHTML=`<div class="empty">${isSyncing?'Connecting to Sleeper…':'No league data yet. Use Sync league to connect.'}</div>`;
    editor.innerHTML='<div class="empty">League analysis will appear here.</div>';
    $('#selectedLabel').textContent='No team selected';
    renderTrendChart();renderAwards();renderScoringProfiles();renderScoringHeatmap();renderScheduleMatrix();renderRegret();renderManagerHistory();
    $('#tickerText').textContent=isSyncing?'Loading league data…':'Waiting for a Sleeper league';renderSyncMeta();save();return;
  }
  if(!teams.some(t=>t.id===selected))selected=list[0].id;
  rankList.innerHTML=list.map((t,i)=>{const rank=i+1,diff=t.prev-rank,move=diff>0?`▲ ${diff}`:diff<0?`▼ ${Math.abs(diff)}`:'—',record=`${t.wins}-${t.losses}${t.ties?`-${t.ties}`:''}`,a=t.analytics;const metrics=a?`<div class="metric"><span>Expected W ${infoIcon('expectedWins')}</span><b>${a.expectedWins.toFixed(2)}</b></div><div class="metric"><span>Avg rank ${infoIcon('avgRank')}</span><b>${a.avgWeeklyRank.toFixed(1)}</b></div><div class="metric"><span>Luck ${infoIcon('luck')}</span><b>${signed(a.luck)}</b></div>`:'';return `<article class="rank-row ${i===0?'top':''}" tabindex="0" data-id="${t.id}" aria-label="Rank ${rank}, ${esc(t.name)}, score ${score(t).toFixed(1)}"><div class="rank-num">${String(rank).padStart(2,'0')}</div><div class="team-cell"><div class="team-name">${esc(t.name)}</div><div class="owner">${esc(t.owner)} · ${record}</div></div><div class="metrics">${metrics}</div><div class="score"><strong>${score(t).toFixed(1)}</strong><span>Power score ${infoIcon('powerScore')}</span></div><div class="move ${diff>0?'up':diff<0?'down':'same'}">${move}</div></article>`}).join('');
  rankList.querySelectorAll('.rank-row').forEach(el=>{el.addEventListener('click',()=>{selected=el.dataset.id;renderEditor()});el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=el.dataset.id;renderEditor()}})});
  renderEditor();renderAwards();renderScoringProfiles();renderScoringHeatmap();renderScheduleMatrix();renderTrendChart();renderManagerHistory();
  $('#tickerText').textContent=sleeperConnection?`${teams.length} teams · ${sleeperConnection.leagueName} · ${sleeperConnection.completedWeeks} weeks analyzed`:'Waiting for a Sleeper league';renderSyncMeta();save();
}
function esc(v){return ChartUtils.escapeHtml(v)}
function renderEditor(){const t=teams.find(x=>x.id===selected);if(!t){renderRegret();return}const rank=sorted().findIndex(x=>x.id===t.id)+1;$('#selectedLabel').textContent=`Rank #${rank} · ${t.name}`;if(!t.analytics){editor.innerHTML='<div class="empty">Analyzing league data…</div>';renderRegret();return}const a=t.analytics,allPlay=`${fmtHalf(a.allPlayWins)}-${fmtHalf(a.allPlayLosses)}${a.allPlayTies?`-${fmtHalf(a.allPlayTies)}`:''}`,allPlayRank=Number.isFinite(a.allPlayRank)?`#${a.allPlayRank} of ${teams.length}`:'—';const card=(key,label,value,classes='')=>`<div class="stat-card ${classes}"><span>${label} ${infoIcon(key)}</span><strong>${value}</strong></div>`;editor.innerHTML=`<div class="stat-grid">${card('expectedWins','Expected wins',a.expectedWins.toFixed(2))}${card('luck','Schedule luck',signed(a.luck),a.luck>0.2?'good':a.luck<-.2?'bad':'')}${card('allPlay','All-play record',allPlay)}${card('avgRank','Avg weekly rank',`${a.avgWeeklyRank.toFixed(1)} of ${teams.length}`)}${card('recentForm','Recent form',`${signed(a.recentZ)} z`)}${card('consistency','Consistency',`${a.consistency.toFixed(1)} σ`)}${card('allPlayRank','All-play rank',allPlayRank)}${card('playoffOdds','Playoff odds',`${a.playoffOdds.toFixed(0)}%`)}${card('badBeats','Bad beats',a.badBeats)}${card('thiefWins','Thief wins',a.thiefWins)}${card('closestGame','Closest game',esc(a.closestGame),'wide')}${card('largestBlowout','Largest blowout',esc(a.largestBlowout),'wide')}</div><div class="report-note">Playoff odds use 3,000 history-based schedule simulations. They reflect past scoring, not injuries or player projections.</div>`;renderRegret()}
function signed(v){return `${v>0?'+':''}${Number(v).toFixed(2)}`}
function fmtHalf(v){return Number.isInteger(v)?String(v):Number(v).toFixed(1)}
const regretView=RegretView.create($('#regretReport'),$('#regretTeamLabel'));
function renderRegret(){regretView.render({teams,regretByRoster,regretError,regretLoaded,isSyncing,selected})}
const historyView=ManagerHistory.create($('#managerHistory'));
function renderManagerHistory(){if(!managerHistory&&isSyncing){$('#managerHistory').innerHTML='<div class="chart-empty">Loading linked league seasons…</div>';return}historyView.render(managerHistory)}
function infoIcon(key){const title=metricInfo[key]?.title||'this metric';return `<button class="info-btn" data-info="${key}" aria-label="How ${esc(title.toLowerCase())} is calculated">i</button>`}
const metricInfo={
  powerScore:{title:'Power score',body:'The overall ranking score combines three league-relative percentiles. Expected wins contribute 45%, season scoring strength contributes 35%, and recent form contributes 20%.',example:'A score of 100 means the team leads the league on the combined formula; it does not mean the team is perfect.'},
  expectedWins:{title:'Expected wins',body:'Each week, a team is compared with every other team in the league. Beating 8 of 9 possible opponents earns 8/9 of an expected win. Weekly values are added across the season.',example:'Scoring second-highest in a 10-team league earns 8 ÷ 9 = 0.89 expected wins that week.'},
  expectedPercentile:{title:'Expected-win percentile',body:'Season expected wins are ranked across the league and converted to a 0–100 percentile before entering the power-score formula.',example:'This component receives the largest weight—45%—because it measures how often a team would beat the league regardless of schedule.'},
  avgRank:{title:'Average weekly rank',body:'The team’s scoring finish among all league teams is calculated for every completed week, then averaged.',example:'Weekly finishes of 2nd and 6th produce an average weekly rank of 4.0.'},
  luck:{title:'Schedule luck',body:'Schedule luck equals actual head-to-head wins minus expected wins. Positive values suggest the schedule helped; negative values suggest the team deserved more wins than it received.',example:'+1.10 means the team has about one more actual win than its weekly scores would normally produce.'},
  allPlay:{title:'All-play record',body:'Every weekly score is treated as if it played every other team. Wins, losses, and ties are totaled across all those hypothetical matchups.',example:'In a 10-team league, each completed week creates nine all-play decisions per team.'},
  recentForm:{title:'Recent form',body:'Weekly scores are standardized against that week’s league average. Newer weeks receive more weight, with each older week counting 75% as much as the next.',example:'A positive z-score means recent scoring is above league average; +1.00 is roughly one standard deviation above it.'},
  seasonScoring:{title:'Season scoring percentile',body:'Each weekly score is converted to a z-score relative to that week’s league scoring. The season average is then ranked across the league on a 0–100 percentile scale.',example:'This prevents unusually high- or low-scoring NFL weeks from distorting comparisons.'},
  consistency:{title:'Consistency',body:'Consistency is the population standard deviation of the team’s completed weekly scores. A smaller number means the team scores in a tighter range.',example:'A value of 8.2 means weekly scores typically vary by about 8.2 points from the team’s average.'},
  allPlayRank:{title:'All-play rank',body:'Teams are ranked by their all-play results: how often their weekly scores would have beaten every other team in the league.',example:'A rank of #2 means only one team has a better cumulative all-play record.'},
  playoffOdds:{title:'Playoff odds',body:'The site runs 3,000 simulations of the remaining regular-season schedule. Future scores are sampled from each team’s completed games with more weight on recent weeks, then teams are ranked by wins and points.',example:'These are history-based odds and do not account for injuries, trades, or external player projections.'},
  ...AwardsChart.metricInfo,
  badBeats:{title:'Bad beats',body:'A bad beat is a head-to-head loss in a week when the team scored above the league median.',example:'The team performed better than at least half the league but still drew an even stronger opponent.'},
  thiefWins:{title:'Thief wins',body:'A thief win is a head-to-head victory in a week when the team scored below the league median.',example:'The team won despite a score that would have lost to at least half the league.'},
  closestGame:{title:'Closest game',body:'The completed matchup with the smallest absolute margin between the team and its opponent.',example:'Both close wins and close losses are eligible.'},
  largestBlowout:{title:'Largest blowout',body:'The completed matchup with the largest absolute scoring margin.',example:'The label shows whether the team won or lost and by how many points.'}
};
function openMetricInfo(key){const info=metricInfo[key];if(!info)return;$('#infoTitle').textContent=info.title;$('#infoBody').textContent=info.body;$('#infoExample').textContent=info.example;$('#infoDialog').showModal()}
function renderAwards(){AwardsChart.render($('#awardsStrip'),teams,infoIcon)}
function renderScoringProfiles(){ScoringProfilesChart.render($('#scoringProfiles'),teams)}
function renderScoringHeatmap(){ScoringHeatmapChart.render($('#scoringHeatmap'),teams)}
function renderScheduleMatrix(){ScheduleMatrixChart.render($('#scheduleMatrix'),teams)}
function renderTrendChart(){PowerMovementChart.render($('#trendChart'),$('#trendLegend'),teams)}
function renderSyncMeta(){const el=$('#syncMeta');if(!sleeperConnection){el.textContent=isSyncing?'Connecting to Sleeper…':'Sleeper not connected';$('#weekChip').textContent='Sleeper league sync';$('#sleeperBtn').textContent=isSyncing?'Analyzing…':'Sync league';return}const when=new Date(sleeperConnection.syncedAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});el.innerHTML=`<span><strong>${esc(sleeperConnection.leagueName)}</strong><br>Last synced ${when} · Auto-checks Thu, Sun &amp; Mon</span>`;$('#weekChip').textContent=`Sleeper · ${sleeperConnection.season} Week ${sleeperConnection.week}`;$('#sleeperBtn').textContent=isSyncing?'Analyzing…':'Switch league'}
$('#sleeperBtn').onclick=()=>{$('#leagueId').value=sleeperConnection?.leagueId||DEFAULT_SLEEPER_LEAGUE_ID;$('#sleeperDialog').showModal();setTimeout(()=>{$('#leagueId').focus();$('#leagueId').select()},50)};$('#cancelSleeper').onclick=()=>$('#sleeperDialog').close();$('#sleeperForm').onsubmit=async e=>{e.preventDefault();await syncSleeper(new FormData(e.currentTarget).get('leagueId'))};
async function sleeperGet(path){const response=await fetch(`https://api.sleeper.app/v1/${path}`);if(!response.ok)throw new Error(response.status===404?'League not found. Double-check the league ID.':'Sleeper is unavailable right now. Try again shortly.');return response.json()}
async function syncSleeper(rawId){
  const leagueId=String(rawId||'').trim();
  if(!/^\d+$/.test(leagueId)){toast('Enter a valid numeric league ID');return}
  const btn=$('#sleeperBtn'),connect=$('#connectBtn');
  isSyncing=true;btn.disabled=true;connect.disabled=true;btn.textContent='Analyzing…';connect.textContent='Analyzing…';
  if(!teams.length)render();else renderRegret();
  try{
    const [league,users,rosters,state]=await Promise.all([sleeperGet(`league/${leagueId}`),sleeperGet(`league/${leagueId}/users`),sleeperGet(`league/${leagueId}/rosters`),sleeperGet('state/nfl')]);
    if(!league?.league_id||!Array.isArray(users)||!Array.isArray(rosters))throw new Error('Sleeper returned incomplete league data.');
    const regularWeeks=Math.max(1,Number(league.settings?.playoff_week_start||15)-1),currentWeek=Math.max(1,Number(state.week||state.display_week||1));
    const matchupWeeks=await Promise.all(Array.from({length:regularWeeks},(_,i)=>sleeperGet(`league/${leagueId}/matchups/${i+1}`)));
    const weekData=matchupWeeks.map((entries,i)=>({week:i+1,entries:Array.isArray(entries)?entries:[]}));
    const people=new Map(users.map(u=>[u.user_id,u])),sameLeague=sleeperConnection?.leagueId===leagueId,oldRanks=sameLeague?new Map(sorted().map((t,i)=>[t.id,i+1])):new Map(),hadAnalytics=sameLeague&&teams.some(t=>t.analytics);
    const nextTeams=rosters.map((r,index)=>{const person=people.get(r.owner_id)||{},settings=r.settings||{},games=Number(settings.wins||0)+Number(settings.losses||0)+Number(settings.ties||0),total=Number(settings.fpts||0)+Number(settings.fpts_decimal||0)/100;return {id:`sleeper-${r.roster_id}`,sleeperRosterId:Number(r.roster_id),name:person.metadata?.team_name||person.display_name||person.username||`Team ${r.roster_id}`,owner:person.display_name||person.username||'Co-manager',wins:0,losses:0,ties:0,points:games?total/games:100,prev:oldRanks.get(`sleeper-${r.roster_id}`)||index+1}});
    analyzeLeague(nextTeams,weekData,currentWeek,league,leagueId);
    teams=nextTeams;
    if(!sameLeague){regretByRoster={};regretLoaded=false;managerHistory=null}
    regretError='';
    if(!hadAnalytics)sorted().forEach((team,index)=>team.prev=index+1);
    const completedWeeks=Math.max(0,currentWeek-1);
    sleeperConnection={leagueId,leagueName:league.name||'Sleeper league',season:league.season||state.season,week:state.display_week||state.week,completedWeeks,syncedAt:new Date().toISOString()};
    localStorage.setItem('power-board-sleeper',JSON.stringify(sleeperConnection));
    selected=sorted()[0]?.id;$('#sleeperDialog').close();toast(`${sleeperConnection.leagueName} analyzed`);
    render();
    const [regretResult,historyResult]=await Promise.allSettled([
      Regret.load(leagueId,league,weekData,currentWeek),
      ManagerHistory.loadChain(league,users,rosters,sleeperGet)
    ]);
    if(regretResult.status==='fulfilled'){
      regretByRoster=Object.fromEntries(regretResult.value);regretError='';regretLoaded=true;
      localStorage.setItem('power-board-regret',JSON.stringify({leagueId,version:REGRET_CACHE_VERSION,rows:regretByRoster}));
    }else{console.error('Transaction analysis failed',regretResult.reason);regretByRoster={};regretLoaded=false;regretError=regretResult.reason?.message||'Sleeper data could not be loaded'}
    if(historyResult.status==='fulfilled'){
      managerHistory=historyResult.value;ManagerHistory.writeCache(managerHistory);
    }else{
      console.error('Manager history failed',historyResult.reason);
      managerHistory={rootLeagueId:leagueId,seasons:[ManagerHistory.normalizeSeason(league,users,rosters)],error:historyResult.reason?.message||'Older seasons could not be loaded'};
    }
  }catch(error){console.error(error);toast(error.message||'Could not sync Sleeper')}
  finally{isSyncing=false;btn.disabled=false;connect.disabled=false;connect.textContent='Sync & analyze';render()}
}
function analyzeLeague(teamList,weekData,currentWeek,league,leagueId){
  const ids=teamList.map(t=>t.sleeperRosterId);
  const stats=new Map(ids.map(id=>[id,{scores:[],weeklyScores:[],zs:[],expectedParts:[],expectedWins:0,allPlayWins:0,allPlayLosses:0,allPlayTies:0,rankSum:0,actualWins:0,actualLosses:0,actualTies:0,pointsAgainst:0,badBeats:0,thiefWins:0,defensePoints:0,defenseStarts:0,closest:null,blowout:null}]));
  const past=weekData.filter(w=>w.week<currentWeek&&w.entries.length>1);
  for(const week of past){
    const entries=week.entries.filter(e=>stats.has(Number(e.roster_id))),scores=entries.map(e=>Number(e.points||0));
    if(scores.length<2)continue;
    const avg=mean(scores),spread=std(scores),med=median(scores),ranked=[...entries].sort((a,b)=>Number(b.points||0)-Number(a.points||0));
    for(const entry of entries){
      const id=Number(entry.roster_id),s=stats.get(id),pts=Number(entry.points||0),wins=scores.filter(x=>pts>x).length,ties=Math.max(0,scores.filter(x=>pts===x).length-1),expected=(wins+.5*ties)/(scores.length-1);
      const weeklyRank=ranked.findIndex(x=>Number(x.roster_id)===id)+1;
      s.scores.push(pts);s.weeklyScores.push({week:week.week,score:pts,rank:weeklyRank});s.zs.push(spread?(pts-avg)/spread:0);s.expectedParts.push(expected);s.expectedWins+=expected;s.allPlayWins+=wins;s.allPlayTies+=ties;s.allPlayLosses+=scores.length-1-wins-ties;s.rankSum+=weeklyRank;
      const defense=startedDefensePoints(entry,league.roster_positions);
      s.defensePoints+=defense.points;s.defenseStarts+=defense.starts;
    }
    for(const pair of groupMatchups(entries)){if(pair.length!==2)continue;const [a,b]=pair,ap=Number(a.points||0),bp=Number(b.points||0);applyResult(stats.get(Number(a.roster_id)),ap,bp,med,week.week);applyResult(stats.get(Number(b.roster_id)),bp,ap,med,week.week)}
  }
  const histories=Object.fromEntries(ids.map(id=>[id,[]]));
  for(let cutoff=1;cutoff<=past.length;cutoff++){
    const expValues={},seasonValues={},recentValues={};
    for(const id of ids){const s=stats.get(id);expValues[id]=mean(s.expectedParts.slice(0,cutoff));seasonValues[id]=mean(s.zs.slice(0,cutoff));recentValues[id]=weightedRecent(s.zs.slice(0,cutoff))}
    const ep=percentiles(expValues),sp=percentiles(seasonValues),rp=percentiles(recentValues),scores=ids.map(id=>({id,score:.45*ep[id]+.35*sp[id]+.20*rp[id]})).sort((a,b)=>b.score-a.score);
    scores.forEach((row,index)=>histories[row.id].push({week:past[cutoff-1].week,rank:index+1,score:row.score}));
  }
  const expValues={},seasonValues={},recentValues={};
  for(const id of ids){const s=stats.get(id),count=Math.max(1,s.scores.length);expValues[id]=s.expectedWins/count;seasonValues[id]=mean(s.zs);recentValues[id]=weightedRecent(s.zs)}
  const expPct=percentiles(expValues),seasonPct=percentiles(seasonValues),recentPct=percentiles(recentValues),odds=simulatePlayoffs([...ids],stats,weekData,currentWeek,Number(league.settings?.playoff_teams||6),leagueId),scheduleRecords=ScheduleMatrixChart.buildRecords(ids,past);
  for(const team of teamList){const s=stats.get(team.sleeperRosterId),count=Math.max(1,s.scores.length);team.wins=s.actualWins;team.losses=s.actualLosses;team.ties=s.actualTies;team.points=mean(s.scores)||team.points;team.analytics={powerScore:.45*expPct[team.sleeperRosterId]+.35*seasonPct[team.sleeperRosterId]+.20*recentPct[team.sleeperRosterId],expectedWins:s.expectedWins,luck:s.actualWins+.5*s.actualTies-s.expectedWins,allPlayWins:s.allPlayWins,allPlayLosses:s.allPlayLosses,allPlayTies:s.allPlayTies,avgWeeklyRank:s.rankSum/count,recentZ:recentValues[team.sleeperRosterId],consistency:std(s.scores),pointsAgainst:s.pointsAgainst,badBeats:s.badBeats,thiefWins:s.thiefWins,defensePoints:s.defensePoints,defenseStarts:s.defenseStarts,closestGame:gameLabel(s.closest),largestBlowout:gameLabel(s.blowout),playoffOdds:odds[team.sleeperRosterId]||0,rankHistory:histories[team.sleeperRosterId],weeklyScores:s.weeklyScores,scheduleRecords:scheduleRecords[team.sleeperRosterId]}}
  const allPlayScores=teamList.map(t=>t.analytics.allPlayWins+.5*t.analytics.allPlayTies);
  for(const team of teamList){const value=team.analytics.allPlayWins+.5*team.analytics.allPlayTies;team.analytics.allPlayRank=1+allPlayScores.filter(other=>other>value).length}
}
function applyResult(s,pts,opp,med,week){const margin=pts-opp;if(margin>0)s.actualWins++;else if(margin<0)s.actualLosses++;else s.actualTies++;s.pointsAgainst+=opp;if(margin<0&&pts>med)s.badBeats++;if(margin>0&&pts<med)s.thiefWins++;const game={week,margin,abs:Math.abs(margin)};if(!s.closest||game.abs<s.closest.abs)s.closest=game;if(!s.blowout||game.abs>s.blowout.abs)s.blowout=game}
function startedDefensePoints(entry,rosterPositions){
  if(!Array.isArray(entry.starters)||!Array.isArray(rosterPositions))return {points:0,starts:0};
  return rosterPositions.reduce((total,slot,index)=>{
    if(slot!=='DEF')return total;
    const id=entry.starters[index];
    if(!id||id==='0')return total;
    const raw=entry.starters_points?.[index]??entry.players_points?.[id];
    if(raw==null||!Number.isFinite(Number(raw)))return total;
    total.points+=Number(raw);total.starts++;
    return total;
  },{points:0,starts:0});
}
function groupMatchups(entries){const groups=new Map();for(const e of entries){if(e.matchup_id==null)continue;const key=String(e.matchup_id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e)}return [...groups.values()]}
function simulatePlayoffs(ids,stats,weekData,currentWeek,playoffTeams,seedText){const makes=Object.fromEntries(ids.map(id=>[id,0])),future=weekData.filter(w=>w.week>=currentWeek),rng=seededRandom(seedText);for(let sim=0;sim<3000;sim++){const table=Object.fromEntries(ids.map(id=>{const s=stats.get(id);return [id,{wins:s.actualWins+.5*s.actualTies,pf:s.scores.reduce((a,b)=>a+b,0)}]}));for(const week of future){for(const pair of groupMatchups(week.entries)){if(pair.length!==2)continue;const a=Number(pair[0].roster_id),b=Number(pair[1].roster_id);if(!table[a]||!table[b])continue;const ap=sampleRecent(stats.get(a).scores,rng),bp=sampleRecent(stats.get(b).scores,rng);table[a].pf+=ap;table[b].pf+=bp;if(ap>bp)table[a].wins++;else if(bp>ap)table[b].wins++;else{table[a].wins+=.5;table[b].wins+=.5}}}ids.sort((a,b)=>table[b].wins-table[a].wins||table[b].pf-table[a].pf).slice(0,Math.min(playoffTeams,ids.length)).forEach(id=>makes[id]++)}return Object.fromEntries(ids.map(id=>[id,makes[id]/30]))}
function sampleRecent(values,rng){if(!values.length)return 100;const weights=values.map((_,i)=>Math.pow(.75,values.length-1-i)),total=weights.reduce((a,b)=>a+b,0);let target=rng()*total;for(let i=0;i<values.length;i++){target-=weights[i];if(target<=0)return values[i]}return values[values.length-1]}
function seededRandom(text){let seed=2166136261;for(const c of String(text)){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619)}return()=>{seed+=0x6D2B79F5;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function percentiles(values){const ordered=Object.entries(values).sort((a,b)=>a[1]-b[1]),den=Math.max(1,ordered.length-1),out={};ordered.forEach(([id],i)=>out[id]=100*i/den);return out}
function weightedRecent(values){if(!values.length)return 0;const weights=values.map((_,i)=>Math.pow(.75,values.length-1-i)),total=weights.reduce((a,b)=>a+b,0);return values.reduce((sum,v,i)=>sum+v*weights[i],0)/total}
function mean(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:0}
function std(values){if(values.length<2)return 0;const avg=mean(values);return Math.sqrt(values.reduce((sum,v)=>sum+(v-avg)**2,0)/values.length)}
function median(values){const s=[...values].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function gameLabel(game){if(!game)return 'Not enough data';return `Week ${game.week} · ${game.margin>=0?'W':'L'} by ${Math.abs(game.margin).toFixed(1)}`}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
document.addEventListener('click',event=>{const btn=event.target.closest('.info-btn');if(!btn)return;event.preventDefault();event.stopPropagation();openMetricInfo(btn.dataset.info)});$('#closeInfo').onclick=()=>$('#infoDialog').close();
function registerWebMCP(){const c=document.modelContext;if(!c?.registerTool)return;try{c.registerTool({name:'get_power_rankings',title:'Get power rankings',description:'Return the current ordered fantasy football power rankings and scores.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({rankings:sorted().map((t,i)=>({rank:i+1,team:t.name,manager:t.owner,score:Number(score(t).toFixed(1))}))})})}catch(e){console.warn('WebMCP unavailable',e)}}
function shouldAutoSync(now=new Date()){if(!sleeperConnection?.leagueId||!AUTO_SYNC_DAYS.has(now.getDay()))return false;const lastSync=Date.parse(sleeperConnection.syncedAt);return !Number.isFinite(lastSync)||now.getTime()-lastSync>=AUTO_SYNC_MAX_AGE_MS}
const needsAnalyticsRefresh=teams.some(t=>!Array.isArray(t.analytics?.weeklyScores)||!t.analytics?.scheduleRecords||!Number.isFinite(t.analytics?.allPlayRank)||!Number.isFinite(t.analytics?.defensePoints)||!Number.isFinite(t.analytics?.defenseStarts));
const needsRegretRefresh=Boolean(sleeperConnection?.leagueId)&&!regretLoaded;
const needsHistoryRefresh=Boolean(sleeperConnection?.leagueId)&&!managerHistory;
render();registerWebMCP();if(!teams.length||needsAnalyticsRefresh||needsRegretRefresh||needsHistoryRefresh||shouldAutoSync())syncSleeper(sleeperConnection?.leagueId||DEFAULT_SLEEPER_LEAGUE_ID);
