const STORAGE_KEY='rowing-102030-schedule';
const MODIFIED_KEY='rowing-102030-modified';
const saveHooks=[];
function onSave(fn){saveHooks.push(fn)}
function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||null}catch(e){return null}}
function saveData(d){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(d));
  localStorage.setItem(MODIFIED_KEY,String(Date.now()));
  saveHooks.forEach(f=>f());
}
function clearData(){localStorage.removeItem(STORAGE_KEY)}
export{MODIFIED_KEY,STORAGE_KEY,clearData,loadData,onSave,saveData};
