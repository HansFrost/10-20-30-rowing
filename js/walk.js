import{$}from'./dom.js';
import{pm5}from'./pm5.js';
import{fmtTime}from'./util.js';

/* GPS walk tracking: foreground-only (iOS suspends JS when the screen locks). */
let walkWatch=null,walkMeters=0,lastFix=null;
let walkGapMs=0,walkHiddenAt=null,bridgeGapSec=0,walkEstMeters=0;

const HINT_DEFAULT='🔒 Keep the screen on: distance tracking pauses while the phone is locked.';
function walkHintUi(){
  const el=$('#walkHint');
  const warned=walkGapMs>5000;
  el.classList.toggle('warn',warned);
  el.textContent=warned
    ?'⚠ Screen was off for '+fmtTime(Math.round(walkGapMs/1000))+'. '+(walkEstMeters>1?Math.round(walkEstMeters)+' m estimated from straight-line distance.':'Distance in that stretch is estimated when GPS returns.')
    :HINT_DEFAULT;
}
document.addEventListener('visibilitychange',()=>{
  if(!$('#walkHint').classList.contains('on'))return; /* only while a walk runs */
  if(document.hidden){walkHiddenAt=Date.now();return}
  if(walkHiddenAt){
    const gap=Date.now()-walkHiddenAt;
    walkGapMs+=gap;walkHiddenAt=null;
    bridgeGapSec+=gap/1000; /* next good fix bridges this stretch */
    walkHintUi();
  }
});

function hav(a,b){
  const R=6371000,rad=x=>x*Math.PI/180;
  const dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
function onFix(p){
  const c=p.coords;
  if(c.accuracy>40)return;              /* ignore poor fixes */
  if(lastFix){
    const d=hav(lastFix,c);
    if(bridgeGapSec>10){
      /* screen was off: credit the straight-line distance, capped at walking speed */
      const est=Math.min(d,1.8*bridgeGapSec);
      if(est>1){walkMeters+=est;walkEstMeters+=est}
      bridgeGapSec=0;
      walkHintUi();
    } else if(d>1&&d<80)walkMeters+=d;  /* ignore jitter and GPS jumps */
  }
  lastFix=c;
}
function walkStart(){
  walkMeters=0;lastFix=null;
  walkGapMs=0;walkHiddenAt=null;bridgeGapSec=0;walkEstMeters=0;
  $('#walkStrip').classList.add('on');
  $('#walkHint').classList.add('on');
  walkHintUi();
  $('#pmWalkDist').textContent='0.00';$('#pmWalkPace').textContent='-';$('#pmWalkHr').textContent='-';
  if(navigator.geolocation)
    walkWatch=navigator.geolocation.watchPosition(onFix,()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
}
function walkStop(){
  if(walkWatch!==null&&navigator.geolocation)navigator.geolocation.clearWatch(walkWatch);
  walkWatch=null;
  $('#walkStrip').classList.remove('on');
  $('#walkHint').classList.remove('on','warn');
}
function walkTick(totalEl){
  $('#pmWalkDist').textContent=(walkMeters/1000).toFixed(2);
  $('#pmWalkPace').textContent=walkMeters>100?fmtTime(Math.round(totalEl/(walkMeters/1000))):'-';
  $('#pmWalkHr').textContent=pm5.hr||'-';
}
function walkDistance(){return Math.round(walkMeters)}

export{walkStart,walkStop,walkTick,walkDistance};
