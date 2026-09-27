const ScoringHeatmapChart = (() => {
  const {escapeHtml: esc, sorted} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const bucket = (rank, teamCount) => {
    const percentile = teamCount > 1 ? 1 - (rank - 1) / (teamCount - 1) : 1;
    return Math.max(1, Math.min(5, Math.ceil(percentile * 5)));
  };
  function model(teams) {
    const rows = sorted(teams).filter(team => team.analytics?.weeklyScores?.length);
    if (!rows.length) return null;
    const weeks = [...new Set(rows.flatMap(team => team.analytics.weeklyScores.map(week => week.week)))].sort((a, b) => a - b);
    return {rows, weeks, teamCount: teams.length};
  }
  function markup(teams) {
    const data = model(teams);
    if (!data) return '<div class="chart-empty">Sync a Sleeper league to build the scoring heatmap.</div>';
    const {rows, weeks, teamCount} = data;
    const body = rows.map(team => {
      const byWeek = new Map(team.analytics.weeklyScores.map(week => [week.week, week]));
      return `<tr><th scope="row" title="${esc(team.name)}">${esc(team.name)}</th>${weeks.map(week => {
        const value = byWeek.get(week);
        if (!value) return '<td class="heat-cell">—</td>';
        return `<td class="heat-cell heat-${bucket(value.rank, teamCount)}" title="${esc(team.name)} scored ${value.score.toFixed(1)} in Week ${week}, ranking #${value.rank}" aria-label="${esc(team.name)}, Week ${week}: ${value.score.toFixed(1)} points, rank ${value.rank}"><span>${value.score.toFixed(1)}</span><small>#${value.rank}</small></td>`;
      }).join('')}</tr>`;
    }).join('');
    return `<table class="data-table heatmap-table"><thead><tr><th scope="col">Team</th>${weeks.map(week => `<th scope="col">W${week}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  }
  function render(holder, teams) { holder.innerHTML = markup(teams); }
  return {bucket, model, markup, render};
})();
if (typeof module !== 'undefined') module.exports = ScoringHeatmapChart;
