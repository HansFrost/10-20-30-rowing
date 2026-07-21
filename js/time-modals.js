import{$,$$}from'./dom.js';
import{DAY_LABELS,DAY_OFFSET,getEffectiveTime,goalTime}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData,saveData}from'./store.js';
import{fmtDate,dateStr}from'./util.js';
let timeTarget=null;
function openTimeModal(key,day,sess,prog){
  const data=loadData();
  timeTarget={key,day,sess,prog};
  const effective=getEffectiveTime(data,key,day,sess.date);
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
  let days=(data.days||[]).slice();
  if(data.steadyDay&&!days.includes(data.steadyDay))days.push(data.steadyDay);
  days.sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
  buildTimeEditor('#defTimesList',days,data.defaultTimes||{});
  const g=data.timeGoal||{};
  $('#goalTimeInput').value=g.target||'';
  $('#goalStepSel').value=String(g.step||15);
  goalPreview(data);
  $('#defTimesOverlay').classList.add('active');
}
function goalPreview(data){
  const el=$('#goalPreview');
  const cur=goalTime(data,new Date());
  el.textContent=(data.timeGoal&&cur)?('This week: '+cur+' \u00b7 shifting '+data.timeGoal.step+' min/week toward '+data.timeGoal.target):'';
}
$('#defTimesBtn').addEventListener('click',openDefTimesModal);
$('#defTimesSave').addEventListener('click',()=>{
  const data=loadData();if(!data)return;
  data.defaultTimes=collectTimeEditor('#defTimesList');
  const target=$('#goalTimeInput').value;
  if(target){
    const times=Object.values(data.defaultTimes);
    const from=goalTime(data,new Date())||times[0]||'07:00';
    data.timeGoal={target:target,step:+$('#goalStepSel').value||15,from:from,startDate:dateStr(new Date())};
  }else{
    delete data.timeGoal;
  }
  saveData(data);
  $('#defTimesOverlay').classList.remove('active');
  renderSchedule();
});
$('#defTimesCancel').addEventListener('click',()=>{$('#defTimesOverlay').classList.remove('active')});
$('#defTimesOverlay').addEventListener('click',e=>{
  if(e.target===e.currentTarget)$('#defTimesOverlay').classList.remove('active');
});

/* ===== SHARED TIME EDITOR (same time for all days, or per day) ===== */
function buildTimeEditor(sel,days,existing,fallback){
  const box=$(sel),ex=existing||{};
  const uniq=[...new Set(days.map(d=>ex[d]||'').filter(Boolean))];
  const mode=uniq.length>1?'perday':'same';
  box.dataset.days=days.join(',');
  box.dataset.fallback=fallback||'';
  box.innerHTML='<div class="btn-row time-mode-row">'+
    '<button type="button" data-temode="same"'+(mode==='same'?' class="selected"':'')+'>Same for all</button>'+
    '<button type="button" data-temode="perday"'+(mode==='perday'?' class="selected"':'')+'>Per day</button>'+
    '</div><div class="te-rows"></div>';
  teRenderRows(box,mode,ex);
  box.querySelectorAll('[data-temode]').forEach(b=>b.addEventListener('click',()=>{
    const cur=collectTimeEditor(sel);
    box.querySelectorAll('[data-temode]').forEach(x=>x.classList.toggle('selected',x===b));
    teRenderRows(box,b.dataset.temode,cur);
  }));
}
function teRenderRows(box,mode,ex){
  const days=box.dataset.days?box.dataset.days.split(','):[];
  const fb=box.dataset.fallback||'';
  const rows=box.querySelector('.te-rows');
  if(mode==='same'){
    const v=days.map(d=>ex[d]||'').find(Boolean)||fb;
    rows.innerHTML='<div class="time-pick-row"><span class="time-pick-day">All days</span>'+
      '<input type="time" class="time-pick-input te-input" data-day="*" value="'+v+'"></div>';
  }else{
    rows.innerHTML=days.map(d=>'<div class="time-pick-row"><span class="time-pick-day">'+DAY_LABELS[d]+'</span>'+
      '<input type="time" class="time-pick-input te-input" data-day="'+d+'" value="'+(ex[d]||fb)+'"></div>').join('');
  }
}
function collectTimeEditor(sel){
  const box=$(sel);if(!box||!box.dataset.days)return{};
  const days=box.dataset.days.split(','),out={};
  const all=box.querySelector('.te-input[data-day="*"]');
  if(all){if(all.value)days.forEach(d=>out[d]=all.value);return out}
  box.querySelectorAll('.te-input').forEach(inp=>{if(inp.value)out[inp.dataset.day]=inp.value});
  return out;
}
export{buildTimeEditor,collectTimeEditor,initTimeModal,openTimeModal};
