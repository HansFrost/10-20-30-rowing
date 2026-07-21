import{$,customAlert}from'./dom.js';
import{loadData}from'./store.js';
import{paused,sequence,stepIdx,timerConfig,timerInterval}from'./timer.js';
const PM5_SVC='ce060030-43e5-11e4-916c-0800200c9a66';
const PM5_CH_STATUS='ce060031-43e5-11e4-916c-0800200c9a66';
const PM5_CH_STATUS1='ce060032-43e5-11e4-916c-0800200c9a66';
const PM5_CH_STROKE='ce060036-43e5-11e4-916c-0800200c9a66';
const RATE_BANDS={low:[16,20],moderate:[22,26],high:[30,99],warmup:[18,20],cooldown:[18,20],steady:[20,24]};
const pm5={device:null,connected:false,manualOff:false,watts:0,spm:0,hr:0,lastDist:null,lastStrokes:null};
let pm5Stats=null;

function pm5u24(dv,o){return dv.getUint8(o)|dv.getUint8(o+1)<<8|dv.getUint8(o+2)<<16}
function pm5NewStats(){return{meters:0,strokes:0,wSum:0,wN:0,peakW:0,sprintPeaks:[],curSprint:0,
  curSprintSpm:0,sprintRates:[],rateHits:0,hrSum:0,hrN:0,hrMax:0,timeline:[],lastSample:-5}}
let ghost=null; /* {timeline:[[sec,m],...], m, idx} best comparable previous session */
function pm5Sampling(){return pm5.connected&&pm5Stats&&timerInterval&&!paused}

function pm5OnStatus(e){
  const d=pm5u24(e.target.value,3)/10;
  if(pm5.lastDist!==null&&pm5Sampling()){
    const delta=d-pm5.lastDist;
    pm5Stats.meters+=delta>=0?delta:d; /* monitor reset mid-session: count from 0 */
  }
  pm5.lastDist=d;
  pm5UpdateStrip();
}
function pm5OnStatus1(e){
  const dv=e.target.value,hr=dv.getUint8(6);
  pm5.spm=dv.getUint8(5);
  const hv=(hr===0||hr===255)?0:hr;
  if(hv)pm5.hr=hv; /* keep BLE-strap value when the PM5 has no belt */
  if(pm5Sampling()){
    if(pm5.hr){pm5Stats.hrSum+=pm5.hr;pm5Stats.hrN++;if(pm5.hr>pm5Stats.hrMax)pm5Stats.hrMax=pm5.hr}
    const t=sequence[stepIdx]&&sequence[stepIdx].type;
    if(t==='high'&&pm5.spm>pm5Stats.curSprintSpm)pm5Stats.curSprintSpm=pm5.spm;
  }
  pm5UpdateStrip();
}
function pm5OnStroke(e){
  const dv=e.target.value,w=dv.getUint16(3,true),sc=dv.getUint16(7,true);
  pm5.watts=w;
  if(pm5.lastStrokes!==null&&pm5Sampling()){
    const ds=sc-pm5.lastStrokes;
    pm5Stats.strokes+=ds>=0?ds:sc;
  }
  pm5.lastStrokes=sc;
  if(pm5Sampling()&&w>0){
    pm5Stats.wSum+=w;pm5Stats.wN++;
    if(w>pm5Stats.peakW)pm5Stats.peakW=w;
    const t=sequence[stepIdx]&&sequence[stepIdx].type;
    if(t==='high'&&w>pm5Stats.curSprint)pm5Stats.curSprint=w;
  }
  pm5UpdateStrip();
}

