import{$,$$,customConfirm}from'./dom.js';
import{buildTimeEditor,collectTimeEditor}from'./time-modals.js';
import{ALL_DAYS,DAY_LABELS,DAY_OFFSET,PROGRAMS,buildSchedule,injectExtras}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{addDays,dateStr,parseDate}from'./util.js';
let cdNumDays=3,cdSteady='';

function cdGetSelected(){
  const days=[];
  $$('#cdDayPicker .day-btn.selected').forEach(b=>days.push(b.dataset.day));
  return days;
}

function cdUpdateState(){
  const data=loadData();if(!data)return;
  const prog=PROGRAMS[data.program||'intermediate'];
  const isAdv=!!prog.defaultSteady;
  const selected=cdGetSelected();
  const count=selected.length;

  $('#cdDaysCount').textContent=count+' / '+cdNumDays+' selected';

  /* Disable day buttons when at limit */
  $$('#cdDayPicker .day-btn').forEach(b=>{
    if(!b.classList.contains('selected')&&count>=cdNumDays)b.style.opacity='.35';
    else b.style.opacity='';
  });

  if(isAdv){
    if(count===cdNumDays){
      $('#cdSteadySection').style.display='';
      cdBuildSteadyPicker(selected);
    } else {
      $('#cdSteadySection').style.display='none';
      cdSteady='';
    }
    const steadyBtn=$('#cdSteadyPicker .day-btn.steady');
    $('#changeDaysSave').disabled=!(count===cdNumDays&&steadyBtn);
  } else {
    $('#cdSteadySection').style.display='none';
    $('#changeDaysSave').disabled=count!==cdNumDays;
  }
  cdUpdateTimesSection(data,selected);
}
function cdUpdateTimesSection(data,selected){
  const ok=!$('#changeDaysSave').disabled;
  $('#cdTimesSection').style.display=ok?'':'none';
  if(!ok)return;
  const allDays=selected.slice();
  if(cdSteady&&!allDays.includes(cdSteady))allDays.push(cdSteady);
  allDays.sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
  const prev=Object.assign({},data.defaultTimes||{},collectTimeEditor('#cdTimesList'));
  buildTimeEditor('#cdTimesList',allDays,prev);
}

function cdBuildSteadyPicker(intervalDays){
  const available=ALL_DAYS.filter(d=>!intervalDays.includes(d));
  let html='';
  available.forEach(d=>{
    const cls=d===cdSteady?'day-btn steady':'day-btn';
    html+='<button class="'+cls+'" data-day="'+d+'">'+DAY_LABELS[d]+'</button>';
  });
  $('#cdSteadyPicker').innerHTML=html;
  $$('#cdSteadyPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('#cdSteadyPicker .day-btn').forEach(x=>x.classList.remove('steady'));
      b.classList.add('steady');
      cdSteady=b.dataset.day;
      cdUpdateState();
    });
  });
}

function cdGetWalkDays(){
  const days=[];
  $$('#cdWalkPicker .day-btn.selected').forEach(b=>days.push(b.dataset.day));
  return days;
}
function openChangeDaysModal(){
  const data=loadData();if(!data)return;
  const prog=PROGRAMS[data.program||'intermediate'];
  const isAdv=!!prog.defaultSteady;
  const currentDays=data.days||[];
  cdNumDays=currentDays.length;
  cdSteady=data.steadyDay||'';

  /* Num days buttons */
  $$('#cdNumDaysBtns button').forEach(b=>{
    const v=parseInt(b.dataset.val);
    b.style.display=(v>=prog.minDays&&v<=prog.maxDays)?'':'none';
    b.classList.toggle('selected',v===cdNumDays);
  });

  /* Prompt text */
  $('#cdDaysPrompt').textContent=isAdv?'Choose '+cdNumDays+' interval training days:':'Choose '+cdNumDays+' training days:';

  /* Day picker: pre-select current days */
  $$('#cdDayPicker .day-btn').forEach(b=>{
    b.classList.toggle('selected',currentDays.includes(b.dataset.day));
  });
  const walkDays=data.walkDays||[];
  $$('#cdWalkPicker .day-btn').forEach(b=>{
    b.classList.toggle('selected',walkDays.includes(b.dataset.day));
  });
  $('#cdWalkTimesList').innerHTML='';
  cdUpdateWalkTimes(data);

  cdUpdateState();
  $('#changeDaysOverlay').classList.add('active');
}

