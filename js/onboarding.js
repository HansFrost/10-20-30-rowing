import{$,$$,customConfirm,showOnboardStep,showScreen}from'./dom.js';
import{activateProgram}from'./history.js';
import{DEFAULT_MAX_HR}from'./hr.js';
import{ALL_DAYS,DAY_LABELS,DAY_OFFSET,PROGRAMS}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{loadData}from'./store.js';
import{buildTimeEditor,collectTimeEditor}from'./time-modals.js';
import{addDays,dateStr,parseDate}from'./util.js';
let selectedProg='intermediate';
let selectedNumDays=3;
let selectedDays=['tue','thu','sat'];
let selectedSteady='';

function initOnboarding(){
  /* Program cards */
  $$('.program-card').forEach(c=>{
    c.addEventListener('click',()=>{
      $$('.program-card').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      selectedProg=c.dataset.prog;
    });
  });

  /* Step 1 → Step 2 */
  $('#progNextBtn').addEventListener('click',()=>{
    showOnboardStep('stepDays');
    initDayPicker();
  });

  /* Num days buttons */
  $$('#numDaysBtns button').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('#numDaysBtns button').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      selectedNumDays=parseInt(b.dataset.val);
      const sel=getSelectedIntervalDays();
      if(sel.length>selectedNumDays){
        sel.sort((a,c)=>DAY_OFFSET[a]-DAY_OFFSET[c]);
        sel.slice(selectedNumDays).forEach(d=>{
          const btn=$('#dayPicker .day-btn[data-day="'+d+'"]');if(btn)btn.classList.remove('selected');
        });
      }
      const isAdv=!!PROGRAMS[selectedProg].defaultSteady;
      $('#daysPrompt').textContent=isAdv?'Choose '+selectedNumDays+' interval training days:':'Choose '+selectedNumDays+' training days:';
      updateDayPickerState();
    });
  });

  /* Day picker buttons */
  $$('#dayPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      b.classList.toggle('selected');
      updateDayPickerState();
    });
  });

  /* Walk day buttons: bound once here, NOT in initDayPicker which runs on every
     step-2 entry and would stack toggle listeners (making buttons appear dead) */
  $$('#obWalkPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{b.classList.toggle('selected');obUpdateWalkTimes()});
  });

  /* Step 2 → Step 3 */
  $('#daysNextBtn').addEventListener('click',()=>{
    selectedDays=getSelectedIntervalDays();
    selectedDays.sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
    if(selectedProg==='advanced'){
      const steadyBtn=$('#steadyPicker .day-btn.steady');
      selectedSteady=steadyBtn?steadyBtn.dataset.day:'wed';
    } else {
      selectedSteady='';
    }
    showOnboardStep('stepDate');
    const today=new Date(),dow=today.getDay();
    const nextMon=dow===1?today:addDays(today,(1-dow+7)%7||7);
    $('#dateInput').value=dateStr(nextMon);
  });

  /* Back buttons */
  $('#daysBackBtn').addEventListener('click',()=>history.back());
  $('#dateBackBtn').addEventListener('click',()=>history.back());

  /* START PROGRAM */
  $('#onboardBtn').addEventListener('click',async()=>{
    const v=$('#dateInput').value;if(!v)return;
    const existing=loadData();
    if(existing&&existing.program){
      if(!await customConfirm('Start a new program? Your current one will be moved to Program History.'))return;
    }
    const d=parseDate(v);
    /* Snap to Monday */
    const dow=d.getDay();
    if(dow!==1){const off=dow===0?6:dow-1;d.setDate(d.getDate()-off)}
    const mhr=parseInt($('#maxHrInput').value)||DEFAULT_MAX_HR;
    const defaultTimes=collectTimeEditor('#timesPickerList');
    const anchor=($('#anchorInput').value||'').trim();
    const walkSel=obGetWalkDays();
    const saveObj={
      anchor:anchor||undefined,
      startDate:dateStr(d),program:selectedProg,
      days:selectedDays,
      maxHR:Math.min(230,Math.max(100,mhr)),
      swaps:{},completed:{},
      defaultTimes,sessionTimes:{}
    };
    if(selectedProg==='advanced')saveObj.steadyDay=selectedSteady;
    if(walkSel.length){
      saveObj.walkDays=walkSel;saveObj.walkStart=dateStr(d);
      saveObj.walkTimes=collectTimeEditor('#obWalkTimesList');
    }
    activateProgram(saveObj);
    renderSchedule();showScreen('#schedule');
  });
}

