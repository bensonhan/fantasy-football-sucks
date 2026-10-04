const ScheduleMatrixChart = (() => {
  const {escapeHtml: esc, sorted, shortName} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  function groupMatchups(entries) {
    const groups = new Map();
    for (const entry of entries) {
      if (entry.matchup_id == null) continue;
      const key = String(entry.matchup_id);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return [...groups.values()];
  }
  function buildRecords(ids, past) {
    const records = Object.fromEntries(ids.map(id => [id, Object.fromEntries(ids.map(scheduleId => [scheduleId, {wins:0, losses:0, ties:0}]))]));
    for (const week of past) {
      const entries = week.entries.filter(entry => ids.includes(Number(entry.roster_id)));
      const byId = new Map(entries.map(entry => [Number(entry.roster_id), entry])), opponents = new Map();
      for (const pair of groupMatchups(entries)) {
        if (pair.length !== 2) continue;
        const a = Number(pair[0].roster_id), b = Number(pair[1].roster_id);
        opponents.set(a, b); opponents.set(b, a);
      }
      for (const scoringId of ids) {
        const scoringEntry = byId.get(scoringId);
        if (!scoringEntry) continue;
        for (const scheduleId of ids) {
          let opponentId = opponents.get(scheduleId);
          if (opponentId === scoringId && scheduleId !== scoringId) opponentId = scheduleId;
          const opponentEntry = byId.get(opponentId);
          if (!opponentEntry) continue;
          const result = records[scoringId][scheduleId];
          const score = Number(scoringEntry.points || 0), opponentScore = Number(opponentEntry.points || 0);
          if (score > opponentScore) result.wins++;
          else if (score < opponentScore) result.losses++;
          else result.ties++;
        }
      }
    }
    return records;
  }
  function markup(teams) {
    const rows = sorted(teams).filter(team => team.analytics?.scheduleRecords);
    if (!rows.length) return '<div class="chart-empty">Sync a Sleeper league to calculate schedule swaps.</div>';
    const header = rows.map(team => `<th scope="col" title="${esc(team.name)}"><span class="data-header-bubble">${esc(shortName(team.name))}</span></th>`).join('');
    const body = rows.map(team => {
      const actualRecord = team.analytics.scheduleRecords[team.sleeperRosterId];
      const actualScore = actualRecord ? actualRecord.wins + (actualRecord.ties * .5) : null;
      return `<tr><th scope="row" title="${esc(team.name)}"><span class="data-row-bubble">${esc(team.name)}</span></th>${rows.map(scheduleTeam => {
        const record = team.analytics.scheduleRecords[scheduleTeam.sleeperRosterId];
        if (!record) return '<td class="matrix-cell">—</td>';
        const text = `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`;
        const actual = team.sleeperRosterId === scheduleTeam.sleeperRosterId;
        const swappedScore = record.wins + (record.ties * .5);
        const comparisonClass = actualScore == null || swappedScore === actualScore ? 'matrix-same' : swappedScore > actualScore ? 'matrix-good' : 'matrix-bad';
        const klass = `${comparisonClass}${actual ? ' matrix-actual' : ''}`;
        return `<td class="matrix-cell ${klass}" title="${esc(team.name)} with ${esc(scheduleTeam.name)}'s schedule: ${text}" aria-label="${esc(team.name)} with ${esc(scheduleTeam.name)}'s schedule: ${record.wins} wins, ${record.losses} losses${record.ties ? `, ${record.ties} ties` : ''}">${text}</td>`;
      }).join('')}</tr>`;
    }).join('');
    return `<table class="data-table schedule-table"><thead><tr><th scope="col"><span class="data-corner-bubble">Scoring team</span></th>${header}</tr></thead><tbody>${body}</tbody></table><p class="table-note">Green improves on the team's actual record, red is worse, and gray is the same. Outlined cells are actual records. When two swapped teams originally faced each other, they remain opponents for that week.</p>`;
  }
  function render(holder, teams) { holder.innerHTML = markup(teams); }
  return {buildRecords, markup, render};
})();
if (typeof module !== 'undefined') module.exports = ScheduleMatrixChart;
