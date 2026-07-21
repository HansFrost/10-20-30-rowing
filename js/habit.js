import{STAGE_IDENTITY}from'./content.js';
import{$,customAlertHtml}from'./dom.js';
import{PROGRAMS,totalAllSessions}from'./programs.js';
import{loadData,saveData}from'./store.js';
import{lifetimeMeters}from'./xp.js';
const MILESTONES={
  first:{test:(d)=>d>=1,icon:'\uD83C\uDF1F',title:'First Session!',msg:'You showed up. That is the hardest part. The journey begins now.'},
  sessions3:{test:(d)=>d>=3,icon:'\uD83C\uDF31',title:'3 Sessions Complete',msg:'You tried it \u2014 and came back. That is how habits begin.'},
  week1:{test:(d,s)=>checkFullWeek(s),icon:'\uD83D\uDCC5',title:'First Full Week!',msg:'Every session in a calendar week \u2014 done. Consistency is building.'},
  streak5:{test:(d,s,st)=>st.current>=5,icon:'\uD83D\uDD25',title:'5 Session Streak!',msg:'Five in a row. Your habit loop is forming. Keep the chain alive.'},
  sessions10:{test:(d)=>d>=10,icon:'\uD83D\uDE80',title:'10 Sessions!',msg:'Double digits. This is no longer an experiment \u2014 you are doing this for real.'},
  streak10:{test:(d,s,st)=>st.current>=10,icon:'\uD83D\uDC99',title:'10 Session Streak!',msg:'This is becoming second nature. This is who you are.'},
  pct50:{test:(d,s,st,t)=>t>0&&d>=Math.ceil(t*.5),icon:'\u2B50',title:'Halfway There!',msg:'50% of the program complete. The momentum is undeniable.'},
  pct75:{test:(d,s,st,t)=>t>0&&d>=Math.ceil(t*.75),icon:'\uD83C\uDFC6',title:'75% Complete!',msg:'Three quarters done. You can see the finish line from here.'},
  pct100:{test:(d,s,st,t)=>t>0&&d>=t,icon:'\uD83C\uDF1E',title:'Program Complete!',msg:'You finished the entire program. You are a different person than when you started.'},
  dist10k:{test:(d,s,st,t,m)=>m>=10000,icon:'\uD83D\uDEA3',title:'10 km Rowed!',msg:'Ten kilometers of real, measured meters. The flywheel knows the truth, and the truth is: you earned every one.'},
  dist25k:{test:(d,s,st,t,m)=>m>=25000,icon:'\uD83C\uDF0A',title:'25 km Rowed!',msg:'25 kilometers. That is further than swimming the English Channel would be. Keep pulling.'},
  dist42k:{test:(d,s,st,t,m)=>m>=42195,icon:'\uD83C\uDFC5',title:'Marathon Rowed!',msg:'42.2 km. You have rowed a full marathon, one stroke at a time.'},
  dist100k:{test:(d,s,st,t,m)=>m>=100000,icon:'\u26F5',title:'100 km Club!',msg:'Six figures of meters. This is the kind of volume that transforms a body.'},
  dist250k:{test:(d,s,st,t,m)=>m>=250000,icon:'\uD83D\uDC0B',title:'250 km Rowed!',msg:'A quarter of a thousand kilometers. Sea creatures are starting to recognize you.'},
  dist500k:{test:(d,s,st,t,m)=>m>=500000,icon:'\uD83C\uDF0D',title:'500 km Rowed!',msg:'Halfway to a million meters. Almost nobody gets here. You did.'},
  dist1000k:{test:(d,s,st,t,m)=>m>=1000000,icon:'\uD83D\uDD31',title:'ONE MILLION METERS!',msg:'1,000 km. The million meter club is real, and you are in it. Poseidon salutes you.'}
};

