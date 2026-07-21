import{loadData}from'./store.js';
const DEFAULT_MAX_HR=176;
function getMaxHR(){const d=loadData();return(d&&d.maxHR)||DEFAULT_MAX_HR}
function calcZones(mhr){
  return{
    warmup:{lo:Math.round(mhr*.60),hi:Math.round(mhr*.70),label:'60\u201370%'},
    low:{lo:Math.round(mhr*.65),hi:Math.round(mhr*.75),label:'65\u201375%'},
    moderate:{lo:Math.round(mhr*.75),hi:Math.round(mhr*.85),label:'75\u201385%'},
    high:{lo:Math.round(mhr*.90),hi:mhr,label:'90\u2013100%'},
    rest:{lo:0,hi:Math.round(mhr*.70),label:'< 70%'},
    steady:{lo:Math.round(mhr*.65),hi:Math.round(mhr*.80),label:'65\u201380%'},
    cooldown:{lo:Math.round(mhr*.50),hi:Math.round(mhr*.65),label:'50\u201365%'},
    countdown:{lo:0,hi:0,label:''}
  };
}
function hrText(type){
  const z=calcZones(getMaxHR())[type];if(!z||!z.label)return '';
  return z.lo===0?'\u2764 < '+z.hi+' bpm ('+z.label+')':'\u2764 '+z.lo+'\u2013'+z.hi+' bpm ('+z.label+')';
}
function renderHrTable(mhr){
  const z=calcZones(mhr);
  const rows=[
    ['#1a4060','Warm-up',z.warmup],['#1a6b3d','Low (30s)',z.low],
    ['#8b7020','Moderate (20s)',z.moderate],['#8b2020','High (10s)',z.high],
    ['#1a3060','Rest',z.rest]
  ];
  let h='<table class="hr-table"><tr><th>Phase</th><th>HR Range</th><th>% Max</th></tr>';
  rows.forEach(r=>{
    const rng=r[2].lo===0?'< '+r[2].hi+' bpm':r[2].lo+'\u2013'+r[2].hi+' bpm';
    h+='<tr><td><span class="zc" style="background:'+r[0]+'"></span>'+r[1]+'</td><td>'+rng+'</td><td>'+r[2].label+'</td></tr>';
  });
  return h+'</table>';
}
export{DEFAULT_MAX_HR,hrText,renderHrTable};
