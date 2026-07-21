import{walkStart,walkStop,walkTick,walkDistance}from'./walk.js';
import{beep,ensureAudio,soundBlockEnd,soundDone,soundPhase,soundSprint,soundTick}from'./audio.js';
import{cheerSeen,pickCheer}from'./cheers.js';
import{DONE_PRAISE,DONE_TIPS}from'./content.js';
import{$,customConfirm,setNavAbortHook,showScreen}from'./dom.js';
import{confettiBurst}from'./fx.js';
import{calcStreak,checkMilestones,getHabitStage,showMilestones}from'./habit.js';
import{hrText}from'./hr.js';
import{pickGhost,pm5,pm5FinalizeSession,pm5PhaseChange,pm5ResetStats,pm5Stats,pm5UpdateStrip,updateGhost}from'./pm5.js';
import{countRowingSessions,PROGRAMS,buildSchedule,getNext,injectExtras,injectWalks}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{fmtTime,parseDate}from'./util.js';
import{calcXP,levelInfo}from'./xp.js';
let currentSessionKey=null;
function launchWalkSession(){
  const now=new Date();
  const dk=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  currentSessionKey='walk-'+dk;
  registerWalkSession(dk,now);
  timerConfig.walk=true;timerConfig.steady=false;timerConfig.warmup=false;timerConfig.cooldown=false;
  startTimer();
  walkStart();
}
/* Starting a walk registers it on the schedule (date + start time) right away,
   so stopping early never erases its existence: the card stays and can be
   restarted or checked off later. */
function registerWalkSession(dk,now){
  const data=loadData();if(!data)return;
  const dayKeys=['sun','mon','tue','wed','thu','fri','sat'];
  const isPlanned=(data.walkDays||[]).includes(dayKeys[now.getDay()]);
  const isExtra=(data.extraSessions||[]).some(e=>e.date===dk&&e.type==='walk');
  if(!isPlanned&&!isExtra){
    if(!data.extraSessions)data.extraSessions=[];
    data.extraSessions.push({date:dk,type:'walk'});
  }
  if(!data.sessionTimes)data.sessionTimes={};
  if(!data.sessionTimes['walk-'+dk])
    data.sessionTimes['walk-'+dk]=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  saveData(data);
}
function launchSession(sess,prog,opts){
  const bare=!!(opts&&opts.bare);
  currentSessionKey=sess.key;
  timerConfig.walk=false;
  timerConfig.blocks=sess.blocks;
  timerConfig.restSec=prog.restSec;
  timerConfig.warmup=!bare;timerConfig.cooldown=!bare;timerConfig.steady=false;
  startTimer();
}

function launchSteadySession(sess){
  currentSessionKey=sess.key;
  timerConfig.walk=false;
  timerConfig.steady=true;timerConfig.steadyMinutes=sess.minutes;
  timerConfig.warmup=true;timerConfig.cooldown=true;
  startTimer();
}

let timerConfig={blocks:3,restSec:120,warmup:true,cooldown:true,steady:false,steadyMinutes:0,walk:false};
let sequence=[],stepIdx=0,remaining=0,timerInterval=null,paused=false,startTime=null,totalSec=0,cheerTimer=null;
let wkStart=0,wkBank=0;
let finishedEarly=false;

