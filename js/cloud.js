import{$,$$,showScreen}from'./dom.js';
import{renderSchedule}from'./schedule.js';
import{MODIFIED_KEY,STORAGE_KEY,loadData,onSave}from'./store.js';
const SUPA_URL='https://jwlevhmdwkwsvnplomsv.supabase.co';
const SUPA_KEY='sb_publishable_XOrV5aL0NQEuSLmGFmVCLQ_bn920z68';  /* publishable key: safe in public source; RLS protects data */
const CLOUD_SESSION_KEY='rowing-102030-cloud-session';
const LASTSYNC_KEY='rowing-102030-lastsync';
let cloudTimer=null,cloudBusy=false;

function cloudConfigured(){return !!(SUPA_URL&&SUPA_KEY)}
function cloudSession(){try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY))||null}catch(e){return null}}
function setCloudSession(s){s?localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(s)):localStorage.removeItem(CLOUD_SESSION_KEY)}
function localModified(){return +(localStorage.getItem(MODIFIED_KEY)||0)}
function jwtSub(tok){try{return JSON.parse(atob(tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub}catch(e){return null}}

async function supaAuth(path,body){
  const r=await fetch(SUPA_URL+'/auth/v1/'+path,{method:'POST',
    headers:{'apikey':SUPA_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.msg||j.error_description||j.message||('Sign-in failed ('+r.status+')'));
  return j;
}
async function freshToken(){
  let s=cloudSession();if(!s)return null;
  if(Date.now()<(s.expires_at-60)*1000)return s.access_token;
  try{
    const j=await supaAuth('token?grant_type=refresh_token',{refresh_token:s.refresh_token});
    s={access_token:j.access_token,refresh_token:j.refresh_token,
       expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),
       email:s.email,uid:jwtSub(j.access_token)||s.uid};
    setCloudSession(s);return s.access_token;
  }catch(e){setCloudSession(null);cloudUiRefresh();return null}
}
async function supaRest(pathAndQuery,opts){
  const tok=await freshToken();if(!tok)throw new Error('Not signed in');
  opts=opts||{};
  const r=await fetch(SUPA_URL+'/rest/v1/'+pathAndQuery,{
    method:opts.method||'GET',
    keepalive:!!opts.keepalive,
    headers:Object.assign({'apikey':SUPA_KEY,'Authorization':'Bearer '+tok,'Content-Type':'application/json'},opts.headers||{}),
    body:opts.body?JSON.stringify(opts.body):undefined});
  if(!r.ok)throw new Error('Sync failed ('+r.status+')');
  return r.status===204?null:r.json().catch(()=>null);
}

/* One relational row per completed workout, for real per-user DB storage */
function workoutRows(data,uid){
  const rows=[],stats=data.sessionStats||{};
  for(const k of Object.keys(data.completed||{})){
    const s=stats[k];
    rows.push({user_id:uid,session_key:k,completed_at:data.completed[k],
      meters:s?s.m:null,avg_watts:s?s.avgW:null,peak_watts:s?s.peakW:null,
      best_sprint:s?s.bestSprint:null,strokes:s?s.strokes:null,
      avg_hr:s?s.avgHr:null,max_hr:s?s.maxHr:null,rate_hits:s?s.rateHits:null,
      blocks:s?s.blocks:null,steady:s?!!s.steady:false,stats:s||null});
  }
  return rows;
}

async function cloudPush(keepalive){
  const s=cloudSession();if(!s||cloudBusy)return;
  const data=loadData();if(!data)return;
  cloudBusy=true;
  try{
    await supaRest('app_state?on_conflict=user_id',{method:'POST',keepalive,
      headers:{'Prefer':'resolution=merge-duplicates'},
      body:[{user_id:s.uid,data:data,updated_at:new Date(localModified()||Date.now()).toISOString()}]});
    const rows=workoutRows(data,s.uid);
    if(rows.length)await supaRest('workouts?on_conflict=user_id,session_key',{method:'POST',keepalive,
      headers:{'Prefer':'resolution=merge-duplicates'},body:rows});
    localStorage.setItem(LASTSYNC_KEY,String(Date.now()));
    cloudUiRefresh();
  }catch(e){/* offline or session lapsed; retried on next save */}
  cloudBusy=false;
}
function scheduleCloudPush(){
  if(!cloudConfigured()||!cloudSession())return;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(()=>{cloudTimer=null;cloudPush(false)},2500);
}
async function cloudPull(){
  const s=cloudSession();if(!s)return false;
  const rows=await supaRest('app_state?select=data,updated_at&user_id=eq.'+s.uid);
  const remote=rows&&rows[0];
  const local=loadData();
  const remoteTs=remote?Date.parse(remote.updated_at):0;
  if(remote&&(!local||remoteTs>localModified()+2000)){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(remote.data));
    localStorage.setItem(MODIFIED_KEY,String(remoteTs));
    return true;
  }
  if(local&&(!remote||localModified()>remoteTs+2000))cloudPush(false);
  return false;
}
async function cloudSyncNow(){
  const replaced=await cloudPull();
  localStorage.setItem(LASTSYNC_KEY,String(Date.now()));
  if(replaced){renderSchedule();showScreen('#schedule')}
  cloudUiRefresh();
  return replaced;
}
async function cloudReset(){ /* explicit program reset: remove the cloud copy too */
  const s=cloudSession();if(!s)return;
  try{
    await supaRest('workouts?user_id=eq.'+s.uid,{method:'DELETE'});
    await supaRest('app_state?user_id=eq.'+s.uid,{method:'DELETE'});
    localStorage.removeItem(MODIFIED_KEY);
  }catch(e){}
}

function cloudShowStep(id){$$('.cloud-step').forEach(x=>x.classList.remove('active'));$('#'+id).classList.add('active')}
function cloudStatus(msg,cls){const el=$('#cloudStatus');el.textContent=msg||'';el.className=cls||''}
function cloudUiRefresh(){
  const btn=$('#cloudBtn');
  if(!cloudConfigured()){btn.style.display='none';return}
  const s=cloudSession();
  btn.textContent=s?'☁ Synced · '+s.email:'☁ Cloud Sync';
  if(s){
    $('#cloudWho').textContent=s.email;
    const ls=+(localStorage.getItem(LASTSYNC_KEY)||0);
    $('#cloudLastSync').textContent=ls?('Last synced: '+new Date(ls).toLocaleString()):'Not synced yet';
    cloudShowStep('cloudStepIn');
  }else cloudShowStep('cloudStepEmail');
}
function cloudOpenModal(){cloudUiRefresh();cloudStatus('');$('#cloudOverlay').classList.add('active')}
$('#cloudBtn').addEventListener('click',cloudOpenModal);
$('#cloudCloseBtn').addEventListener('click',()=>$('#cloudOverlay').classList.remove('active'));
$('#cloudSendBtn').addEventListener('click',async()=>{
  const email=$('#cloudEmail').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(email)){cloudStatus('Enter a valid email address','err');return}
  cloudStatus('Sending code...');
  try{
    await supaAuth('otp',{email:email,create_user:true});
    $('#cloudEmailShow').textContent=email;
    cloudShowStep('cloudStepCode');
    cloudStatus('Code sent. Check your inbox (and spam folder).','ok');
  }catch(e){cloudStatus(e.message,'err')}
});
$('#cloudBackToEmail').addEventListener('click',()=>{cloudShowStep('cloudStepEmail');cloudStatus('')});
$('#cloudVerifyBtn').addEventListener('click',async()=>{
  const email=$('#cloudEmailShow').textContent,code=$('#cloudCode').value.trim();
  if(!code){cloudStatus('Enter the code from the email','err');return}
  cloudStatus('Verifying...');
  try{
    const j=await supaAuth('verify',{email:email,token:code,type:'email'});
    setCloudSession({access_token:j.access_token,refresh_token:j.refresh_token,
      expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),
      email:email,uid:jwtSub(j.access_token)});
    cloudStatus('Signed in! Syncing...','ok');
    const replaced=await cloudSyncNow();
    cloudStatus(replaced?'Restored your progress from the cloud.':'Signed in and synced.','ok');
  }catch(e){cloudStatus(e.message,'err')}
});
$('#cloudSyncNowBtn').addEventListener('click',async()=>{
  cloudStatus('Syncing...');
  try{const replaced=await cloudSyncNow();cloudStatus(replaced?'Pulled newer progress from the cloud.':'Everything up to date.','ok')}
  catch(e){cloudStatus(e.message,'err')}
});
$('#cloudSignOutBtn').addEventListener('click',()=>{
  setCloudSession(null);cloudUiRefresh();
  cloudStatus('Signed out. Your data stays on this device.');
});
window.addEventListener('pagehide',()=>{if(cloudTimer){clearTimeout(cloudTimer);cloudTimer=null;cloudPush(true)}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&cloudTimer){clearTimeout(cloudTimer);cloudTimer=null;cloudPush(true)}
});
onSave(scheduleCloudPush);
export{cloudConfigured,cloudOpenModal,cloudReset,cloudSession,cloudSyncNow,cloudUiRefresh};