function pm5UpdateStrip(){
  if(!pm5.connected)return;
  $('#pmWatts').textContent=pm5.watts||'-';
  $('#pmRate').textContent=pm5.spm||'-';
  $('#pmDist').textContent=pm5Stats?String(Math.round(pm5Stats.meters)):'-';
  $('#pmHr').textContent=pm5.hr||'-';
  $('#pm5Live').textContent=pm5.watts?(pm5.watts+' W · '+(pm5.spm||0)+' spm'):'connected';
  const s=sequence[stepIdx],band=s&&RATE_BANDS[s.type];
  $('#pmRateTile').classList.toggle('inband',!!(band&&pm5.spm>=band[0]&&pm5.spm<=band[1]&&timerInterval&&!paused));
}

function pm5SetUi(){
  const chip=$('#pm5Chip');
  chip.classList.toggle('on',pm5.connected);
  chip.classList.toggle('lost',!pm5.connected&&!!pm5.device&&!pm5.manualOff);
  $('#pm5ChipText').textContent=pm5.connected?'PM5':'PM5 · tap to connect';
  $('#pm5Strip').classList.toggle('on',pm5.connected);
  $('#pm5Btn .dev-label').textContent=pm5.connected?'✓ Rower · tap to disconnect':'🚣 Connect Rower (PM5)';
  $('#pm5Live').textContent=pm5.connected?'connected':'';
}

async function pm5Connect(){
  if(!navigator.bluetooth){
    customAlert('Web Bluetooth is not available in this browser. On iPhone, open this page in the Bluefy app.');
    return;
  }
  try{
    pm5.manualOff=false;
    const dev=await navigator.bluetooth.requestDevice({filters:[{namePrefix:'PM5'}],optionalServices:[PM5_SVC]});
    pm5.device=dev;
    dev.addEventListener('gattserverdisconnected',pm5OnDisconnect);
    await pm5Subscribe();
  }catch(err){
    if(err.name!=='NotFoundError')customAlert('Rower connection failed: '+err.message);
    pm5SetUi();
  }
}
async function pm5Subscribe(){
  const server=await pm5.device.gatt.connect();
  const svc=await server.getPrimaryService(PM5_SVC);
  const subs=[[PM5_CH_STATUS,pm5OnStatus],[PM5_CH_STATUS1,pm5OnStatus1],[PM5_CH_STROKE,pm5OnStroke]];
  for(const [uuid,fn] of subs){
    const ch=await svc.getCharacteristic(uuid);
    ch.removeEventListener('characteristicvaluechanged',fn);
    ch.addEventListener('characteristicvaluechanged',fn);
    await ch.startNotifications();
  }
  pm5.connected=true;pm5.lastDist=null;pm5.lastStrokes=null;
  pm5SetUi();
}
function pm5OnDisconnect(){
  pm5.connected=false;pm5SetUi();
  if(!pm5.manualOff)pm5Retry(0);
}
function pm5Retry(n){
  if(n>=5||!pm5.device||pm5.manualOff)return;
  setTimeout(async()=>{
    if(pm5.connected||pm5.manualOff)return;
    try{await pm5Subscribe()}catch(e){pm5Retry(n+1)}
  },2000);
}
function pm5Disconnect(){
  pm5.manualOff=true;
  if(pm5.device&&pm5.device.gatt.connected)pm5.device.gatt.disconnect();
  pm5.connected=false;pm5SetUi();
}
function pm5PhaseChange(oldIdx){
  if(!pm5.connected||!pm5Stats)return;
  const old=sequence[oldIdx];
  if(old&&old.type==='high'&&pm5Stats.curSprint>0){
    const w=pm5Stats.curSprint;
    pm5Stats.sprintPeaks.push(w);
    pm5Stats.sprintRates.push(pm5Stats.curSprintSpm);
    if(pm5Stats.curSprintSpm>=30)pm5Stats.rateHits++;
    const d=loadData(),pb=(d&&d.pm5PB&&d.pm5PB.peakW)||0;
    $('#encouragement').textContent=(pb>0&&w>pb)?'⚡ NEW POWER PB: '+w+' W!':'⚡ Sprint peak: '+w+' W';
    pm5Stats.curSprint=0;pm5Stats.curSprintSpm=0;
  }
  pm5UpdateStrip();
}