function obGetWalkDays(){
  const days=[];
  $$('#obWalkPicker .day-btn.selected').forEach(b=>days.push(b.dataset.day));
  return days;
}
function obUpdateWalkTimes(){
  const wd=obGetWalkDays().sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
  $('#obWalkTimesWrap').style.display=wd.length?'':'none';
  if(wd.length)buildTimeEditor('#obWalkTimesList',wd,collectTimeEditor('#obWalkTimesList'));
}
function initDayPicker(){
  const prog=PROGRAMS[selectedProg];
  const defaults=prog.defaultDays;
  const isAdv=!!prog.defaultSteady;
  selectedNumDays=prog.defaultNumDays;

  /* Set up num days buttons */
  $$('#numDaysBtns button').forEach(b=>{
    const v=parseInt(b.dataset.val);
    b.style.display=(v>=prog.minDays&&v<=prog.maxDays)?'':'none';
    b.classList.toggle('selected',v===selectedNumDays);
  });
  $('#numDaysLabel').textContent=isAdv?'Interval sessions per week (+ 1 steady):':'Sessions per week:';

  /* Reset all day buttons */
  $$('#dayPicker .day-btn').forEach(b=>{
    b.classList.remove('selected');
  });
  /* Pre-select defaults (up to selectedNumDays) */
  defaults.slice(0,selectedNumDays).forEach(d=>{
    const btn=$('#dayPicker .day-btn[data-day="'+d+'"]');
    if(btn)btn.classList.add('selected');
  });

  if(isAdv){
    $('#daysPrompt').textContent='Choose '+selectedNumDays+' interval training days:';
  } else {
    $('#daysPrompt').textContent='Choose '+selectedNumDays+' training days:';
  }

  $('#steadySection').style.display='none';
  $('#timesSection').style.display='none';
  selectedSteady='';
  updateDayPickerState();
}

function getSelectedIntervalDays(){
  const days=[];
  $$('#dayPicker .day-btn.selected').forEach(b=>days.push(b.dataset.day));
  return days;
}

function updateDayPickerState(){
  const prog=PROGRAMS[selectedProg];
  const needed=selectedNumDays;
  const isAdv=!!prog.defaultSteady;
  const selected=getSelectedIntervalDays();
  const count=selected.length;

  $('#daysCount').textContent=count+' / '+needed+' selected';

  if(isAdv){
    if(count===needed){
      /* Show steady picker */
      $('#steadySection').style.display='';
      buildSteadyPicker(selected);
    } else {
      $('#steadySection').style.display='none';
      selectedSteady='';
    }
    /* NEXT enabled when interval days correct AND steady selected */
    const steadyBtn=$('#steadyPicker .day-btn.steady');
    const ready=count===needed&&steadyBtn;
    $('#daysNextBtn').disabled=!ready;
    if(ready){
      const allDays=selected.slice().sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
      if(selectedSteady)allDays.push(selectedSteady);
      allDays.sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
      $('#timesSection').style.display='';buildTimeEditor('#timesPickerList',allDays,collectTimeEditor('#timesPickerList'),'07:00');
    } else {$('#timesSection').style.display='none'}
  } else {
    $('#steadySection').style.display='none';
    const ready=count===needed;
    $('#daysNextBtn').disabled=!ready;
    if(ready){
      const allDays=selected.slice().sort((a,b)=>DAY_OFFSET[a]-DAY_OFFSET[b]);
      $('#timesSection').style.display='';buildTimeEditor('#timesPickerList',allDays,collectTimeEditor('#timesPickerList'),'07:00');
    } else {$('#timesSection').style.display='none'}
  }
}

function buildSteadyPicker(intervalDays){
  const available=ALL_DAYS.filter(d=>!intervalDays.includes(d));
  let html='';
  available.forEach(d=>{
    const cls=d===selectedSteady?'day-btn steady':'day-btn';
    html+='<button class="'+cls+'" data-day="'+d+'">'+DAY_LABELS[d]+'</button>';
  });
  $('#steadyPicker').innerHTML=html;
  $$('#steadyPicker .day-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('#steadyPicker .day-btn').forEach(x=>x.classList.remove('steady'));
      b.classList.add('steady');
      selectedSteady=b.dataset.day;
      updateDayPickerState();
    });
  });
}
export{initOnboarding};
