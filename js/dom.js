const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
let confirmResolve=null;
function customConfirm(msg){
  return new Promise(resolve=>{
    confirmResolve=resolve;
    $('#confirmMsg').textContent=msg;
    $('#confirmCancel').style.display='';
    $('#confirmOverlay').classList.add('active');
  });
}
function customAlert(msg){
  return new Promise(resolve=>{
    confirmResolve=()=>resolve();
    $('#confirmMsg').textContent=msg;
    $('#confirmCancel').style.display='none';
    $('#confirmOverlay').classList.add('active');
  });
}
function closeConfirm(result){
  $('#confirmOverlay').classList.remove('active');
  if(confirmResolve){confirmResolve(result);confirmResolve=null}
}
let _skipHist=false;
function showScreen(id){
  $$('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');document.body.className='';
  if(!_skipHist)history.pushState({screen:id},'');
}
function showOnboardStep(id){
  $$('.onboard-step').forEach(s=>s.classList.remove('active'));$('#'+id).classList.add('active');
  if(!_skipHist)history.pushState({screen:'#onboarding',step:id},'');
}
window.addEventListener('popstate',function(e){
  var st=e.state;if(!st||!st.screen)return;
  _skipHist=true;
  navAbortHook();
  $$('.screen').forEach(s=>s.classList.remove('active'));$(st.screen).classList.add('active');document.body.className='';
  if(st.screen==='#schedule')navRenderHook();
  if(st.step)showOnboardStep(st.step);
  _skipHist=false;
});

function customAlertHtml(html){
  return new Promise(resolve=>{
    confirmResolve=()=>resolve();
    $('#confirmMsg').innerHTML=html;
    $('#confirmCancel').style.display='none';
    $('#confirmOverlay').classList.add('active');
  });
}

$('#confirmOk').addEventListener('click',()=>closeConfirm(true));
$('#confirmCancel').addEventListener('click',()=>closeConfirm(false));
let navAbortHook=()=>{},navRenderHook=()=>{};
function setNavAbortHook(fn){navAbortHook=fn}
function setNavRenderHook(fn){navRenderHook=fn}
function setSkipHist(v){_skipHist=v}
export{$,$$,customAlert,customAlertHtml,customConfirm,setNavAbortHook,setNavRenderHook,setSkipHist,showOnboardStep,showScreen};
