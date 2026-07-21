import{ensureCoinFields,spendCoins}from'./coins.js';
import{COSMETICS,getEquipped,getItem,isOwned,rankStartLevel}from'./cosmetics.js';
import{$,customAlert,customConfirm}from'./dom.js';
import{loadData,onSave,saveData}from'./store.js';
import{RANKS,calcXP,levelInfo,renderXpStrip}from'./xp.js';

/* Shop & Avatars: modal to buy/equip cosmetics, opened from the Settings row
   and from the card on the Progress screen. */
const WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LOG_SHOWN=15;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
/* e.g. 'Tue 21 Jul 19:04' - always 24h, never AM/PM */
function fmtLogTs(ts){
  const d=new Date(ts);
  return WD[d.getDay()]+' '+d.getDate()+' '+MO[d.getMonth()]+' '+
    String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

function itemState(item,data,lvl){
  const eq=getEquipped(data);
  const equippedId=item.type==='avatar'?eq.avatar.id:(eq.flair&&eq.flair.id);
  if(equippedId===item.id)return{cls:'equipped',label:'Equipped'};
  if(isOwned(item,data,lvl))return{cls:'owned',label:'Tap to equip'};
  if(item.unlock.rank!==undefined)
    return{cls:'locked',label:'Unlocks at '+RANKS[item.unlock.rank]+' (LVL '+rankStartLevel(item.unlock.rank)+')'};
  return{cls:'buy',label:'Buy · '+item.unlock.coins+' \u{1FA99}'};
}
function shopItemHtml(item,data,lvl){
  const st=itemState(item,data,lvl);
  return '<button class="shop-item '+st.cls+'" data-id="'+item.id+'">'+
    '<span class="shop-emoji">'+item.emoji+'</span>'+
    '<span class="shop-name">'+item.name+'</span>'+
    '<span class="shop-state">'+st.label+'</span></button>';
}
function coinLogHtml(data){
  const log=(data.coinLog||[]).slice().reverse(); /* newest first */
  if(!log.length)return '<p class="shop-log-empty">Coins you earn will show up here.</p>';
  const shown=log.slice(0,LOG_SHOWN);
  let h=shown.map(e=>'<div class="shop-log-row">'+
    '<span class="shop-log-amt '+(e.amount>=0?'plus':'minus')+'">'+(e.amount>=0?'+':'')+e.amount+'</span>'+
    '<span class="shop-log-reason">'+esc(e.reason||'')+'</span>'+
    '<span class="shop-log-ts">'+fmtLogTs(e.ts)+'</span></div>').join('');
  if(log.length>shown.length)h+='<div class="shop-log-more">and '+(log.length-shown.length)+' older entries</div>';
  return h;
}
function renderShopModal(){
  const data=loadData()||{};
  const lvl=levelInfo(calcXP(data)).lvl;
  $('#shopCoins').textContent='\u{1FA99} '+(typeof data.coins==='number'?data.coins:0)+' coins';
  $('#shopLog').innerHTML=coinLogHtml(data);
  const av=COSMETICS.filter(i=>i.type==='avatar'),fl=COSMETICS.filter(i=>i.type==='flair');
  $('#shopGrid').innerHTML='<div class="shop-head">Avatars</div>'+av.map(i=>shopItemHtml(i,data,lvl)).join('')+
    '<div class="shop-head">Flair</div>'+fl.map(i=>shopItemHtml(i,data,lvl)).join('');
}

function equipItem(item,data){
  const eq=data.cosmetics.equipped;
  if(item.type==='flair'&&eq.flair===item.id)eq.flair=null; /* tap again to unequip flair */
  else eq[item.type]=item.id;
  saveData(data);
  renderShopModal();
  renderXpStrip(loadData());
}
async function buyItem(item){
  if(!await customConfirm('Buy '+item.name+' for '+item.unlock.coins+' coins?'))return;
  if(!spendCoins(item.unlock.coins,item.name)){await customAlert('Not enough coins.');return}
  const data=loadData();
  ensureCoinFields(data);
  if(!data.cosmetics.owned.includes(item.id))data.cosmetics.owned.push(item.id);
  saveData(data);
  renderShopModal();
}
async function onItemTap(id){
  const item=getItem(id),data=loadData();
  if(!item||!data)return;
  ensureCoinFields(data);
  const lvl=levelInfo(calcXP(data)).lvl;
  if(isOwned(item,data,lvl)){equipItem(item,data);return}
  if(item.unlock.coins!==undefined)await buyItem(item);
}

/* Card on the Progress screen under the XP strip; re-rendered on every data
   save so balance and equipped look stay fresh. */
function renderShopCard(){
  const el=$('#shopCard'),data=loadData();
  if(!data){el.innerHTML='';return}
  const eq=getEquipped(data);
  const coins=(typeof data.coins==='number')?data.coins:0;
  el.innerHTML='<button class="shop-card">'+
    '<span class="shop-card-avatar">'+eq.avatar.emoji+
      (eq.flair?'<span class="shop-card-flair">'+eq.flair.emoji+'</span>':'')+'</span>'+
    '<span class="shop-card-mid"><b>Shop &amp; Avatars</b><span>Spend coins, equip your look</span></span>'+
    '<span class="shop-card-coins">\u{1FA99} '+coins+'</span></button>';
}

function openShop(){renderShopModal();$('#shopOverlay').classList.add('active')}
function closeShop(){$('#shopOverlay').classList.remove('active')}
function initShop(){
  $('#shopBtn').addEventListener('click',openShop);
  $('#shopCard').addEventListener('click',e=>{if(e.target.closest('.shop-card'))openShop()});
  $('#shopClose').addEventListener('click',closeShop);
  $('#shopOverlay').addEventListener('click',e=>{if(e.target===$('#shopOverlay'))closeShop()});
  $('#shopGrid').addEventListener('click',e=>{
    const btn=e.target.closest('.shop-item');
    if(btn&&!btn.classList.contains('locked'))onItemTap(btn.dataset.id);
  });
  renderShopCard();
  onSave(renderShopCard);
}
export{initShop};
