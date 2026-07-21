import{$}from'./dom.js';
import{loadData}from'./store.js';
import{RANKS,calcXP,levelInfo,xpBreakdownRules,xpForLevel}from'./xp.js';
/* Rank ladder: rank i covers two levels starting at level 2i+1; the XP
   threshold comes from xpForLevel, the same math levelInfo uses. */
function rankLadder(){
  return RANKS.map((rank,i)=>({rank,lvl:i*2+1,xp:xpForLevel(i*2+1)}));
}
function rulesHtml(){
  return '<table class="xpg-table">'+xpBreakdownRules().map(r=>
    '<tr><td>'+r.label+'</td><td class="xpg-amount">'+r.amount+'</td></tr>').join('')+'</table>';
}
function ladderHtml(xp){
  const li=levelInfo(xp),ladder=rankLadder();
  const curIdx=ladder.findIndex(r=>r.rank===li.rank);
  const next=ladder[curIdx+1];
  let h='<div class="xpg-status">'+xp.toLocaleString()+' XP total &middot; '+
    (next?'next rank '+next.rank+' at '+next.xp.toLocaleString()+' XP':'top rank reached')+'</div>';
  h+='<div class="xpg-ladder">'+ladder.map((r,i)=>
    '<div class="xpg-rank'+(i===curIdx?' current':'')+'">'+
      '<span class="xpg-rank-name">'+r.rank+'</span>'+
      '<span class="xpg-rank-req">LVL '+r.lvl+' &middot; '+r.xp.toLocaleString()+' XP</span>'+
    '</div>').join('')+'</div>';
  return h;
}
function openXpGuide(){
  const data=loadData();if(!data)return;
  $('#xpgRules').innerHTML=rulesHtml();
  $('#xpgRanks').innerHTML=ladderHtml(calcXP(data));
  $('#xpGuideOverlay').classList.add('active');
}
function closeXpGuide(){$('#xpGuideOverlay').classList.remove('active')}
function initXpGuide(){
  /* the strip is re-rendered, so listen on its stable container */
  $('#xpStrip').addEventListener('click',()=>{if($('#xpStrip').innerHTML)openXpGuide()});
  $('#xpGuideClose').addEventListener('click',closeXpGuide);
  $('#xpGuideOverlay').addEventListener('click',e=>{if(e.target===$('#xpGuideOverlay'))closeXpGuide()});
}
export{initXpGuide,openXpGuide,rankLadder};
