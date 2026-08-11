import{PROGRAMS,dailySettings}from'./programs.js';
import{loadData,saveData}from'./store.js';
/* Daily Minimum mode, built on BJ Fogg's Tiny Habits.
   Three rules drive everything here:
   1. The commitment is the FLOOR, not the session. Pass the floor and the day
      is banked, so stopping right there is a success, never a failure.
   2. One grace day per week absorbs a miss, because punishing an overwhelmed
      person is exactly the wrong feedback.
   3. Growth is offered, never scheduled. The weekly ramp of the other
      programs is deliberately absent. */
const GRACE_PER_WEEK=1;
const GROWTH_AT=10; /* consecutive days before the app offers a bigger target */

function isDaily(data){
  const prog=data&&PROGRAMS[data.program];
  return!!(prog&&prog.daily);
}
/* Timer settings for one daily session; the other programs read the program
   constants instead, so this is the only place the overrides apply. */
function dailyTimerOpts(data){
  const s=dailySettings(data);
  return{blocks:s.target,floor:s.floor,restSec:s.restSec,warmup:s.warmup,cooldown:s.cooldown};
}
function saveDaily(data,patch){
  data.daily=Object.assign({},data.daily||{},patch);
  saveData(data);
  return data;
}
/* Index of the last working step of the floor block. Passing it means the day
   is earned, whether or not the rest of the session happens. */
function floorStepIndex(sequence,floor){
  let last=-1;
  for(let i=0;i<sequence.length;i++){
    const s=sequence[i];
    if(s.blk===floor&&s.cyc)last=i;
  }
  return last;
}
/* Marks the day complete the moment the floor is passed. Returns true only on
   the transition, so the caller celebrates once. */
function bankFloor(key){
  if(!key)return false;
  const data=loadData();
  if(!data||!data.completed||data.completed[key])return false;
  data.completed[key]=new Date().toISOString();
  saveData(data);
  return true;
}
/* Streak with a weekly grace day. A missed day inside a week that still has
   grace bridges the gap instead of resetting the count. */
function dailyStreak(data,sessions,today){
  const completed=data.completed||{};
  const sorted=sessions.filter(s=>s.type!=='walk').sort((a,b)=>a.date-b.date);
  if(!sorted.length)return{current:0,best:0,shields:0,graceLeft:GRACE_PER_WEEK};
  let best=0,run=0;
  for(let i=0;i<sorted.length;i++){
    if(completed[sorted[i].key]){run++;if(run>best)best=run}else{run=0}
  }
  let lastDone=-1;
  for(let i=sorted.length-1;i>=0;i--){
    if(completed[sorted[i].key]){lastDone=i;break}
  }
  const spent={};
  let current=0;
  for(let i=lastDone;i>=0;i--){
    const s=sorted[i];
    if(completed[s.key]){current++;continue}
    if(s.date>=today)continue; /* today is still open, not a miss */
    if((spent[s.week]||0)<GRACE_PER_WEEK){spent[s.week]=(spent[s.week]||0)+1;continue}
    break;
  }
  return{current,best,shields:0,graceLeft:graceLeft(data,sessions,today),graceTotal:GRACE_PER_WEEK};
}
/* Grace remaining in the week that contains `today`. Only days already in the
   past can spend it. */
function graceLeft(data,sessions,today){
  const completed=data.completed||{};
  const week=weekOf(sessions,today);
  if(!week)return GRACE_PER_WEEK;
  const missed=sessions.filter(s=>s.week===week&&s.type!=='walk'&&s.date<today&&!completed[s.key]).length;
  return Math.max(0,GRACE_PER_WEEK-missed);
}
function weekOf(sessions,today){
  const t=today.getTime();
  for(const s of sessions){
    const d=s.date.getTime();
    if(d<=t&&t-d<7*86400000)return s.week;
  }
  return 0;
}
/* Fogg: let the habit grow on its own, then ask. Never raise the floor here. */
function shouldOfferGrowth(data,streak){
  if(!isDaily(data))return false;
  const s=dailySettings(data);
  if(s.target>=8)return false;
  const mark=(data.daily&&data.daily.growthOffered)||0;
  return streak>=GROWTH_AT&&streak>mark;
}
function acceptGrowth(data,streak){
  const s=dailySettings(data);
  return saveDaily(data,{target:Math.min(8,s.target+1),growthOffered:streak});
}
function declineGrowth(data,streak){
  return saveDaily(data,{growthOffered:streak});
}
function floorLabel(data){
  const s=dailySettings(data);
  return s.floor===s.target
    ?s.target+(s.target===1?' block':' blocks')
    :'floor '+s.floor+' of '+s.target+' blocks';
}
export{GRACE_PER_WEEK,acceptGrowth,bankFloor,dailyStreak,dailyTimerOpts,declineGrowth,floorLabel,floorStepIndex,graceLeft,isDaily,saveDaily,shouldOfferGrowth};
