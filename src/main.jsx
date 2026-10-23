import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer,BarChart,Bar,ReferenceLine } from 'recharts';
import './style.css';
import LiveDashboard from './LiveDashboard.jsx';

const modules = ['Dashboard','Operações abertas','Histórico','Detalhe da operação','Performance','Por par','Por período','Calendário','Desalinhamentos','Alertas','Relatórios','Configurações','Sincronização'];
const sample = [{d:'01',saldo:25000,equity:25000},{d:'05',saldo:25250,equity:25130},{d:'10',saldo:24900,equity:24600},{d:'15',saldo:25500,equity:25300},{d:'20',saldo:26000,equity:25920},{d:'25',saldo:25800,equity:25500},{d:'30',saldo:26850,equity:26600}];
const mockTrades = [
 {symbol:'EURUSD',side:'COMPRA',entry:'1,08420',stop:'1,07920',target:'1,10920',pnl:320,misaligned:false},
 {symbol:'EURAUD',side:'VENDA',entry:'1,60465',stop:'1,61165',target:'1,56965',pnl:-110,misaligned:true},
 {symbol:'GBPJPY',side:'COMPRA',entry:'194,250',stop:'193,700',target:'197,000',pnl:450,misaligned:false}
];
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(n);
function ChartBox({title,children}) { return <section className="panel"><h3>{title}</h3>{children}</section> }
function App(){
 const [module,setModule]=useState('Dashboard');
 const [month,setMonth]=useState(9);
 const [selectedDay,setSelectedDay]=useState(null);
 // Prefer authenticated real data when Supabase is configured; examples remain opt-in.
 const [demo,setDemo]=useState(!Boolean(import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY));
 if (!demo) return <LiveDashboard onDemo={()=>setDemo(true)}/>;
 const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 const year=2026;
 const offset=(new Date(year,month,1).getDay()+6)%7;
 const days=new Date(year,month+1,0).getDate();
 const pnlByDay={2:220,3:-180,6:410,8:95,9:-125,12:350,13:-90,15:230,16:175,19:-210,20:540,22:180,23:-75,26:320,27:290,29:-110};
 const cards=[['Saldo virtual',money(26850)],['Equity',money(26600)],['Resultado realizado','+US$ 1.850,00'],['Drawdown máximo','7,8%'],['Operações abertas','3'],['Taxa de acerto','64%']];
 const chart=<ResponsiveContainer width="100%" height={260}><LineChart data={sample}><CartesianGrid stroke="#293241" strokeDasharray="3 3"/><XAxis dataKey="d" stroke="#8e98aa"/><YAxis stroke="#8e98aa" tickFormatter={x=>'$'+Math.round(x/1000)+'k'}/><Tooltip contentStyle={{background:'#202936',border:'1px solid #3c4657'}} formatter={x=>money(x)}/><Line type="monotone" dataKey="saldo" name="Saldo" stroke="#d9b778" strokeWidth={3}/><Line type="monotone" dataKey="equity" name="Equity" stroke="#55bba5" strokeWidth={2}/></LineChart></ResponsiveContainer>;
 const calendar=<><div className="calendar-head"><button onClick={()=>{setMonth((month+11)%12);setSelectedDay(null)}}>‹</button><strong>{months[month]} {year}</strong><button onClick={()=>{setMonth((month+1)%12);setSelectedDay(null)}}>›</button></div><div className="calendar-grid">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=><div className="week" key={x}>{x}</div>)}{Array.from({length:offset},(_,i)=><div key={'blank'+i}/>)}{Array.from({length:days},(_,i)=>{const d=i+1;const v=month===9?pnlByDay[d]:undefined;return <button key={d} onClick={()=>setSelectedDay(d)} className={'day '+(v>0?'positive':v<0?'negative':'')+(selectedDay===d?' selected':'')}><span>{d}</span><b>{v===undefined?'—':(v>0?'+':'')+'$'+v}</b></button>})}</div>{selectedDay&&<div className="day-detail">Dia {selectedDay}/{String(month+1).padStart(2,'0')}/{year} · Resultado: <strong>{pnlByDay[selectedDay]===undefined?'Sem operações encerradas':money(pnlByDay[selectedDay])}</strong><p>Detalhamento por operação será carregado do Supabase quando houver dados reais.</p></div>}</>;
 return <div className="layout"><aside className="sidebar"><div className="brand">ROYAL <span>BLACK</span><small>FOREX SIMULATOR</small></div><nav>{modules.map(m=><button className={module===m?'active':''} onClick={()=>setModule(m)} key={m}>{m}</button>)}</nav><div className="sidefoot">MT4: não conectado<br/>Ambiente: demonstração</div></aside><main><header><div><span className="eyebrow">ROYAL BLACK / {module}</span><h1>{module}</h1></div><div className="auth-actions"><span className="status">● DEMONSTRAÇÃO</span><button onClick={()=>setDemo(false)}>Conectar Supabase</button></div></header><div className="notice">Dados ilustrativos. Nenhuma operação real ou simulada está conectada ao MT4 neste painel.</div>
 {module==='Dashboard'&&<><div className="cards">{cards.map(([k,v])=><div className="metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><div className="twocol"><ChartBox title="Evolução do saldo e equity">{chart}</ChartBox><ChartBox title="Calendário financeiro — resumo">{calendar}</ChartBox></div><ChartBox title="Operações — exemplo"><TradeTable trades={mockTrades}/></ChartBox></>}
 {module==='Calendário'&&<ChartBox title="Resultados por dia">{calendar}</ChartBox>}
 {module==='Performance'&&<><div className="cards">{cards.slice(2,6).map(([k,v])=><div className="metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><ChartBox title="Saldo e patrimônio">{chart}</ChartBox><ChartBox title="Resultado por par"><ResponsiveContainer width="100%" height={260}><BarChart data={[{symbol:'EURUSD',pnl:780},{symbol:'GBPUSD',pnl:-210},{symbol:'USDJPY',pnl:450},{symbol:'EURAUD',pnl:830}]}><CartesianGrid stroke="#293241"/><XAxis dataKey="symbol" stroke="#8e98aa"/><YAxis stroke="#8e98aa"/><Tooltip/><ReferenceLine y={0} stroke="#888"/><Bar dataKey="pnl" fill="#d9b778"/></BarChart></ResponsiveContainer></ChartBox></>}
 {['Operações abertas','Histórico','Detalhe da operação'].includes(module)&&<ChartBox title={module}><TradeTable trades={mockTrades}/></ChartBox>}
 {!['Dashboard','Calendário','Performance','Operações abertas','Histórico','Detalhe da operação'].includes(module)&&<ChartBox title={module}><p className="placeholder">Módulo reservado na navegação. A implementação funcional dependerá da ingestão validada dos dados MT4.</p></ChartBox>}
 </main></div>
}
function TradeTable({trades}){return <div className="table-scroll"><table><thead><tr><th>Par</th><th>Direção</th><th>Entrada</th><th>STOP</th><th>ALVO 5</th><th>Flutuante</th><th>Desalinhamento</th></tr></thead><tbody>{trades.map(t=><tr key={t.symbol}><td>{t.symbol}</td><td>{t.side}</td><td>{t.entry}</td><td>{t.stop}</td><td>{t.target}</td><td className={t.pnl>=0?'profit':'loss'}>{money(t.pnl)}</td><td>{t.misaligned?'Sim':'Não'}</td></tr>)}</tbody></table></div>}
createRoot(document.getElementById('root')).render(<App/>);
