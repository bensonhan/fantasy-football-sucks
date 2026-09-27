const ScoringProfilesChart = (() => {
  const {escapeHtml: esc, sorted, mean} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  function model(teams) {
    const withScores = sorted(teams).filter(team => team.analytics?.weeklyScores?.length);
    if (!withScores.length) return null;
    const rows = withScores.map(team => {
      const values = team.analytics.weeklyScores.map(week => week.score);
      return {team, min: Math.min(...values), max: Math.max(...values), average: mean(values)};
    }).sort((a, b) => b.average - a.average);
    const allScores = withScores.flatMap(team => team.analytics.weeklyScores.map(week => week.score));
    const leagueAverage = mean(allScores), rawMin = Math.min(...allScores), rawMax = Math.max(...allScores);
    const padding = Math.max(8, (rawMax - rawMin) * .08);
    const domainMin = Math.max(0, Math.floor((rawMin - padding) / 10) * 10);
    const domainMax = Math.ceil((rawMax + padding) / 10) * 10;
    const highest = [...rows].sort((a, b) => b.max - a.max)[0];
    const steadiest = [...rows].sort((a, b) => a.team.analytics.consistency - b.team.analytics.consistency)[0];
    return {rows, leagueAverage, domainMin, domainMax, highest, steadiest};
  }
  function markup(teams) {
    const data = model(teams);
    if (!data) return '<div class="chart-empty">Sync a Sleeper league to build team scoring profiles.</div>';
    const {rows, leagueAverage, domainMin, domainMax, highest, steadiest} = data;
    const position = value => 100 * (value - domainMin) / (domainMax - domainMin);
    const leaguePosition = position(leagueAverage);
    return `<div class="profile-overview"><div><small>League weekly average</small><strong>${leagueAverage.toFixed(1)}</strong><span>points per team</span></div><div><small>Highest single week</small><strong>${highest.max.toFixed(1)}</strong><span>${esc(highest.team.name)}</span></div><div><small>Most consistent</small><strong>${steadiest.team.analytics.consistency.toFixed(1)} pts</strong><span>${esc(steadiest.team.name)} · score deviation</span></div></div><div class="profile-guide"><span><i class="guide-endpoint"></i> Floor & ceiling</span><span><i class="guide-average"></i> Average</span><span><i class="guide-league"></i> League average</span></div><div class="profile-rows">${rows.map((row,index)=>{const from=position(row.min),to=position(row.max),average=position(row.average),compact=to-from<18;return `<article class="profile-row"><div class="profile-identity"><b>${String(index+1).padStart(2,'0')}</b><strong>${esc(row.team.name)}</strong></div><div class="profile-plot ${compact?'compact':''} ${from<12?'edge-start':''} ${to>88?'edge-end':''}" role="img" aria-label="${esc(row.team.name)}: floor ${row.min.toFixed(1)}, average ${row.average.toFixed(1)}, ceiling ${row.max.toFixed(1)} points; league average ${leagueAverage.toFixed(1)}"><div class="profile-track"><span class="profile-range-fill" style="left:${from}%;width:${Math.max(0,to-from)}%"></span><span class="profile-league-mark" style="left:${leaguePosition}%"></span><span class="profile-average-mark" style="left:${average}%"></span></div><span class="profile-point-value profile-value-average" style="left:clamp(25px,${average}%,calc(100% - 25px))">${row.average.toFixed(1)}</span>${compact?`<span class="profile-point-value profile-compact-range" style="left:clamp(48px,${(from+to)/2}%,calc(100% - 48px))">${row.min.toFixed(1)}–${row.max.toFixed(1)}</span>`:`<span class="profile-point-value profile-value-floor" style="left:${from}%">${row.min.toFixed(1)}</span><span class="profile-point-value profile-value-ceiling" style="left:${to}%">${row.max.toFixed(1)}</span>`}</div></article>`}).join('')}</div><div class="profile-axis-label"><span>${domainMin} pts</span><span>Weekly points on one shared scale</span><span>${domainMax} pts</span></div>`;
  }
  function render(holder, teams) { holder.innerHTML = markup(teams); }
  return {model, markup, render};
})();
if (typeof module !== 'undefined') module.exports = ScoringProfilesChart;
