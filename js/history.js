import{$,$$,customConfirm,showOnboardStep,showScreen}from'./dom.js';
import{PROGRAMS,progWeeks,scheduleFor,totalAllSessions}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{addDays,dateStr,fmtDate,parseDate}from'./util.js';

/* ===== Archive data model =====
   data.archive is an array of past-program snapshots stored inside the main
   data blob, so cloud sync, export/import and reset all carry it for free.
   Each entry is the full program data minus its own archive field (archives
   never nest), plus an archivedAt ISO timestamp. */

function snapshot(data){
  const s=Object.assign({},data);
  delete s.archive;
  s.archivedAt=new Date().toISOString();
  return s;
}

/* Returns the archive chain with the given active program appended. */
function archiveCurrent(data){
  const archive=(data&&data.archive)?data.archive.slice():[];
  if(data&&data.program)archive.push(snapshot(data));
  return archive;
}

/* Archives the currently active program (if any) and makes newData active,
   preserving the existing archive chain. */
function activateProgram(newData){
  const current=loadData();
  newData.archive=archiveCurrent(current);
  delete newData.archivedAt;
  saveData(newData);
}

function listHistory(){
  const data=loadData();
  return(data&&data.archive)?data.archive:[];
}

/* Pause: archive the active program and leave no program active, so the user
   lands on program selection with everything preserved. */
function pauseProgram(){
  const data=loadData();
  if(!data||!data.program)return false;
  const snap=snapshot(data);
  snap.pausedAt=snap.archivedAt;
  const archive=(data.archive||[]).slice();
  archive.push(snap);
  saveData({archive});
  return true;
}

/* First week that still has an unfinished rowing session (1 if none is done). */
function firstOpenWeek(entry){
  const completed=entry.completed||{};
  const weeks=progWeeks(entry);
  const sessions=scheduleFor(entry).filter(s=>s.type!=='walk');
  for(let w=1;w<=weeks;w++){
    const ws=sessions.filter(s=>s.week===w);
    if(ws.length&&ws.some(s=>!completed[s.key]))return w;
  }
  return 1;
}
/* A paused program must not resume into a wall of dates that already passed:
   those would read as missed sessions and break the streak. Shifting startDate
   forward moves the first unfinished week onto the current week. Session keys
   are week-based, so every completion record survives the shift. */
function shiftToCurrentWeek(entry){
  if(!entry.startDate)return entry;
  const start=parseDate(entry.startDate);
  const today=new Date();today.setHours(0,0,0,0);
  const dow=today.getDay();
  const thisMon=addDays(today,-(dow===0?6:dow-1));
  const open=firstOpenWeek(entry);
  let newStart=addDays(thisMon,-(open-1)*7);
  if(newStart<=start)return entry;
  /* Resuming late in the week would land that whole week in the past. Move one
     week further out when nothing of it is left, so a resumed program always
     has a session still ahead of it. */
  const probe=Object.assign({},entry,{startDate:dateStr(newStart)});
  const wk=scheduleFor(probe).filter(s=>s.week===open&&s.type!=='walk');
  if(wk.length&&!wk.some(s=>s.date>=today))newStart=addDays(newStart,7);
  const offset=Math.round((newStart-start)/86400000);
  entry.startDate=dateStr(newStart);
  /* Completed extras are history and keep their real dates; only pending ones
     travel with the plan, because shifting a key would orphan its record. */
  if(Array.isArray(entry.extraSessions)){
    const completed=entry.completed||{};
    entry.extraSessions=entry.extraSessions.map(ex=>{
      const key=(ex.type==='walk'?'walk-':'extra-')+ex.date;
      if(completed[key])return ex;
      return Object.assign({},ex,{date:dateStr(addDays(parseDate(ex.date),offset))});
    });
  }
  if(entry.walkStart)entry.walkStart=dateStr(addDays(parseDate(entry.walkStart),offset));
  return entry;
}

