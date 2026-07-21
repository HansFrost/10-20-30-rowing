import{DAILY_TIPS,STAGE_IDENTITY}from'./content.js';
import{$,$$,setNavRenderHook,showScreen}from'./dom.js';
import{calcStreak,checkMilestones,getHabitStage,renderHabitStrip,showMilestones}from'./habit.js';
import{DEFAULT_MAX_HR,renderHrTable}from'./hr.js';
import{DAY_LABELS,PROGRAMS,buildSchedule,getEffectiveTime,getNext,injectExtras,migrateData,totalAllSessions}from'./programs.js';
import{deleteExtraSession,openAddSessionModal,openSwapModal}from'./session-modals.js';
import{loadData,saveData}from'./store.js';
import{openTimeModal}from'./time-modals.js';
import{launchSession,launchSteadySession}from'./timer.js';
import{WEEKDAY_NAMES,addDays,fmtDate,parseDate,sameDay}from'./util.js';
import{renderXpStrip}from'./xp.js';
function renderSchedule(){
  const data=loadData();
  if(!data){showScreen('#onboarding');return}
  if(!data.days){migrateData(data)}
  const progKey=data.program||'intermediate';
  const prog=PROGRAMS[progKey];
  const startMon=parseDate(data.startDate);
  const sessions=injectExtras(buildSchedule(startMon,progKey,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks);
  const today=new Date();today.setHours(0,0,0,0);
  const completed=data.completed||{};
  const total=totalAllSessions(progKey,data.days.length,(data.extraSessions||[]).length);

  /* Program name */
  const nameEl=$('#progName');
  nameEl.textContent=data.programName||'My Program';
  nameEl.onclick=()=>{
    nameEl.contentEditable='true';nameEl.focus();
    const r=document.createRange();r.selectNodeContents(nameEl);
    const s=window.getSelection();s.removeAllRanges();s.addRange(r);
  };
  const saveName=()=>{
    nameEl.contentEditable='false';
    const v=nameEl.textContent.trim();
    if(v&&v!=='My Program'){data.programName=v}else{delete data.programName}
    nameEl.textContent=data.programName||'My Program';
    saveData(data);
  };
  nameEl.onblur=saveName;
  nameEl.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();nameEl.blur()}};

  /* Badge */
  let badge=prog.name+' \u00B7 '+prog.weeks+'w \u00B7 '+data.days.map(d=>DAY_LABELS[d]).join('/');
  if(data.steadyDay)badge+='+'+DAY_LABELS[data.steadyDay];
  $('#progBadge').textContent=badge;

  /* Help */
  const mhr=data.maxHR||DEFAULT_MAX_HR;
  $('#helpHrTitle').textContent='Your Heart Rate Zones (Max HR: '+mhr+' bpm)';
  $('#helpHrTable').innerHTML=renderHrTable(mhr);
  $('#helpProgTitle').textContent=prog.name+' Program';
  $('#helpProgDetails').innerHTML='<p>'+prog.desc+'</p>';
  $('#maxHrEdit').value=mhr;

  /* Progress */
  const doneCount=Object.keys(completed).length;
  const lastSession=sessions[sessions.length-1];
  const programOver=lastSession&&lastSession.date<today;
  const pct=Math.round(doneCount/total*100);
  if(programOver){
    $('#progLabel').textContent='Program finished \u2014 '+doneCount+' / '+total+' sessions';
  } else {
    $('#progLabel').textContent=doneCount+' / '+total+' sessions';
  }
  $('#progPct').textContent=pct+'%';
  $('#progFill').style.width=pct+'%';

  /* Habit strip (streak + stage badge) */
  renderHabitStrip(data,sessions);
  renderXpStrip(data);
  renderWeeklyCard(data,sessions,today,completed,startMon);

  /* Daily tip */
  const tipEl=$('#dailyTip');
  const dayOfYear=Math.floor((today-new Date(today.getFullYear(),0,0))/(86400000));
  const tip=DAILY_TIPS[dayOfYear%DAILY_TIPS.length];
  tipEl.innerHTML='<div class="sched-tip"><div class="sched-tip-label">Tip of the day</div>'+tip+'</div>';

  /* Today banner */
  const todaySessions=sessions.filter(s=>sameDay(s.date,today));
  const todayInterval=todaySessions.find(s=>s.type==='interval'&&!completed[s.key]);
  const todaySteady=todaySessions.find(s=>s.type==='steady'&&!completed[s.key]);
  const bannerEl=$('#todayBanner');
  const bDoneCount=Object.keys(completed).length;
  const bStage=getHabitStage(bDoneCount);
  const bTagline=STAGE_IDENTITY[bStage.id].tagline;
  const bTagHtml=bTagline?'<div class="today-tagline">'+bTagline+'</div>':'';
  const bStreak=calcStreak(data,sessions);
  const hasUndone=todayInterval||todaySteady;
  const streakWarnHtml=(hasUndone&&bStreak.current>=2)?'<div class="streak-warning">Your '+bStreak.current+'-session streak is at risk today</div>':'';

  if(todayInterval){
    const tTime=getEffectiveTime(data,todayInterval.key,todayInterval.actualDay);
    const timeInfo=tTime?' \u00B7 '+tTime:'';
    bannerEl.innerHTML='<div class="sched-today-banner">'+
      '<div class="day-label">TODAY &middot; '+todayInterval.day+timeInfo+'</div>'+
      '<div class="day-title">Week '+todayInterval.week+' &middot; '+todayInterval.blocks+' Blocks</div>'+
      bTagHtml+streakWarnHtml+
      '<button class="btn btn-primary" id="todayStartBtn">START TODAY\'S SESSION</button>'+
      (todayInterval.blocks>1?'<button class="quick-session-btn" id="quickSessionBtn">'+(bStreak.current>=2?'PROTECT YOUR STREAK \u2014 ':'')+'QUICK SESSION (1 block)</button>':'')+
    '</div>';
    $('#todayStartBtn').addEventListener('click',()=>launchSession(todayInterval,prog));
    const qBtn=$('#quickSessionBtn');
    if(qBtn)qBtn.addEventListener('click',()=>{
      const qs=Object.assign({},todayInterval,{blocks:1});
      launchSession(qs,prog);
    });
  } else if(todaySteady){
    const tTime=getEffectiveTime(data,todaySteady.key,todaySteady.actualDay);
    const timeInfo=tTime?' \u00B7 '+tTime:'';
    bannerEl.innerHTML='<div class="sched-today-banner">'+
      '<div class="day-label">TODAY &middot; '+todaySteady.day+timeInfo+'</div>'+
      '<div class="day-title">Steady-State '+todaySteady.minutes+' min</div>'+
      bTagHtml+streakWarnHtml+
      '<button class="btn btn-primary" id="todaySteadyBtn">START STEADY SESSION</button></div>';
    $('#todaySteadyBtn').addEventListener('click',()=>launchSteadySession(todaySteady));
  } else if(programOver){
    /* Compute encouraging stats from actual data */
    const doneSessions=sessions.filter(s=>!!completed[s.key]);
    const totalBlocks=doneSessions.reduce((sum,s)=>sum+(s.type==='interval'?s.blocks:0),0);
    const totalSprints=totalBlocks*5;
    const totalCycles=totalBlocks*5;
    const estMinutes=doneSessions.reduce((sum,s)=>{
      if(s.type==='steady')return sum+s.minutes+4+5;
      return sum+4+s.blocks*5+(s.blocks-1)*(prog.restSec/60)+5;
    },0);
    const estHours=Math.round(estMinutes/60*10)/10;
    const weeksActive=new Set(doneSessions.map(s=>s.week)).size;
    const si=calcStreak(data,sessions);

    /* Pick encouraging message based on completion rate */
    let finishMsg;
    if(doneCount===total) finishMsg='Perfect completion. Every single session, done. That is extraordinary.';
    else if(pct>=75) finishMsg='You completed more than three quarters of the program. That level of consistency changes your physiology.';
    else if(pct>=50) finishMsg='You showed up for more than half the program. Most people never make it this far.';
    else if(pct>=25) finishMsg='You built a real training habit over '+weeksActive+' weeks. That foundation carries forward.';
    else finishMsg='You showed up '+doneCount+' times. Every session made you fitter than you were before.';

    bannerEl.innerHTML='<div class="sched-rest-banner">'+
      '<p style="font-weight:700;color:var(--green);margin-bottom:4px;font-size:1rem">Program Finished!</p>'+
      bTagHtml+
      '<div class="finish-stats">'+
        '<div class="finish-stat"><div class="finish-stat-num">'+doneCount+'</div><div class="finish-stat-label">Sessions</div></div>'+
        '<div class="finish-stat"><div class="finish-stat-num">'+totalSprints+'</div><div class="finish-stat-label">Sprints</div></div>'+
        '<div class="finish-stat"><div class="finish-stat-num">'+estHours+'h</div><div class="finish-stat-label">Training time</div></div>'+
        '<div class="finish-stat"><div class="finish-stat-num">'+si.best+'</div><div class="finish-stat-label">Best streak</div></div>'+
      '</div>'+
      '<p class="finish-msg">'+finishMsg+'</p>'+
      '<p style="font-size:.8rem;color:var(--muted)">Tap <strong>Change Program</strong> to start again.</p>'+
    '</div>';
  } else {
    bannerEl.innerHTML='<div class="sched-rest-banner">'+
      '<p style="font-weight:700;margin-bottom:4px">Rest Day ('+WEEKDAY_NAMES[today.getDay()]+')</p>'+
      bTagHtml+
      '<p>Next: '+getNext(sessions,today,completed)+'</p></div>';
  }

  /* Precommit banner — upcoming sessions without times (next 7 days) */
  const weekAhead=addDays(today,7);
  const uncommitted=sessions.filter(s=>s.date>=today&&s.date<=weekAhead&&!completed[s.key]&&!getEffectiveTime(data,s.key,s.actualDay));
  const pcEl=$('#precommitBanner');
  if(uncommitted.length){
    let pcHtml='<div class="sched-precommit"><p style="font-size:.8rem;font-weight:600;margin-bottom:8px">\uD83D\uDCC5 Set times for upcoming sessions</p><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">';
    uncommitted.forEach(s=>{
      pcHtml+='<span class="precommit-chip" data-pc-key="'+s.key+'" data-pc-day="'+s.actualDay+'"><span class="pc-day">'+s.day+'</span><span class="pc-date">'+fmtDate(s.date)+'</span></span>';
    });
    pcHtml+='</div></div>';
    pcEl.innerHTML=pcHtml;
    $$('.precommit-chip').forEach(chip=>{
      chip.addEventListener('click',()=>{
        const s=sessions.find(x=>x.key===chip.dataset.pcKey);
        if(s)openTimeModal(s.key,s.actualDay,s,prog);
      });
    });
  } else {
    pcEl.innerHTML='';
  }

  /* Week grid */
  let html='';
  for(let w=1;w<=prog.weeks;w++){
    const ws=sessions.filter(s=>s.week===w);
    const ibs=ws.filter(s=>s.type==='interval').map(s=>s.blocks);
    const lo=Math.min(...ibs),hi=Math.max(...ibs);
    const tag=ibs.length?lo===hi?lo+' blocks':lo+'\u2013'+hi+' blocks':'';
    html+='<div class="week-group"><div class="week-label"><span>Week '+w+'</span>'+
      '<span class="blocks-tag">'+tag+'</span>'+
      '<button class="add-session-btn" data-add-week="'+w+'">+</button></div><div class="week-sessions">';
    ws.forEach(s=>{
      const isDone=!!completed[s.key],isToday=sameDay(s.date,today);
      const isFuture=s.date>today,isPast=s.date<today;
      let cls='session-card';
      if(s.isExtra) cls+=' extra';
      if(s.type==='steady') cls+=' steady';
      if(s.swapped) cls+=' swapped';
      if(isDone) cls+=' completed';
      if(isToday) cls+=' today';
      else if(isFuture) cls+=' future';
      else if(isPast&&!isDone) cls+=' past';

      const label=s.type==='steady'?'Steady '+s.minutes+'m':s.blocks+' blocks';
      const sTime=getEffectiveTime(data,s.key,s.actualDay);
      const timeCls=sTime?'s-time has-time':'s-time';
      const timeContent=sTime?sTime:'\uD83D\uDD50';
      const swapBtn='<div class="s-swap" data-swap-key="'+s.key+'" data-swap-week="'+s.week+'" data-swap-default="'+s.defaultDay+'" data-swap-current="'+s.actualDay+'"'+(s.isExtra?' data-swap-extra="1"':'')+'>&#8652;</div>';
      const deleteBtn=s.isExtra?'<div class="s-delete" data-delete-extra="'+s.key+'">&times;</div>':'';
      html+='<div class="'+cls+'" data-key="'+s.key+'" data-blocks="'+s.blocks+'" data-type="'+s.type+'">'+
        '<div class="s-check" data-toggle="'+s.key+'">'+(isDone?'&#10003;':'')+'</div>'+
        deleteBtn+
        '<div class="'+timeCls+'" data-time-key="'+s.key+'" data-time-day="'+s.actualDay+'">'+timeContent+'</div>'+
        swapBtn+
        '<div class="s-day">'+s.day+(s.swapped?' *':'')+'</div>'+
        '<div class="s-date">'+fmtDate(s.date)+'</div>'+
        '<div class="s-blocks">'+label+'</div>'+
      '</div>';
    });
    html+='</div></div>';
  }
  $('#weekGrid').innerHTML=html;

  /* Card events */
  $$('.session-card').forEach(card=>{
    card.addEventListener('click',e=>{
      if(e.target.closest('[data-toggle]')){
        e.stopPropagation();
        toggleDone(e.target.closest('[data-toggle]').dataset.toggle);
        return;
      }
      if(e.target.closest('[data-time-key]')){
        e.stopPropagation();
        const el=e.target.closest('[data-time-key]');
        const s=sessions.find(x=>x.key===el.dataset.timeKey);
        if(s)openTimeModal(s.key,el.dataset.timeDay,s,prog);
        return;
      }
      if(e.target.closest('[data-delete-extra]')){
        e.stopPropagation();
        deleteExtraSession(e.target.closest('[data-delete-extra]').dataset.deleteExtra);
        return;
      }
      if(e.target.closest('[data-swap-key]')){
        e.stopPropagation();
        const el=e.target.closest('[data-swap-key]');
        openSwapModal(el.dataset.swapKey,el.dataset.swapWeek,el.dataset.swapDefault,el.dataset.swapCurrent,!!el.dataset.swapExtra);
        return;
      }
      const s=sessions.find(x=>x.key===card.dataset.key);
      if(!s)return;
      const now=new Date();now.setHours(0,0,0,0);
      if(s.date>now)return;
      if(s.type==='interval') launchSession(s,prog);
      else if(s.type==='steady') launchSteadySession(s);
    });
  });
  $$('[data-add-week]').forEach(btn=>{
    btn.addEventListener('click',e=>{e.stopPropagation();openAddSessionModal(+btn.dataset.addWeek)});
  });
}

