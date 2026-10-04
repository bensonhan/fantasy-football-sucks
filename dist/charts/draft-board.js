const DraftBoard = (() => {
  const escape = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const id = value => String(value ?? '');
  const pointsLabel = value => Number(value).toFixed(1);

  function model(draft, picks, rosters, weeks, teams, currentWeek, transactions = []) {
    const rosterById = new Map(rosters.map(roster => [id(roster.roster_id), roster]));
    const teamById = new Map(teams.map(team => [id(team.sleeperRosterId), team]));
    const slots = new Map();
    for (const [slot, rosterId] of Object.entries(draft.slot_to_roster_id || {})) {
      if (rosterById.has(id(rosterId))) slots.set(id(rosterId), Number(slot));
    }
    for (const roster of rosters) {
      const slot = Number(draft.draft_order?.[roster.owner_id]);
      if (!slots.has(id(roster.roster_id)) && Number.isInteger(slot) && slot > 0) slots.set(id(roster.roster_id), slot);
    }
    const draftPicks = picks.filter(pick => pick?.player_id != null && rosterById.has(id(pick.roster_id)));
    // A traded pick can move to another roster, but its draft slot still names the original draft position.
    // The full draft record has slot_to_roster_id; older records may need the pick data as a fallback.
    for (const pick of draftPicks) {
      const slot = Number(pick.draft_slot);
      if (!slots.has(id(pick.roster_id)) && Number.isInteger(slot) && slot > 0) slots.set(id(pick.roster_id), slot);
    }
    const rosterIds = [...rosterById.keys()].sort((a, b) => {
      const left = slots.get(a), right = slots.get(b);
      return (left ?? Infinity) - (right ?? Infinity) || Number(a) - Number(b);
    });
    const currentPlayers = new Map(rosters.map(roster => [id(roster.roster_id), new Set((roster.players || []).map(id))]));
    const drafterByPlayer = new Map(draftPicks.map(pick => [id(pick.player_id), id(pick.roster_id)]));
    const departureByPlayer = new Map();
    const draftFinishedAt = Number(draft.last_picked || draft.start_time || draft.created || 0);
    const completedTransactions = transactions.filter(tx => tx?.status === 'complete')
      .filter(tx => Number(tx.status_updated || tx.created || 0) >= draftFinishedAt)
      .sort((a, b) => Number(a.status_updated || a.created || 0) - Number(b.status_updated || b.created || 0));
    for (const tx of completedTransactions) {
      for (const [playerId, rosterId] of Object.entries(tx.drops || {})) {
        if (id(rosterId) === drafterByPlayer.get(playerId)) departureByPlayer.set(playerId, tx.type === 'trade' ? 'Traded' : 'Dropped');
      }
    }
    const playerStats = new Map();
    for (const week of weeks) {
      if (week.week >= currentWeek) continue;
      const seen = new Set();
      for (const entry of week.entries || []) {
        const starters = new Set((entry.starters || []).map(id));
        for (const [playerId, rawPoints] of Object.entries(entry.players_points || {})) {
          if (seen.has(playerId)) continue;
          seen.add(playerId);
          const stats = playerStats.get(playerId) || {starts: 0, points: 0, startedPoints: 0};
          const points = Number(rawPoints);
          if (starters.has(playerId)) {
            stats.starts++;
            if (Number.isFinite(points)) stats.startedPoints += points;
          }
          if (Number.isFinite(points)) stats.points += points;
          playerStats.set(playerId, stats);
        }
      }
    }
    const rows = new Map();
    for (const pick of draftPicks) {
      const round = Number(pick.round);
      if (!Number.isInteger(round) || round < 1) continue;
      if (!rows.has(round)) rows.set(round, new Map());
      const rosterId = id(pick.roster_id), playerId = id(pick.player_id);
      const metadata = pick.metadata || {};
      const position = String(metadata.position || '').toUpperCase();
      const name = [metadata.first_name, metadata.last_name].filter(Boolean).join(' ').trim() || metadata.player_name || playerId;
      const cell = rows.get(round), group = cell.get(rosterId) || [];
      const retained = currentPlayers.get(rosterId)?.has(playerId) || false;
      group.push({name, position, pickNo: Number(pick.pick_no), playerId,
        retained, departureLabel: departureByPlayer.get(playerId) || 'Dropped',
        stats: playerStats.get(playerId) || {starts: 0, points: 0, startedPoints: 0}});
      cell.set(rosterId, group);
    }
    const allPicks = [...rows.values()].flatMap(cells => [...cells.values()].flat());
    const ratesByPosition = new Map();
    for (const pick of allPicks) {
      pick.pointsPerStart = pick.stats.starts ? pick.stats.startedPoints / pick.stats.starts : null;
      if (!pick.position || pick.pointsPerStart == null) continue;
      const rates = ratesByPosition.get(pick.position) || [];
      rates.push(pick.pointsPerStart);
      ratesByPosition.set(pick.position, rates);
    }
    for (const pick of allPicks) {
      const rates = ratesByPosition.get(pick.position) || [];
      if (pick.pointsPerStart == null || rates.length < 2) {pick.quality = null;continue}
      const lower = rates.filter(rate => rate < pick.pointsPerStart).length;
      const equal = rates.filter(rate => rate === pick.pointsPerStart).length;
      pick.quality = (lower + (equal - 1) / 2) / (rates.length - 1);
    }
    const totalRounds = Number(draft.settings?.rounds);
    const roundNumbers = Number.isInteger(totalRounds) && totalRounds > 0 && totalRounds <= 50
      ? Array.from({length: totalRounds}, (_, index) => index + 1) : [...rows.keys()].sort((a, b) => a - b);
    return {teams: rosterIds.map(rosterId => ({rosterId, slot: slots.get(rosterId) || null, name: teamById.get(rosterId)?.name || `Team ${rosterId}`})),
      rounds: roundNumbers.map(round => [round, Object.fromEntries(rows.get(round) || [])]),
      draftName: draft.metadata?.name || `${draft.season || ''} draft`};
  }

  function markup(board) {
    if (!board) return '<div class="chart-empty">Sync a Sleeper league to load Draftboard Postmortem.</div>';
    if (!board.teams.length || !board.rounds.length) return '<div class="chart-empty">No draft picks are available for this league.</div>';
    const headers = board.teams.map(team => `<th scope="col" title="${escape(team.name)}"><span class="draft-header-bubble">${team.slot ? `<small>Slot ${team.slot}</small>` : ''}<span class="draft-header-name">${escape(team.name)}</span></span></th>`).join('');
    const body = board.rounds.map(([round, cells]) => `<tr><th scope="row"><span class="draft-round-bubble">Round ${round}</span></th>${board.teams.map(team => {
      const picks = cells[team.rosterId] || [];
      return `<td><div class="draft-cell${picks.length > 1 ? ' draft-cell-multi' : ''}">${picks.length ? picks.map(pick => {
        const status = pick.retained ? 'Still on drafting team' : `${pick.departureLabel} from drafting team`;
        const rateLabel = pick.pointsPerStart == null ? 'no starts yet' : `${pointsLabel(pick.pointsPerStart)} points per start`;
        const gradeLabel = pick.quality == null ? 'position grade pending' : `position percentile ${Math.round(pick.quality * 100)}`;
        const label = `${pick.name}, ${pick.position || 'player'}, ${status}, ${pick.stats.starts} starts, ${pointsLabel(pick.stats.points)} fantasy points, ${rateLabel}, ${gradeLabel}`;
        const bucket = pick.quality == null ? null : Math.max(1, Math.min(5, Math.floor(pick.quality * 5) + 1));
        const tone = !pick.retained ? 'draft-departed' : bucket == null ? 'draft-ungraded' : `heat-${bucket}`;
        return `<span class="draft-pick ${tone}${round <= 2 ? ' draft-pick-top' : ''}" tabindex="0" aria-label="${escape(label)}"><span class="draft-pick-name">${escape(pick.name)}</span><span class="draft-pick-meta">${escape(pick.position)}${Number.isFinite(pick.pickNo) ? ` · #${pick.pickNo}` : ''}</span>${pick.retained ? '' : `<span class="draft-left-label ${pick.departureLabel === 'Traded' ? 'draft-left-traded' : 'draft-left-dropped'}">${escape(pick.departureLabel)}</span>`}<span class="draft-tooltip" role="tooltip"><strong>${escape(pick.name)}</strong>${pick.retained ? '' : `<span>${escape(status)}</span>`}<span>${pick.stats.starts} starts</span><span>${pointsLabel(pick.stats.points)} fantasy points</span><span>${escape(rateLabel)}</span><span>${escape(gradeLabel)}</span></span></span>`;
      }).join('') : '<span class="draft-no-pick">—</span>'}${picks.length > 1 ? `<span class="draft-more">+${picks.length - 1} more pick${picks.length === 2 ? '' : 's'}</span>` : ''}</div></td>`;
    }).join('')}</tr>`).join('');
    return `<div class="draft-board-scroll" role="region" aria-label="Draftboard Postmortem. Scroll vertically for more rounds and horizontally for more teams." tabindex="0"><table class="draft-board-table" aria-label="Draft picks by round and team"><thead><tr><th scope="col"><span class="draft-header-bubble draft-corner-bubble">Round</span></th>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function render(element, board, error, loading) {
    element.innerHTML = error ? `<div class="chart-empty">${escape(error)}</div>` : loading && !board ? '<div class="chart-empty">Loading draft picks…</div>' : markup(board);
  }
  return {model, markup, render};
})();
if (typeof module !== 'undefined') module.exports = DraftBoard;
