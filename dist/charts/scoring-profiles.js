const ScoringProfilesChart = (() => {
  const {escapeHtml: esc, sorted, mean} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const teamLabel = name => String(name).length > 20 ? `${String(name).slice(0, 19)}…` : String(name);
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
    const width = 1080, left = 220, right = 54, top = 12, rowHeight = 62, bottom = 62;
    const plotRight = width - right, plotBottom = top + rows.length * rowHeight;
    const height = plotBottom + bottom;
    const xFor = value => left + (value - domainMin) / (domainMax - domainMin) * (plotRight - left);
    const span = domainMax - domainMin, tickStep = span <= 60 ? 10 : span <= 120 ? 20 : 25, ticks = [];
    for (let value = Math.ceil(domainMin / tickStep) * tickStep; value <= domainMax; value += tickStep) ticks.push(value);
    let chart = `<div class="profile-chart-shell"><svg class="profile-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="profile-svg-title profile-svg-desc"><title id="profile-svg-title">Team weekly scoring profiles</title><desc id="profile-svg-desc">All teams appear in one chart. Each horizontal line runs from a team’s lowest to highest weekly score. The diamond marks its average, and the dashed vertical line marks the league average.</desc><rect class="profile-frame" x="${left}" y="${top}" width="${plotRight-left}" height="${plotBottom-top}" rx="10"/>`;
    for (const tick of ticks) {
      const x = xFor(tick);
      chart += `<line class="profile-grid" x1="${x}" y1="${top}" x2="${x}" y2="${plotBottom}"/><text class="profile-axis" x="${x}" y="${plotBottom+28}" text-anchor="middle">${tick}</text>`;
    }
    rows.forEach((row, index) => {
      const y = top + index * rowHeight + rowHeight / 2;
      const markerX = [xFor(row.min), xFor(row.average), xFor(row.max)];
      chart += `<line class="profile-row-rule" x1="${left}" y1="${top+(index+1)*rowHeight}" x2="${plotRight}" y2="${top+(index+1)*rowHeight}"/><g class="profile-chart-row" role="img" aria-label="${esc(row.team.name)}: floor ${row.min.toFixed(1)}, average ${row.average.toFixed(1)}, ceiling ${row.max.toFixed(1)} points"><text class="profile-team" x="${left-18}" y="${y+5}" text-anchor="end"><title>${esc(row.team.name)}</title>${esc(teamLabel(row.team.name))}</text><line class="profile-range" x1="${markerX[0]}" y1="${y}" x2="${markerX[2]}" y2="${y}"/><circle class="profile-end" cx="${markerX[0]}" cy="${y}" r="6"><title>Floor ${row.min.toFixed(1)}</title></circle><circle class="profile-end" cx="${markerX[2]}" cy="${y}" r="6"><title>Ceiling ${row.max.toFixed(1)}</title></circle><rect class="profile-average" x="${markerX[1]-6}" y="${y-6}" width="12" height="12" transform="rotate(45 ${markerX[1]} ${y})"><title>Average ${row.average.toFixed(1)}</title></rect><text class="profile-value profile-floor-value" x="${markerX[0]-14}" y="${y+4}" text-anchor="end">${row.min.toFixed(1)}</text><text class="profile-value profile-average-value" x="${markerX[1]}" y="${y-15}" text-anchor="middle">${row.average.toFixed(1)}</text><text class="profile-value profile-ceiling-value" x="${markerX[2]+14}" y="${y+4}" text-anchor="start">${row.max.toFixed(1)}</text></g>`;
    });
    const leagueX = xFor(leagueAverage);
    chart += `<line class="profile-league" x1="${leagueX}" y1="${top}" x2="${leagueX}" y2="${plotBottom}"/><text class="profile-axis-title" x="${(left+plotRight)/2}" y="${height-13}" text-anchor="middle">Weekly points</text></svg></div>`;
    return `<div class="profile-overview"><div><small>League weekly average</small><strong>${leagueAverage.toFixed(1)}</strong><span>points per team</span></div><div><small>Highest single week</small><strong>${highest.max.toFixed(1)}</strong><span>${esc(highest.team.name)}</span></div><div><small>Most consistent</small><strong>${steadiest.team.analytics.consistency.toFixed(1)} pts</strong><span>${esc(steadiest.team.name)} · score deviation</span></div></div>${chart}`;
  }
  function render(holder, teams) { holder.innerHTML = markup(teams); }
  return {model, markup, render};
})();
if (typeof module !== 'undefined') module.exports = ScoringProfilesChart;