/* Ghost race: compare live meters against your best comparable previous session */
function pickGhost(){
  ghost=null;
  if(!pm5.connected)return;
  const d=loadData();if(!d||!d.sessionStats)return;
  let best=null;
  for(const k of Object.keys(d.sessionStats)){
    const s=d.sessionStats[k];
    if(!s||!s.timeline||s.timeline.length<2)continue;
    if(!!s.steady!==!!timerConfig.steady)continue;
    if(!s.steady&&s.blocks!==timerConfig.blocks)continue;
    if(!best||s.m>best.m)best=s;
  }
  if(best)ghost={timeline:best.timeline,m:best.m,idx:0};
}
function ghostMetersAt(sec){
  const tl=ghost.timeline;
  while(ghost.idx<tl.length-1&&tl[ghost.idx+1][0]<=sec)ghost.idx++;
  if(ghost.idx>0&&tl[ghost.idx][0]>sec)ghost.idx=0; /* time went backward (skip); rescan */
  while(ghost.idx<tl.length-1&&tl[ghost.idx+1][0]<=sec)ghost.idx++;
  const a=tl[ghost.idx],b=tl[Math.min(ghost.idx+1,tl.length-1)];
  if(b[0]===a[0])return a[1];
  const f=Math.min(1,Math.max(0,(sec-a[0])/(b[0]-a[0])));
  return a[1]+(b[1]-a[1])*f;
}
function updateGhost(totalEl){
  const el=$('#ghostLine');
  if(!ghost||!pm5.connected||!pm5Stats){el.classList.remove('on');return}
  const gm=ghostMetersAt(totalEl);
  const delta=Math.round(pm5Stats.meters-gm);
  el.classList.add('on');
  el.classList.toggle('ahead',delta>=0);
  el.classList.toggle('behind',delta<0);
  el.textContent=delta>=0?'▲ '+delta+' m ahead of your best':'▼ '+(-delta)+' m behind your best';
}
$('#pm5Btn').addEventListener('click',()=>pm5.connected?pm5Disconnect():pm5Connect());
$('#pm5Chip').addEventListener('click',()=>{if(!pm5.connected)pm5Connect()});
function pm5ResetStats(){pm5Stats=pm5NewStats()}
function pm5FinalizeSession(){
  if(!pm5Stats||(pm5Stats.wN<=0&&pm5Stats.meters<=0))return null;
  if(pm5Stats.curSprint>0){
    pm5Stats.sprintPeaks.push(pm5Stats.curSprint);
    pm5Stats.sprintRates.push(pm5Stats.curSprintSpm);
    if(pm5Stats.curSprintSpm>=30)pm5Stats.rateHits++;
    pm5Stats.curSprint=0;pm5Stats.curSprintSpm=0;
  }
  return{m:Math.round(pm5Stats.meters),
    avgW:pm5Stats.wN?Math.round(pm5Stats.wSum/pm5Stats.wN):0,
    peakW:pm5Stats.peakW,strokes:pm5Stats.strokes,
    bestSprint:pm5Stats.sprintPeaks.length?Math.max.apply(null,pm5Stats.sprintPeaks):0,
    avgHr:pm5Stats.hrN?Math.round(pm5Stats.hrSum/pm5Stats.hrN):0,maxHr:pm5Stats.hrMax,
    sprintPeaks:pm5Stats.sprintPeaks.slice(),sprintRates:pm5Stats.sprintRates.slice(),
    rateHits:pm5Stats.rateHits,timeline:pm5Stats.timeline.slice(),
    blocks:timerConfig.steady?0:timerConfig.blocks,steady:!!timerConfig.steady};
}
export{pickGhost,pm5,pm5FinalizeSession,pm5PhaseChange,pm5ResetStats,pm5Stats,pm5UpdateStrip,updateGhost};