/* Num days buttons */
$$('#cdNumDaysBtns button').forEach(b=>{
  b.addEventListener('click',()=>{
    const data=loadData();if(!data)return;
    const prog=PROGRAMS[data.program||'intermediate'];
    const isAdv=!!prog.defaultSteady;
    $$('#cdNumDaysBtns button').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    cdNumDays=parseInt(b.dataset.val);
    /* Trim excess selected days */
    const sel=cdGetSelected();
    if(sel.length>cdNumDays){
      sel.sort((a,c)=>DAY_OFFSET[a]-DAY_OFFSET[c]);
      sel.slice(cdNumDays).forEach(d=>{
        const btn=$('#cdDayPicker .day-btn[data-day="'+d+'"]');
        if(btn)btn.classList.remove('selected');
      });
    }
    $('#cdDaysPrompt').textContent=isAdv?'Choose '+cdNumDays+' interval training days:':'Choose '+cdNumDays+' training days:';
    cdUpdateState();
  });
});

/* Day picker toggle */
$$('#cdDayPicker .day-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    const sel=cdGetSelected();
    if(b.classList.contains('selected')){
      b.classList.remove('selected');
    } else if(sel.length<cdNumDays){
      b.classList.add('selected');
    }
    cdUpdateState();
  });
});

/* Save */
function cdUpdateWalkTimes(data){
  const wd=cdGetWalkDays().sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
  $('#cdWalkTimesWrap').style.display=wd.length?'':'none';
  if(wd.length){
    const prev=Object.assign({},(data||loadData()||{}).walkTimes||{},collectTimeEditor('#cdWalkTimesList'));
    buildTimeEditor('#cdWalkTimesList',wd,prev);
  }
}
$$('#cdWalkPicker .day-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    b.classList.toggle('selected');
    cdUpdateState();
    cdUpdateWalkTimes();
  });
});
$('#changeDaysSave').addEventListener('click',()=>{
  const data=loadData();if(!data)return;
  const prog=PROGRAMS[data.program||'intermediate'];
  const isAdv=!!prog.defaultSteady;
  const oldDays=(data.days||[]).slice();
  const newDays=cdGetSelected().sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
  const newSteady=isAdv?cdSteady:'';

  /* Build positional mapping old→new */
  const dayMap={};
  for(let i=0;i<Math.min(oldDays.length,newDays.length);i++){
    if(oldDays[i]!==newDays[i])dayMap[oldDays[i]]=newDays[i];
  }
  /* Map old steady→new steady */
  if(isAdv&&data.steadyDay&&newSteady&&data.steadyDay!==newSteady){
    dayMap[data.steadyDay]=newSteady;
  }

  /* Remap a session key like "1-tue" using the dayMap */
  function remapKey(key){
    for(const old in dayMap){
      /* Match "-oldDay" at end, or "-oldDay-ss" for steady keys */
      if(key.endsWith('-'+old))return key.slice(0,-(old.length))+dayMap[old];
      if(key.endsWith('-'+old+'-ss'))return key.slice(0,-(old.length+3))+dayMap[old]+'-ss';
    }
    return key;
  }

  /* Remap completed */
  if(data.completed){
    const nc={};
    for(const k in data.completed)nc[remapKey(k)]=data.completed[k];
    data.completed=nc;
  }
  /* Remap swaps */
  if(data.swaps){
    const ns={};
    for(const k in data.swaps)ns[remapKey(k)]=data.swaps[k];
    data.swaps=ns;
  }
  /* Remap sessionTimes */
  if(data.sessionTimes){
    const nt={};
    for(const k in data.sessionTimes)nt[remapKey(k)]=data.sessionTimes[k];
    data.sessionTimes=nt;
  }
  /* Remap defaultTimes */
  if(data.defaultTimes){
    const nd={};
    for(const d in data.defaultTimes){
      nd[dayMap[d]||d]=data.defaultTimes[d];
    }
    data.defaultTimes=nd;
  }

  /* Remove data for days that no longer exist (if day count reduced) */
  if(newDays.length<oldDays.length){
    const orphanDays=oldDays.slice(newDays.length);
    orphanDays.forEach(od=>{
      if(data.defaultTimes)delete data.defaultTimes[od];
    });
  }

  data.days=newDays;
  if(isAdv)data.steadyDay=newSteady;
  const walkSel=cdGetWalkDays();
  if(walkSel.length){
    data.walkDays=walkSel;
    data.walkTimes=collectTimeEditor('#cdWalkTimesList');
    if(!data.walkStart)data.walkStart=dateStr(new Date());
  }else{
    delete data.walkDays;delete data.walkStart;delete data.walkTimes;
  }
  data.defaultTimes=collectTimeEditor('#cdTimesList');
  saveData(data);
  $('#changeDaysOverlay').classList.remove('active');
  renderSchedule();
});