function calcStreak(data,sessions){
  const completed=data.completed||{};
  const sorted=[...sessions].sort((a,b)=>a.date-b.date);
  if(!sorted.length)return{current:0,best:0,shields:0};
  /* Shields: one earned per fully completed week */
  const weeks={};
  sorted.forEach(s=>{(weeks[s.week]=weeks[s.week]||[]).push(s)});
  let earned=0;
  for(const w in weeks){if(weeks[w].length&&weeks[w].every(s=>completed[s.key]))earned++}
  /* Scan all streaks to find true best */
  let best=0,run=0;
  for(let i=0;i<sorted.length;i++){
    if(completed[sorted[i].key]){run++;if(run>best)best=run}else{run=0}
  }
  /* Current streak: count backward from last completed */
  let lastDone=-1;
  for(let i=sorted.length-1;i>=0;i--){
    if(completed[sorted[i].key]){lastDone=i;break;}
  }
  if(lastDone===-1)return{current:0,best,shields:earned};
  let current=0,shields=earned;
  const today=new Date();today.setHours(0,0,0,0);
  for(let i=lastDone;i>=0;i--){
    if(completed[sorted[i].key])current++;
    else if(sorted[i].date>=today); /* today's pending session is not a miss yet */
    else if(shields>0)shields--; /* a shield bridges the gap, streak survives */
    else break;
  }
  return{current,best,shields};
}

function getHabitStage(doneCount){
  if(doneCount>=11)return{id:3,name:'Locked In',cls:'stage-3',colorCls:'c-blue',ring:'\u26A1',next:null,threshold:11};
  if(doneCount>=4)return{id:2,name:'Building Momentum',cls:'stage-2',colorCls:'c-green',ring:'\uD83D\uDD25',next:11,threshold:4};
  if(doneCount>=1)return{id:1,name:'Getting Started',cls:'stage-1',colorCls:'c-green',ring:'\uD83C\uDF31',next:4,threshold:1};
  return{id:0,name:'Not Started',cls:'',colorCls:'',ring:'\u2013',next:1,threshold:0};
}

function checkFullWeek(sessions){
  const data=loadData();if(!data)return false;
  const completed=data.completed||{};
  const prog=PROGRAMS[data.program];
  for(let w=1;w<=prog.weeks;w++){
    const ws=sessions.filter(s=>s.week===w);
    if(ws.length>0&&ws.every(s=>!!completed[s.key]))return true;
  }
  return false;
}

function checkMilestones(data,sessions,streakInfo){
  const doneCount=Object.keys(data.completed||{}).length;
  const total=totalAllSessions(data.program,data.days.length,(data.extraSessions||[]).length);
  const meters=lifetimeMeters(data);
  const shown=data.milestones||[];
  const found=[];
  for(const[id,m]of Object.entries(MILESTONES)){
    if(shown.includes(id))continue;
    if(m.test(doneCount,sessions,streakInfo,total,meters))found.push({id,icon:m.icon,title:m.title,msg:m.msg});
  }
  return found;
}

async function showMilestones(milestones,data){
  for(const m of milestones){
    await customAlertHtml(
      '<div class="milestone-icon">'+m.icon+'</div>'+
      '<div class="milestone-title">'+m.title+'</div>'+
      '<div class="milestone-msg">'+m.msg+'</div>'
    );
    if(!data.milestones)data.milestones=[];
    data.milestones.push(m.id);
    saveData(data);
  }
}

function renderHabitStrip(data,sessions){
  const el=$('#habitStrip');
  const completed=data.completed||{};
  const doneCount=Object.keys(completed).length;
  if(doneCount===0){el.innerHTML='';return}
  const si=calcStreak(data,sessions);
  const stage=getHabitStage(doneCount);
  if(si.best!==(data.bestStreak||0)){data.bestStreak=si.best;saveData(data)}
  const bestTxt=si.best>0?'Best: '+si.best:'';
  const progTxt=stage.next?doneCount+' / '+stage.next+' to next stage':doneCount+' sessions completed';
  el.innerHTML='<div class="sched-habit">'+
    '<div class="streak-box">'+
      '<div class="streak-num">'+si.current+'</div>'+
      '<div class="streak-label">Streak</div>'+
      (bestTxt?'<div class="streak-best">'+bestTxt+'</div>':'')+
      (si.shields>0?'<div class="streak-best">🛡 ×'+si.shields+'</div>':'')+
    '</div>'+
    '<div class="habit-divider"></div>'+
    '<div class="habit-badge">'+
      '<div class="habit-ring '+stage.cls+'">'+stage.ring+'</div>'+
      '<div class="habit-info">'+
        '<div class="habit-stage '+stage.colorCls+'">'+stage.name+'</div>'+
        (STAGE_IDENTITY[stage.id].subtitle?'<div class="habit-subtitle">'+STAGE_IDENTITY[stage.id].subtitle+'</div>':'')+
        '<div class="habit-progress">'+progTxt+'</div>'+
      '</div>'+
    '</div>'+
  '</div>';
}
export{calcStreak,checkMilestones,getHabitStage,renderHabitStrip,showMilestones};