function buildSequence(){
  const c=timerConfig,seq=[];
  if(c.walk){
    seq.push({type:'walk',name:'WALK',dur:4*3600,inst:'Head out \u2022 tap FINISH when done',blk:0,cyc:0});
    return seq;
  }
  if(c.steady){
    if(c.warmup) seq.push({type:'warmup',name:'WARM-UP',dur:240,inst:'Build gradually \u2022 18\u201320 spm',blk:0,cyc:0});
    seq.push({type:'steady',name:'STEADY STATE',dur:c.steadyMinutes*60,inst:'Comfortable pace \u2022 20\u201324 spm',blk:0,cyc:0});
    if(c.cooldown) seq.push({type:'cooldown',name:'COOL-DOWN',dur:300,inst:'Bring HR down \u2022 18\u201320 spm',blk:0,cyc:0});
    return seq;
  }
  if(c.warmup) seq.push({type:'warmup',name:'WARM-UP',dur:240,inst:'Build gradually \u2022 18\u201320 spm',blk:0,cyc:0});
  seq.push({type:'countdown',name:'GET READY',dur:10,inst:'Block 1 starting...',blk:1,cyc:0});
  for(let b=1;b<=c.blocks;b++){
    for(let cy=1;cy<=5;cy++){
      seq.push({type:'low',name:'LOW',dur:30,inst:'Easy paddle \u2022 16\u201320 spm',blk:b,cyc:cy});
      seq.push({type:'moderate',name:'MODERATE',dur:20,inst:'Steady pace \u2022 22\u201326 spm',blk:b,cyc:cy});
      seq.push({type:'high',name:'SPRINT',dur:10,inst:'ALL OUT! \u2022 30+ spm',blk:b,cyc:cy});
    }
    if(b<c.blocks){
      seq.push({type:'rest',name:'REST',dur:c.restSec,inst:'Light paddle or stop \u2022 Breathe',blk:b,cyc:0});
      seq.push({type:'countdown',name:'GET READY',dur:10,inst:'Block '+(b+1)+' starting...',blk:b+1,cyc:0});
    }
  }
  if(c.cooldown) seq.push({type:'cooldown',name:'COOL-DOWN',dur:300,inst:'Bring HR down \u2022 18\u201320 spm',blk:0,cyc:0});
  return seq;
}

function elapsedBefore(idx){let s=0;for(let i=0;i<idx;i++)s+=sequence[i].dur;return s}

function showCheer(type){const m=pickCheer(type),el=$('#encouragement');
  el.style.opacity='0';setTimeout(()=>{el.textContent=m;el.style.opacity='1'},150)}
function scheduleCheer(type,dur){clearTimeout(cheerTimer);showCheer(type);
  if(dur>15) cheerTimer=setTimeout(()=>showCheer(type),(dur>60?20:10)*1000)}

function updateTimerUI(){
  const s=sequence[stepIdx];
  document.body.className='phase-'+(s.type==='countdown'?'rest':s.type==='cooldown'?'warmup':s.type);
  $('#phaseLabel').textContent=s.type==='countdown'?'NEXT':s.blk?(s.cyc?'BLOCK '+s.blk+'/'+timerConfig.blocks+' \u00B7 CYCLE '+s.cyc+'/5':'BLOCK '+s.blk+'/'+timerConfig.blocks):'SESSION';
  $('#phaseName').textContent=s.name;
  $('#phaseName').classList.remove('pulse');void $('#phaseName').offsetWidth;$('#phaseName').classList.add('pulse');
  $('#hrZone').textContent=hrText(s.type);
  $('#instruction').textContent=s.inst;
  scheduleCheer(s.type,s.dur);
  updateCountdown();updateTimerProgress();pm5UpdateStrip();
}
function updateCountdown(){
  if(timerConfig.walk){ /* walks count up */
    const el=Math.max(0,sequence[stepIdx].dur-remaining);
    $('#countdown').textContent=fmtTime(el);
    return;
  }
  if(remaining>=60) $('#countdown').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
  else $('#countdown').textContent=remaining;
}
function updateTimerProgress(){
  const s=sequence[stepIdx],el=elapsedBefore(stepIdx)+(s.dur-remaining),pct=(el/totalSec)*100;
  $('#timerProgressFill').style.width=pct+'%';
  let t='';
  if(s.blk&&s.cyc) t='Block '+s.blk+' / '+timerConfig.blocks+' \u00B7 Cycle '+s.cyc+' / 5';
  else if(s.blk) t='Block '+s.blk+' / '+timerConfig.blocks;
  else t=s.name;
  t+=' \u00B7 '+fmtTime(Math.round(el))+' / '+fmtTime(totalSec);
  $('#timerProgressText').textContent=t;
}
function tick(){
  if(paused)return;
  const totalEl=(wkBank+(Date.now()-wkStart))/1000;
  let cum=0,newIdx=-1;
  for(let i=0;i<sequence.length;i++){
    if(totalEl<cum+sequence[i].dur){newIdx=i;break}
    cum+=sequence[i].dur;
  }
  if(newIdx<0){finish();return}
  const changed=newIdx!==stepIdx,oldIdx=stepIdx;stepIdx=newIdx;
  remaining=Math.max(0,Math.ceil(sequence[stepIdx].dur-(totalEl-cum)));
  if(changed){
    const s=sequence[stepIdx];
    if(s.type==='high')soundSprint();else if(s.type==='rest')soundBlockEnd();
    else if(s.type==='low'||s.type==='moderate')soundPhase();
    updateTimerUI();
    pm5PhaseChange(oldIdx);
  }else{
    if(remaining<=3&&remaining>0)soundTick();
    updateCountdown();updateTimerProgress();
  }
  pm5TickHook(totalEl);
  if(timerConfig.walk)walkTick(totalEl);
}
function pm5TickHook(totalEl){
  if(!pm5.connected||!pm5Stats)return;
  if(totalEl-pm5Stats.lastSample>=5){
    pm5Stats.timeline.push([Math.round(totalEl),Math.round(pm5Stats.meters)]);
    pm5Stats.lastSample=totalEl;
  }
  updateGhost(totalEl);
  /* Rate coach: halfway through a sprint, one low buzz if stroke rate is under target */
  const s=sequence[stepIdx];
  if(s&&s.type==='high'&&remaining===5&&pm5.spm>0&&pm5.spm<30)beep(220,.3,.5);
}
function skipPhase(){
  if(stepIdx>=sequence.length-1){finish();return}
  wkBank=elapsedBefore(stepIdx+1)*1000;wkStart=Date.now();tick();
}

