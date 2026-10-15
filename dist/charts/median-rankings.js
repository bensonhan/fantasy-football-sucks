const MedianRankingsChart = (() => {
  const {escapeHtml: esc} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const median = values => {
    const list = [...values].sort((a, b) => a - b), middle = Math.floor(list.length / 2);
    return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
  };
  function buildRows(teams) {
    const scored = teams.filter(team => team.analytics?.weeklyScores?.length);
    const byWeek = new Map();
    for (const team of scored) for (const entry of team.analytics.weeklyScores) {
      if (!byWeek.has(entry.week)) byWeek.set(entry.week, []);
      byWeek.get(entry.week).push(Number(entry.score));
    }
    const medians = new Map([...byWeek].map(([week, scores]) => [week, median(scores)]));
    const rows = scored.map(team => {
      let medianWins = 0, medianLosses = 0, points = 0;
      for (const entry of team.analytics.weeklyScores) {
        if (Number(entry.score) > medians.get(entry.week)) medianWins++; else medianLosses++;
        points += Number(entry.score);
      }
      const wins = Number(team.wins || 0), losses = Number(team.losses || 0), ties = Number(team.ties || 0);
      return {team, wins, losses, ties, medianWins, medianLosses, points,
        totalWins: wins + medianWins, totalLosses: losses + medianLosses, totalTies: ties};
    });
    const order = (a, b) => (b.totalWins + b.totalTies * .5) - (a.totalWins + a.totalTies * .5) || b.points - a.points;
    const actualOrder = [...rows].sort((a, b) => (b.wins + b.ties * .5) - (a.wins + a.ties * .5) || b.points - a.points);
    actualOrder.forEach((row, index) => { row.actualRank = index + 1; });
    rows.sort(order).forEach((row, index) => { row.rank = index + 1; row.change = row.actualRank - row.rank; });
    return rows;
  }
  const record = (wins, losses, ties = 0) => `${wins}-${losses}${ties ? `-${ties}` : ''}`;
  function changeCell(change) {
    if (!change) return '<span class="median-change median-same">—</span>';
    return `<span class="median-change ${change > 0 ? 'median-up' : 'median-down'}">${change > 0 ? '▲' : '▼'} ${Math.abs(change)}</span>`;
  }
  function markup(teams) {
    const rows = buildRows(teams);
    if (!rows.length) return '<div class="chart-empty">Sync a Sleeper league to calculate median rankings.</div>';
    const head = ['Median record', 'Actual record', 'Median W-L', 'vs. actual rank'].map(label => `<th scope="col"><span class="data-header-bubble">${label}</span></th>`).join('');
    const body = rows.map(row => `<tr class="${row.change > 0 ? 'median-row-up' : row.change < 0 ? 'median-row-down' : ''}"><th scope="row" title="${esc(row.team.name)}"><span class="data-row-bubble">${row.rank}. ${esc(row.team.name)}</span></th>` +
      `<td class="median-cell median-total">${record(row.totalWins, row.totalLosses, row.totalTies)}</td>` +
      `<td class="median-cell">${record(row.wins, row.losses, row.ties)}</td>` +
      `<td class="median-cell">${record(row.medianWins, row.medianLosses)}</td>` +
      `<td class="median-cell" title="Actual rank #${row.actualRank}, median rank #${row.rank}">${changeCell(row.change)}</td></tr>`).join('');
    return `<table class="data-table median-table"><thead><tr><th scope="col"><span class="data-corner-bubble">Team</span></th>${head}</tr></thead><tbody>${body}</tbody></table><p class="table-note">Each week, every team also gets a win for scoring above that week's league median, or a loss otherwise. Median record adds those results to the actual record; ties in the standings break on total points. Green names move up from the actual standings and red names move down.</p>`;
  }
  function render(holder, teams) { holder.innerHTML = markup(teams); }
  return {median, buildRows, markup, render};
})();
if (typeof module !== 'undefined') module.exports = MedianRankingsChart;
