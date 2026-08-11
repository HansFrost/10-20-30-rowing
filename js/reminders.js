import{$}from'./dom.js';
import{PROGRAMS,dailySettings,getEffectiveTime,scheduleFor}from'./programs.js';
import{loadData}from'./store.js';
import{customAlert}from'./dom.js';

/* Calendar reminders: .ics with alarms -> native iOS notification banners, no server needed. */
function icsStamp(d,hm){
  const p=hm.split(':');
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+
    'T'+String(p[0]).padStart(2,'0')+String(p[1]).padStart(2,'0')+'00';
}
function sessionMinutes(s,cfg){
  if(s.type==='walk')return s.minutes||30;
  if(s.type==='steady')return s.minutes+9;
  return(cfg.warmup?4:0)+s.blocks*5+(s.blocks-1)*Math.round(cfg.restSec/60)+(cfg.cooldown?5:0);
}
/* Daily mode can drop the warm-up and the cool-down, so the calendar entry
   must be built from the user's settings, not the program constants. */
function sessionConfig(data){
  const prog=PROGRAMS[data.program];
  if(!prog.daily)return{restSec:prog.restSec,warmup:true,cooldown:true};
  const s=dailySettings(data);
  return{restSec:s.restSec,warmup:s.warmup,cooldown:s.cooldown};
}
function buildIcs(data){
  const cfg=sessionConfig(data);
  const sessions=scheduleFor(data);
  const today=new Date();today.setHours(0,0,0,0);
  const completed=data.completed||{};
  const upcoming=sessions.filter(s=>s.date>=today&&!completed[s.key]);
  if(!upcoming.length)return null;
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//10-20-30 Rowing//EN','CALSCALE:GREGORIAN'];
  upcoming.forEach(s=>{
    const hm=getEffectiveTime(data,s.key,s.actualDay,s.date)||'07:00';
    const title=s.type==='walk'?'Walk':s.type==='steady'?'Rowing: steady-state '+s.minutes+' min':'Rowing: 10-20-30 ('+s.blocks+' blocks)';
    L.push('BEGIN:VEVENT',
      'UID:'+s.key+'@10-20-30-rowing',
      'DTSTAMP:'+icsStamp(today,'00:00')+'Z',
      'DTSTART:'+icsStamp(s.date,hm),
      'DURATION:PT'+sessionMinutes(s,cfg)+'M',
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