/* Cancel / close */
$('#changeDaysCancel').addEventListener('click',()=>{$('#changeDaysOverlay').classList.remove('active')});
$('#changeDaysOverlay').addEventListener('click',e=>{
  if(e.target===e.currentTarget)$('#changeDaysOverlay').classList.remove('active');
});
$('#changeDaysBtn').addEventListener('click',openChangeDaysModal);

let swapTarget=null;

function openSwapModal(key,week,defaultDay,currentDay,isExtra){
  swapTarget={key,week,defaultDay,currentDay,isExtra:!!isExtra};
  $('#swapTitle').textContent='Move Week '+week+' '+DAY_LABELS[currentDay]+' to:';
  $$('#swapDayPicker .day-btn').forEach(b=>{
    b.classList.toggle('selected',b.dataset.day===currentDay);
  });
  const resetBtn=$('#swapReset');
  if(isExtra){
    resetBtn.style.display='none';
  } else {
    resetBtn.textContent='Reset to default';
    resetBtn.style.display=(currentDay!==defaultDay)?'':'none';
    resetBtn.style.color='';
  }
  $('#swapOverlay').classList.add('active');
}

function initSwapModal(){
  $$('#swapDayPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      if(!swapTarget)return;
      const newDay=b.dataset.day;
      const data=loadData();if(!data)return;
      if(swapTarget.isExtra){
        /* Extra session: update the date in extraSessions */
        const oldDate=swapTarget.key.replace('extra-','');
        const ex=(data.extraSessions||[]).find(e=>e.date===oldDate);
        if(!ex){$('#swapOverlay').classList.remove('active');swapTarget=null;return}
        const startMon=parseDate(data.startDate);
        const weekMon=addDays(startMon,(+swapTarget.week-1)*7);
        const newDate=dateStr(addDays(weekMon,DAY_OFFSET[newDay]));
        /* Move completion & time if they exist */
        const oldKey=swapTarget.key,newKey='extra-'+newDate;
        ex.date=newDate;
        if(data.completed[oldKey]){data.completed[newKey]=data.completed[oldKey];delete data.completed[oldKey]}
        if(data.sessionTimes&&data.sessionTimes[oldKey]){data.sessionTimes[newKey]=data.sessionTimes[oldKey];delete data.sessionTimes[oldKey]}
      } else {
        if(!data.swaps)data.swaps={};
        if(newDay===swapTarget.defaultDay) delete data.swaps[swapTarget.key];
        else data.swaps[swapTarget.key]=newDay;
      }
      saveData(data);
      $('#swapOverlay').classList.remove('active');
      swapTarget=null;
      renderSchedule();
    });
  });
  $('#swapCancel').addEventListener('click',()=>{
    $('#swapOverlay').classList.remove('active');swapTarget=null;
  });
  $('#swapReset').addEventListener('click',()=>{
    if(!swapTarget)return;
    const data=loadData();if(!data)return;
    if(data.swaps)delete data.swaps[swapTarget.key];
    saveData(data);
    $('#swapOverlay').classList.remove('active');
    swapTarget=null;
    renderSchedule();
  });
}

