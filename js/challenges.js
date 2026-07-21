import{awardCoins}from'./coins.js';
import{$}from'./dom.js';
import{pm5,pm5Stats}from'./pm5.js';
import{PROGRAMS,buildSchedule,injectExtras}from'./programs.js';
import{loadData}from'./store.js';
import{sequence,stepIdx,timerConfig}from'./timer.js';
import{fmtTime,parseDate}from'./util.js';
import{walkDistance}from'./walk.js';
/* Coin-earning engine: random mid-session challenges (banner on the timer
   screen) plus fixed bonuses evaluated when a session finishes. No challenge
   state persists - everything resets when a session starts, and STOP/FINISH
   clears the banner. All awards flow through awardCoins so they sync and
   show up in the shop coin log automatically. Imports of timer state are
   runtime-only (allowed feature-to-feature cycle, same pattern as pm5.js). */
const WATT_MARKS=[200,250,300,350,400];
const ROW_COINS=20,WALK_COINS=15,WALK_TARGET_M=300,WALK_WINDOW=240,GPS_STALE=30;
let rowPicks=null,walkTimes=null,active=null,hideAt=-1,lastDist=0,lastMoveEl=0;

function showBanner(text,cls){const el=$('#challengeBanner');if(!el)return;
  el.textContent=text;el.className='on'+(cls?' '+cls:'')}
function hideBanner(){const el=$('#challengeBanner');if(el){el.className='';el.textContent=''}}

/* Called from startTimer: plan this session's challenges. */
function challengesBegin(){
  active=null;hideAt=-1;lastDist=0;lastMoveEl=0;rowPicks=null;walkTimes=null;
  hideBanner();
  if(timerConfig.walk)walkTimes=planWalkTimes();
  else rowPicks=planSprintPicks(sequence);
}
/* Called from STOP/finish: drop all challenge state and the banner. */
function challengesClear(){active=null;rowPicks=null;walkTimes=null;hideAt=-1;hideBanner()}

/* 1-2 random sprint phases per session, never the first sprint. */
function planSprintPicks(seq){
  const sprints=[];
  for(let i=0;i<seq.length;i++)if(seq[i].type==='high')sprints.push(i);
  sprints.shift();
  for(let i=sprints.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    const t=sprints[i];sprints[i]=sprints[j];sprints[j]=t;
  }
  return new Set(sprints.slice(0,Math.min(sprints.length,Math.random()<0.5?1:2)));
}
/* 1-2 random elapsed times per walk, never in the first 2 minutes; a second
   challenge can only start after the first one's window has fully passed. */
function planWalkTimes(){
  const t=[120+Math.floor(Math.random()*600)];
  if(Math.random()<0.5)t.push(t[0]+WALK_WINDOW+60+Math.floor(Math.random()*900));
  return t;
}

/* Called from tick() with elapsed session seconds (pause-aware: the timer
   stops ticking while paused, so challenge clocks pause too). */
function challengeTick(totalEl){
  if(!active&&hideAt>=0&&totalEl>=hideAt){hideAt=-1;hideBanner()}
  if(timerConfig.walk)walkChallengeTick(totalEl);
  else rowChallengeTick(totalEl);
}

function rowChallengeTick(totalEl){
  if(active){
    /* 1 Hz sampling: the success check runs first so a target hit in the
       sprint's final second (read on the boundary tick) still counts. */
    if(pm5.watts>=active.target){
      awardCoins(ROW_COINS,'Sprint challenge');
      showBanner('⚡ '+active.target+' W hit! +'+ROW_COINS+' coins','success');
      active=null;hideAt=totalEl+6;
    }else if(stepIdx!==active.idx){
      showBanner('Challenge missed, next time!','miss');
      active=null;hideAt=totalEl+5;
    }
    return;
  }
  if(!rowPicks||!rowPicks.has(stepIdx))return;
  rowPicks.delete(stepIdx);
  if(!pm5.connected)return; /* no rower connected: challenges never fire */
  const s=sequence[stepIdx];
  if(!s||s.type!=='high')return;
  const d=loadData();
  const base=(d&&d.pm5PB&&d.pm5PB.peakW)||(pm5Stats&&pm5Stats.peakW)||150;
  active={idx:stepIdx,target:Math.round(base*0.9/5)*5};
  hideAt=-1;
  showBanner('CHALLENGE: hit '+active.target+' W on this sprint for '+ROW_COINS+' coins','');
}

