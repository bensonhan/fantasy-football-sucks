const AwardsChart = (() => {
  const {escapeHtml: esc, score, sorted} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  const metricInfo = {
    awardJuggernaut:{title:'Juggernaut award',body:'Juggernaut goes to the team with the most first-place weekly scoring finishes.',example:'Ties are broken by the current power score.'},
    awardHeartbreak:{title:'Heartbreak Kid award',body:'Heartbreak Kid goes to the team with the most losses in weeks when it still scored above the league median.',example:'It recognizes strong performances spoiled by an even stronger opponent.'},
    awardEscape:{title:'Escape Artist award',body:'Escape Artist goes to the team with the most wins in weeks when it scored below the league median.',example:'It celebrates victories that most of the league would not have earned.'},
    awardMetronome:{title:'Metronome award',body:'Metronome goes to the team with the smallest standard deviation in weekly scores.',example:'A smaller scoring deviation means a steadier, more predictable team.'},
    awardRollercoaster:{title:'Rollercoaster award',body:'Rollercoaster goes to the team with the largest standard deviation in weekly scores.',example:'A larger scoring deviation means bigger swings between weekly highs and lows.'},
    awardDWhisperer:{title:'“D” Whisperer award',body:'“D” Whisperer goes to the team whose started D/ST defenses have scored the most points across completed weeks.',example:'Only defenses placed in a starting DEF slot count. Bench defense scores do not count.'}
  };
  function winners(teams) {
    const eligible = sorted(teams).filter(team => team.analytics?.weeklyScores?.length);
    if (!eligible.length) return null;
    const most = getter => [...eligible].sort((a, b) => getter(b) - getter(a) || score(b) - score(a))[0];
    const weeklyCrowns = team => team.analytics.weeklyScores.filter(week => week.rank === 1).length;
    const steadyPool = eligible.filter(team => team.analytics.weeklyScores.length > 1);
    const defensePool = eligible.filter(team => team.analytics.defenseStarts > 0);
    return {
      juggernaut: most(weeklyCrowns),
      heartbreak: most(team => team.analytics.badBeats),
      escape: most(team => team.analytics.thiefWins),
      metronome: steadyPool.length ? [...steadyPool].sort((a, b) => a.analytics.consistency - b.analytics.consistency || score(b) - score(a))[0] : eligible[0],
      rollercoaster: steadyPool.length ? most(team => team.analytics.consistency) : eligible[0],
      dWhisperer: defensePool.length ? [...defensePool].sort((a, b) => b.analytics.defensePoints - a.analytics.defensePoints || score(b) - score(a))[0] : null
    };
  }
  function markup(teams, infoIcon = () => '') {
    const result = winners(teams);
    if (!result) return '<div class="chart-empty">Sync a Sleeper league to reveal the awards.</div>';
    const plural = (value, word) => `${value} ${word}${value === 1 ? '' : 's'}`;
    const {juggernaut, heartbreak, escape, metronome, rollercoaster, dWhisperer} = result;
    const awards = [
      ['👑','Juggernaut','awardJuggernaut',juggernaut,plural(juggernaut.analytics.weeklyScores.filter(week => week.rank === 1).length,'weekly crown')],
      ['💔','Heartbreak Kid','awardHeartbreak',heartbreak,plural(heartbreak.analytics.badBeats,'above-median loss')],
      ['🥷','Escape Artist','awardEscape',escape,plural(escape.analytics.thiefWins,'below-median win')],
      ['🎯','Metronome','awardMetronome',metronome,`${metronome.analytics.consistency.toFixed(1)}-point scoring deviation`],
      ['🎢','Rollercoaster','awardRollercoaster',rollercoaster,`${rollercoaster.analytics.consistency.toFixed(1)}-point scoring deviation`],
      ['🛡️','“D” Whisperer','awardDWhisperer',dWhisperer,dWhisperer ? `${dWhisperer.analytics.defensePoints.toFixed(1)} started D/ST points · ${plural(dWhisperer.analytics.defenseStarts,'start')}` : 'No D/ST starts yet']
    ];
    return awards.map(([icon, title, key, team, detail]) => `<article class="award-card"><div class="award-icon" aria-hidden="true">${icon}</div><div class="award-title"><span>${title}</span>${infoIcon(key)}</div><div class="award-team" title="${esc(team?.name || '')}">${team ? esc(team.name) : 'Not yet awarded'}</div><div class="award-detail">${detail}</div></article>`).join('');
  }
  function render(holder, teams, infoIcon) { holder.innerHTML = markup(teams, infoIcon); }
  return {metricInfo, winners, markup, render};
})();
if (typeof module !== 'undefined') module.exports = AwardsChart;