function startTimer(){
  if(!timerConfig.walk)ensureAudio(); /* WebAudio would pause background podcasts */
  sequence=buildSequence();stepIdx=0;remaining=sequence[0].dur;
  totalSec=sequence.reduce((a,x)=>a+x.dur,0);paused=false;finishedEarly=false;startTime=Date.now();wkStart=Date.now();wkBank=0;
  pm5ResetStats();
  Object.keys(cheerSeen).forEach(k=>delete cheerSeen[k]);
  $('#pauseBtn').textContent='PAUSE';$('#encouragement').textContent='';
  pickGhost();$('#ghostLine').classList.remove('on');
  showScreen('#timer');updateTimerUI();timerInterval=setInterval(tick,1000);requestWakeLock();tryFullscreen();setScreenDim(false);
}
function stopTimer(){clearInterval(timerInterval);timerInterval=null;clearTimeout(cheerTimer);walkStop();
  setScreenDim(true);showScreen('#schedule');renderSchedule()}

function finishEarly(){
  finishedEarly=true;
  if(!paused){wkBank+=Date.now()-wkStart}
  paused=true;
  clearInterval(timerInterval);timerInterval=null;clearTimeout(cheerTimer);
  finish();
}
function resumeSession(){
  finishedEarly=false;
  paused=false;wkStart=Date.now();
  showScreen('#timer');
  timerInterval=setInterval(tick,1000);
  $('#pauseBtn').textContent='PAUSE';
  updateTimerUI();requestWakeLock();setScreenDim(false);
}
function finish(){
  clearInterval(timerInterval);timerInterval=null;clearTimeout(cheerTimer);if(!timerConfig.walk)soundDone();setScreenDim(true);
  const elapsed=Math.round((Date.now()-startTime)/1000);

  let ps=null;
  if(timerConfig.walk){
    walkStop();
    ps={walk:true,m:walkDistance(),min:Math.max(1,Math.round(elapsed/60)),
        avgHr:pm5Stats&&pm5Stats.hrN?Math.round(pm5Stats.hrSum/pm5Stats.hrN):0,
        maxHr:pm5Stats?pm5Stats.hrMax:0};
  }else{
    ps=pm5FinalizeSession();
    /* steady sessions earn XP per minute, so store the duration */
    if(ps&&timerConfig.steady)ps.min=Math.max(1,Math.round(elapsed/60));
  }
  let newPowerPB=false;

  let xpBefore=0,xpAfter=0,golden=0;
  if(currentSessionKey){const d=loadData();if(d){
    xpBefore=calcXP(d);
    d.completed[currentSessionKey]=new Date().toISOString();
    d.bonusXP=d.bonusXP||{};
    if(d.bonusXP[currentSessionKey]===undefined&&Math.random()<0.15)d.bonusXP[currentSessionKey]=100;
    golden=d.bonusXP[currentSessionKey]||0;
    if(ps){
      d.sessionStats=d.sessionStats||{};d.sessionStats[currentSessionKey]=ps;
      d.pm5PB=d.pm5PB||{peakW:0};
      if(ps.peakW>d.pm5PB.peakW){newPowerPB=d.pm5PB.peakW>0;d.pm5PB.peakW=ps.peakW}
    }
    saveData(d);
    xpAfter=calcXP(d)}}
  document.body.className='phase-done';
  $('#doneContinueBtn').style.display=finishedEarly?'':'none';
  $('#doneSubtext').textContent=timerConfig.walk?'Walk logged!':finishedEarly?'Session paused \u2014 you can continue or wrap up.':'Session marked complete!';
  let h='';h+=sRow('Total time',fmtTime(elapsed));
  if(timerConfig.walk){
    if(ps&&ps.m)h+=sRow('Distance',(ps.m/1000).toFixed(2)+' km');
    if(ps&&ps.m>100)h+=sRow('Pace',fmtTime(Math.round(elapsed/(ps.m/1000)))+' /km');
  } else if(timerConfig.steady){
    h+=sRow('Steady-state',timerConfig.steadyMinutes+' min');
  } else {
    const sprintSec=timerConfig.blocks*5*10;
    h+=sRow('Blocks',timerConfig.blocks);
    h+=sRow('Total cycles',timerConfig.blocks*5);h+=sRow('Sprint time',fmtTime(sprintSec));
    h+=sRow('Sprints',timerConfig.blocks*5);
  }
  if(ps&&!ps.walk){
    if(ps.m)h+=sRow('Distance rowed',ps.m.toLocaleString()+' m');
    if(ps.avgW)h+=sRow('Avg power',ps.avgW+' W');
    if(ps.peakW)h+=sRow('Peak power',ps.peakW+' W'+(newPowerPB?' \ud83c\udfc6':''));
    if(ps.bestSprint&&!timerConfig.steady)h+=sRow('Best sprint',ps.bestSprint+' W');
    if(ps.strokes)h+=sRow('Strokes',ps.strokes);
    if(ps.avgHr)h+=sRow('Avg / max HR',ps.avgHr+' / '+ps.maxHr+' bpm');
  }
  if(ps&&ps.walk&&ps.avgHr)h+=sRow('Avg / max HR',ps.avgHr+' / '+ps.maxHr+' bpm');
  $('#summaryBox').innerHTML=h;

  /* Enhanced done screen with habit info */
  const data=loadData();
  if(data&&currentSessionKey){
    const prog=PROGRAMS[data.program];
    const startMon=parseDate(data.startDate);
    const sessions=injectWalks(injectExtras(buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks),data,startMon);
    const completed=data.completed||{};
    const doneCount=countRowingSessions(completed);
    const si=calcStreak(data,sessions);
    const stage=getHabitStage(doneCount);
    const today=new Date();today.setHours(0,0,0,0);
    const oldBest=data.bestStreak||0;
    const isNewBest=si.best>oldBest&&si.best>1;
    if(si.best!==oldBest){data.bestStreak=si.best;saveData(data)}

    let sh='<div class="done-streak"><div class="done-streak-num">'+si.current+'</div><div class="done-streak-label">session streak</div></div>';
    if(isNewBest)sh+='<div class="done-pb">NEW PERSONAL BEST!</div>';
    if(newPowerPB)sh+='<div class="done-pb">⚡ NEW POWER PB: '+ps.peakW+' W</div>';

    /* Session grade from sprint stroke-rate compliance (needs rower data) */
    if(ps&&!timerConfig.steady&&ps.sprintRates&&ps.sprintRates.length){
      const totalSprints=timerConfig.blocks*5;
      const pct=ps.rateHits/totalSprints;
      const g=pct>=.9&&!finishedEarly?'S':pct>=.7?'A':pct>=.5?'B':'C';
      const gLabel={S:'Flawless',A:'Strong',B:'Solid',C:'Keep pushing'}[g];
      sh+='<div class="done-grade g-'+g+'"><span class="g-letter">'+g+'</span>'+
        '<span class="g-detail">'+gLabel+'<br>'+ps.rateHits+' / '+totalSprints+' sprints at 30+ spm</span></div>';
    }

    /* XP earned + level-up + golden session */
    let levelUp=false;
    if(golden)sh+='<div class="done-pb" style="color:var(--gold)">🌟 GOLDEN SESSION! +'+golden+' bonus XP</div>';
    if(xpAfter>xpBefore){
      const li0=levelInfo(xpBefore),li1=levelInfo(xpAfter);
      levelUp=li1.lvl>li0.lvl;
      sh+='<div class="done-xp">+'+(xpAfter-xpBefore)+' XP</div>';
      if(levelUp)sh+='<div class="done-levelup">Level up! LVL '+li1.lvl+' · '+li1.rank+'</div>';
    }
    /* Celebrate every completion; go big on special moments */
    const big=levelUp||newPowerPB||isNewBest||golden>0;
    setTimeout(()=>confettiBurst(big?90:25),400);
    $('#doneStreakArea').innerHTML=sh;

    $('#doneHabitArea').innerHTML='<div class="done-habit">'+
      '<div class="habit-ring '+stage.cls+'">'+stage.ring+'</div>'+
      '<span class="habit-stage '+stage.colorCls+'">'+stage.name+'</span></div>';

    $('#doneNextArea').innerHTML='<div class="done-next">Next: '+getNext(sessions,today,completed)+'</div>';

    /* Performance praise or tip */
    const blocks=timerConfig.blocks||0;
    const sprints=blocks*5;
    const isTipSession=(doneCount%3===0);
    if(isTipSession&&!timerConfig.steady){
      const tipIdx=doneCount%DONE_TIPS.length;
      $('#doneQuoteArea').innerHTML='<div class="done-tip">\uD83D\uDCA1 '+DONE_TIPS[tipIdx]+'</div>';
    } else {
      const praiseIdx=doneCount%DONE_PRAISE.length;
      const praise=DONE_PRAISE[praiseIdx]
        .replace(/\{blocks\}/g,blocks).replace(/\{sprints\}/g,sprints)
        .replace(/\{streak\}/g,si.current).replace(/\{total\}/g,doneCount);
      $('#doneQuoteArea').innerHTML='<div class="done-praise">'+praise+'</div>';
    }

    const milestones=checkMilestones(data,sessions,si);
    if(milestones.length)setTimeout(()=>showMilestones(milestones,data),1200);
  } else {
    $('#doneStreakArea').innerHTML='';
    $('#doneHabitArea').innerHTML='';
    $('#doneNextArea').innerHTML='';
    $('#doneQuoteArea').innerHTML='';
  }

  showScreen('#done');
}
function sRow(l,v){return '<div class="summary-row"><span class="label">'+l+'</span><span class="value">'+v+'</span></div>'}
async function requestWakeLock(){try{if('wakeLock' in navigator)await navigator.wakeLock.request('screen')}catch(e){}}
/* Bluefy proprietary API: control iOS screen auto-dim/sleep. allowDim=false keeps the screen on. */
function setScreenDim(allowDim){
  try{
    if(navigator.bluetooth&&typeof navigator.bluetooth.setScreenDimEnabled==='function')
      navigator.bluetooth.setScreenDimEnabled(allowDim);
  }catch(e){}
}
function tryFullscreen(){
  try{
    if(document.fullscreenElement||document.webkitFullscreenElement)return;
    const el=document.documentElement;
    const p=el.requestFullscreen?el.requestFullscreen():el.webkitRequestFullscreen?el.webkitRequestFullscreen():null;
    if(p&&p.catch)p.catch(()=>{});
  }catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&timerInterval&&!paused)tick()});
$('#pauseBtn').addEventListener('click',()=>{
  if(!paused){wkBank+=Date.now()-wkStart}else{wkStart=Date.now()}
  paused=!paused;$('#pauseBtn').textContent=paused?'RESUME':'PAUSE'});
$('#skipBtn').addEventListener('click',skipPhase);
$('#finishBtn').addEventListener('click',finishEarly);
$('#stopBtn').addEventListener('click',async()=>{
  if(await customConfirm('Stop this session? Nothing will be saved. Use FINISH to keep your progress.'))stopTimer();
});
$('#doneContinueBtn').addEventListener('click',resumeSession);
$('#doneBackBtn').addEventListener('click',()=>{finishedEarly=false;renderSchedule();showScreen('#schedule')});
setNavAbortHook(()=>{clearInterval(timerInterval);timerInterval=null;clearTimeout(cheerTimer)});
export{launchWalkSession,launchSession,launchSteadySession,paused,sequence,stepIdx,timerConfig,timerInterval};
