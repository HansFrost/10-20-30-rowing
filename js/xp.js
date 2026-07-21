import{getEquipped}from'./cosmetics.js';
import{$}from'./dom.js';
const RANKS=['Deckhand','Paddler','Rower','Oarsman','Bowman','Stroke Seat','Coxswain','Captain','Sea Wolf','Viking','Poseidon'];
/* XP for one completed session, graded by type. Derives everything from the
   stored stats so past sessions rebalance automatically when rules change. */
function sessionXP(s,bonus){
  let xp=100+bonus; /* every completed session earns the flat 100 for showing up */
  if(!s)return xp; /* manual check-off: base + golden bonus only */
  if(s.walk)return xp+Math.floor((s.m||0)/1000)*3; /* walks: +3 per full km, no meters/rate XP */
  xp+=Math.floor((s.m||0)/100)+(s.rateHits||0)*5; /* rowing: +1 per 100 m, +5 per on-target sprint */
  if(s.steady)xp+=(s.min||0)*2; /* steady-state: +2 per minute */
  else xp+=(s.blocks||0)*15; /* intervals: +15 per block */
  return xp;
}
function calcXP(data){
  const completed=data.completed||{},stats=data.sessionStats||{};
  let xp=0;
  for(const k of Object.keys(completed))xp+=sessionXP(stats[k],(data.bonusXP&&data.bonusXP[k])||0);
  return xp;
}
/* Single source for the earning rules the XP guide displays; keep in sync with sessionXP */
function xpBreakdownRules(){
  return[
    {label:'Complete any session',amount:'+100 XP'},
    {label:'Each interval block rowed',amount:'+15 XP'},
    {label:'Steady-state rowing',amount:'+2 XP / min'},
    {label:'Walking',amount:'+3 XP / km'},
    {label:'Meters rowed',amount:'+1 XP / 100 m'},
    {label:'Sprint on target rate (30+ spm)',amount:'+5 XP'},
    {label:'Golden session (random 15%)',amount:'+100 XP'},
  ];
}
/* Cumulative XP at which a level starts; the exact steps levelInfo subtracts */
function xpForLevel(lvl){
  let xp=0;
  for(let l=1;l<lvl;l++)xp+=300+150*(l-1);
  return xp;
}
function levelInfo(xp){
  let lvl=1,need=300,rem=xp;
  while(rem>=need){rem-=need;lvl++;need=300+150*(lvl-1)}
  return{lvl,into:rem,need,rank:RANKS[Math.min(RANKS.length-1,Math.floor((lvl-1)/2))]};
}
function lifetimeMeters(data){
  const stats=data.sessionStats||{};
  return Object.keys(stats).reduce((s,k)=>s+(stats[k].walk?0:(stats[k].m||0)),0);
}
function renderXpStrip(data){
  const el=$('#xpStrip');
  const doneCount=Object.keys(data.completed||{}).length;
  if(!doneCount){el.innerHTML='';return}
  const xp=calcXP(data),li=levelInfo(xp),lm=lifetimeMeters(data);
  const pct=Math.round(li.into/li.need*100);
  const av=getEquipped(data).avatar;
  el.innerHTML='<div class="xp-strip">'+
    '<div class="xp-level"><span class="xp-avatar">'+av.emoji+'</span><span class="lvl-badge">'+li.lvl+'</span></div>'+
    '<div class="xp-body">'+
      '<div class="xp-title"><span class="xp-rank">'+li.rank+'</span><span class="xp-nums">'+xp+' XP · '+li.into+' / '+li.need+' to LVL '+(li.lvl+1)+'</span></div>'+
      '<div class="xp-bar"><div class="xp-fill" style="width:'+pct+'%"></div></div>'+
      (lm>0?'<div class="xp-lifetime">🚣 '+lm.toLocaleString()+' m rowed lifetime</div>':'')+
    '</div>'+
    '<span class="xp-chevron">&#8250;</span></div>';
}
export{RANKS,calcXP,levelInfo,lifetimeMeters,renderXpStrip,xpBreakdownRules,xpForLevel};
