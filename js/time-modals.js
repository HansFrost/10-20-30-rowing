import{$,$$}from'./dom.js';
import{DAY_LABELS,getEffectiveTime}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{fmtDate}from'./util.js';
let timeTarget=null;
function openTimeModal(key,day,sess,prog){
  const data=loadData();
  timeTarget={key,day,sess,prog};
  const effective=getEffectiveTime(data,key,day);
  $('#timeTitle').textContent='Set time for '+sess.day+' '+fmtDate(sess.date);
  const inp=$('#timeModalInput');
  inp.value=effective||'07:00';
  $('#timeOverlay').classList.add('active');
}
function initTimeModal(){
  $('#timeSave').addEventListener('click',()=>{
    if(!timeTarget)return;
    const data=loadData();if(!data)return;
    const v=$('#timeModalInput').value;
    if(!data.sessionTimes)data.sessionTimes={};
    if(v){data.sessionTimes[timeTarget.key]=v}
    else{delete data.sessionTimes[timeTarget.key]}
    saveData(data);
    $('#timeOverlay').classList.remove('active');
    timeTarget=null;renderSchedule();
  });
  $('#timeClear').addEventListener('click',()=>{
    if(!timeTarget)return;
    const data=loadData();if(!data)return;
    if(!data.sessionTimes)data.sessionTimes={};
    delete data.sessionTimes[timeTarget.key];
    saveData(data);
    $('#timeOverlay').classList.remove('active');
    timeTarget=null;renderSchedule();
  });
  $('#timeCancel').addEventListener('click',()=>{
    $('#timeOverlay').classList.remove('active');
    timeTarget=null;
  });
  $('#timeOverlay').addEventListener('click',e=>{
    if(e.target===e.currentTarget){$('#timeOverlay').classList.remove('active');timeTarget=null}
  });
}

function openDefTimesModal(){
  const data=loadData();if(!data)return;
  const days=data.days||[];
  const dt=data.defaultTimes||{};
  let html='';
  days.forEach(d=>{
    html+='<div class="time-pick-row"><span class="time-pick-day">'+DAY_LABELS[d]+'</span>'+
      '<input type="time" class="dt-input" data-day="'+d+'" value="'+(dt[d]||'')+'"></div>';
  });
  $('#defTimesList').innerHTML=html;
  $('#defTimesOverlay').classList.add('active');
}
$('#defTimesBtn').addEventListener('click',openDefTimesModal);
$('#defTimesSave').addEventListener('click',()=>{
  const data=loadData();if(!data)return;
  if(!data.defaultTimes)data.defaultTimes={};
  $$('.dt-input').forEach(inp=>{
    if(inp.value)data.defaultTimes[inp.dataset.day]=inp.value;
    else delete data.defaultTimes[inp.dataset.day];
  });
  saveData(data);
  $('#defTimesOverlay').classList.remove('active');
  renderSchedule();
});
$('#defTimesCancel').addEventListener('click',()=>{$('#defTimesOverlay').classList.remove('active')});
$('#defTimesOverlay').addEventListener('click',e=>{
  if(e.target===e.currentTarget)$('#defTimesOverlay').classList.remove('active');
});

/* ===== CHANGE DAYS MODAL ===== */
function buildTimePickers(days){
  let html='';
  days.forEach(d=>{
    html+='<div class="time-pick-row"><span class="time-pick-day">'+DAY_LABELS[d]+'</span>'+
      '<input type="time" class="time-pick-input" data-day="'+d+'" value="07:00"></div>';
  });
  $('#timesPickerList').innerHTML=html;
}

/* ===== SWAP MODAL ===== */
export{buildTimePickers,initTimeModal,openTimeModal};
