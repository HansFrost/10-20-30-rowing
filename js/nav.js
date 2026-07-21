import{$$,registerScreenRenderer,showScreen}from'./dom.js';
import{renderProgress}from'./progress.js';
import{renderSchedule}from'./schedule.js';

/* Bottom tab bar: Schedule / Progress / Settings. Renderers run before the
   switch so the target screen is always fresh. renderSchedule also fills the
   strips (#xpStrip, #weeklyCard, #dailyTip) that live on the Progress tab. */
const TAB_RENDER={
  '#schedule':()=>renderSchedule(),
  '#progress':()=>{renderSchedule();renderProgress()},
  '#connect':()=>{},
  '#settings':()=>{},
};
function initNav(){
  /* popstate re-renders restored screens with the same renderers the tabs use */
  Object.keys(TAB_RENDER).forEach(id=>registerScreenRenderer(id,TAB_RENDER[id]));
  $$('#tabBar .tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const tab=btn.dataset.tab;
    if(document.body.dataset.screen===tab)return;
    TAB_RENDER[tab]();
    showScreen(tab);
  }));
}
export{initNav};
