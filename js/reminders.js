import{$}from'./dom.js';
import{PROGRAMS,buildSchedule,getEffectiveTime,injectExtras}from'./programs.js';
import{loadData}from'./store.js';
import{customAlert}from'./dom.js';
import{parseDate}from'./util.js';

/* Calendar reminders: .ics with alarms -> native iOS notification banners, no server needed. */
function icsStamp(d,hm){
  const p=hm.split(':');
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+
    'T'+String(p[0]).padStart(2,'0')+String(p[1]).padStart(2,'0')+'00';
}
function sessionMinutes(s,prog){
  if(s.type==='steady')return s.minutes+9;
  return 4+s.blocks*5+(s.blocks-1)*Math.round(prog.restSec/60)+5;
}
function buildIcs(data){
  const prog=PROGRAMS[data.program];
  const startMon=parseDate(data.startDate);
  const sessions=injectExtras(buildSchedule(startMon,data.program,data.days,data.steadyDay,data.swaps||{}),data,startMon,prog.weeks);
  const today=new Date();today.setHours(0,0,0,0);
  const completed=data.completed||{};
  const upcoming=sessions.filter(s=>s.date>=today&&!completed[s.key]);
  if(!upcoming.length)return null;
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//10-20-30 Rowing//EN','CALSCALE:GREGORIAN'];
  upcoming.forEach(s=>{
    const hm=getEffectiveTime(data,s.key,s.actualDay,s.date)||'07:00';
    const title=s.type==='steady'?'Rowing: steady-state '+s.minutes+' min':'Rowing: 10-20-30 ('+s.blocks+' blocks)';
    L.push('BEGIN:VEVENT',
      'UID:'+s.key+'@10-20-30-rowing',
      'DTSTAMP:'+icsStamp(today,'00:00')+'Z',
      'DTSTART:'+icsStamp(s.date,hm),
      'DURATION:PT'+sessionMinutes(s,prog)+'M',
      'SUMMARY:'+title,
      'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:Rowing in 30 minutes','END:VALARM',
      'BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Time to row','END:VALARM',
      'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
$('#remindersBtn').addEventListener('click',()=>{
  const data=loadData();if(!data)return;
  const ics=buildIcs(data);
  if(!ics){customAlert('No upcoming sessions to remind you about.');return}
  const blob=new Blob([ics],{type:'text/calendar'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='rowing-sessions.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  customAlert('Calendar file created. Open it and tap "Add All" to get a notification 30 minutes before every remaining session. Re-export after changing days or times.');
});
