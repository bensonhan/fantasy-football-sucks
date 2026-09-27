const ManagerHistory = (() => {
  const {escapeHtml: esc} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const CACHE_KEY = 'power-board-manager-history', CACHE_VERSION = 2;
  const format = value => value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

  function normalizeSeason(league, users, rosters) {
    const people = new Map(users.map(user => [String(user.user_id), user]));
    return {
      leagueId: String(league.league_id), year: String(league.season), status: league.status,
      playoffWeek: Number(league.settings?.playoff_week_start || 0),
      playoffTeams: Number(league.settings?.playoff_teams || 0),
      managers: rosters.filter(roster => roster.owner_id).map(roster => {
        const userId = String(roster.owner_id), person = people.get(userId);
        const points = Math.round(Number(roster.settings?.fpts || 0) * 100 + Number(roster.settings?.fpts_decimal || 0)) / 100;
        return {userId, rosterId: Number(roster.roster_id), name: person?.display_name || person?.username || `Manager ${userId}`,
          regularPoints: points, points, finish: null, score: null};
      })
    };
  }
  function placements(winners, losers, playoffTeams) {
    const result = new Map();
    for (const [bracket, offset] of [[winners, 0], [losers, playoffTeams]]) {
      for (const match of bracket) {
        if (!Number.isInteger(Number(match.p)) || !match.p || !match.w || !match.l) continue;
        result.set(Number(match.w), offset + Number(match.p));
        result.set(Number(match.l), offset + Number(match.p) + 1);
      }
    }
    return result;
  }
  function scoreSeason(season, matchups, winners, losers) {
    const finishByRoster = placements(winners, losers, season.playoffTeams);
    const playoffCents = new Map();
    for (const week of matchups) for (const entry of week) {
      const rosterId = Number(entry.roster_id), rawPoints = entry.custom_points ?? entry.points, points = Number(rawPoints);
      if (rawPoints == null || !Number.isFinite(rosterId) || !Number.isFinite(points)) continue;
      playoffCents.set(rosterId, (playoffCents.get(rosterId) || 0) + Math.round(points * 100));
    }
    for (const manager of season.managers) {
      manager.points = Math.round(manager.regularPoints * 100 + (playoffCents.get(manager.rosterId) || 0)) / 100;
      manager.finish = finishByRoster.get(manager.rosterId) || null;
    }
    season.rankable = season.managers.length > 1 && season.managers.every(manager => manager.finish >= 1 && manager.finish <= season.managers.length) &&
      new Set(season.managers.map(manager => manager.finish)).size === season.managers.length;
    if (!season.rankable) return season;
    const values = season.managers.map(manager => manager.points), min = Math.min(...values), max = Math.max(...values);
    const count = season.managers.length;
    for (const manager of season.managers) {
      const pointsShare = max === min ? .5 : (manager.points - min) / (max - min);
      const finishShare = (count - manager.finish) / (count - 1);
      manager.score = Math.round((.6 * pointsShare + .4 * finishShare) * 10000) / 100;
    }
    return season;
  }
  async function addSeasonDetails(season, get) {
    if (season.status !== 'complete' || !season.playoffWeek || !season.playoffTeams) return season;
    const base = `league/${season.leagueId}`;
    const [winners, losers] = await Promise.all([get(`${base}/winners_bracket`), get(`${base}/losers_bracket`)]);
    if (!Array.isArray(winners) || !Array.isArray(losers)) throw new Error(`Incomplete ${season.year} playoff brackets`);
    const rounds = Math.max(0, ...winners.map(match => Number(match.r) || 0), ...losers.map(match => Number(match.r) || 0));
    const matchups = await Promise.all(Array.from({length: rounds}, (_, i) => get(`${base}/matchups/${season.playoffWeek + i}`)));
    if (matchups.some(week => !Array.isArray(week))) throw new Error(`Incomplete ${season.year} playoff scores`);
    return scoreSeason(season, matchups, winners, losers);
  }
  async function loadChain(league, users, rosters, get) {
    const rootLeagueId = String(league.league_id), seen = new Set([rootLeagueId]);
    const seasons = [normalizeSeason(league, users, rosters)];
    let previousId = league.previous_league_id, error = '';
    for (let depth = 0; previousId && depth < 30; depth++) {
      const id = String(previousId);
      if (seen.has(id)) {error = 'Sleeper league history contains a loop.'; break;}
      seen.add(id);
      try {
        const prior = await get(`league/${id}`);
        if (!prior?.league_id || String(prior.league_id) !== id) throw new Error(`Missing league ${id}`);
        const [priorUsers, priorRosters] = await Promise.all([get(`league/${id}/users`), get(`league/${id}/rosters`)]);
        if (!Array.isArray(priorUsers) || !Array.isArray(priorRosters)) throw new Error(`Incomplete ${prior.season} roster data`);
        seasons.push(normalizeSeason(prior, priorUsers, priorRosters));
        previousId = prior.previous_league_id;
      } catch (failure) {error = failure.message || 'Older seasons could not be loaded'; break;}
    }
    if (previousId && seasons.length >= 31) error = 'History was limited to 31 seasons.';
    const details = await Promise.allSettled(seasons.map(season => addSeasonDetails(season, get)));
    details.forEach((result, i) => {
      if (result.status === 'rejected') error = [error, `${seasons[i].year}: ${result.reason?.message || 'playoff data unavailable'}`].filter(Boolean).join(' · ');
    });
    seasons.sort((a, b) => Number(b.year) - Number(a.year));
    return {rootLeagueId, seasons, error};
  }
  const metrics = {
    historical: {label: 'Historical ranking', unit: 'rank pts'},
    points: {label: 'All-time points', unit: 'pts'},
    perSeason: {label: 'Points per season', unit: 'pts / season'},
    averageFinish: {label: 'Average finish', unit: 'avg finish'}
  };
  function rank(history, year = '', metric = 'historical') {
    if (!metrics[metric]) metric = 'historical';
    const seasons = (history?.seasons || []).filter(season =>
      (!year || season.year === String(year)) &&
      (season.rankable || (metric === 'points' && season.status === 'in_season')));
    const rows = new Map();
    for (const season of seasons) for (const manager of season.managers) {
      let row = rows.get(manager.userId);
      if (!row) {row = {userId: manager.userId, name: manager.name, cents: 0, completedCents: 0, score: 0, finishes: 0, completedSeasons: 0, seasons: 0, active: false}; rows.set(manager.userId, row);}
      row.cents += Math.round(manager.points * 100);
      if (season.rankable) {
        row.completedCents += Math.round(manager.points * 100);
        row.score += manager.score;
        row.finishes += manager.finish;
        row.completedSeasons++;
      } else row.active = true;
      row.seasons++;
    }
    return [...rows.values()].map(row => ({userId: row.userId, name: row.name, points: row.cents / 100,
      score: Math.round(row.score * 100) / 100, averageFinish: row.completedSeasons ? row.finishes / row.completedSeasons : null,
      seasons: row.seasons, completedSeasons: row.completedSeasons, active: row.active,
      pointsPerSeason: row.completedSeasons ? Math.round(row.completedCents / row.completedSeasons) / 100 : null}))
      .sort((a, b) => {
        if (metric === 'averageFinish') return a.averageFinish - b.averageFinish || b.completedSeasons - a.completedSeasons || b.points - a.points || a.name.localeCompare(b.name);
        const value = row => metric === 'points' ? row.points : metric === 'perSeason' ? row.pointsPerSeason : row.score;
        return value(b) - value(a) || b.score - a.score || b.points - a.points || a.name.localeCompare(b.name);
      });
  }
  function markup(history, selectedYear = '', selectedMetric = 'historical') {
    if (!history?.seasons?.length) return '<div class="chart-empty">Sync a Sleeper league to load manager history.</div>';
    const years = history.seasons.map(season => season.year);
    const year = years.includes(String(selectedYear)) ? String(selectedYear) : '';
    const metric = metrics[selectedMetric] ? selectedMetric : 'historical';
    const rankings = rank(history, year, metric), selected = history.seasons.find(season => season.year === year);
    const range = [...years].sort((a, b) => Number(a) - Number(b));
    const options = `<option value="" ${year?'':'selected'}>All seasons · ${range[0]}–${range.at(-1)}</option>${history.seasons.map(season => `<option value="${esc(season.year)}" ${year===season.year?'selected':''}>${esc(season.year)}${season.rankable||metric==='points'&&season.status==='in_season'?'':' · pending'}</option>`).join('')}`;
    const metricOptions = Object.entries(metrics).map(([key, choice]) => `<option value="${key}" ${metric===key?'selected':''}>${choice.label}</option>`).join('');
    const value = manager => metric === 'points' ? format(manager.points) : metric === 'averageFinish' ? (year ? `#${manager.averageFinish.toFixed(0)}` : manager.averageFinish.toFixed(2)) : metric === 'perSeason' ? format(manager.pointsPerSeason) : format(manager.score);
    const unit = metric === 'averageFinish' && year ? 'final place' : metrics[metric].unit;
    const detail = manager => metric === 'averageFinish' ? `${manager.completedSeasons} completed season${manager.completedSeasons===1?'':'s'} · ${format(manager.points)} total pts` :
      metric === 'perSeason' ? `${format(manager.points)} total pts · ${manager.completedSeasons} completed season${manager.completedSeasons===1?'':'s'}` :
      metric === 'points' ? `${manager.seasons} season${manager.seasons===1?'':'s'}${manager.active?' · includes current season':''}${year&&manager.averageFinish?` · #${manager.averageFinish} final finish`:''}` :
      `${format(manager.points)} total pts · ${year?`#${manager.averageFinish} final finish`:`${manager.seasons} season${manager.seasons===1?'':'s'} · avg finish ${manager.averageFinish.toFixed(1)}`}`;
    const podium = rankings.slice(0, 3).map((manager, i) => `<article class="history-podium history-place-${i+1}"><span class="history-medal" aria-label="Rank ${i+1}">${['🥇','🥈','🥉'][i]}</span><div><small>#${i+1} ${['Gold','Silver','Bronze'][i]}</small><h3>${esc(manager.name)}</h3><strong>${value(manager)} <span>${unit}</span></strong><p>${detail(manager)}</p></div></article>`).join('');
    const rest = rankings.slice(3).map((manager, i) => `<div class="history-row"><b>${String(i+4).padStart(2,'0')}</b><span>${esc(manager.name)}</span><small>${detail(manager)}</small><strong>${value(manager)} ${unit}</strong></div>`).join('');
    const empty = selected && !selected.rankable ? (metric === 'points' ? 'Point totals are not available for this season yet.' : 'Final standings are not available for this season yet. It will enter this leaderboard once the playoffs finish.') : 'No completed seasons with final standings are available yet.';
    const method = metric === 'points' ? 'Adds each manager’s scored points across linked seasons. Completed seasons include regular-season and playoff-week scores; the current season includes points scored so far. Seasons with incomplete historical playoff data are omitted.' :
      metric === 'averageFinish' ? 'Average final league place across completed seasons, using Sleeper’s playoff and consolation brackets. Lower is better; ties favor managers with more completed seasons. In-progress seasons are excluded.' :
      metric === 'perSeason' ? 'Average total points per completed season: regular-season points plus playoff-week scores, divided by completed seasons managed. In-progress seasons are excluded.' :
      'Each completed season earns up to 100 ranking points: 60% from total season points (regular season + playoff weeks, scaled from lowest to highest in that league year) and 40% from final bracket placement (champion to last place). All-time totals add those yearly scores; active seasons wait for final standings. Consolation placements follow Sleeper’s bracket.';
    const completedCount = history.seasons.filter(season => season.rankable).length;
    const managerCount = `${rankings.length} ${rankings.length===1?'manager':'managers'}`;
    return `<div class="history-controls"><label for="historyMetricSelect">Leaderboard<select id="historyMetricSelect">${metricOptions}</select></label><label for="historyYearSelect">Season<select id="historyYearSelect">${options}</select></label><span>${managerCount} · ${year?`${year} season`:`${completedCount} completed season${completedCount===1?'':'s'}`}</span></div>${rankings.length?`<div class="history-podiums">${podium}</div>${rest?`<div class="history-rest">${rest}</div>`:''}`:`<div class="history-empty">${empty}</div>`}${history.error?`<p class="history-warning">Some history may be incomplete: ${esc(history.error)}</p>`:''}<p class="history-method">${method}</p>`;
  }
  function create(holder) {
    let history = null, selectedYear = '', selectedMetric = 'historical';
    function render(nextHistory) {
      if (nextHistory !== undefined) {
        if (nextHistory?.rootLeagueId !== history?.rootLeagueId) selectedYear = '';
        history = nextHistory;
      }
      holder.innerHTML = markup(history, selectedYear, selectedMetric);
    }
    holder.addEventListener('change', event => {
      if (event.target.id === 'historyYearSelect') selectedYear = event.target.value;
      else if (event.target.id === 'historyMetricSelect') selectedMetric = event.target.value;
      else return;
      render();
      holder.querySelector(`#${event.target.id}`).focus();
    });
    return {render};
  }
  function readCache(leagueId) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      return cached?.version === CACHE_VERSION && cached.history?.rootLeagueId === String(leagueId) ? cached.history : null;
    } catch {return null;}
  }
  function writeCache(history) {
    try {localStorage.setItem(CACHE_KEY, JSON.stringify({version:CACHE_VERSION, history}));}
    catch (error) {console.warn('Manager history cache unavailable', error);}
  }
  return {normalizeSeason, placements, scoreSeason, addSeasonDetails, loadChain, rank, markup, create, readCache, writeCache};
})();
if (typeof module !== 'undefined') module.exports = ManagerHistory;
