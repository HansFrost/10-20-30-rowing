import{$}from'./dom.js';
const RANKS=['Deckhand','Paddler','Rower','Oarsman','Bowman','Stroke Seat','Coxswain','Captain','Sea Wolf','Viking','Poseidon'];
function calcXP(data){
  const completed=data.completed||{},stats=data.sessionStats||{};
  let xp=0;
  for(const k of Object.keys(completed)){
    xp+=100;
    const s=stats[k];
    if(s){xp+=Math.floor((s.m||0)/100)+(s.rateHits||0)*5}
    xp+=(data.bonusXP&&data.bonusXP[k])||0;
  }
  return xp;
}
function levelInfo(xp){
  let lvl=1,need=300,rem=xp;
  while(rem>=need){rem-=need;lvl++;need=300+150*(lvl-1)}
  return{lvl,into:rem,need,rank:RANKS[Math.min(RANKS.length-1,Math.floor((lvl-1)/2))]};
}
function lifetimeMeters(data){
  const stats=data.sessionStats||{};
  return Object.keys(stats).reduce((s,k)=>s+(stats[k].m||0),0);
}
function renderXpStrip(data){
  const el=$('#xpStrip');
  const doneCount=Object.keys(data.completed||{}).length;
  if(!doneCount){el.innerHTML='';return}
  const xp=calcXP(data),li=levelInfo(xp),lm=lifetimeMeters(data);
  const pct=Math.round(li.into/li.need*100);
  el.innerHTML='<div class="xp-strip">'+
    '<div class="xp-level"><span class="lvl-num">'+li.lvl+'</span><span class="lvl-word">LVL</span></div>'+
    '<div class="xp-body">'+
      '<div class="xp-title"><span class="xp-rank">'+li.rank+'</span><span class="xp-nums">'+li.into+' / '+li.need+' XP</span></div>'+
      '<div class="xp-bar"><div class="xp-fill" style="width:'+pct+'%"></div></div>'+
      (lm>0?'<div class="xp-lifetime">🚣 '+lm.toLocaleString()+' m rowed lifetime</div>':'')+
    '</div></div>';
}
export{calcXP,levelInfo,lifetimeMeters,renderXpStrip};
