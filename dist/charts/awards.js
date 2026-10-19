const AwardsChart = (() => {
  const {escapeHtml: esc, sorted} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const metricInfo = {
    awardJuggernaut:{title:'Juggernaut award',body:'Juggernaut goes to the team with the most first-place weekly scoring finishes.',example:'Teams tied for the highest score each earn a weekly crown.'},
    awardHeartbreak:{title:'Heartbreak Kid award',body:'Heartbreak Kid goes to the team with the most losses in weeks when it still scored above the league median.',example:'Scores exactly at the median and tied matchups do not count.'},
    awardEscape:{title:'Escape Artist award',body:'Escape Artist goes to the team with the most wins in weeks when it scored below the league median.',example:'Scores exactly at the median and tied matchups do not count.'},
    awardKickerWhisperer:{title:'“K” Whisperer award',body:'“K” Whisperer goes to the team whose starting kickers have scored the most points across completed weeks.',example:'Only kickers placed in a starting K slot count. Bench kicker scores do not count.'},
    awardWaiverTransactions:{title:'Commitment Issues award',body:'Goes to the team with the most completed waiver claims, free-agent transactions, and trades this season, including the current week and preseason.',example:'Free-agent adds, drops, and add/drop transactions count, even without a waiver claim. Each transaction counts once per team; an add/drop in one transaction counts as one. Each completed trade counts once for every participating team, including trades involving only draft picks or FAAB. Pending, failed, and canceled transactions do not count.'},
    awardDWhisperer:{title:'“D” Whisperer award',body:'“D” Whisperer goes to the team whose started D/ST defenses have scored the most points across completed weeks.',example:'Only defenses placed in a starting DEF slot count. Bench defense scores do not count.'}
  };
  const totalPoints = team => team.analytics.weeklyScores.reduce((sum, week) => sum + (Number(week.score) || 0), 0);
  const breakTie = (a, b) => totalPoints(b) - totalPoints(a)
    || String(a.sleeperRosterId ?? a.id ?? a.name).localeCompare(String(b.sleeperRosterId ?? b.id ?? b.name), 'en', {numeric:true});
  function winners(teams) {
    const eligible = sorted(teams).filter(team => team.analytics?.weeklyScores?.length);
    if (!eligible.length) return null;
    const most = getter => [...eligible].sort((a, b) => getter(b) - getter(a) || breakTie(a, b))[0];
    const weeklyCrowns = team => team.analytics.weeklyScores.filter(week => week.rank === 1).length;
    const kickerPool = eligible.filter(team => team.analytics.kickerStarts > 0);
    const waiverPool = eligible.filter(team => team.analytics.waiverTransactions > 0);
    const defensePool = eligible.filter(team => team.analytics.defenseStarts > 0);
    return {
      juggernaut: most(weeklyCrowns),
      heartbreak: eligible.some(team => team.analytics.badBeats > 0) ? most(team => team.analytics.badBeats) : null,
      escape: eligible.some(team => team.analytics.thiefWins > 0) ? most(team => team.analytics.thiefWins) : null,
      kickerWhisperer: kickerPool.length ? [...kickerPool].sort((a, b) => b.analytics.kickerPoints - a.analytics.kickerPoints || breakTie(a, b))[0] : null,
      waiverTransactions: waiverPool.length ? [...waiverPool].sort((a, b) => b.analytics.waiverTransactions - a.analytics.waiverTransactions || breakTie(a, b))[0] : null,
      dWhisperer: defensePool.length ? [...defensePool].sort((a, b) => b.analytics.defensePoints - a.analytics.defensePoints || breakTie(a, b))[0] : null
    };
  }
  function markup(teams, infoIcon = () => '') {
    const result = winners(teams);
    if (!result) return '<div class="chart-empty">Sync a Sleeper league to reveal the awards.</div>';
    const plural = (value, word) => `${value} ${word}${value === 1 ? '' : word.endsWith('loss') ? 'es' : 's'}`;
    const {juggernaut, heartbreak, escape, kickerWhisperer, waiverTransactions, dWhisperer} = result;
    const awards = [
      ['👑','Juggernaut','awardJuggernaut',juggernaut,plural(juggernaut.analytics.weeklyScores.filter(week => week.rank === 1).length,'weekly crown')],
      ['💔','Heartbreak Kid','awardHeartbreak',heartbreak,heartbreak ? plural(heartbreak.analytics.badBeats,'above-median loss') : 'No above-median losses yet'],
      ['🥷','Escape Artist','awardEscape',escape,escape ? plural(escape.analytics.thiefWins,'below-median win') : 'No below-median wins yet'],
      ['🔄','Commitment Issues','awardWaiverTransactions',waiverTransactions,waiverTransactions ? plural(waiverTransactions.analytics.waiverTransactions,'completed transaction') : teams.every(team => Number.isFinite(team.analytics?.waiverTransactions)) ? 'No completed waiver, free-agent, or trade transactions yet' : 'Sync league to load transactions'],
      ['🦵','“K” Whisperer','awardKickerWhisperer',kickerWhisperer,kickerWhisperer ? `${kickerWhisperer.analytics.kickerPoints.toFixed(1)} started kicker points · ${plural(kickerWhisperer.analytics.kickerStarts,'start')}` : 'No kicker starts yet'],
      ['🛡️','“D” Whisperer','awardDWhisperer',dWhisperer,dWhisperer ? `${dWhisperer.analytics.defensePoints.toFixed(1)} started D/ST points · ${plural(dWhisperer.analytics.defenseStarts,'start')}` : 'No D/ST starts yet']
    ];
    return awards.map(([icon, title, key, team, detail]) => `<article class="award-card"><div class="award-icon" aria-hidden="true">${icon}</div><div class="award-title"><span>${title}</span>${infoIcon(key)}</div><div class="award-team" title="${esc(team?.name || '')}">${team ? esc(team.name) : 'Not yet awarded'}</div><div class="award-detail">${detail}</div></article>`).join('');
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
  function render(holder, teams, infoIcon) { holder.innerHTML = markup(teams, infoIcon); }
  return {metricInfo, winners, markup, render, applyTransactions};
})();
if (typeof module !== 'undefined') module.exports = AwardsChart;
