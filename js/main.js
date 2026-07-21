import'./audio.js';
import'./cheers.js';
import'./cloud.js';
import'./content.js';
import'./dom.js';
import'./fx.js';
import'./habit.js';
import'./hr.js';
import'./onboarding.js';
import'./pm5.js';
import'./programs.js';
import'./progress.js';
import'./schedule.js';
import'./session-modals.js';
import'./store.js';
import'./time-modals.js';
import'./timer.js';
import'./util.js';
import'./xp.js';
import{cloudConfigured,cloudReset,cloudSession,cloudSyncNow,cloudUiRefresh}from'./cloud.js';
import{$,customAlert,customConfirm,setSkipHist,showOnboardStep,showScreen}from'./dom.js';
import{DEFAULT_MAX_HR}from'./hr.js';
import{initOnboarding}from'./onboarding.js';
import{PROGRAMS,migrateData}from'./programs.js';
import{renderSchedule}from'./schedule.js';
import{initAddSessionModal,initSwapModal}from'./session-modals.js';
import{clearData,loadData,saveData}from'./store.js';
import{initTimeModal}from'./time-modals.js';
$('#helpBtn').addEventListener('click',()=>$('#helpOverlay').classList.add('active'));
$('#helpClose').addEventListener('click',()=>$('#helpOverlay').classList.remove('active'));
$('#helpOverlay').addEventListener('click',e=>{if(e.target===$('#helpOverlay'))$('#helpOverlay').classList.remove('active')});
$('#changProgBtn').addEventListener('click',()=>{
  $('#backToProgram').style.display='';
  showScreen('#onboarding');showOnboardStep('stepProgram')});
$('#backToProgram').addEventListener('click',()=>{
  $('#backToProgram').style.display='none';
  renderSchedule();showScreen('#schedule')});
$('#maxHrSaveBtn').addEventListener('click',()=>{
  const data=loadData();if(!data)return;
  const v=parseInt($('#maxHrEdit').value)||DEFAULT_MAX_HR;
  data.maxHR=Math.min(230,Math.max(100,v));
  saveData(data);renderSchedule()});
$('#exportBtn').addEventListener('click',()=>{
  const data=loadData();if(!data){customAlert('No progress to export.');return}
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='rowing-102030-progress.json';a.click();URL.revokeObjectURL(a.href)});
$('#importBtn').addEventListener('click',()=>$('#importFile').click());
$('#onboardImportBtn').addEventListener('click',()=>$('#importFile').click());
$('#importFile').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!data.startDate||!data.program||!PROGRAMS[data.program]){await customAlert('Invalid progress file.');return}
      if(loadData()&&!await customConfirm('Import this progress? It will replace your current data.'))return;
      saveData(data);renderSchedule();showScreen('#schedule');
    }catch(err){customAlert('Could not read file. Make sure it is a valid progress export.')}
  };
  reader.readAsText(file);e.target.value=''});
$('#resetBtn').addEventListener('click',async()=>{
  if(await customConfirm('Reset the entire program? All progress will be lost.')){
    cloudReset();clearData();showScreen('#onboarding');showOnboardStep('stepProgram')}});

/* ===== INIT ===== */
initOnboarding();initSwapModal();initTimeModal();initAddSessionModal();
const saved=loadData();
setSkipHist(true);
if(saved&&saved.program){
  if(!saved.days)migrateData(saved);
  renderSchedule();showScreen('#schedule');
  history.replaceState({screen:'#schedule'},'');
}
else if(saved){clearData();showScreen('#onboarding');history.replaceState({screen:'#onboarding',step:'stepProgram'},'');}
else{showScreen('#onboarding');history.replaceState({screen:'#onboarding',step:'stepProgram'},'');}
setSkipHist(false);
cloudUiRefresh();
if(cloudConfigured()&&cloudSession())cloudSyncNow().catch(()=>{});

/* Install guide */
function showInstallGuide(){
  var isStandalone=window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone;
  if(isStandalone){$('#installBox').innerHTML='<h2>Already Installed</h2><p style="color:var(--muted);margin:16px 0">You are already running the app from your home screen.</p><button class="btn btn-primary" id="installDismiss" style="width:100%">OK</button>';$('#installDismiss').addEventListener('click',()=>$('#installGuide').classList.remove('active'))}
  var isIos=/iPad|iPhone|iPod/.test(navigator.userAgent);
  if(isIos){$('#installAndroid').style.display='none'}
  else{$('#installIos').style.display='none'}
  $('#installGuide').classList.add('active');
}
$('#installDismiss').addEventListener('click',()=>{
  $('#installGuide').classList.remove('active');
  localStorage.setItem('install_guide_seen','1');
});
$('#helpInstallBtn').addEventListener('click',()=>{
  $('#helpOverlay').classList.remove('active');
  showInstallGuide();
});
if(!localStorage.getItem('install_guide_seen')&&!window.matchMedia('(display-mode:standalone)').matches&&!window.navigator.standalone){
  showInstallGuide();
}
