import{saveData}from'./store.js';
import{addDays,dateStr,fmtDate,parseDate}from'./util.js';
const ALL_DAYS=['mon','tue','wed','thu','fri','sat','sun'];
const DAY_OFFSET={mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6};
const DAY_LABELS={mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
const PROGRAMS={
  beginner:{
    name:'Beginner',weeks:8,restSec:180,
    defaultNumDays:3,minDays:2,maxDays:5,
    defaultDays:['tue','thu','sat'],
    weekRange:[[2],[2],[2,3,.67],[3],[3],[3],[3,4,.3],[3,4,.8]],
    desc:'Blocks ramp from 2 to 4. 3-min rest.'
  },
  intermediate:{
    name:'Intermediate',weeks:7,restSec:120,
    defaultNumDays:3,minDays:2,maxDays:5,
    defaultDays:['tue','thu','sat'],
    weekRange:[[3],[3],[3],[3,4,.3],[3,4,.8],[4],[4]],
    desc:'3 blocks building to 4. 2-min rest.'
  },
  advanced:{
    name:'Advanced',weeks:8,restSec:120,
    defaultNumDays:3,minDays:2,maxDays:5,
    defaultDays:['tue','thu','sat'],defaultSteady:'wed',
    weekRange:[[3],[3],[3],[3,4,.3],[3,4,.8],[4],[4],[4]],
    steadyMinutes:[30,30,35,35,35,40,40,40],
    desc:'Interval + 1 steady-state/week. Blocks 3\u20134. 2-min rest.'
  }
};

function distributeBlocks(base,peak,n,ratio){
  if(!peak||peak===base||!ratio||n<=0)return Array(Math.max(0,n)).fill(base);
  const numPeak=Math.min(n,Math.max(0,Math.round(n*ratio)));
  if(numPeak<=0)return Array(n).fill(base);
  if(numPeak>=n)return Array(n).fill(peak);
  const arr=Array(n).fill(base);
  for(let i=0;i<numPeak;i++){
    /* Spread peaks evenly from end to start */
    const pos=numPeak===1?n-1:Math.round((n-1)*(1-i/(numPeak-1)));
    arr[pos]=peak;
  }
  return arr;
}

function buildSchedule(startMon,progKey,days,steadyDay,swaps){
  const prog=PROGRAMS[progKey];
  const sessions=[];
  const n=days.length;
  for(let w=0;w<prog.weeks;w++){
    const weekMon=addDays(startMon,w*7);
    const wr=prog.weekRange[w];
    const wBlocks=distributeBlocks(wr[0],wr[1],n,wr[2]);
    const weekSessions=[];
    /* Interval sessions — one per chosen day */
    days.forEach((day,idx)=>{
      const key=(w+1)+'-'+day;
      const actualDay=(swaps&&swaps[key])||day;
      const date=addDays(weekMon,DAY_OFFSET[actualDay]);
      weekSessions.push({
        key,date,day:DAY_LABELS[actualDay],week:w+1,
        blocks:wBlocks[idx],type:'interval',minutes:0,
        defaultDay:day,actualDay,swapped:actualDay!==day
      });
    });
    /* Steady-state session (advanced) */
    if(prog.steadyMinutes){
      const sDay=steadyDay||'wed';
      const key=(w+1)+'-'+sDay+'-ss';
      const actualDay=(swaps&&swaps[key])||sDay;
      const date=addDays(weekMon,DAY_OFFSET[actualDay]);
      weekSessions.push({
        key,date,day:DAY_LABELS[actualDay],week:w+1,
        blocks:0,type:'steady',minutes:prog.steadyMinutes[w],
        defaultDay:sDay,actualDay,swapped:actualDay!==sDay
      });
    }
    weekSessions.sort((a,b)=>a.date-b.date);
    sessions.push(...weekSessions);
  }
  return sessions;
}

function injectExtras(sessions,data,startMon,progWeeks){
  if(!data.extraSessions||!data.extraSessions.length)return sessions;
  const all=[...sessions];
  const dayKeys=['sun','mon','tue','wed','thu','fri','sat'];
  data.extraSessions.forEach(function(ex){
    var d=parseDate(ex.date);
    var weekNum=Math.floor((d-startMon)/(7*86400000))+1;
    if(weekNum<1||weekNum>progWeeks)return;
    var dayKey=dayKeys[d.getDay()];
    all.push({key:'extra-'+ex.date,date:d,day:DAY_LABELS[dayKey],week:weekNum,
      blocks:ex.blocks,type:'interval',minutes:0,
      defaultDay:dayKey,actualDay:dayKey,swapped:false,isExtra:true});
  });
  all.sort(function(a,b){return a.date-b.date});
  return all;
}

function totalAllSessions(progKey,numDays,extraCount){
  const prog=PROGRAMS[progKey];
  let n=prog.weeks*numDays;
  if(prog.steadyMinutes)n+=prog.weeks;
  return n+(extraCount||0);
}

function getNext(sessions,today,completed){
  const u=sessions.filter(s=>s.date>today&&!completed[s.key]);
  if(!u.length)return 'Program complete!';
  const n=u[0];
  const label=n.type==='steady'?'Steady '+n.minutes+'m':n.blocks+' blocks';
  return n.day+' '+fmtDate(n.date)+' (Week '+n.week+', '+label+')';
}

function getEffectiveTime(data,key,day){
  if(data.sessionTimes&&data.sessionTimes[key])return data.sessionTimes[key];
  if(data.defaultTimes&&data.defaultTimes[day])return data.defaultTimes[day];
  return null;
}
function migrateData(data){
  if(data.days)return data;
  const prog=PROGRAMS[data.program];
  if(!prog)return data;
  data.days=prog.defaultDays.slice();
  if(prog.defaultSteady)data.steadyDay=prog.defaultSteady;
  /* Adjust startDate from Tuesday-based to Monday-based */
  const d=parseDate(data.startDate);
  d.setDate(d.getDate()-1);
  data.startDate=dateStr(d);
  if(!data.swaps)data.swaps={};
  saveData(data);
  return data;
}
export{ALL_DAYS,DAY_LABELS,DAY_OFFSET,PROGRAMS,buildSchedule,getEffectiveTime,getNext,injectExtras,migrateData,totalAllSessions};
