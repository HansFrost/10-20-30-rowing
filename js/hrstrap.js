import{$,customAlert}from'./dom.js';
import{pm5,pm5Stats}from'./pm5.js';
import{paused,timerInterval}from'./timer.js';

/* Bluetooth heart-rate strap (standard heart_rate service). Feeds the shared
   pm5.hr display and the per-session HR stats, for walks and rowing alike. */
const strap={device:null,connected:false,manualOff:false};

function onHrNotif(e){
  const dv=e.target.value;
  const flags=dv.getUint8(0);
  const v=(flags&1)?dv.getUint16(1,true):dv.getUint8(1);
  if(!v)return;
  pm5.hr=v;
  if(pm5Stats&&timerInterval&&!paused){
    pm5Stats.hrSum+=v;pm5Stats.hrN++;
    if(v>pm5Stats.hrMax)pm5Stats.hrMax=v;
  }
  strapSetUi();
}
function strapSetUi(){
  const chip=$('#hrChip'),btn=$('#hrBtn');
  chip.classList.toggle('on',strap.connected);
  chip.classList.toggle('lost',!strap.connected&&!!strap.device&&!strap.manualOff);
  $('#hrChipText').textContent=strap.connected?('❤ '+(pm5.hr||'--')):'❤ strap';
  btn.textContent=strap.connected?'✓ HR Strap Connected · tap to disconnect':'❤ Connect HR Strap';
}
async function strapConnect(){
  if(!navigator.bluetooth){
    customAlert('Web Bluetooth is not available in this browser. On iPhone, open this page in the Bluefy app.');
    return;
  }
  try{
    strap.manualOff=false;
    const dev=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
    strap.device=dev;
    dev.addEventListener('gattserverdisconnected',strapOnDisconnect);
    await strapSubscribe();
  }catch(err){
    if(err.name!=='NotFoundError')customAlert('Strap connection failed: '+err.message);
    strapSetUi();
  }
}
async function strapSubscribe(){
  const server=await strap.device.gatt.connect();
  const svc=await server.getPrimaryService('heart_rate');
  const ch=await svc.getCharacteristic('heart_rate_measurement');
  ch.removeEventListener('characteristicvaluechanged',onHrNotif);
  ch.addEventListener('characteristicvaluechanged',onHrNotif);
  await ch.startNotifications();
  strap.connected=true;
  strapSetUi();
}
function strapOnDisconnect(){
  strap.connected=false;strapSetUi();
  if(!strap.manualOff)strapRetry(0);
}
function strapRetry(n){
  if(n>=5||!strap.device||strap.manualOff)return;
  setTimeout(async()=>{
    if(strap.connected||strap.manualOff)return;
    try{await strapSubscribe()}catch(e){strapRetry(n+1)}
  },2000);
}
function strapDisconnect(){
  strap.manualOff=true;
  if(strap.device&&strap.device.gatt.connected)strap.device.gatt.disconnect();
  strap.connected=false;strapSetUi();
}
$('#hrBtn').addEventListener('click',()=>strap.connected?strapDisconnect():strapConnect());
$('#hrChip').addEventListener('click',()=>{if(!strap.connected)strapConnect()});
