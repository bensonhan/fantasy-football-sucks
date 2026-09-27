const RegretView = (() => {
  const {escapeHtml:esc,sorted} = typeof module !== 'undefined' ? require('./utils.js') : ChartUtils;
  function create(holder,label){
    let teamId=null,moveId=null,week=null,context=null;
    function render(data){
      context=data;
      const {teams,regretByRoster,regretError,regretLoaded,isSyncing,selected}=data;
      const available=sorted(teams);
      if(!available.length){label.textContent='Choose a team below';holder.innerHTML='<div class="chart-empty">Sync a Sleeper league to review its moves.</div>';return}
      if(!available.some(t=>t.id===teamId))teamId=available.some(t=>t.id===selected)?selected:available[0].id;
      const team=available.find(t=>t.id===teamId),moves=regretByRoster[team.sleeperRosterId]||[];
      label.textContent=team.name;
      if(!moves.some(move=>move.id===moveId)){moveId=moves.find(move=>move.rows.some(row=>!row.incomplete))?.id||moves[0]?.id||null;week=null}
      const kind=move=>move.type==='trade'?'Trade':move.type==='waiver'?'Waiver claim':'Free agent move';
      const controls=`<div class="regret-chooser"><label for="regretTeamSelect">Team<select id="regretTeamSelect">${available.map(t=>`<option value="${esc(t.id)}" ${t.id===teamId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label for="regretMoveSelect">Trade or waiver move<select id="regretMoveSelect" ${!regretLoaded||!moves.length?'disabled':''}>${moves.length?moves.map(move=>`<option value="${esc(move.id)}" ${move.id===moveId?'selected':''}>${kind(move)} · W${move.week} · ${esc(move.title)}</option>`).join(''):'<option value="">No moves available</option>'}</select></label></div>`;
      if(regretError){holder.innerHTML=controls+`<div class="regret-empty">Transaction analysis is unavailable: ${esc(regretError)}. Try syncing again.</div>`;return}
      if(!regretLoaded){holder.innerHTML=controls+`<div class="regret-empty">${isSyncing?'Analyzing trades and waiver moves…':'Sync the league to calculate trade regret.'}</div>`;return}
      if(!moves.length){holder.innerHTML=controls+'<div class="regret-empty">No completed trades or waiver moves for this team yet.</div>';return}
      const move=moves.find(item=>item.id===moveId),valid=move.rows.filter(row=>!row.incomplete),hasResult=valid.length>0;
      const withPoints=valid.reduce((sum,row)=>sum+row.withPoints,0),withoutPoints=valid.reduce((sum,row)=>sum+row.withoutPoints,0),points=value=>Number(value).toFixed(1),signedPoints=value=>`${value>0?'+':''}${points(value)}`;
      const faab=move.faab.reduce((sum,item)=>sum+(Number(item.receiver)===move.rosterId?Number(item.amount||0):-Number(item.amount||0)),0);
      const extras=[move.picks.length?`${move.picks.length} draft pick${move.picks.length===1?'':'s'} not graded`:'',faab?`${Math.abs(faab)} FAAB ${faab>0?'received':'spent'} (not graded)`:''].filter(Boolean).join(' · ');
      const received=move.receivedNames?.length?move.receivedNames.join(', '):'No player added',departed=move.sentNames?.length?move.sentNames.join(', '):'No player sent or dropped';
      const outcome=(value,opponent)=>opponent==null?'—':value>opponent?'Win':value<opponent?'Loss':'Tie';
      if(!move.rows.some(row=>row.week===week))week=move.rows[0]?.week||null;
      const weekRow=move.rows.find(row=>row.week===week);
      const weekCard=row=>{
        if(row.incomplete)return `<article class="regret-week-card"><h4>Week ${row.week}</h4><p>Scoring data unavailable for this week.</p></article>`;
        const withoutOutcome=outcome(row.withoutPoints,row.opponentPoints),withOutcome=outcome(row.withPoints,row.opponentPoints);
        return `<article class="regret-week-card"><div class="regret-week-head"><h4>Week ${row.week}</h4><strong class="${row.impact<0?'negative':row.impact>0?'positive':''}">${signedPoints(row.impact)} pts${row.estimated?' ≈':''}</strong></div><div class="regret-week-scores"><span><small>With move · actual</small><b>${points(row.withPoints)}</b></span><span><small>Without move · estimate</small><b>${points(row.withoutPoints)}</b></span></div><p>Potential result without → with: <strong>${withoutOutcome} → ${withOutcome}</strong>${row.opponentPoints==null?'':` · Opponent ${points(row.opponentPoints)}`}</p>${row.estimated?'<small class="regret-estimate">Includes an estimated score for an unrostered player.</small>':''}</article>`;
      };
      const weekSection=move.rows.length?`<div class="regret-week-section"><div class="regret-week-toolbar"><h4>Weekly detail</h4><label for="regretWeekSelect">Week<select id="regretWeekSelect">${move.rows.map(row=>`<option value="${row.week}" ${row.week===week?'selected':''}>Week ${row.week}${row.incomplete?' · data unavailable':''}</option>`).join('')}</select></label></div>${weekCard(weekRow)}</div>`:'';
      holder.innerHTML=`${controls}<div class="regret-detail-page"><div class="regret-detail-head"><div><span class="regret-kicker">${kind(move)} · Week ${move.week}${extras?` · ${extras}`:''}</span><h3>${esc(move.title)}</h3><p>Added or received: ${esc(received)}<br>Sent or dropped: ${esc(departed)}</p></div><div class="regret-impact-tile"><small>Impact of this move</small><strong class="${move.impact<0?'negative':move.impact>0?'positive':''}">${hasResult?`${signedPoints(move.impact)} pts`:move.unrated?'Unrated':'Pending'}</strong><span>${hasResult?`${valid.length} completed week${valid.length===1?'':'s'} compared`:'No scored weeks yet'}</span></div></div>${hasResult?`<div class="regret-comparison"><div><small>With the move</small><strong>${points(withPoints)} <span>pts</span></strong><p>Actual started-lineup scores</p></div><div><small>Without the move</small><strong>${points(withoutPoints)} <span>pts</span></strong><p>Estimated scores with a legal replacement lineup</p></div><div><small>Potential result change</small><strong class="${move.winChange<0?'negative':move.winChange>0?'positive':''}">${signedPoints(move.winChange)} <span>wins</span></strong><p>Against the same actual opponents</p></div></div>`:move.unrated?'<div class="regret-empty">This move only involved draft picks or FAAB, so there is no player lineup to compare.</div>':'<div class="regret-empty">No completed week can be scored for this move yet.</div>'}${weekSection}<p class="regret-method">With-move points are what the team actually scored. Without-move points keep its other starters and substitute departed players where they improve a legal lineup; bench players fill any remaining gaps. Positive impact favors the move. Potential results use the same actual opponents.${move.capped?' The comparison stops when one of these players moves again.':''}${move.incomplete?' Some weeks could not be scored.':''}</p></div>`;
    }
    holder.addEventListener('change',event=>{
      if(event.target.id==='regretTeamSelect'){teamId=event.target.value;moveId=null;week=null;render(context);holder.querySelector('#regretTeamSelect').focus()}
      else if(event.target.id==='regretMoveSelect'){moveId=event.target.value;week=null;render(context);holder.querySelector('#regretMoveSelect').focus()}
      else if(event.target.id==='regretWeekSelect'){week=Number(event.target.value);render(context);holder.querySelector('#regretWeekSelect').focus()}
    });
    return {render};
  }
  return {create};
})();
if (typeof module !== 'undefined') module.exports = RegretView;
