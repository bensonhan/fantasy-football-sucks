/* Transaction hindsight: compare actual starters with a legal no-move lineup. */
const Regret = (() => {
  const benchSlots = new Set(['BN', 'IR', 'TAXI']);
  const slotPositions = {
    FLEX: ['RB', 'WR', 'TE'], WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'], OP: ['QB', 'RB', 'WR', 'TE'],
    IDP_FLEX: ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S'], DL: ['DL', 'DE', 'DT'], DB: ['DB', 'CB', 'S']
  };
  const decimals = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const transactionTime = tx => Number(tx.status_updated || tx.created || 0);
  const createdTime = tx => Number(tx.created || tx.status_updated || 0);
  const playerName = (id, players) => players?.[id]?.full_name || [players?.[id]?.first_name, players?.[id]?.last_name].filter(Boolean).join(' ') || id;
  function eligible(id, slot, players) {
    const positions = players?.[id]?.fantasy_positions || (id.length <= 3 && /^[A-Z]+$/.test(id) ? ['DEF'] : []);
    return positions.some(position => (slotPositions[slot] || [slot]).includes(position));
  }
  function bestLineup(ids, points, slots, players) {
    const active = slots.filter(slot => !benchSlots.has(slot));
    if (!active.length || active.length > 16) return null;
    let states = new Map([[0, 0]]);
    for (const id of ids) {
      const value = Number(points[id] || 0);
      const next = new Map(states);
      for (const [mask, total] of states) for (let slot = 0; slot < active.length; slot++) {
        if ((mask & (1 << slot)) || !eligible(id, active[slot], players)) continue;
        const key = mask | (1 << slot), candidate = total + value;
        if (candidate > (next.get(key) ?? -Infinity)) next.set(key, candidate);
      }
      states = next;
    }
    return Math.max(...states.values());
  }
  function noMoveLineup(entry, movement, points, slots, players) {
    const active = slots.filter(slot => !benchSlots.has(slot));
    if (!Array.isArray(entry.starters) || entry.starters.length !== active.length || !active.length || active.length > 16) return null;
    const started = entry.starters.map(String).filter(id => id !== '0' && id !== 'null');
    const kept = started.filter(id => !movement.received.includes(id));
    const sent = movement.sent.filter(id => !kept.includes(id));
    const bench = (entry.players || []).map(String).filter(id => !started.includes(id) && !movement.received.includes(id) && !sent.includes(id));
    const candidates = [...new Set([...kept, ...sent, ...bench])];
    const benchIds = new Set(bench);
    let states = new Map([[0, {score: 0, bench: 0, ids: []}]]);
    for (const id of candidates) {
      const next = new Map(states), value = Number(points[id] || 0);
      for (const [mask, row] of states) for (let slot = 0; slot < active.length; slot++) {
        if ((mask & (1 << slot)) || !eligible(id, active[slot], players)) continue;
        const key = mask | (1 << slot), candidate = {score: row.score + value, bench: row.bench + Number(benchIds.has(id)), ids: [...row.ids, id]};
        const previous = next.get(key);
        if (!previous || candidate.bench < previous.bench || candidate.bench === previous.bench && candidate.score > previous.score) next.set(key, candidate);
      }
      states = next;
    }
    let chosen = null, filled = -1;
    for (const [mask, row] of states) {
      const count = mask.toString(2).replace(/0/g, '').length;
      if (count > filled || count === filled && (row.bench < chosen.bench || row.bench === chosen.bench && row.score > chosen.score)) {chosen = row; filled = count;}
    }
    const original = new Set(started), alternative = new Set(chosen.ids);
    const removed = [...original].filter(id => !alternative.has(id)).reduce((sum, id) => sum + Number(points[id] || 0), 0);
    const added = [...alternative].filter(id => !original.has(id)).reduce((sum, id) => sum + Number(points[id] || 0), 0);
    const actualPoints = Number(entry.points);
    const baseline = Number.isFinite(actualPoints) ? actualPoints : [...original].reduce((sum, id) => sum + Number(points[id] || 0), 0);
    return {withPoints: decimals(baseline), withoutPoints: decimals(baseline - removed + added)};
  }
  function scoreStats(stats, settings) {
    if (!stats) return 0;
    return Object.entries(settings || {}).reduce((sum, [key, weight]) => sum + Number(weight || 0) * Number(stats[key] || 0), 0);
  }
  function describe(tx, rosterId, players) {
    const received = Object.entries(tx.adds || {}).filter(([, id]) => Number(id) === rosterId).map(([id]) => id);
    const sent = Object.entries(tx.drops || {}).filter(([, id]) => Number(id) === rosterId).map(([id]) => id);
    const label = ids => ids.length ? ids.map(id => playerName(id, players)).join(', ') : 'Nobody';
    const title = received.length && sent.length ? `${label(received)} for ${label(sent)}`
      : received.length ? `Added ${label(received)}` : sent.length ? `Dropped ${label(sent)}` : 'Picks or FAAB exchanged';
    return {received, sent, receivedNames: received.map(id => playerName(id, players)), sentNames: sent.map(id => playerName(id, players)), title};
  }
  function analyze({transactions, weeks, statsByWeek, players, league, currentWeek}) {
    const completed = transactions.filter(tx => tx?.status === 'complete' && ['trade', 'waiver', 'free_agent'].includes(tx.type))
      .sort((a, b) => transactionTime(a) - transactionTime(b) || createdTime(a) - createdTime(b));
    const outcomes = new Map(), slots = league.roster_positions || [];
    for (let index = 0; index < completed.length; index++) {
      const tx = completed[index];
      for (const rawId of tx.roster_ids || []) {
        const rosterId = Number(rawId), movement = describe(tx, rosterId, players);
        const picks = (tx.draft_picks || []).filter(pick => Number(pick.previous_owner_id) === rosterId || Number(pick.owner_id) === rosterId);
        const faabItems = (tx.waiver_budget || []).filter(item => Number(item.sender) === rosterId || Number(item.receiver) === rosterId);
        if (!movement.received.length && !movement.sent.length && !picks.length && !faabItems.length) continue;
        const assets = new Set([...movement.received, ...movement.sent]);
        const nextMove = completed.slice(index + 1).find(later =>
          Object.entries(later.adds || {}).some(([id, owner]) => Number(owner) === rosterId && assets.has(id)) ||
          Object.entries(later.drops || {}).some(([id, owner]) => Number(owner) === rosterId && assets.has(id)));
        const endWeek = nextMove ? Number(nextMove.leg || 99) : Infinity;
        const rows = [];
        for (const week of weeks) {
          if (!assets.size) break;
          if (week.week < Number(tx.leg || 1) || week.week >= currentWeek || week.week > endWeek) continue;
          const entry = week.entries.find(item => Number(item.roster_id) === rosterId);
          if (!entry || !Array.isArray(entry.players) || !entry.players_points) continue;
          const actual = new Set(entry.players.map(String));
          if (nextMove && week.week === endWeek &&
            (!movement.received.every(id => actual.has(id)) || !movement.sent.every(id => !actual.has(id)))) continue;
          if (!movement.received.some(id => actual.has(id)) && !movement.sent.some(id => !actual.has(id))) continue;
          const alternative = new Set([...actual].filter(id => !movement.received.includes(id)));
          movement.sent.forEach(id => alternative.add(id));
          const leaguePoints = Object.assign({}, ...week.entries.map(item => item.players_points || {}));
          const needed = [...alternative].filter(id => !(id in leaguePoints));
          if (needed.length) { rows.push({week: week.week, incomplete: true, reason: 'no_data'}); continue; }
          const points = {...leaguePoints};
          const comparison = noMoveLineup(entry, movement, points, slots, players);
          if (!comparison) { rows.push({week: week.week, incomplete: true}); continue; }
          const opponent = week.entries.find(item => item.matchup_id != null && item.matchup_id === entry.matchup_id && Number(item.roster_id) !== rosterId);
          const opponentPoints = opponent ? Number(opponent.points || 0) : null;
          const actualResult = opponentPoints == null ? null : Math.sign(comparison.withPoints - opponentPoints);
          const withoutResult = opponentPoints == null ? null : Math.sign(comparison.withoutPoints - opponentPoints);
          rows.push({week: week.week, impact: decimals(comparison.withPoints - comparison.withoutPoints),
            ...comparison, opponentPoints,
            estimated: false, winChange: actualResult == null ? 0 : (actualResult - withoutResult) / 2});
        }
        const scored = rows.filter(row => !row.incomplete);
        const result = {id: `${tx.transaction_id}-${rosterId}`, rosterId, type: tx.type, title: movement.title,
          received: movement.received, sent: movement.sent, receivedNames: movement.receivedNames, sentNames: movement.sentNames, picks, faab: faabItems,
          week: Number(tx.leg || 1), timestamp: transactionTime(tx), createdAt: createdTime(tx), rows, impact: decimals(scored.reduce((sum, row) => sum + row.impact, 0)),
          winChange: scored.reduce((sum, row) => sum + row.winChange, 0), estimated: scored.some(row => row.estimated),
          incomplete: rows.some(row => row.incomplete), capped: Boolean(nextMove), unrated: !assets.size};
        if (!outcomes.has(rosterId)) outcomes.set(rosterId, []);
        outcomes.get(rosterId).push(result);
      }
    }
    for (const moves of outcomes.values()) moves.sort((a, b) => b.timestamp - a.timestamp || b.createdAt - a.createdAt || b.week - a.week);
    return outcomes;
  }
  async function load(leagueId, league, weeks, currentWeek) {
    const get = async path => {
      const response = await fetch(`https://api.sleeper.app/v1/${path}`);
      if (!response.ok) throw new Error(`Sleeper returned ${response.status} for ${path}`);
      return response.json();
    };
    const rounds = Array.from({length: Math.max(1, Number(league.settings?.playoff_week_start || 15))}, (_, week) => week);
    const getPlayers = async () => {
      const url = 'https://api.sleeper.app/v1/players/nfl', key = 'regret-player-cache-time';
      const cache = typeof caches !== 'undefined' ? await caches.open('sleeper-player-directory-v1').catch(() => null) : null;
      const cached = cache ? await cache.match(url) : null;
      const lastFetch = Number(localStorage.getItem(key) || 0);
      if (cached && Date.now() - lastFetch < 24 * 60 * 60 * 1000) return cached.json();
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Sleeper returned ${response.status} for player directory`);
        if (cache) {
          try { await cache.put(url, response.clone()); localStorage.setItem(key, String(Date.now())); }
          catch (error) { console.warn('Player directory cache unavailable', error); }
        }
        return response.json();
      } catch (error) {
        if (cached) return cached.json();
        throw error;
      }
    };
    const [transactionsByWeek, players] = await Promise.all([
      Promise.all(rounds.map(week => get(`league/${leagueId}/transactions/${week}`))),
      getPlayers()
    ]);
    const transactions = [...new Map(transactionsByWeek.flat().filter(Boolean).map(tx => [tx.transaction_id, tx])).values()];
    return analyze({transactions, weeks, statsByWeek: {}, players, league, currentWeek});
  }
  return {analyze, load, playerName, bestLineup, scoreStats};
})();
if (typeof module !== 'undefined') module.exports = Regret;
