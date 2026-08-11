import{DONE_PRAISE,DONE_TIPS}from'./content.js';
import{getEquipped}from'./cosmetics.js';
import{acceptGrowth,declineGrowth,isDaily,shouldOfferGrowth}from'./daily.js';
import{$,customConfirm}from'./dom.js';
import{confettiBurst}from'./fx.js';
import{calcStreak,checkMilestones,getHabitStage,showMilestones}from'./habit.js';
import{countRowingSessions,getNext,scheduleFor}from'./programs.js';
import{loadData,saveData}from'./store.js';
import{levelInfo}from'./xp.js';

/* Everything below the raw stats on the done screen: streak, grade, XP,
   habit stage, next session, praise, milestones. Split out of timer.js,
   which was already past the file-size limit. */

function clearDoneExtras(){
  $('#doneStreakArea').innerHTML='';
  $('#doneHabitArea').innerHTML='';
  $('#doneNextArea').innerHTML='';
  $('#doneQuoteArea').innerHTML='';
}
/* Grade needs rower data: sprint stroke-rate compliance over the whole session. */
function gradeHtml(ps,blocks,finishedEarly){
  if(!ps||!ps.sprintRates||!ps.sprintRates.length||!blocks)return'';
  const totalSprints=blocks*5;
  const pct=ps.rateHits/totalSprints;
  const g=pct>=.9&&!finishedEarly?'S':pct>=.7?'A':pct>=.5?'B':'C';
  const label={S:'Flawless',A:'Strong',B:'Solid',C:'Keep pushing'}[g];
  return'<div class="done-grade g-'+g+'"><span class="g-letter">'+g+'</span>'+
    '<span class="g-detail">'+label+'<br>'+ps.rateHits+' / '+totalSprints+' sprints at 30+ spm</span></div>';
}
function praiseHtml(doneCount,blocks,streak,steady){
  if(doneCount%3===0&&!steady){
    return'<div class="done-tip">💡 '+DONE_TIPS[doneCount%DONE_TIPS.length]+'</div>';
  }
  const praise=DONE_PRAISE[doneCount%DONE_PRAISE.length]
    .replace(/\{blocks\}/g,blocks).replace(/\{sprints\}/g,blocks*5)
    .replace(/\{streak\}/g,streak).replace(/\{total\}/g,doneCount);
  return'<div class="done-praise">'+praise+'</div>';
}
/* Fogg: the habit grows when it is already easy, and only if the person agrees. */
async function offerGrowth(data,streak){
  if(!shouldOfferGrowth(data,streak))return;
  const yes=await customConfirm(streak+' days in a row, and the floor never moved. '+
    'Raise your daily target by one block? Your floor stays exactly where it is.');
  const fresh=loadData();if(!fresh)return;
  if(yes)acceptGrowth(fresh,streak);else declineGrowth(fresh,streak);
}

function renderDoneExtras(ctx){
  const data=loadData();
  if(!data||!ctx.sessionKey){clearDoneExtras();return}
  const sessions=scheduleFor(data);
  const completed=data.completed||{};
  const doneCount=countRowingSessions(completed);
  const si=calcStreak(data,sessions);
  const stage=getHabitStage(doneCount);
  const today=new Date();today.setHours(0,0,0,0);
  const oldBest=data.bestStreak||0;
  const isNewBest=si.best>oldBest&&si.best>1;
  if(si.best!==oldBest){data.bestStreak=si.best;saveData(data)}

  let sh='<div class="done-streak"><div class="done-streak-num">'+si.current+'</div>'+
    '<div class="done-streak-label">'+(isDaily(data)?'day streak':'session streak')+'</div></div>';
  if(isNewBest)sh+='<div class="done-pb">NEW PERSONAL BEST!</div>';
  if(ctx.newPowerPB)sh+='<div class="done-pb">⚡ NEW POWER PB: '+ctx.ps.peakW+' W</div>';
  if(!ctx.steady)sh+=gradeHtml(ctx.ps,ctx.blocks,ctx.finishedEarly);

  let levelUp=false;
  if(ctx.golden)sh+='<div class="done-pb" style="color:var(--gold)">🌟 GOLDEN SESSION! +'+ctx.golden+' bonus XP</div>';
  if(ctx.xpAfter>ctx.xpBefore){
    const li0=levelInfo(ctx.xpBefore),li1=levelInfo(ctx.xpAfter);
    levelUp=li1.lvl>li0.lvl;
    sh+='<div class="done-xp">+'+(ctx.xpAfter-ctx.xpBefore)+' XP</div>';
    if(levelUp)sh+='<div class="done-levelup">Level up! LVL '+li1.lvl+' · '+li1.rank+'</div>';
  }
  /* Celebrate every completion; go big on special moments */
  const big=levelUp||ctx.newPowerPB||isNewBest||ctx.golden>0;
  setTimeout(()=>confettiBurst(big?90:25),400);
  $('#doneStreakArea').innerHTML=sh;

  const eq=getEquipped(data);
  $('#doneHabitArea').innerHTML='<div class="done-habit">'+
    '<div class="habit-ring '+stage.cls+'">'+stage.ring+'</div>'+
    '<span class="habit-stage '+stage.colorCls+'">'+stage.name+'</span>'+
    '<span class="done-avatar">'+eq.avatar.emoji+
      (eq.flair?'<span class="done-flair">'+eq.flair.emoji+'</span>':'')+'</span></div>';

  $('#doneNextArea').innerHTML='<div class="done-next">Next: '+getNext(sessions,today,completed)+'</div>';
  $('#doneQuoteArea').innerHTML=praiseHtml(doneCount,ctx.blocks||0,si.current,ctx.steady);

  const milestones=checkMilestones(data,sessions,si);
  if(milestones.length)setTimeout(()=>showMilestones(milestones,data).then(()=>offerGrowth(data,si.current)),1200);
  else offerGrowth(data,si.current);
}
export{renderDoneExtras};