/* ===== ADD / DELETE EXTRA SESSIONS ===== */
async function deleteExtraSession(key){
  if(!await customConfirm('Remove this extra session?'))return;
  const data=loadData();if(!data)return;
  const ds=key.replace('extra-','');
  data.extraSessions=(data.extraSessions||[]).filter(e=>e.date!==ds);
  delete data.completed[key];
  if(data.sessionTimes)delete data.sessionTimes[key];
  saveData(data);
  renderSchedule();
}
let addSessionTarget=null;
function openAddSessionModal(week){
  addSessionTarget={week};
  const data=loadData();if(!data)return;
  const prog=PROGRAMS[data.program];
  const startMon=parseDate(data.startDate);
  const weekMon=addDays(startMon,(week-1)*7);
  $('#addSessionTitle').textContent='Add session to Week '+week;
  const sessions=injectExtras(buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks);
  const weekSessions=sessions.filter(s=>s.week===week);
  $$('#addSessionDayPicker .day-btn').forEach(b=>{
    b.classList.remove('taken','selected');
  });
  const weekBlocks=weekSessions.filter(s=>s.type==='interval').map(s=>s.blocks);
  const defaultBlocks=weekBlocks.length?weekBlocks[0]:3;
  $$('#addSessionBlockPicker .block-btn').forEach(b=>{
    b.classList.toggle('selected',+b.dataset.blocks===defaultBlocks);
  });
  $('#addSessionTime').value='';
  addSessionTarget.weekMon=weekMon;
  addSessionTarget.selectedDay=null;
  addSessionTarget.selectedBlocks=defaultBlocks;
  $('#addSessionSave').disabled=true;
  $('#addSessionOverlay').classList.add('active');
}
function initAddSessionModal(){
  $$('#addSessionDayPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      if(b.classList.contains('taken'))return;
      $$('#addSessionDayPicker .day-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      if(addSessionTarget)addSessionTarget.selectedDay=b.dataset.day;
      $('#addSessionSave').disabled=false;
    });
  });
  $$('#addSessionBlockPicker .block-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('#addSessionBlockPicker .block-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      if(addSessionTarget)addSessionTarget.selectedBlocks=+b.dataset.blocks;
    });
  });
  $('#addSessionSave').addEventListener('click',()=>{
    if(!addSessionTarget||!addSessionTarget.selectedDay)return;
    const data=loadData();if(!data)return;
    if(!data.extraSessions)data.extraSessions=[];
    const d=addDays(addSessionTarget.weekMon,DAY_OFFSET[addSessionTarget.selectedDay]);
    const dk=dateStr(d);
    if(data.extraSessions.find(e=>e.date===dk))return;
    data.extraSessions.push({date:dk,blocks:addSessionTarget.selectedBlocks});
    const timeVal=$('#addSessionTime').value;
    if(timeVal){
      if(!data.sessionTimes)data.sessionTimes={};
      data.sessionTimes['extra-'+dk]=timeVal;
    }
    saveData(data);
    $('#addSessionOverlay').classList.remove('active');
    addSessionTarget=null;
    renderSchedule();
  });
  $('#addSessionCancel').addEventListener('click',()=>{
    $('#addSessionOverlay').classList.remove('active');addSessionTarget=null;
  });
  $('#addSessionOverlay').addEventListener('click',e=>{
    if(e.target===e.currentTarget){$('#addSessionOverlay').classList.remove('active');addSessionTarget=null}
  });
}
export{deleteExtraSession,initAddSessionModal,initSwapModal,openAddSessionModal,openSwapModal};
