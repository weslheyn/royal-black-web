import React,{useEffect,useRef} from 'react';
import {createChart,ColorType,LineStyle} from 'lightweight-charts';
export default function MT4PriceChart({pair,quotes,trades}){
 const host=useRef(null);
 useEffect(()=>{
  if(!host.current)return;
  const chart=createChart(host.current,{width:host.current.clientWidth,height:490,layout:{background:{type:ColorType.Solid,color:'#101827'},textColor:'#cbd5e1'},grid:{vertLines:{color:'#243042'},horzLines:{color:'#243042'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155',timeVisible:true,secondsVisible:true}});
  const line=chart.addLineSeries({color:'#d9b778',lineWidth:2,priceLineVisible:true,title:'MT4 Mid'});
  const filtered=(quotes||[]).filter(q=>String(q.symbol||'').toUpperCase().startsWith(pair)&&Number(q.bid)>0&&Number(q.ask)>0).map(q=>({time:Math.floor(Date.parse(q.observed_at)/1000),value:(Number(q.bid)+Number(q.ask))/2})).filter(q=>Number.isFinite(q.time)&&Number.isFinite(q.value)).sort((a,b)=>a.time-b.time);
  const unique=[...new Map(filtered.map(q=>[q.time,q])).values()];
  if(unique.length)line.setData(unique);
  const levels=[];
  (trades||[]).filter(t=>t.status==='OPEN'&&String(t.symbol||'').toUpperCase().startsWith(pair)).forEach(t=>{
   const add=(price,title,color,style)=>{const n=Number(price);if(Number.isFinite(n)&&n>0)levels.push(line.createPriceLine({price:n,color,lineWidth:1,lineStyle:style,axisLabelVisible:true,title}));};
   add(t.entry_price,t.direction+' ENTRADA','#d9b778',LineStyle.Solid);
   add(t.stop_price,'STOP','#ef6b6b',LineStyle.Dashed);
   for(let n=1;n<=5;n++)if(t['target'+n+'_price']!=null)add(t['target'+n+'_price'],'ALVO '+n,'#4ac9a4',LineStyle.Dashed);
  });
  if(unique.length)chart.timeScale().fitContent();
  const observer=new ResizeObserver(entries=>{if(entries[0]?.contentRect?.width)chart.applyOptions({width:entries[0].contentRect.width})});
  observer.observe(host.current);
  return()=>{observer.disconnect();chart.remove()};
 },[pair,quotes,trades]);
 const available=(quotes||[]).filter(q=>String(q.symbol||'').toUpperCase().startsWith(pair));
 return <div><div ref={host} style={{width:'100%',minHeight:490}}/><p style={{fontSize:12,opacity:.8}}>{available.length?'Gráfico MT4: '+available.length+' cotação(ões) recentes disponíveis.':'Sem cotações MT4 recentes deste par.'} As linhas representam os níveis reais registrados nas operações virtuais. Histórico completo de candles ainda não está integrado.</p></div>;
}