function walkChallengeTick(totalEl){
  const dist=walkDistance();
  if(dist>lastDist){lastDist=dist;lastMoveEl=totalEl}
  if(active){
    if(dist-active.startDist>=WALK_TARGET_M){
      awardCoins(WALK_COINS,'Walk challenge');
      showBanner('🚶 '+WALK_TARGET_M+' m covered! +'+WALK_COINS+' coins','success');
      active=null;hideAt=totalEl+8;
    }else if(totalEl>=active.deadline){
      active=null;hideAt=-1;hideBanner(); /* quiet miss */
    }else{
      showBanner('CHALLENGE: cover '+WALK_TARGET_M+' m in the next '+
        fmtTime(Math.ceil(active.deadline-totalEl))+' for '+WALK_COINS+' coins','');
    }
    return;
  }
  if(!walkTimes||!walkTimes.length||totalEl<walkTimes[0])return;
  walkTimes.shift();
  /* GPS distance must actually be accumulating, else the slot is skipped */
  if(!(dist>0&&totalEl-lastMoveEl<=GPS_STALE))return;
  active={startDist:dist,deadline:totalEl+WALK_WINDOW};
  hideAt=-1;
}

/* Pure: which fixed bonuses does this finished session earn? data must be the
   pre-finish snapshot (pm5PB not yet updated with this session's peak). */
function computeBonuses(stats,data,sessionKey){
  const awards=[];
  if(stats&&stats.peakW>0&&!stats.walk){
    const prev=(data.pm5PB&&data.pm5PB.peakW)||0;
    if(stats.peakW>prev)awards.push({amount:50,reason:'New power PB'});
    const marks=data.wattMarks||[];
    for(const t of WATT_MARKS)
      if(stats.peakW>=t&&marks.indexOf(t)<0)
        awards.push({amount:25,reason:'First time over '+t+' W',mark:t});
  }
  const w=completedWeek(data,sessionKey);
  if(w)awards.push({amount:30,reason:'Full week completed',week:w});
  return awards;
}
/* Week number whose planned rowing sessions are now all completed (0 if none).
   Walks neither trigger nor count; data.weekBonus guards double awards. */
function completedWeek(data,sessionKey){
  if(!sessionKey||sessionKey.indexOf('walk-')===0)return 0;
  const prog=data&&PROGRAMS[data.program];
  if(!prog||!data.days||!data.startDate)return 0;
  const startMon=parseDate(data.startDate);
  const sessions=injectExtras(buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks);
  const sess=sessions.find(s=>s.key===sessionKey);
  if(!sess)return 0;
  if((data.weekBonus||[]).indexOf(sess.week)>=0)return 0;
  const completed=data.completed||{};
  const ws=sessions.filter(s=>s.week===sess.week&&s.type!=='walk');
  return ws.length&&ws.every(s=>completed[s.key])?sess.week:0;
}
/* Hook for session-completion paths. Contract: call with the caller's live
   data object (completion already recorded, pm5PB not yet updated) BEFORE the
   caller's saveData. Guard arrays are written onto that object; awardCoins
   persists the coins itself, so they are mirrored back into the object to
   keep the caller's later saveData from clobbering them. */
function evalSessionBonuses(stats,data,sessionKey){
  const awards=computeBonuses(stats,data,sessionKey);
  if(!awards.length)return;
  for(const a of awards){
    if(a.mark){if(!data.wattMarks)data.wattMarks=[];data.wattMarks.push(a.mark)}
    if(a.week){if(!data.weekBonus)data.weekBonus=[];data.weekBonus.push(a.week)}
    awardCoins(a.amount,a.reason);
  }
  const fresh=loadData();
  if(fresh){data.coins=fresh.coins;data.coinLog=fresh.coinLog;
    if(!data.cosmetics)data.cosmetics=fresh.cosmetics}
}
export{challengesBegin,challengeTick,challengesClear,computeBonuses,evalSessionBonuses};
