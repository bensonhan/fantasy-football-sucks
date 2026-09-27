const PowerMovementChart = (() => {
  const {escapeHtml: esc, sorted, shortName} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  let focus = null;
  function markup(teams, chartFocus = null) {
    const series = sorted(teams).filter(team => team.analytics?.rankHistory?.length);
    if (!series.length) return {chart: '<div class="chart-empty">Sync a Sleeper league to build weekly power movement.</div>', legend: ''};
    if (!series.some(team => team.id === chartFocus)) chartFocus = null;
    const weeks = series[0].analytics.rankHistory.map(row => row.week);
    const width = 1180, height = Math.max(500, series.length * 46 + 70), left = 55, right = 210, top = 32, bottom = 45;
    const plotRight = width - right, plotBottom = height - bottom;
    const xFor = index => weeks.length === 1 ? plotRight : left + index * (plotRight - left) / (weeks.length - 1);
    const yFor = rank => top + (rank - 1) * (plotBottom - top) / Math.max(1, series.length - 1);
    const grid = Array.from({length: series.length}, (_, index) => {
      const rank = index + 1, y = yFor(rank);
      return `<g><line class="shared-rank-grid" x1="${left}" y1="${y}" x2="${plotRight}" y2="${y}"/><text class="shared-rank-label" x="${left-22}" y="${y+5}" text-anchor="middle">${rank}</text></g>`;
    }).join('');
    const weekLabels = weeks.map((week, index) => `<g><line class="shared-week-grid" x1="${xFor(index)}" y1="${top}" x2="${xFor(index)}" y2="${plotBottom}"/><text class="shared-week-label" x="${xFor(index)}" y="${height-13}" text-anchor="middle">W${week}</text></g>`).join('');
    const paths = series.map((team, index) => {
      const history = team.analytics.rankHistory, points = history.map((row, i) => `${xFor(i)},${yFor(row.rank)}`).join(' ');
      const last = history.at(-1), lastY = yFor(last.rank);
      return `<g class="shared-series" data-chart-team="${team.id}" style="--series-color:var(--series-${index%12})"><polyline class="shared-series-line" points="${points}"/><polyline class="shared-series-hit" points="${points}"/>${history.map((row,i)=>`<circle class="shared-series-point" cx="${xFor(i)}" cy="${yFor(row.rank)}" r="4"><title>${esc(team.name)} · Week ${row.week}: #${row.rank} (${row.score.toFixed(1)} power)</title></circle>`).join('')}<line class="shared-end-rule" x1="${plotRight+7}" y1="${lastY}" x2="${plotRight+21}" y2="${lastY}"/><text class="shared-end-label" x="${plotRight+27}" y="${lastY+5}">#${last.rank} ${esc(shortName(team.name))}</text></g>`;
    }).join('');
    const chart = `<div class="shared-chart-scroll"><svg class="shared-movement-svg ${weeks.length<=4?'few-weeks':''}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly power rank paths for all ${series.length} teams. Rank 1 is at the top; latest team names are on the right."><rect class="shared-chart-backdrop" x="${left}" y="${top}" width="${plotRight-left}" height="${plotBottom-top}" rx="9"/>${grid}${weekLabels}${paths}</svg></div>`;
    const legend = `<div class="shared-chart-guide"><span>Rank #1 is at the top · Latest ranks are labeled on the right <em class="shared-mobile-hint">· Swipe chart to see them →</em></span><button class="shared-show-all" type="button" ${chartFocus?'':'hidden'}>Show all teams</button></div><div class="shared-chart-keys">${series.map((team,index)=>{const last=team.analytics.rankHistory.at(-1);return `<button type="button" class="shared-chart-key" data-chart-team="${team.id}" aria-pressed="${chartFocus===team.id}" style="--series-color:var(--series-${index%12})"><span class="shared-key-swatch"></span><span>${esc(team.name)}</span><b>#${last.rank}</b></button>`}).join('')}</div>`;
    return {chart, legend};
  }
  function render(holder, legend, teams) {
    const series = sorted(teams).filter(team => team.analytics?.rankHistory?.length);
    if (!series.some(team => team.id === focus)) focus = null;
    const html = markup(teams, focus);
    holder.innerHTML = html.chart; legend.innerHTML = html.legend;
    if (!series.length) return;
    const highlight = id => {
      holder.querySelectorAll('.shared-series').forEach(element => {
        element.classList.toggle('dimmed', Boolean(id) && element.dataset.chartTeam !== id);
        element.classList.toggle('focused', Boolean(id) && element.dataset.chartTeam === id);
      });
      legend.querySelectorAll('[data-chart-team]').forEach(element => element.setAttribute('aria-pressed', String(Boolean(id) && element.dataset.chartTeam === id)));
      legend.querySelector('.shared-show-all').hidden = !focus;
    };
    holder.querySelectorAll('.shared-series').forEach(element => {
      element.addEventListener('mouseenter', () => highlight(element.dataset.chartTeam));
      element.addEventListener('mouseleave', () => highlight(focus));
      element.addEventListener('click', () => {focus = focus === element.dataset.chartTeam ? null : element.dataset.chartTeam; highlight(focus);});
    });
    legend.querySelectorAll('[data-chart-team]').forEach(button => button.addEventListener('click', () => {focus = focus === button.dataset.chartTeam ? null : button.dataset.chartTeam; highlight(focus);}));
    legend.querySelector('.shared-show-all').addEventListener('click', () => {focus = null; highlight(null);});
    highlight(focus);
  }
  return {markup, render};
})();
if (typeof module !== 'undefined') module.exports = PowerMovementChart;
