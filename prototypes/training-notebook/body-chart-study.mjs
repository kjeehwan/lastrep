import { TODAY, metrics, observations, displayValue } from './home-model.mjs';
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso = d => d.toISOString().slice(0,10);
const date = v => new Date(`${v}T12:00:00Z`);
const fmt = (v, options={month:'short',day:'numeric'}) => date(v).toLocaleDateString('en-US',{...options,timeZone:'UTC'});
const pageSize = {day:7,week:8,month:10,year:5};
export const chartStudyStates = [
 ['chart-day','Body charts / Day','Daily recorded measurements, with compact date labels.'],
 ['chart-week','Body charts / Week averages','Each point is a weekly average of recorded days.'],
 ['chart-month','Body charts / Month averages','Each point is a monthly average of recorded days.'],
 ['chart-year','Body charts / Year averages','Each point is a yearly average of recorded days.'],
 ['chart-sparse','Body charts / two entries','Oct 12 and 15: fully visible, right aligned, with no repeated month label.'],
 ['chart-one','Body charts / one entry','One recorded day, fully visible at the right.'],
 ['chart-empty','Body charts / no entries','No invented zero measurements or averages.'],
];
function bucket(dateKey,range) {
 const start=date(dateKey),end=date(dateKey);
 if(range==='week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end.setTime(start.getTime());end.setUTCDate(end.getUTCDate()+6);}
 if(range==='month'){start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0);}
 if(range==='year'){start.setUTCMonth(0,1);end.setUTCMonth(11,31);}
 return {date:iso(start),end:iso(end)};
}
export function chartRows(s) {
 const grouped=new Map();
 for(const row of observations(s.records,s.metric).filter(r=>r.date<=TODAY)) {
  const period=bucket(row.date,s.chartRange), item=grouped.get(period.date)||{...period,sum:0,count:0,source:row.source};
  item.sum+=row[s.metric];item.count++;grouped.set(period.date,item);
 }
 return [...grouped.values()].map(r=>({...r,[s.metric]:r.sum/r.count}));
}
export function chartPage(s) {
 const rows=chartRows(s);
 return {rows,previous:rows.length>pageSize[s.chartRange],next:false};
}
function axisLabel(row,index,rows,range) {
 const first=index===0,previous=rows[index-1];
 if(range==='year')return row.date.slice(0,4);
 if(range==='month') { const firstInYear=first||row.date.slice(0,4)!==previous.date.slice(0,4); const yearStart=rows.findIndex(r=>r.date.slice(0,4)===row.date.slice(0,4)); return firstInYear?fmt(row.date,{month:'short'})+'\n'+row.date.slice(0,4):(Number(row.date.slice(5,7))-Number(rows[yearStart].date.slice(5,7)))%2===0?fmt(row.date,{month:'short'}):''; }
 if(range==='week')return first||row.end.slice(0,7)!==previous.end.slice(0,7)?row.end.slice(5,7)+'/'+row.end.slice(-2):Number(row.end.slice(-2));
 return first||row.date.slice(0,7)!==previous.date.slice(0,7)?row.date.slice(5,7)+'/'+row.date.slice(-2):Number(row.date.slice(-2));
}
function periodLabel(row,range) {
 if(range==='year')return row.date.slice(0,4);
 if(range==='month')return fmt(row.date,{month:'long',year:'numeric'});
 if(range==='week')return `${fmt(row.date)} \u2013 ${fmt(row.end)}, ${row.date.slice(0,4)}`;
 return fmt(row.date,{month:'short',day:'numeric',year:'numeric'});
}
export function bodyChartStudy(s) {
 const {rows,previous,next}=chartPage(s),selected=rows.find(r=>r.date===s.selected)||rows.at(-1),range=s.chartRange;
 const unit=s.metric==='bodyFat'?'%':s.unit,aggregate=range!=='day';
 const label=rows.length?(range==='year'?`${rows[0].date.slice(0,4)}${rows.length>1?' \u2013 '+rows.at(-1).date.slice(0,4):''}`:range==='month'?`${fmt(rows[0].date,{month:'short',year:'numeric'})}${rows.length>1?' \u2013 '+fmt(rows.at(-1).date,{month:'short',year:'numeric'}):''}`:`${fmt(rows[0].date,rows[0].date.slice(0,4)!==rows.at(-1).date.slice(0,4)?{month:'short',day:'numeric',year:'numeric'}:{month:'short',day:'numeric'})} \u2013 ${fmt(range==='week'?rows.at(-1).end:rows.at(-1).date,{month:'short',day:'numeric',year:'numeric'})}`):'No recorded measurements';
 const controls=`<div class="chart-range-tabs" aria-label="Chart range">${['day','week','month','year'].map(v=>`<button data-action="chart-range" data-value="${v}" aria-pressed="${range===v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div><div class="chart-period"><button class="icon-button" data-action="chart-previous" aria-label="Earlier measurements" ${previous?'':'disabled'}>&lsaquo;</button><span>${esc(label)}</span><button class="icon-button" data-action="chart-next" aria-label="Later measurements" ${next?'':'disabled'}>&rsaquo;</button></div>`;
 if(!selected)return controls+`<div class="chart-period-empty"><h4>No measurements yet</h4><p class="supporting">Add a measurement when you have one.</p></div>`;
 const step=330/pageSize[range],width=Math.max(330,rows.length*step),low=Math.min(...rows.map(r=>r[s.metric])),spread=Math.max(1,Math.max(...rows.map(r=>r[s.metric]))-low);
 const points=rows.map((r,i)=>({...r,x:width-step/2-(rows.length-1-i)*step,y:94-(r[s.metric]-low)/spread*62}));
 const partial=aggregate&&selected.date<=TODAY&&selected.end>=TODAY;
 return controls+`<div class="chart-study-summary"><span class="label">${aggregate?({week:'Weekly',month:'Monthly',year:'Yearly'}[range]+' average'):'Recorded value'}${partial?' &middot; To date':''}</span><div class="selected-measurement"><strong>${displayValue(selected[s.metric],s.metric,s.unit)}<small>${unit}</small></strong><span class="supporting">${esc(periodLabel(selected,range))}</span></div></div><div class="body-chart-scroll chart-study-scroll" role="region" tabindex="0" aria-label="${esc(metrics.find(m=>m[0]===s.metric)[1])} ${range} history; scroll for earlier points"><svg class="body-chart" style="width:${width/330*100}%;min-width:100%;height:154px" preserveAspectRatio="none" viewBox="0 0 ${width} 154" aria-label="${aggregate?range+' averages':'Recorded daily measurements'}"><path class="axis" d="M16 108H${width-16}"/>${points.length>1?`<polyline class="trend" points="${points.map(r=>`${r.x},${r.y}`).join(' ')}"/>`:''}${points.map((r,i)=>`<circle class="point ${r.date===selected.date?'selected':''}" cx="${r.x}" cy="${r.y}" r="4"/><circle class="point-hit" cx="${r.x}" cy="${r.y}" r="22" tabindex="0" role="button" aria-pressed="${r.date===selected.date}" aria-label="${esc(periodLabel(r,range))}, ${aggregate?'average ':''}${displayValue(r[s.metric],s.metric,s.unit)} ${unit}" data-action="select-point" data-date="${r.date}"/><text x="${r.x}" y="130" text-anchor="${'middle'}">${String(axisLabel(r,i,rows,range)).split('\n').map((line,j)=>`<tspan x="${r.x}" dy="${j?16:0}">${esc(line)}</tspan>`).join('')}</text>`).join('')}</svg></div><p class="chart-hint">${aggregate?`${selected.count} recorded ${selected.count===1?'day':'days'} &middot; Missing days excluded`:`${esc(selected.source)}`}<br>${aggregate?'Each point is a '+range+'ly average.':'Daily records; month labels appear only when needed.'}</p>`;
}
