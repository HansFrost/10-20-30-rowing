const MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function dateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parseDate(s){const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r}
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function fmtDate(d){return d.getDate()+' '+MONTH_SHORT[d.getMonth()]}
function fmtTime(sec){const m=Math.floor(sec/60),s=sec%60;return m+':'+String(s).padStart(2,'0')}
export{WEEKDAY_NAMES,addDays,dateStr,fmtDate,fmtTime,parseDate,sameDay};
