import{$}from'./dom.js';
import{PROGRAMS,buildSchedule,injectExtras,injectWalks}from'./programs.js';
import{loadData}from'./store.js';
import{WEEKDAY_NAMES,fmtDate,fmtTime,parseDate}from'./util.js';

/* Session Log: every completed session of the active program, newest first,
   with an accordion row per session showing all recorded stats. Archived
   programs (data.archive) are out of scope here. */

/* Map key -> scheduled session, so manual check-offs without stats still get
   blocks/minutes for their type tag. Best-effort: falls back to key parsing. */
function scheduleMap(data){
  const map={};
  try{
    const prog=PROGRAMS[data.program];
    if(!prog)return map;
    const startMon=parseDate(data.startDate);
    const sessions=injectWalks(injectExtras(
      buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),
      data,startMon,prog.weeks),data,startMon);
    sessions.forEach(s=>{map[s.key]=s});
  }catch(e){}
  return map;
}

function keyType(key){
  if(key.indexOf('walk-')===0)return 'walk';
  if(/-ss$/.test(key))return 'steady';
  return 'interval';
}
function durationMin(st){
  if(!st)return 0;
  if(st.min)return st.min;
  const tl=st.timeline;
  if(tl&&tl.length)return Math.round(tl[tl.length-1][0]/60);
  return 0;
}
function tagText(type,st,sched){
  if(type==='walk')return 'Walk';
  if(type==='steady'){
    const min=durationMin(st)||(sched&&sched.minutes)||0;
    return min?'Steady '+min+' min':'Steady';
  }
  const blocks=(st&&st.blocks)||(sched&&sched.blocks)||0;
  return blocks?'Rowing '+blocks+' blocks':'Rowing';
}
function headline(type,st){
  if(!st)return '';
  if(type==='walk'&&st.m)return (st.m/1000).toFixed(2)+' km';
  if(st.m)return st.m.toLocaleString()+' m';
  const min=durationMin(st);
  return min?min+' min':'';
}

function dRow(l,v){return '<div class="log-d"><span class="log-dl">'+l+'</span><span class="log-dv">'+v+'</span></div>'}
function detailHtml(st,bonus){
  if(!st){
    return '<div class="log-note">No recorded data (checked off manually)</div>'+
      (bonus?dRow('Golden bonus','+'+bonus+' XP'):'');
  }
  let h='';
  const min=durationMin(st);
  if(min)h+=dRow('Duration',min+' min');
  if(st.walk){
    if(st.m)h+=dRow('Distance',(st.m/1000).toFixed(2)+' km');
    if(st.m>100&&min)h+=dRow('Pace',fmtTime(Math.round(min*60/(st.m/1000)))+' /km');
  }else if(st.m)h+=dRow('Meters',st.m.toLocaleString()+' m');
  if(st.avgW)h+=dRow('Avg power',st.avgW+' W');
  if(st.peakW)h+=dRow('Peak power',st.peakW+' W');
  if(st.bestSprint)h+=dRow('Best sprint',st.bestSprint+' W');
  if(st.strokes)h+=dRow('Strokes',st.strokes.toLocaleString());
  if(st.avgHr)h+=dRow('Avg HR',st.avgHr+' bpm');
  if(st.maxHr)h+=dRow('Max HR',st.maxHr+' bpm');
  if(st.rateHits)h+=dRow('Sprints at 30+ spm',st.rateHits);
  if(bonus)h+=dRow('Golden bonus','+'+bonus+' XP');
  return h;
}

function rowHtml(key,iso,st,bonus,sched){
  const d=new Date(iso);
  const dateTxt=isNaN(d.getTime())?'':WEEKDAY_NAMES[d.getDay()]+' '+fmtDate(d);
  const type=(st&&st.walk)?'walk':(st&&st.steady)?'steady':keyType(key);
  return '<div class="log-row"><button class="log-head" type="button">'+
    '<span class="log-date">'+dateTxt+'</span>'+
    '<span class="log-tag log-tag-'+type+'">'+tagText(type,st,sched)+'</span>'+
    '<span class="log-main">'+headline(type,st)+'</span>'+
    '<span class="log-chev">&#9662;</span></button>'+
    '<div class="log-details">'+detailHtml(st,bonus)+'</div></div>';
}

/* Accordion: one row open at a time; tapping an open row closes it. */
function wireAccordion(el){
  el.querySelectorAll('.log-head').forEach(btn=>btn.addEventListener('click',()=>{
    const row=btn.parentElement,wasOpen=row.classList.contains('open');
    el.querySelectorAll('.log-row.open').forEach(r=>r.classList.remove('open'));
    if(!wasOpen)row.classList.add('open');
  }));
}

function renderSessionLog(){
  const el=$('#sessionLog');
  if(!el)return;
  const data=loadData();
  const completed=(data&&data.completed)||{};
  const keys=Object.keys(completed)
    .sort((a,b)=>new Date(completed[b])-new Date(completed[a]));
  let h='<div class="log-title">Session Log</div>';
  if(!keys.length){
    el.innerHTML=h+'<div class="log-empty">Sessions you complete will appear here with their stats.</div>';
    return;
  }
  const stats=data.sessionStats||{},bonus=data.bonusXP||{};
  const sched=scheduleMap(data);
  h+=keys.map(k=>rowHtml(k,completed[k],stats[k],bonus[k],sched[k])).join('');
  el.innerHTML=h;
  wireAccordion(el);
}

export{renderSessionLog};
