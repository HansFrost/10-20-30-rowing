import{$,$$}from'./dom.js';
import{PROGRAMS}from'./programs.js';
import{estMinutes}from'./today-banner.js';

/* Onboarding step for Daily Minimum: floor, target, rest, warm-up, cool-down
   and program length. Kept out of onboarding.js so neither file carries two
   responsibilities. */

function pickOne(rowSel,val){
  $$(rowSel+' button').forEach(b=>b.classList.toggle('selected',+b.dataset.val===val));
}
function readOne(rowSel,fallback){
  const b=$(rowSel+' button.selected');
  return b?+b.dataset.val:fallback;
}
function collectDailySetup(){
  const target=readOne('#dailyTargetBtns',2);
  return{
    programWeeks:readOne('#dailyWeeksBtns',12),
    daily:{
      target,
      floor:Math.min(target,readOne('#dailyFloorBtns',1)),
      restSec:readOne('#dailyRestBtns',60),
      warmup:$('#dailyWarmup').checked,
      cooldown:$('#dailyCooldown').checked
    }
  };
}
/* The floor can never exceed the target, so the picker enforces it visibly. */
function syncFloorLimit(){
  const target=readOne('#dailyTargetBtns',2);
  let floor=readOne('#dailyFloorBtns',1);
  $$('#dailyFloorBtns button').forEach(b=>{
    const over=+b.dataset.val>target;
    b.disabled=over;b.style.opacity=over?'.35':'';
  });
  if(floor>target){floor=target;pickOne('#dailyFloorBtns',floor)}
}
function refreshEstimate(){
  syncFloorLimit();
  const c=collectDailySetup().daily;
  const t=estMinutes(c.target,c);
  const f=estMinutes(c.floor,c);
  $('#dailyEstimate').textContent=c.floor===c.target
    ?'About '+t+' min a day.'
    :'About '+t+' min a day, and '+f+' min on the days you only reach the floor.';
}
function showDailySetup(on){
  $('#dailySection').style.display=on?'':'none';
  if(on)refreshEstimate();
}
function initDailySetup(){
  ['#dailyFloorBtns','#dailyTargetBtns','#dailyRestBtns','#dailyWeeksBtns'].forEach(sel=>{
    $$(sel+' button').forEach(b=>b.addEventListener('click',()=>{
      if(b.disabled)return;
      pickOne(sel,+b.dataset.val);
      refreshEstimate();
    }));
  });
  const d=PROGRAMS.daily.defaults;
  $('#dailyWarmup').checked=d.warmup;
  $('#dailyCooldown').checked=d.cooldown;
  $('#dailyWarmup').addEventListener('change',refreshEstimate);
  $('#dailyCooldown').addEventListener('change',refreshEstimate);
}
export{collectDailySetup,initDailySetup,showDailySetup};
