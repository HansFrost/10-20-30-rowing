import{$,$$,customConfirm,showScreen}from'./dom.js';
import{PROGRAMS,totalAllSessions}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{addDays,fmtDate,parseDate}from'./util.js';

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

/* Swap: the current active program gets archived, the selected archived
   entry becomes active. Nothing is lost. */
function restoreProgram(index){
  const data=loadData();
  if(!data||!data.archive||!data.archive[index])return false;
  const chosen=Object.assign({},data.archive[index]);
  const archive=data.archive.filter((_,i)=>i!==index);
  if(data.program)archive.push(snapshot(data));
  delete chosen.archivedAt;
  chosen.archive=archive;
  saveData(chosen);
  return true;
}

/* ===== History modal UI ===== */
function esc(s){return String(s).replace(/</g,'&lt;')}

function entryStats(e){
  const prog=PROGRAMS[e.program];
  if(!prog||!e.startDate)return null;
  const numDays=(e.days&&e.days.length)||prog.defaultNumDays;
  const total=totalAllSessions(e.program,numDays,(e.extraSessions||[]).length);
  const done=Object.keys(e.completed||{}).length;
  const start=parseDate(e.startDate);
  const end=addDays(start,prog.weeks*7-1);
  return{prog,total,done,start,end};
}

function entryHtml(e,i){
  const s=entryStats(e);
  if(!s)return'';
  const name=e.programName||s.prog.name;
  return '<div class="history-entry">'+
    '<div class="history-name">'+esc(name)+'</div>'+
    '<div class="history-meta">'+
      '<span class="history-badge">'+s.prog.name+' · '+s.prog.weeks+'w</span>'+
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
  if(!await customConfirm('Resume this program? Your current program will be moved to Program History. Nothing is lost.'))return;
  if(!restoreProgram(index))return;
  $('#historyOverlay').classList.remove('active');
  renderSchedule();showScreen('#schedule');
}

function openHistoryModal(){
  renderHistoryList();
  $('#historyOverlay').classList.add('active');
}

function initHistory(){
  $('#historyBtn').addEventListener('click',openHistoryModal);
  $('#historyClose').addEventListener('click',()=>$('#historyOverlay').classList.remove('active'));
  $('#historyOverlay').addEventListener('click',e=>{
    if(e.target===$('#historyOverlay'))$('#historyOverlay').classList.remove('active');
  });
}
export{activateProgram,archiveCurrent,initHistory,listHistory,openHistoryModal,restoreProgram};
