import{$,showScreen}from'./dom.js';
import{loadData}from'./store.js';
import{calcXP,levelInfo,lifetimeMeters}from'./xp.js';
function progStat(v,l){return '<div class="finish-stat"><div class="finish-stat-num">'+v+'</div><div class="finish-stat-label">'+l+'</div></div>'}
function chartSvg(series,colors){
  const W=320,H=150,P=28;
  let max=0;series.forEach(s=>s.forEach(v=>{if(v>max)max=v}));
  if(max<=0)return '';
  max=Math.max(50,Math.ceil(max/50)*50);
  const n=series[0].length;
  const x=i=>n===1?(P+(W-P-6)/2):P+i*(W-P-6)/(n-1);
  const y=v=>H-16-(v/max)*(H-28);
  let out='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  [0,max/2,max].forEach(v=>{
    out+='<line x1="'+P+'" y1="'+y(v)+'" x2="'+(W-6)+'" y2="'+y(v)+'" stroke="rgba(255,255,255,'+(v===0?'.15':'.07')+')"/>'+
      '<text x="'+(P-4)+'" y="'+(y(v)+3)+'" font-size="8" fill="#7a8fa0" text-anchor="end">'+v+'</text>';
  });
  series.forEach((s,si)=>{
    const pts=s.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
    if(s.length>1)out+='<polyline points="'+pts+'" fill="none" stroke="'+colors[si]+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s.forEach((v,i)=>{out+='<circle cx="'+x(i).toFixed(1)+'" cy="'+y(v).toFixed(1)+'" r="2.5" fill="'+colors[si]+'"/>'});
  });
  return out+'</svg>';
}
function barsSvg(vals,color){
  const W=320,H=120,P=28;
  const max=Math.max.apply(null,vals);
  if(!(max>0))return '';
  const n=vals.length,slot=(W-P-6)/n,bw=Math.min(22,slot*.7);
  let out='<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  out+='<line x1="'+P+'" y1="'+(H-16)+'" x2="'+(W-6)+'" y2="'+(H-16)+'" stroke="rgba(255,255,255,.15)"/>'+
    '<text x="'+(P-4)+'" y="'+(H-13)+'" font-size="8" fill="#7a8fa0" text-anchor="end">0</text>'+
    '<text x="'+(P-4)+'" y="15" font-size="8" fill="#7a8fa0" text-anchor="end">'+max.toLocaleString()+'</text>';
  vals.forEach((v,i)=>{
    const bh=(v/max)*(H-32);
    out+='<rect x="'+(P+i*slot+(slot-bw)/2).toFixed(1)+'" y="'+(H-16-bh).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" rx="3" fill="'+color+'"/>';
  });
  return out+'</svg>';
}
function renderProgress(){
  const body=$('#progressBody');
  const data=loadData();
  if(!data){body.innerHTML='<div class="prog-empty">No program yet.</div>';return}
  const stats=data.sessionStats||{},completed=data.completed||{};
  const keys=Object.keys(stats).filter(k=>completed[k])
    .sort((a,b)=>new Date(completed[a])-new Date(completed[b]));
  const doneCount=Object.keys(completed).length;
  const xp=calcXP(data),li=levelInfo(xp),lm=lifetimeMeters(data);
  const totStrokes=keys.reduce((s,k)=>s+(stats[k].strokes||0),0);
  const pb=(data.pm5PB&&data.pm5PB.peakW)||0;
  let h='<div class="finish-stats">'+
    progStat(lm?lm.toLocaleString():'0','Lifetime meters')+
    progStat(doneCount,'Sessions done')+
    progStat(pb?pb+' W':'–','Peak power PB')+
    progStat(totStrokes?totStrokes.toLocaleString():'–','Total strokes')+
    progStat('LVL '+li.lvl,li.rank)+
    progStat(data.bestStreak||0,'Best streak')+
    progStat(walkKeys.length,'Walks logged')+
    progStat((walkKeys.reduce((s,k)=>s+(stats[k].m||0),0)/1000).toFixed(1)+' km','Walked')+
  '</div>';
  const walkKeys=keys.filter(k=>stats[k].walk);
  const chartKeys=keys.filter(k=>!stats[k].walk&&!stats[k].steady&&stats[k].avgW);
  if(chartKeys.length>=2){
    h+='<div class="prog-chart-card"><div class="prog-chart-title">Power per session</div>'+
      chartSvg([chartKeys.map(k=>stats[k].bestSprint||0),chartKeys.map(k=>stats[k].avgW||0)],['#B7BF10','#60a5fa'])+
      '<div class="prog-legend"><span><i style="background:#B7BF10"></i>Best sprint (W)</span>'+
      '<span><i style="background:#60a5fa"></i>Avg power (W)</span></div></div>';
  }
  if(walkKeys.length>=2){
    h+='<div class="prog-chart-card"><div class="prog-chart-title">Km per walk</div>'+
      barsSvg(walkKeys.map(k=>Math.round((stats[k].m||0)/10)/100),'#60a5fa')+'</div>';
  }
  if(keys.filter(k=>!stats[k].walk).length>=2){
    h+='<div class="prog-chart-card"><div class="prog-chart-title">Meters per session</div>'+
      barsSvg(keys.filter(k=>!stats[k].walk).map(k=>stats[k].m||0),'#22c55e')+'</div>';
  }
  if(keys.length<2){
    h+='<div class="prog-empty">Row at least two sessions with the PM5 connected to unlock power and distance charts.</div>';
  }
  body.innerHTML=h;
}

$('#progressBtn').addEventListener('click',()=>{renderProgress();showScreen('#progress')});
$('#progressBackBtn').addEventListener('click',()=>showScreen('#schedule'));