function toggleDone(key){
  const data=loadData();if(!data)return;
  const prog=PROGRAMS[data.program];
  const startMon=parseDate(data.startDate);
  const sessions=injectExtras(buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks);
  const sess=sessions.find(s=>s.key===key);
  if(sess){
    const today=new Date();today.setHours(0,0,0,0);
    if(sess.date>today)return;
  }
  const wasCompleted=!!data.completed[key];
  if(data.completed[key]) delete data.completed[key];
  else data.completed[key]=new Date().toISOString();
  const si=calcStreak(data,sessions);
  data.bestStreak=si.best;
  saveData(data);
  if(!wasCompleted){
    const milestones=checkMilestones(data,sessions,si);
    if(milestones.length){showMilestones(milestones,data).then(()=>renderSchedule());return}
  }
  renderSchedule();
}

function renderWeeklyCard(data,sessions,today,completed,startMon){
  const el=$('#weeklyCard');
  const wk=Math.floor((today-startMon)/(7*86400000))+1;
  const ws=sessions.filter(s=>s.week===wk);
  if(wk<1||!ws.length){el.innerHTML='';return}
  const done=ws.filter(s=>completed[s.key]).length;
  const stats=data.sessionStats||{};
  const meters=ws.reduce((sum,s)=>sum+((stats[s.key]&&stats[s.key].m)||0),0);
  const sprints=ws.reduce((sum,s)=>sum+((completed[s.key]&&s.type==='interval')?s.blocks*5:0),0);
  el.innerHTML='<div class="weekly-card">'+
    '<div class="weekly-head"><span>This week</span><span>Week '+wk+'</span></div>'+
    '<div class="weekly-stats">'+
      '<div class="weekly-stat"><div class="wv">'+done+'/'+ws.length+'</div><div class="wl">Sessions</div></div>'+
      '<div class="weekly-stat"><div class="wv">'+sprints+'</div><div class="wl">Sprints</div></div>'+
      '<div class="weekly-stat"><div class="wv">'+(meters?meters.toLocaleString():'-')+'</div><div class="wl">Meters</div></div>'+
    '</div></div>';
}

setNavRenderHook(renderSchedule);
export{renderSchedule};
