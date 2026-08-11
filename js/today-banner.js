import{STAGE_IDENTITY}from'./content.js';
import{dailySettings,getEffectiveTime,getNext,countRowingSessions}from'./programs.js';
import{floorLabel,graceLeft,isDaily}from'./daily.js';
import{$}from'./dom.js';
import{calcStreak,getHabitStage}from'./habit.js';
import{renderSchedule}from'./schedule.js';
import{saveData}from'./store.js';
import{launchSession,launchSteadySession,launchWalkSession}from'./timer.js';
import{WEEKDAY_NAMES,fmtDate,sameDay}from'./util.js';

/* The one banner at the top of the schedule screen: what to do today, and the
   single tap that starts it. Split out of schedule.js because the daily
   program needs its own branch here. */

function timeSuffix(data,s){
  const t=getEffectiveTime(data,s.key,s.actualDay,s.date);
  return t?' · '+t:'';
}
/* Rough wall-clock cost of a session, used to make the ask concrete. */
function estMinutes(blocks,cfg){
  return(cfg.warmup?4:0)+blocks*5+Math.round((blocks-1)*cfg.restSec/60)+(cfg.cooldown?5:0);
}
function anchorHtml(data){
  return data.anchor
    ?'<div class="anchor-line" id="anchorLine">After '+String(data.anchor).replace(/</g,'&lt;')+' → row</div>'
    :'<div class="anchor-line dim" id="anchorLine">＋ set your cue: "After I ..., I row"</div>';
}
/* The anchor is Fogg's prompt: an existing routine the new behaviour rides on. */
function wireAnchor(data){
  const line=$('#anchorLine');if(!line)return;
  line.addEventListener('click',()=>{
    if(line.isContentEditable)return;
    line.textContent=data.anchor||'';
    line.contentEditable='true';line.classList.remove('dim');line.focus();
  });
  line.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();line.blur()}});
  line.addEventListener('blur',()=>{
    line.contentEditable='false';
    const v=line.textContent.trim();
    if(v)data.anchor=v;else delete data.anchor;
    saveData(data);renderSchedule();
  });
}
function taglineHtml(completed){
  const stage=getHabitStage(countRowingSessions(completed));
  const t=STAGE_IDENTITY[stage.id].tagline;
  return t?'<div class="today-tagline">'+t+'</div>':'';
}
/* Non-daily programs warn about the streak. Daily mode never does: pressure is
   the opposite of what the tiny-habit design needs. */
function streakWarnHtml(streak,hasUndone){
  if(!hasUndone||streak.current<2)return'';
  return streak.shields>0
    ?'<div class="streak-warning">🛡 A shield protects your '+streak.current+'-session streak today, but rowing beats spending it</div>'
    :'<div class="streak-warning">Your '+streak.current+'-session streak is at risk today</div>';
}

function dailyBanner(el,data,sess,prog,completed,graceRemaining){
  const cfg=dailySettings(data);
  const targetMin=estMinutes(cfg.target,cfg);
  const floorMin=estMinutes(cfg.floor,cfg);
  const graceLine=graceRemaining>0
    ?'<div class="daily-grace">🛡 One grace day left this week. Missing today will not break your streak.</div>'
    :'<div class="daily-grace spent">🛡 Grace used this week. Even the floor keeps the chain alive.</div>';
  el.innerHTML='<div class="sched-today-banner daily">'+
    '<div class="day-label">TODAY &middot; '+sess.day+timeSuffix(data,sess)+'</div>'+
    '<div class="day-title">Daily Minimum</div>'+
    '<div class="daily-dose">'+
      '<div class="dose-item floor"><span class="dose-num">'+cfg.floor+'</span>'+
        '<span class="dose-lbl">FLOOR<br>'+floorMin+' min &middot; counts the day</span></div>'+
      '<div class="dose-item"><span class="dose-num">'+cfg.target+'</span>'+
        '<span class="dose-lbl">TARGET<br>'+targetMin+' min</span></div>'+
    '</div>'+
    anchorHtml(data)+taglineHtml(completed)+graceLine+
    '<button class="btn btn-primary" id="todayStartBtn">START · '+targetMin+' MIN</button>'+
    (cfg.floor<cfg.target
      ?'<button class="quick-session-btn" id="floorOnlyBtn">ROUGH DAY? JUST THE FLOOR ('+floorMin+' min)</button>'
      :'')+
  '</div>';
  $('#todayStartBtn').addEventListener('click',()=>launchSession(sess,prog));
  const fBtn=$('#floorOnlyBtn');
  if(fBtn)fBtn.addEventListener('click',()=>launchSession(Object.assign({},sess,{blocks:cfg.floor}),prog));
  wireAnchor(data);
}

function intervalBanner(el,data,sess,prog,completed,streak){
  el.innerHTML='<div class="sched-today-banner">'+
    '<div class="day-label">TODAY &middot; '+sess.day+timeSuffix(data,sess)+'</div>'+
    '<div class="day-title">Week '+sess.week+' &middot; '+sess.blocks+' Blocks</div>'+
    anchorHtml(data)+taglineHtml(completed)+streakWarnHtml(streak,true)+
    '<button class="btn btn-primary" id="todayStartBtn">START TODAY\'S SESSION</button>'+
    (sess.blocks>1?'<button class="quick-session-btn" id="quickSessionBtn">QUICK SESSION (1 block)</button>':'')+
    (streak.current>=2?'<button class="quick-session-btn" id="microSessionBtn">🛡 5-MIN STREAK SAVER (1 block, no extras)</button>':'')+
  '</div>';
  $('#todayStartBtn').addEventListener('click',()=>launchSession(sess,prog));
  wireAnchor(data);
  const mBtn=$('#microSessionBtn');
  if(mBtn)mBtn.addEventListener('click',()=>launchSession(Object.assign({},sess,{blocks:1}),prog,{bare:true}));
  const qBtn=$('#quickSessionBtn');
  if(qBtn)qBtn.addEventListener('click',()=>launchSession(Object.assign({},sess,{blocks:1}),prog));
}

