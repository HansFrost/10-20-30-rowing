import{$}from'./dom.js';
import{pm5}from'./pm5.js';
import{fmtTime}from'./util.js';

/* GPS walk tracking: foreground-only (iOS suspends JS when the screen locks). */
let walkWatch=null,walkMeters=0,lastFix=null;

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
    if(d>1&&d<80)walkMeters+=d;         /* ignore jitter and GPS jumps */
  }
  lastFix=c;
}
function walkStart(){
  walkMeters=0;lastFix=null;
  $('#walkStrip').classList.add('on');
  $('#pmWalkDist').textContent='0.00';$('#pmWalkPace').textContent='-';$('#pmWalkHr').textContent='-';
  if(navigator.geolocation)
    walkWatch=navigator.geolocation.watchPosition(onFix,()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:15000});
}
function walkStop(){
  if(walkWatch!==null&&navigator.geolocation)navigator.geolocation.clearWatch(walkWatch);
  walkWatch=null;
  $('#walkStrip').classList.remove('on');
}
function walkTick(totalEl){
  $('#pmWalkDist').textContent=(walkMeters/1000).toFixed(2);
  $('#pmWalkPace').textContent=walkMeters>100?fmtTime(Math.round(totalEl/(walkMeters/1000))):'-';
  $('#pmWalkHr').textContent=pm5.hr||'-';
}
function walkDistance(){return Math.round(walkMeters)}

export{walkStart,walkStop,walkTick,walkDistance};