/* Swap: the current active program gets archived, the selected archived
   entry becomes active. Nothing is lost. */
function restoreProgram(index){
  const data=loadData();
  if(!data||!data.archive||!data.archive[index])return false;
  const chosen=Object.assign({},data.archive[index]);
  const archive=data.archive.filter((_,i)=>i!==index);
  if(data.program)archive.push(snapshot(data));
  delete chosen.archivedAt;delete chosen.pausedAt;
  shiftToCurrentWeek(chosen);
  chosen.archive=archive;
  saveData(chosen);
  return true;
}

/* ===== History modal UI ===== */
function esc(s){return String(s).replace(/</g,'&lt;')}

function entryStats(e){
  const prog=PROGRAMS[e.program];
  if(!prog||!e.startDate)return null;
  const weeks=progWeeks(e);
  const total=totalAllSessions(e);
  const done=Object.keys(e.completed||{}).length;
  const start=parseDate(e.startDate);
  const end=addDays(start,weeks*7-1);
  return{prog,weeks,total,done,start,end};
}

function entryHtml(e,i){
  const s=entryStats(e);
  if(!s)return'';
  const name=e.programName||s.prog.name;
  return '<div class="history-entry'+(e.pausedAt?' paused':'')+'">'+
    '<div class="history-name">'+esc(name)+(e.pausedAt?' <span class="history-paused">paused</span>':'')+'</div>'+
    '<div class="history-meta">'+
      '<span class="history-badge">'+s.prog.name+' · '+s.weeks+'w</span>'+
      '<span>'+fmtDate(s.start)+' - '+fmtDate(s.end)+'</span>'+
      '<span>'+s.done+' / '+s.total+' sessions</span>'+
    '</div>'+
    '<button class="btn btn-secondary btn-small history-resume" data-restore="'+i+'">Resume</button>'+
  '</div>';
}

function renderHistoryList(){
  const list=$('#historyList');
  const entries=listHistory();
  if(!entries.length){
    list.innerHTML='<p class="history-empty">Programs you finish or replace will appear here.</p>';
    return;
  }
  /* Newest first, but keep the real archive index for restore */
  list.innerHTML=entries.map((e,i)=>({e,i})).reverse().map(x=>entryHtml(x.e,x.i)).join('');
  $$('#historyList [data-restore]').forEach(btn=>{
    btn.addEventListener('click',()=>confirmRestore(+btn.dataset.restore));
  });
}

async function confirmRestore(index){
  const active=!!(loadData()&&loadData().program);
  const msg=active
    ?'Resume this program? Your current program will be moved to Program History. Nothing is lost.'
    :'Resume this program? Its remaining weeks move to this week, so the pause costs you no sessions.';
  if(!await customConfirm(msg))return;
  if(!restoreProgram(index))return;
  $('#historyOverlay').classList.remove('active');
  renderSchedule();showScreen('#schedule');
}

async function confirmPause(){
  if(!await customConfirm('Pause this program? It waits in Program History with your progress intact, '+
    'and when you resume, its remaining weeks move to that week.'))return;
  if(!pauseProgram())return;
  showScreen('#onboarding');showOnboardStep('stepProgram');
}

function openHistoryModal(){
  renderHistoryList();
  $('#historyOverlay').classList.add('active');
}

function initHistory(){
  $('#historyBtn').addEventListener('click',openHistoryModal);
  $('#pauseProgBtn').addEventListener('click',confirmPause);
  $('#historyClose').addEventListener('click',()=>$('#historyOverlay').classList.remove('active'));
  $('#historyOverlay').addEventListener('click',e=>{
    if(e.target===$('#historyOverlay'))$('#historyOverlay').classList.remove('active');
  });
}
export{activateProgram,archiveCurrent,initHistory,listHistory,openHistoryModal,pauseProgram,restoreProgram,shiftToCurrentWeek};