function steadyBanner(el,data,sess,completed,streak){
  el.innerHTML='<div class="sched-today-banner">'+
    '<div class="day-label">TODAY &middot; '+sess.day+timeSuffix(data,sess)+'</div>'+
    '<div class="day-title">Steady-State '+sess.minutes+' min</div>'+
    anchorHtml(data)+taglineHtml(completed)+streakWarnHtml(streak,true)+
    '<button class="btn btn-primary" id="todaySteadyBtn">START STEADY SESSION</button></div>';
  $('#todaySteadyBtn').addEventListener('click',()=>launchSteadySession(sess));
  wireAnchor(data);
}

function walkBanner(el,data,sess,completed,streak){
  el.innerHTML='<div class="sched-today-banner">'+
    '<div class="day-label">TODAY &middot; '+sess.day+timeSuffix(data,sess)+'</div>'+
    '<div class="day-title">🚶 Walk day</div>'+
    anchorHtml(data)+taglineHtml(completed)+streakWarnHtml(streak,false)+
    '<button class="btn btn-primary" id="todayWalkBtn">START WALK</button></div>';
  $('#todayWalkBtn').addEventListener('click',()=>launchWalkSession());
  wireAnchor(data);
}

function finishMessage(pct,doneCount,total,weeksActive){
  if(doneCount===total)return'Perfect completion. Every single session, done. That is extraordinary.';
  if(pct>=75)return'You completed more than three quarters of the program. That level of consistency changes your physiology.';
  if(pct>=50)return'You showed up for more than half the program. Most people never make it this far.';
  if(pct>=25)return'You built a real training habit over '+weeksActive+' weeks. That foundation carries forward.';
  return'You showed up '+doneCount+' times. Every session made you fitter than you were before.';
}
function finishedBanner(el,data,sessions,completed,prog,p){
  const done=sessions.filter(s=>!!completed[s.key]&&s.type!=='walk');
  const totalBlocks=done.reduce((sum,s)=>sum+(s.type==='interval'?s.blocks:0),0);
  const estMin=done.reduce((sum,s)=>{
    if(s.type==='steady')return sum+s.minutes+9;
    return sum+4+s.blocks*5+(s.blocks-1)*(prog.restSec/60)+5;
  },0);
  const weeksActive=new Set(done.map(s=>s.week)).size;
  const si=calcStreak(data,sessions);
  el.innerHTML='<div class="sched-rest-banner">'+
    '<p style="font-weight:700;color:var(--green);margin-bottom:4px;font-size:1rem">Program Finished!</p>'+
    taglineHtml(completed)+
    '<div class="finish-stats">'+
      '<div class="finish-stat"><div class="finish-stat-num">'+p.doneCount+'</div><div class="finish-stat-label">Sessions</div></div>'+
      '<div class="finish-stat"><div class="finish-stat-num">'+totalBlocks*5+'</div><div class="finish-stat-label">Sprints</div></div>'+
      '<div class="finish-stat"><div class="finish-stat-num">'+(Math.round(estMin/60*10)/10)+'h</div><div class="finish-stat-label">Training time</div></div>'+
      '<div class="finish-stat"><div class="finish-stat-num">'+si.best+'</div><div class="finish-stat-label">Best streak</div></div>'+
    '</div>'+
    '<p class="finish-msg">'+finishMessage(p.pct,p.doneCount,p.total,weeksActive)+'</p>'+
    '<p style="font-size:.8rem;color:var(--muted)">Tap <strong>Change Program</strong> to start again.</p>'+
  '</div>';
}

function renderTodayBanner(data,sessions,today,completed,prog,startMon,p){
  const el=$('#todayBanner');
  const mine=sessions.filter(s=>sameDay(s.date,today));
  const interval=mine.find(s=>s.type==='interval'&&!completed[s.key]);
  const walk=mine.find(s=>s.type==='walk'&&!completed[s.key]);
  const steady=mine.find(s=>s.type==='steady'&&!completed[s.key]);
  const streak=calcStreak(data,sessions);
  if(interval&&isDaily(data))dailyBanner(el,data,interval,prog,completed,graceLeft(data,sessions,today));
  else if(interval)intervalBanner(el,data,interval,prog,completed,streak);
  else if(steady)steadyBanner(el,data,steady,completed,streak);
  else if(walk)walkBanner(el,data,walk,completed,streak);
  else if(p.programOver)finishedBanner(el,data,sessions,completed,prog,p);
  else if(startMon>today){
    el.innerHTML='<div class="sched-rest-banner compact"><div class="rest-body">'+
      '<p class="rest-title">Starts '+WEEKDAY_NAMES[startMon.getDay()]+' '+fmtDate(startMon)+'</p>'+
      '<p class="rest-next">First session: '+getNext(sessions,today,completed)+'</p></div></div>';
  } else {
    el.innerHTML='<div class="sched-rest-banner compact"><div class="rest-body">'+
      '<p class="rest-title">'+(isDaily(data)?'Day already banked ('+floorLabel(data)+')':'Rest Day ('+WEEKDAY_NAMES[today.getDay()]+')')+'</p>'+
      '<p class="rest-next">Next: '+getNext(sessions,today,completed)+'</p></div>'+
      '<button class="quick-session-btn" id="restWalkBtn">🚶 WALK</button></div>';
    const rwBtn=$('#restWalkBtn');
    if(rwBtn)rwBtn.addEventListener('click',()=>launchWalkSession());
  }
}
export{estMinutes,renderTodayBanner};
