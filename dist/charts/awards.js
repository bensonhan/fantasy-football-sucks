const AwardsChart = (() => {
  const {escapeHtml: esc} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const metricInfo = {
    awardJuggernaut:{title:'Juggernaut award',body:'Juggernaut goes to the team with the most first-place weekly scoring finishes.',example:'Teams tied for the highest score each earn a weekly crown.'},
    awardHeartbreak:{title:'Heartbreak Kid award',body:'Heartbreak Kid goes to the team with the most losses in weeks when it still scored above the league median.',example:'Scores exactly at the median and tied matchups do not count.'},
    awardEscape:{title:'Escape Artist award',body:'Escape Artist goes to the team with the most wins in weeks when it scored below the league median.',example:'Scores exactly at the median and tied matchups do not count.'},
    awardKickerWhisperer:{title:'Fantasy Futbol award',body:'Fantasy Futbol goes to the team whose starting kickers have scored the most points across completed weeks.',example:'Only kickers placed in a starting K slot count. Bench kicker scores do not count.'},
    awardWaiverTransactions:{title:'Commitment Issues award',body:'Goes to the team with the most completed waiver claims, free-agent transactions, and trades this season, including the current week and preseason.',example:'Free-agent adds, drops, and add/drop transactions count, even without a waiver claim. Each transaction counts once per team; an add/drop in one transaction counts as one. Each completed trade counts once for every participating team, including trades involving only draft picks or FAAB. Pending, failed, and canceled transactions do not count.'},
    awardDWhisperer:{title:'“D” Whisperer award',body:'“D” Whisperer goes to the team whose started D/ST defenses have scored the most points across completed weeks.',example:'Only defenses placed in a starting DEF slot count. Bench defense scores do not count.'}
  };
  const totalPoints = team => team.analytics.weeklyScores.reduce((sum, week) => sum + (Number(week.score) || 0), 0);
  const breakTie = (a, b) => totalPoints(b) - totalPoints(a)
    || String(a.sleeperRosterId ?? a.id ?? a.name).localeCompare(String(b.sleeperRosterId ?? b.id ?? b.name), 'en', {numeric:true});
  const weeklyCrowns = team => team.analytics.weeklyScores.filter(week => week.rank === 1).length;
  const plural = (value, word) => `${value} ${word}${value === 1 ? '' : word.endsWith('loss') ? 'es' : 's'}`;
  const awards = [
    {id:'juggernaut', icon:'👑', title:'Juggernaut', key:'awardJuggernaut', value:weeklyCrowns,
      qualifies:team => weeklyCrowns(team) > 0, detail:team => plural(weeklyCrowns(team),'weekly crown'), empty:'No weekly crowns yet'},
    {id:'heartbreak', icon:'💔', title:'Heartbreak Kid', key:'awardHeartbreak', value:team => team.analytics.badBeats,
      qualifies:team => team.analytics.badBeats > 0, detail:team => plural(team.analytics.badBeats,'above-median loss'), empty:'No above-median losses yet'},
    {id:'escape', icon:'🥷', title:'Escape Artist', key:'awardEscape', value:team => team.analytics.thiefWins,
      qualifies:team => team.analytics.thiefWins > 0, detail:team => plural(team.analytics.thiefWins,'below-median win'), empty:'No below-median wins yet'},
    {id:'waiverTransactions', icon:'🔄', title:'Commitment Issues', key:'awardWaiverTransactions', value:team => team.analytics.waiverTransactions,
      qualifies:team => team.analytics.waiverTransactions > 0, detail:team => plural(team.analytics.waiverTransactions,'completed transaction'), empty:'No completed waiver, free-agent, or trade transactions yet'},
    {id:'kickerWhisperer', icon:'🦵', title:'Fantasy Futbol', key:'awardKickerWhisperer', value:team => team.analytics.kickerPoints,
      qualifies:team => team.analytics.kickerStarts > 0 && Number.isFinite(team.analytics.kickerPoints), detail:team => `${team.analytics.kickerPoints.toFixed(1)} started kicker points · ${plural(team.analytics.kickerStarts,'start')}`, empty:'No kicker starts yet'},
    {id:'dWhisperer', icon:'🛡️', title:'“D” Whisperer', key:'awardDWhisperer', value:team => team.analytics.defensePoints,
      qualifies:team => team.analytics.defenseStarts > 0 && Number.isFinite(team.analytics.defensePoints), detail:team => `${team.analytics.defensePoints.toFixed(1)} started D/ST points · ${plural(team.analytics.defenseStarts,'start')}`, empty:'No D/ST starts yet'}
  ];
  function rankings(teams) {
    const eligible = teams.filter(team => team.analytics?.weeklyScores?.length);
    if (!eligible.length) return null;
    return Object.fromEntries(awards.map(award => [award.id, eligible.filter(award.qualifies)
      .sort((a, b) => award.value(b) - award.value(a) || breakTie(a, b))]));
  }
  function winners(teams) {
    const result = rankings(teams);
    return result && Object.fromEntries(Object.entries(result).map(([id, list]) => [id, list[0] || null]));
  }
  function markup(teams, infoIcon = () => '', limit = 3) {
    const result = rankings(teams);
    if (!result) return '<div class="chart-empty">Sync a Sleeper league to reveal the awards.</div>';
    const count = limit === 1 ? 1 : 3;
    return awards.map(award => {
      const list = result[award.id].slice(0, count);
      const empty = award.id === 'waiverTransactions' && !teams.every(team => Number.isFinite(team.analytics?.waiverTransactions))
        ? 'Sync league to load transactions' : award.empty;
      const rows = list.map((team, index) => `<li class="award-row${index === 0 ? ' award-leader' : ''}"><span class="award-rank" aria-hidden="true">${String(index + 1).padStart(2,'0')}</span><div class="award-entry"><div class="award-team" title="${esc(team.name)}">${esc(team.name)}</div><div class="award-detail">${award.detail(team)}</div></div>${index === 0 ? '<span class="award-leader-label">Leader</span>' : ''}</li>`).join('');
      return `<article class="award-card"><div class="award-card-head"><div class="award-icon" aria-hidden="true">${award.icon}</div><div class="award-title"><span>${award.title}</span>${infoIcon(award.key)}</div></div>${list.length ? `<ol class="award-list" aria-label="${esc(award.title)} top ${count}">${rows}</ol>` : `<div class="award-empty"><div class="award-team">Not yet awarded</div><div class="award-detail">${empty}</div></div>`}</article>`;
    }).join('');
  }
  function applyTransactions(teams, transactions) {
    const counts = new Map(teams.map(team => [Number(team.sleeperRosterId), 0]));
    const seen = new Set();
    for (const tx of transactions) {
      if (tx?.status !== 'complete' || !['waiver', 'free_agent', 'trade'].includes(tx.type) || seen.has(tx.transaction_id)) continue;
      seen.add(tx.transaction_id);
      for (const rosterId of new Set((tx.roster_ids || []).map(Number))) {
        if (counts.has(rosterId)) counts.set(rosterId, counts.get(rosterId) + 1);
      }
    }
    for (const team of teams) team.analytics.waiverTransactions = counts.get(Number(team.sleeperRosterId));
  }
  function render(holder, teams, infoIcon, limit = 3) { holder.innerHTML = markup(teams, infoIcon, limit); }
  return {metricInfo, rankings, winners, markup, render, applyTransactions};
})();
if (typeof module !== 'undefined') module.exports = AwardsChart;
