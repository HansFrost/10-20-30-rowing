import{loadData,saveData}from'./store.js';
/* Coin currency inside the single data blob (data.coins + data.coinLog), so
   cloud sync and export/import carry it automatically. Every mutation goes
   through loadData/saveData - never direct localStorage writes. Kept
   dependency-light (store.js only): a mid-session challenge engine will call
   awardCoins without dragging UI modules into the timer. */
const LOG_CAP=50;
function ensureCoinFields(data){
  if(typeof data.coins!=='number')data.coins=0;
  if(!Array.isArray(data.coinLog))data.coinLog=[];
  if(!data.cosmetics)data.cosmetics={owned:[],equipped:{avatar:null,flair:null}};
  if(!Array.isArray(data.cosmetics.owned))data.cosmetics.owned=[];
  if(!data.cosmetics.equipped)data.cosmetics.equipped={avatar:null,flair:null};
  return data;
}
function logCoins(data,amount,reason){
  data.coinLog.push({ts:Date.now(),amount,reason});
  if(data.coinLog.length>LOG_CAP)data.coinLog=data.coinLog.slice(-LOG_CAP);
}
function getCoins(){
  const d=loadData();
  return d?ensureCoinFields(d).coins:0;
}
function awardCoins(amount,reason){
  const d=loadData();
  if(!d||!(amount>0))return 0;
  ensureCoinFields(d);
  d.coins+=amount;
  logCoins(d,amount,reason);
  saveData(d);
  showCoinToast('\u{1FA99} +'+amount+' '+reason);
  return d.coins;
}
function spendCoins(amount,reason){
  const d=loadData();
  if(!d)return false;
  ensureCoinFields(d);
  if(!(amount>0)||d.coins<amount)return false;
  d.coins-=amount;
  logCoins(d,-amount,reason||'spent');
  saveData(d);
  return true;
}
/* Minimal non-blocking toast; style is injected here so the module stays
   self-contained. */
let toastTimer=null;
function ensureToastStyle(){
  if(document.getElementById('coinToastStyle'))return;
  const st=document.createElement('style');
  st.id='coinToastStyle';
  st.textContent='.coin-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(8px);'+
    'background:var(--card);border:1px solid var(--accent);color:var(--text);border-radius:999px;'+
    'padding:8px 16px;font-size:.85rem;font-weight:700;z-index:400;opacity:0;pointer-events:none;'+
    'transition:opacity .25s,transform .25s;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis}'+
    '.coin-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(st);
}
function showCoinToast(msg){
  ensureToastStyle();
  let el=document.querySelector('.coin-toast');
  if(!el){el=document.createElement('div');el.className='coin-toast';document.body.appendChild(el)}
  el.textContent=msg;
  requestAnimationFrame(()=>el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
export{awardCoins,ensureCoinFields,getCoins,spendCoins};
