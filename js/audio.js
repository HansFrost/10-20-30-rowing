const AudioCtx=window.AudioContext||window.webkitAudioContext;
let audioCtx=null;
function ensureAudio(){try{if(!audioCtx&&AudioCtx)audioCtx=new AudioCtx();if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume()}catch(e){}}
function beep(f,d,v){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g);g.connect(audioCtx.destination);o.frequency.value=f;o.type='sine';g.gain.value=v||.4;
  o.start(audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+d);
  o.stop(audioCtx.currentTime+d)}
function soundTick(){beep(600,.08,.2)}
function soundPhase(){beep(880,.15,.5)}
function soundBlockEnd(){beep(440,.3,.4);setTimeout(()=>beep(440,.3,.4),350)}
function soundSprint(){beep(1200,.1,.6);setTimeout(()=>beep(1400,.15,.6),120)}
function soundDone(){beep(523,.2,.5);setTimeout(()=>beep(659,.2,.5),200);setTimeout(()=>beep(784,.4,.5),400)}
export{beep,ensureAudio,soundBlockEnd,soundDone,soundPhase,soundSprint,soundTick};
