/* Keep the screen awake during sessions. Two mechanisms, both engaged:
   1. Screen Wake Lock API where available, re-acquired on foreground return.
   2. A muted, inline 2px video fed from a canvas stream - the NoSleep technique
      that defeats the idle timer in iOS WKWebView (Bluefy), where the Wake Lock
      API is missing. Muted media does not claim the audio session, so podcasts
      playing in another app keep running. */
let wakeLock=null,video=null,ctx=null,paintTimer=null,active=false;

async function acquireLock(){
  try{
    if('wakeLock' in navigator){
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null});
    }
  }catch(e){}
}
function ensureVideo(){
  if(video)return;
  const canvas=document.createElement('canvas');
  canvas.width=2;canvas.height=2;
  ctx=canvas.getContext('2d');
  ctx.fillRect(0,0,2,2);
  video=document.createElement('video');
  video.muted=true;video.setAttribute('muted','');
  video.playsInline=true;video.setAttribute('playsinline','');
  video.srcObject=canvas.captureStream(1);
  video.style.cssText='position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.appendChild(video);
}
function keepAwakeOn(){
  active=true;
  acquireLock();
  try{
    ensureVideo();
    video.play().catch(()=>{});
    clearInterval(paintTimer);
    paintTimer=setInterval(()=>{ /* repaint so the stream never stalls */
      if(ctx){ctx.fillStyle=ctx.fillStyle==='#000000'?'#010101':'#000000';ctx.fillRect(0,0,2,2)}
    },15000);
  }catch(e){}
}
function keepAwakeOff(){
  active=false;
  if(wakeLock){try{wakeLock.release()}catch(e){}wakeLock=null}
  if(video)video.pause();
  clearInterval(paintTimer);paintTimer=null;
}
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&active){
    acquireLock();
    if(video)video.play().catch(()=>{});
  }
});

export{keepAwakeOn,keepAwakeOff};
