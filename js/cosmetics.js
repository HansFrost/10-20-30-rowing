/* Cosmetic catalog: Nordic/Danish rowing identity to match the Viking rank
   ladder. Content-only module: no imports, so any feature module may use it.
   unlock is either {rank:N} (0-based index into the RANKS ladder; auto-owned
   once the level reaches that rank) or {coins:price} (bought in the shop). */
const DEFAULT_AVATAR='rower';
const COSMETICS=[
  /* Avatars */
  {id:'rower',name:'Rower',emoji:'\u{1F6A3}',type:'avatar',unlock:{rank:0}},
  {id:'longship',name:'Longship',emoji:'⛵',type:'avatar',unlock:{rank:2}},
  {id:'seal',name:'Harbor Seal',emoji:'\u{1F9AD}',type:'avatar',unlock:{coins:100}},
  {id:'kayak',name:'Kayak',emoji:'\u{1F6F6}',type:'avatar',unlock:{coins:150}},
  {id:'swan',name:'Swan of the Sound',emoji:'\u{1F9A2}',type:'avatar',unlock:{coins:250}},
  {id:'viking',name:'Viking',emoji:'\u{1F9D4}',type:'avatar',unlock:{rank:5}},
  {id:'seawolf',name:'Sea Wolf',emoji:'\u{1F40B}',type:'avatar',unlock:{rank:8}},
  {id:'figurehead',name:'Dragon Figurehead',emoji:'\u{1F409}',type:'avatar',unlock:{coins:400}},
  {id:'poseidon',name:'Poseidon',emoji:'\u{1F531}',type:'avatar',unlock:{rank:10}},
  /* Flair (small accessory shown beside the avatar) */
  {id:'coffee',name:'Morning Coffee',emoji:'☕',type:'flair',unlock:{coins:50}},
  {id:'boots',name:'Walking Boots',emoji:'\u{1F97E}',type:'flair',unlock:{coins:60}},
  {id:'hrstrap',name:'HR Strap',emoji:'❤',type:'flair',unlock:{coins:75}},
  {id:'sauna',name:'Sauna Ember',emoji:'\u{1F525}',type:'flair',unlock:{coins:90}},
  {id:'bolt',name:'Sprint Bolt',emoji:'⚡',type:'flair',unlock:{coins:100}},
  {id:'headphones',name:'Race-Day Headphones',emoji:'\u{1F3A7}',type:'flair',unlock:{coins:120}},
  {id:'compass',name:'North Sea Compass',emoji:'\u{1F9ED}',type:'flair',unlock:{coins:150}},
  {id:'wave',name:'Bow Wave',emoji:'\u{1F30A}',type:'flair',unlock:{rank:1}},
  {id:'dannebrog',name:'Dannebrog Pennant',emoji:'\u{1F1E9}\u{1F1F0}',type:'flair',unlock:{rank:4}},
  {id:'anchor',name:"First Mate's Anchor",emoji:'⚓',type:'flair',unlock:{rank:6}},
  {id:'goldenoar',name:'Golden Oar',emoji:'\u{1F3C5}',type:'flair',unlock:{coins:400}},
];
/* levelInfo maps level L to rank index floor((L-1)/2), so rank index R is
   first reached at level R*2+1. */
function rankStartLevel(rankIndex){return rankIndex*2+1}
function getItem(id){return COSMETICS.find(i=>i.id===id)||null}
/* Rank items are owned automatically once the level is high enough; coin
   items must be in data.cosmetics.owned. */
function isOwned(item,data,lvl){
  if(item.unlock.rank!==undefined)return lvl>=rankStartLevel(item.unlock.rank);
  const c=data&&data.cosmetics;
  return !!(c&&Array.isArray(c.owned)&&c.owned.includes(item.id));
}
/* Resolves equipped ids to catalog items; avatar falls back to the default
   Rower, flair may be null (none equipped). */
function getEquipped(data){
  const eq=(data&&data.cosmetics&&data.cosmetics.equipped)||{};
  return{
    avatar:getItem(eq.avatar)||getItem(DEFAULT_AVATAR),
    flair:getItem(eq.flair),
  };
}
export{COSMETICS,DEFAULT_AVATAR,getEquipped,getItem,isOwned,rankStartLevel};
