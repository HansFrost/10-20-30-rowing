const STORAGE_KEY='rowing-102030-schedule';
const MODIFIED_KEY='rowing-102030-modified';
const saveHooks=[];
function onSave(fn){saveHooks.push(fn)}
function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||null}catch(e){return null}}
function saveData(d){
  const s=JSON.stringify(d);
  if(s===localStorage.getItem(STORAGE_KEY))return; /* no-op write: keep modified stamp honest for sync */
  localStorage.setItem(STORAGE_KEY,s);
  localStorage.setItem(MODIFIED_KEY,String(Date.now()));
  saveHooks.forEach(f=>f());
}
function clearData(){localStorage.removeItem(STORAGE_KEY)}
export{MODIFIED_KEY,STORAGE_KEY,clearData,loadData,onSave,saveData};
