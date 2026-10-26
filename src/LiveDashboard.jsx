import MT4PriceChart from './MT4PriceChart.jsx';
import DevicePairing from './DevicePairing.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {supabase} from './supabaseClient.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(Number(n)||0);
export default function LiveDashboard({onDemo}){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [account,setAccount]=useState(null),[trades,setTrades]=useState([]),[days,setDays]=useState([]),[pairs,setPairs]=useState([]),[snapshots,setSnapshots]=useState([]),[tradeCount,setTradeCount]=useState(null),[verifiedContracts,setVerifiedContracts]=useState(null);
 const [module,setModule]=useState('Dashboard'),[month,setMonth]=useState(new Date().getMonth()),[selectedDay,setSelectedDay]=useState(null),[diagnostics,setDiagnostics]=useState([]),[devices,setDevices]=useState([]),[quotes,setQuotes]=useState([]),[m5Trades,setM5Trades]=useState([]),[contractData,setContractData]=useState([]);
 const [candles,setCandles]=useState([]);
 const [brokerAccounts,setBrokerAccounts]=useState([]),[selectedBrokerId,setSelectedBrokerId]=useState('');
 const [accountView,setAccountView]=useState('simulation');
 const [tvPair,setTvPair]=useState('EURUSD'),[tvInterval,setTvInterval]=useState('60');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[lastUpdated,setLastUpdated]=useState(null);
 const refreshInFlight=useRef(false);
 const refreshEpoch=useRef(0);
 useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)});
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
 return ()=>{active=false;subscription.unsubscribe()};},[]);
 useEffect(()=>{refreshEpoch.current+=1;refreshInFlight.current=false;setBusy(false);setError('');setNotice('');
 if(!session){setAccount(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);setTradeCount(null);setVerifiedContracts(null);setLastUpdated(null);setDiagnostics([]);setDevices([]);setM5Trades([]);setContractData([]);setCandles([]);setBrokerAccounts([]);setSelectedBrokerId('');return;}
 refresh();
 const loadBrokerAccounts=async()=>{const {data,error:e}=await supabase.from('rb_broker_accounts').select('id,broker,server,login_number,currency,balance,equity,margin_free,is_demo,last_seen_at').order('created_at',{ascending:true});if(!e&&activeBrokerRef.current)setBrokerAccounts(data||[]);};
 const activeBrokerRef={current:true};
 loadBrokerAccounts();
 const timer=setInterval(()=>{if(!document.hidden)refresh()},10000);
 return ()=>{activeBrokerRef.current=false;clearInterval(timer)};
 },[session?.user?.id]);
 async function authenticate(mode){
  if(!supabase)return;setBusy(true);setError('');setNotice('');
  const {error:e}=mode==='signup'?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
  if(e)setError(e.message);else if(mode==='signup')setNotice('Cadastro solicitado. Verifique o e-mail se a confirmação estiver habilitada.');
  setBusy(false);
 }
 async function refresh(){
  if(!supabase||!session||refreshInFlight.current)return;
  const epoch=refreshEpoch.current;
  const sameSession=()=>epoch===refreshEpoch.current;
  refreshInFlight.current=true;setBusy(true);setError('');
  try{
   let {data:accounts,error:aerr}=await supabase.from('sim_accounts').select('id,name,currency,initial_balance,fixed_lots').order('created_at',{ascending:true}).limit(1);
   if(aerr)throw aerr;
   if(!accounts?.length){
    const {error:rpcError}=await supabase.rpc('royal_create_initial_account');
    if(rpcError)throw rpcError;
    ({data:accounts,error:aerr}=await supabase.from('sim_accounts').select('id,name,currency,initial_balance,fixed_lots').limit(1));
    if(aerr)throw aerr;
   }
   const current=accounts?.[0];if(!current)throw new Error('Não foi possível obter a conta virtual.');
   const [t,d,p,s,total,contracts,diag,dev,q,m5,cv]=await Promise.all([
    supabase.from('sim_trades').select('id,symbol,direction,status,entry_price,stop_price,target5_price,opened_at,closed_at,realized_pnl,mfe_amount,mae_amount,had_misalignment').eq('account_id',current.id).order('opened_at',{ascending:false}).limit(1000),
    supabase.from('sim_daily_results').select('*').eq('account_id',current.id).order('close_date_utc',{ascending:false}).limit(1000),
    supabase.from('sim_symbol_results').select('*').eq('account_id',current.id).limit(1000),
    supabase.from('sim_equity_snapshots').select('observed_at,balance,equity,floating_pnl').eq('account_id',current.id).order('observed_at',{ascending:false}).limit(1000),
    supabase.from('sim_trades').select('id',{count:'exact',head:true}).eq('account_id',current.id),
    supabase.from('sim_contract_snapshots').select('id',{count:'exact',head:true}).eq('account_id',current.id).eq('is_verified',true),
    supabase.from('sim_diagnostic_signals').select('id,signal_key,symbol,direction,entry_price,stop_price,target5_price,source,signal_time,received_at').eq('account_id',current.id).order('received_at',{ascending:false}).limit(500),
    supabase.from('sim_devices').select('id,label,is_active,last_seen_at').eq('account_id',current.id).eq('is_active',true),
    supabase.from('sim_market_quotes').select('symbol,bid,ask,observed_at').eq('account_id',current.id).order('observed_at',{ascending:false}).limit(500),
    supabase.from('sim_m5_virtual_trades').select('*').eq('account_id',current.id).order('opened_at',{ascending:false}).limit(1000),
    supabase.from('sim_contract_snapshots').select('symbol,point,tick_size_points,tick_value_deposit,usd_per_deposit_unit,is_verified,captured_at').eq('account_id',current.id).eq('is_verified',true).order('captured_at',{ascending:false}).limit(200)
   ]);
   for(const result of [t,d,p,s,total,contracts,diag,dev,q,m5,cv])if(result.error)throw result.error;
   if(!sameSession())return;
   setAccount(current);setTradeCount(total.count);setVerifiedContracts(contracts.count);setTrades(t.data||[]);setDays(d.data||[]);setPairs(p.data||[]);setSnapshots(s.data||[]);setDiagnostics(diag.data||[]);setDevices(dev.data||[]);setQuotes(q.data||[]);setM5Trades(m5.data||[]);setContractData(cv.data||[]);
   if(!Number.isSafeInteger(total.count)||total.count!==(t.data?.length||0)||[d,p,s].some(x=>(x.data?.length||0)===1000))setNotice('Histórico parcialmente carregado: alguns indicadores ou tabelas podem estar incompletos.');
   else setNotice('');
   setLastUpdated(new Date());
  }catch(e){if(!sameSession())return;setError(e.message||'Falha na consulta.');setAccount(null);setTradeCount(null);setVerifiedContracts(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);setDiagnostics([]);setDevices([]);setM5Trades([]);setContractData([]);}
  finally{if(sameSession()){refreshInFlight.current=false;setBusy(false)}}
 }
 useEffect(()=>{if(!session||!account?.id){setCandles([]);return;}let active=true;supabase.from('sim_market_candles').select('symbol,candle_time,open,high,low,close').eq('account_id',account.id).eq('timeframe','M1').ilike('symbol',tvPair+'%').order('candle_time',{ascending:false}).limit(1500).then(({data,error})=>{if(active)setCandles(error?[]:(data||[]))});return()=>{active=false};},[session?.user?.id,account?.id,tvPair,lastUpdated]);
 if(!supabase)return <div className="live-screen"><h2>Conexão ainda não configurada</h2><p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY na hospedagem. Não utilize service_role.</p><button onClick={onDemo}>Voltar à demonstração</button></div>;
 if(!session)return <div className="live-screen"><h2>ROYAL BLACK · Acesso seguro</h2><p>Entre para visualizar exclusivamente seus dados no Supabase.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><div className="auth-actions"><button disabled={busy||!email||!password} onClick={()=>authenticate('signin')}>Entrar</button><button disabled={busy||!email||password.length<6} onClick={()=>authenticate('signup')}>Criar conta</button><button onClick={onDemo}>Ver demonstração</button></div>{error&&<p role="alert">{error}</p>}{notice&&<p>{notice}</p>}</div>;
 if(!account)return <div className="live-screen"><h2>Conta virtual indisponível</h2><p>{busy?'Carregando dados da conta...':'Não foi possível carregar a conta virtual nesta consulta.'}</p>{error&&<p role="alert">{error}</p>}<div className="auth-actions"><button onClick={refresh} disabled={busy}>Tentar novamente</button><button onClick={()=>supabase.auth.signOut()}>Sair</button><button onClick={onDemo}>Demonstração</button></div></div>;
 const closed=trades.filter(x=>x.status==='CLOSED');
 const pnl=closed.reduce((a,t)=>a+Number(t.realized_pnl||0),0);
 const metricsComplete=Number.isSafeInteger(tradeCount)&&tradeCount===trades.length;
 const dailyComplete=metricsComplete&&days.length<1000;
 const symbolComplete=metricsComplete&&pairs.length<1000;
 const balance=Number(account?.initial_balance||25000)+pnl;
 const latest=snapshots[0];
 const wins=closed.filter(t=>Number(t.realized_pnl)>0).length;
 const modules=['Dashboard','Gráfico de mercado','Operações abertas','Histórico','Detalhe da operação','Performance','Por par','Por período','Calendário','Desalinhamentos','Alertas','Relatórios','Configurações','Sincronização'];
 const now=new Date(),year=now.getFullYear(),months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 const offset=(new Date(year,month,1).getDay()+6)%7,daysInMonth=new Date(year,month+1,0).getDate();
 const dayMap=new Map(days.map(d=>[String(d.close_date_utc),Number(d.net_pnl||0)]));
 const active=trades.filter(t=>t.status==='OPEN'),lastSeen=devices.map(d=>Date.parse(d.last_seen_at||'')).filter(Number.isFinite).sort((a,b)=>b-a)[0];
 const online=Boolean(lastSeen&&Date.now()-lastSeen<180000);
 const fmtPrice=x=>x===null||x===undefined?'—':String(x);
 const tradeRows=module==='Histórico'?trades.filter(t=>t.status==='CLOSED'):module==='Operações abertas'?active:trades;
 const signalRows=diagnostics.filter(x=>x.source==='M5_CSV');
 const [quoteBySymbol,quotePending]=[new Map(),!quotes.length];
 quotes.forEach(q=>{if(!quoteBySymbol.has(q.symbol))quoteBySymbol.set(q.symbol,q)});
 const simulated=signalRows.map(x=>{
 const q=quoteBySymbol.get(x.symbol),fresh=q&&Date.now()-Date.parse(q.observed_at)<120000;
 const current=fresh?Number(x.direction==='BUY'?q.bid:q.ask):null;
 const entry=Number(x.entry_price),stop=Number(x.stop_price);
 const move=current===null?null:(current-entry)*(x.direction==='BUY'?1:-1);
 const r=move===null||entry===stop?null:move/Math.abs(entry-stop);
 return {...x,current,move,r};
 });
 const simulatedTable=<div className="table-scroll"><table><thead><tr><th>Par</th><th>Direção</th><th>Entrada virtual</th><th>Preço atual</th><th>STOP</th><th>Alvo 5</th><th>Variação</th><th>Risco (R)</th></tr></thead><tbody>{simulated.map(x=><tr key={x.id}><td>{x.symbol}</td><td>{x.direction}</td><td>{x.entry_price}</td><td>{x.current===null?'Sem cotação':x.current.toFixed(5)}</td><td>{x.stop_price}</td><td>{x.target5_price}</td><td>{x.move===null?'—':x.move.toFixed(5)}</td><td>{x.r===null?'—':x.r.toFixed(2)+'R'}</td></tr>)}</tbody></table>{!simulated.length&&<p>Aguardando níveis Grid M5.</p>}</div>;
 const m5Closed=m5Trades.filter(t=>t.status==='CLOSED'),m5Open=m5Trades.filter(t=>t.status==='OPEN');
 const m5R=t=>{const risk=Math.abs(Number(t.entry_price)-Number(t.stop_price));return risk>0?(Number(t.exit_price)-Number(t.entry_price))*(t.direction==='BUY'?1:-1)/risk:null};
 const m5Wins=m5Closed.filter(t=>(m5R(t)||0)>0).length;
 const m5Stops=m5Closed.filter(t=>t.close_reason==='STOP_OBSERVED').length,m5Targets=m5Closed.filter(t=>t.close_reason==='TARGET5_OBSERVED').length;
 const m5Realized=m5Closed.reduce((a,t)=>a+(m5R(t)||0),0);
 const m5Floating=m5Open.reduce((a,t)=>{const risk=Math.abs(Number(t.entry_price)-Number(t.stop_price)),mark=Number(t.last_price);return a+(risk>0&&mark>0?(mark-Number(t.entry_price))*(t.direction==='BUY'?1:-1)/risk:0)},0);
 const m5Stats=<div className="cards">{[['Entradas virtuais',m5Trades.length],['Abertas',m5Open.length],['Encerradas',m5Closed.length],['Vitórias',m5Wins],['Derrotas',m5Closed.length-m5Wins],['Taxa de acerto',m5Closed.length?(100*m5Wins/m5Closed.length).toFixed(1)+'%':'—'],['STOP observado',m5Stops],['Alvo 5 observado',m5Targets],['Realizado',m5Realized.toFixed(2)+'R'],['Flutuante',m5Floating.toFixed(2)+'R']].map(([name,value])=><div className="metric" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>;
 const m5Table=<div className="table-scroll"><table><thead><tr><th>Sinal</th><th>Par</th><th>Direção</th><th>Entrada</th><th>Preço observado</th><th>STOP</th><th>Alvos 1–5</th><th>Status</th><th>Resultado</th><th>Última cotação</th></tr></thead><tbody>{m5Trades.map(t=>{const risk=Math.abs(Number(t.entry_price)-Number(t.stop_price)),mark=Number(t.status==='CLOSED'?t.exit_price:t.last_price);const r=t.status==='CLOSED'?m5R(t):risk>0&&mark>0?(mark-Number(t.entry_price))*(t.direction==='BUY'?1:-1)/risk:null;const stale=t.status==='OPEN'&&(!t.last_quote_at||Date.now()-Date.parse(t.last_quote_at)>120000);const targets=[t.target1_price,t.target2_price,t.target3_price,t.target4_price,t.target5_price].filter(x=>x!==null&&x!==undefined);return <tr key={t.id}><td title={t.signal_key}>{String(t.signal_key||'').split('|').slice(-1)[0]}</td><td>{t.symbol}</td><td>{t.direction}</td><td>{t.entry_price}</td><td>{mark>0?mark:'—'}</td><td>{t.stop_price}</td><td>{targets.join(' / ')}</td><td>{t.status==='CLOSED'?(t.close_reason==='STOP_OBSERVED'?'STOP observado':'Alvo 5 observado'):(stale?'ABERTA · cotação atrasada':'ABERTA')}</td><td>{r===null?'—':r.toFixed(2)+'R'}</td><td>{t.last_quote_at?new Date(t.last_quote_at).toLocaleString('pt-BR'):'—'}</td></tr>})}</tbody></table>{!m5Trades.length&&<p>Aguardando sinais Grid M5.</p>}</div>;
 const m5BySymbol=Object.values(m5Trades.reduce((acc,t)=>{const a=acc[t.symbol]||(acc[t.symbol]={symbol:t.symbol,total:0,open:0,closed:0,wins:0,r:0});a.total++;if(t.status==='OPEN')a.open++;else{a.closed++;const v=m5R(t)||0;a.r+=v;if(v>0)a.wins++}return acc},{}));
 const m5SymbolTable=<div className="table-scroll"><table><thead><tr><th>Par</th><th>Sinais</th><th>Abertas</th><th>Encerradas</th><th>Vitórias</th><th>Resultado</th></tr></thead><tbody>{m5BySymbol.map(x=><tr key={x.symbol}><td>{x.symbol}</td><td>{x.total}</td><td>{x.open}</td><td>{x.closed}</td><td>{x.wins}</td><td>{x.r.toFixed(2)}R</td></tr>)}</tbody></table></div>;
 const contractBySymbol=new Map();contractData.forEach(c=>{if(!contractBySymbol.has(c.symbol))contractBySymbol.set(c.symbol,c)});
 const pnlUsd=t=>{const c=contractBySymbol.get(t.symbol),step=Number(c?.point)*Number(c?.tick_size_points),value=Number(c?.tick_value_deposit)*Number(c?.usd_per_deposit_unit),lots=Number(account?.fixed_lots);if(!c||!step||!value||!lots)return null;const price=Number(t.status==='CLOSED'?t.exit_price:t.last_price);if(!price)return null;return (price-Number(t.entry_price))*(t.direction==='BUY'?1:-1)/step*value*lots};
 const priced=m5Trades.map(t=>pnlUsd(t)),usdReady=m5Trades.length>0&&priced.every(x=>x!==null&&Number.isFinite(x));
 const realizedUsd=usdReady?m5Closed.reduce((a,t)=>a+pnlUsd(t),0):null;
 const floatingUsd=usdReady?m5Open.reduce((a,t)=>a+pnlUsd(t),0):null;
 const initialUsd=Number(account.initial_balance);
 const accountBalance=usdReady?initialUsd+realizedUsd:null;
 const accountEquity=usdReady?accountBalance+floatingUsd:null;
 const financialCards=[['Saldo inicial',money(initialUsd)],['Saldo virtual',usdReady?money(accountBalance):'Aguardando contratos'],['Equity',usdReady?money(accountEquity):'Aguardando contratos'],['Lucro/prejuízo realizado',usdReady?money(realizedUsd):'Aguardando contratos'],['Lucro/prejuízo flutuante',usdReady?money(floatingUsd):'Aguardando contratos'],['Operações abertas',m5Open.length],['Operações encerradas',m5Closed.length],['Taxa de acerto',m5Closed.length?(100*m5Wins/m5Closed.length).toFixed(1)+'%':'—'],['Resultado realizado em R',m5Realized.toFixed(2)+'R'],['Cotações atrasadas',m5Open.filter(t=>!t.last_quote_at||Date.now()-Date.parse(t.last_quote_at)>120000).length]];
 const chartOpenTrades=m5Trades.filter(t=>t.status==='OPEN'&&String(t.symbol||'').toUpperCase().startsWith(tvPair));
 const chartLevels=chartOpenTrades.flatMap(t=>[{type:'ENTRADA',price:Number(t.entry_price),key:t.id+'e',direction:t.direction},{type:'STOP',price:Number(t.stop_price),key:t.id+'s',direction:t.direction},...[1,2,3,4,5].filter(n=>t['target'+n+'_price']!==null&&t['target'+n+'_price']!==undefined).map(n=>({type:'ALVO '+n,price:Number(t['target'+n+'_price']),key:t.id+'t'+n,direction:t.direction}))]).filter(x=>Number.isFinite(x.price)&&x.price>0);
 const chartMin=chartLevels.length?Math.min(...chartLevels.map(x=>x.price)):0,chartMax=chartLevels.length?Math.max(...chartLevels.map(x=>x.price)):1,chartRange=Math.max(chartMax-chartMin,0.00000001);
 const chartLevelPanel=<div style={{padding:'14px 16px',border:'1px solid #344054',borderRadius:10,marginTop:14}}><h3>Níveis das operações abertas · {tvPair}</h3><p style={{fontSize:13,opacity:.8}}>Visualização própria do simulador, separada do gráfico TradingView. As linhas são posicionadas pela escala dos preços registrados no Grid M5.</p>{chartLevels.length?<div style={{position:'relative',height:Math.max(340,chartLevels.length*32),margin:'22px 4px 12px',borderLeft:'1px solid #667085',background:'repeating-linear-gradient(to bottom,transparent 0px,transparent 59px,#34405455 60px)'}}>{chartLevels.map(l=>{const y=8+(chartMax-l.price)/chartRange*84;const color=l.type==='STOP'?'#ef6b6b':l.type==='ENTRADA'?'#d9b778':'#4ac9a4';return <div key={l.key} style={{position:'absolute',top:y+'%',left:0,right:0,borderTop:'1px '+(l.type==='ENTRADA'?'solid':'dashed')+' '+color,color,display:'flex',justifyContent:'space-between',gap:12,fontSize:12,pointerEvents:'none'}}><span style={{background:'#101827',padding:'2px 5px'}}>{l.direction} · {l.type}</span><strong style={{background:'#101827',padding:'2px 5px'}}>{l.price}</strong></div>})}</div>:<p>Não há operações virtuais abertas registradas para {tvPair}.</p>}<p style={{fontSize:12,opacity:.75}}>{chartOpenTrades.length} operação(ões) aberta(s). Os preços exibidos são do MT4; o TradingView pode apresentar cotações diferentes.</p></div>;
 const financialPanel=<div className="cards">{financialCards.map(([name,value])=><div className="metric" key={name}><span>{name}</span><strong>{value}</strong></div>)}</div>;
 const rDaily=Object.entries(m5Closed.reduce((acc,t)=>{const day=String(t.closed_at||'').slice(0,10);if(day)acc[day]=(acc[day]||0)+(m5R(t)||0);return acc},{})).sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value:Number(value.toFixed(3))}));
 const rChart=rDaily.length?<ResponsiveContainer width="100%" height={260}><LineChart data={rDaily}><CartesianGrid stroke="#293241" strokeDasharray="3 3"/><XAxis dataKey="date" stroke="#8e98aa"/><YAxis stroke="#8e98aa"/><Tooltip/><Line type="monotone" dataKey="value" stroke="#d9b778" strokeWidth={2}/></LineChart></ResponsiveContainer>:<p>Aguardando operações virtuais encerradas.</p>;
 const chartData=snapshots.slice().reverse().map(x=>({d:new Date(x.observed_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),saldo:Number(x.balance),equity:Number(x.equity)}));
 const calendar=<><div className="calendar-head"><button onClick={()=>{setMonth((month+11)%12);setSelectedDay(null)}}>‹</button><strong>{months[month]} {year}</strong><button onClick={()=>{setMonth((month+1)%12);setSelectedDay(null)}}>›</button></div><div className="calendar-grid">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=><div className="week" key={x}>{x}</div>)}{Array.from({length:offset},(_,i)=><div key={'b'+i}/>)}{Array.from({length:daysInMonth},(_,i)=>{const day=i+1,date=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),v=dayMap.get(date);return <button key={day} onClick={()=>setSelectedDay(day)} className={'day '+(v>0?'positive':v<0?'negative':'')+(selectedDay===day?' selected':'')}><span>{day}</span><b>{v===undefined?'—':(v>0?'+':'')+money(v)}</b></button>})}</div>{selectedDay&&<div className="day-detail">Dia {selectedDay}/{month+1}/{year}: {dayMap.has(year+'-'+String(month+1).padStart(2,'0')+'-'+String(selectedDay).padStart(2,'0'))?money(dayMap.get(year+'-'+String(month+1).padStart(2,'0')+'-'+String(selectedDay).padStart(2,'0'))):'Sem fechamentos registrados'}</div>}</>;
 const tradeTable=<div className="table-scroll"><table><thead><tr><th>Par</th><th>Direção</th><th>Entrada</th><th>STOP</th><th>ALVO 5</th><th>Resultado</th><th>Desalinhamento</th></tr></thead><tbody>{tradeRows.map(t=><tr key={t.id}><td>{t.symbol}</td><td>{t.direction}</td><td>{fmtPrice(t.entry_price)}</td><td>{fmtPrice(t.stop_price)}</td><td>{fmtPrice(t.target5_price)}</td><td>{t.status==='CLOSED'?money(t.realized_pnl):'Sem medição'}</td><td>{t.had_misalignment?'Sim':'Não'}</td></tr>)}</tbody></table>{!tradeRows.length&&<p>Nenhuma operação virtual registrada.</p>}</div>;
 const signalTable=<div className="table-scroll"><table><thead><tr><th>Recebido</th><th>Par</th><th>Direção</th><th>Entrada</th><th>STOP</th><th>ALVO 5</th><th>Origem</th></tr></thead><tbody>{diagnostics.slice(0,80).map(x=><tr key={x.id}><td>{new Date(x.received_at).toLocaleString('pt-BR')}</td><td>{x.symbol}</td><td>{x.direction}</td><td>{fmtPrice(x.entry_price)}</td><td>{fmtPrice(x.stop_price)}</td><td>{fmtPrice(x.target5_price)}</td><td>{x.source}</td></tr>)}</tbody></table>{!diagnostics.length&&<p>Nenhum diagnóstico recebido.</p>}</div>;
 const panel=(title,content)=><section className="panel"><h3>{title}</h3>{content}</section>;
 return <div className="layout"><aside className="sidebar"><div className="brand">ROYAL <span>BLACK</span><small>FOREX SIMULATOR</small></div><nav>{modules.map(m=><button key={m} className={module===m?'active':''} onClick={()=>setModule(m)}>{m}</button>)}</nav><div className="sidefoot">MT4: {online?'ONLINE':'sem heartbeat recente'}<br/>Ambiente: dados reais · diagnóstico</div></aside><main><header><div><span className="eyebrow">ROYAL BLACK / {module}</span><h1>{module}</h1></div><div className="auth-actions"><div className="rb-mode-switch" role="group" aria-label="Visualização da conta"><button className={accountView==='simulation'?'selected':''} onClick={()=>setAccountView('simulation')} aria-pressed={accountView==='simulation'}>Simulação</button><button className={accountView==='real'?'selected':''} onClick={()=>setAccountView('real')} aria-pressed={accountView==='real'}>Conta real</button></div><span className="status">● {online?'MT4 ONLINE':'AGUARDANDO MT4'}</span><button onClick={refresh} disabled={busy}>Atualizar</button><button onClick={onDemo}>Demonstração</button><button onClick={()=>supabase.auth.signOut()}>Sair</button></div></header><div className="notice">Conectado ao Supabase · dados reais, sem valores ilustrativos. {lastUpdated?'Última atualização: '+lastUpdated.toLocaleTimeString('pt-BR')+'. ':''} Grid M5: operações virtuais persistentes com STOP e alvo 5 por cotação recebida. Resultado em R, não USD. Sem ordens reais.</div>{error&&<p role="alert">{error}</p>}{notice&&<p>{notice}</p>}
 {accountView==='real'&&<section className="panel rb-real-status"><h3>Contas da corretora</h3><p>Selecione a conta que deseja acompanhar. Os dados exibidos vêm exclusivamente da sincronização confirmada pelo MT4; escolher uma conta não ativa negociações.</p>{brokerAccounts.length?<><label>Conta conectada <select value={selectedBrokerId||brokerAccounts[0].id} onChange={e=>setSelectedBrokerId(e.target.value)}>{brokerAccounts.map(a=><option key={a.id} value={a.id}>{a.broker} · {a.server} · {a.login_number} ({a.currency})</option>)}</select></label>{(()=>{const a=brokerAccounts.find(x=>x.id===(selectedBrokerId||brokerAccounts[0].id));if(!a)return null;const fmt=v=>v==null?'Aguardando MT4':new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v))+' '+a.currency;return <><div className="cards"><div className="metric"><span>Saldo · {a.currency}</span><strong>{fmt(a.balance)}</strong></div><div className="metric"><span>Equity · {a.currency}</span><strong>{fmt(a.equity)}</strong></div><div className="metric"><span>Margem livre · {a.currency}</span><strong>{fmt(a.margin_free)}</strong></div></div><p>Corretora: {a.broker} · Servidor: {a.server} · Conta: {a.login_number} · Tipo: {a.is_demo?'Demo':'Real'}</p><p>Última sincronização: {a.last_seen_at?new Date(a.last_seen_at).toLocaleString('pt-BR'):'Aguardando MT4'}</p></>})()}</>:<p>Nenhuma conta de corretora sincronizada até o momento. A identificação automática será feita pelo MT4 quando a telemetria de contas estiver conectada.</p>}<p>Execução real: desativada. O site permanece somente para consulta.</p><button onClick={()=>setAccountView('simulation')}>Voltar à simulação</button></section>}{accountView==='simulation'&&<>
 {module==='Gráfico de mercado'&&<section className="panel"><h3>TradingView · gráfico de mercado</h3><h3>MT4 · operações e níveis sobre o preço</h3><MT4PriceChart pair={tvPair} quotes={quotes} trades={m5Trades} candles={candles}/><h3 style={{marginTop:24}}>TradingView · histórico de mercado</h3><p className="notice">Visualização externa do TradingView. Os preços e o histórico deste gráfico podem diferir dos preços da sua corretora MT4; o simulador continua utilizando as cotações recebidas do MT4.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:14}}><label>Par <select value={tvPair} onChange={e=>setTvPair(e.target.value)}>{['AUDCAD','AUDCHF','AUDJPY','AUDNZD','AUDUSD','CADCHF','CADJPY','CHFJPY','EURAUD','EURCAD','EURCHF','EURGBP','EURJPY','EURNZD','EURUSD','GBPAUD','GBPCAD','GBPCHF','GBPJPY','GBPNZD','GBPUSD','NZDCAD','NZDCHF','NZDJPY','NZDUSD','USDCAD','USDCHF','USDJPY'].map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Período <select value={tvInterval} onChange={e=>setTvInterval(e.target.value)}>{[['1','M1'],['5','M5'],['15','M15'],['30','M30'],['60','H1'],['240','H4'],['D','D1'],['W','W1']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div><iframe key={tvPair+'-'+tvInterval} title={'TradingView '+tvPair} src={'https://s.tradingview.com/widgetembed/?frameElementId=rb-market-chart&symbol=FX%3A'+tvPair+'&interval='+encodeURIComponent(tvInterval)+'&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0f1726&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1'} style={{width:'100%',height:'min(75vh,720px)',minHeight:460,border:0,borderRadius:10}} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/>{chartLevelPanel}<p style={{marginTop:12}}>O gráfico não consome armazenamento de candles no Supabase. As operações virtuais e seus resultados continuam independentes dele.</p></section>}
 {module==='Dashboard'&&<>{financialPanel}{!usdReady&&<p className="notice">Os resultados em USD dependem da captura e verificação dos contratos MT4 e do lote configurado. Operações M5 com cotações atrasadas são identificadas na tabela. Resultados históricos ainda sujeitos à auditoria dos fechamentos.</p>}<div className="twocol">{panel('Desempenho diário · R',rChart)}{panel('Grid M5 · estatísticas',m5Stats)}</div>{panel('Últimas operações virtuais · Grid M5',<div style={{maxHeight:460,overflowY:'auto'}}>{m5Table}</div>)}{panel('Desempenho por par',m5SymbolTable)}</>}
 {module==='Calendário'&&panel('Resultados virtuais por dia · R',rChart)}
 {module==='Performance'&&<>{financialPanel}{panel('Grid M5 · estatísticas',m5Stats)}{panel('Grid M5 · desempenho por par',m5SymbolTable)}</>}
 {module==='Operações abertas'&&panel('Grid M5 · operações virtuais',m5Table)}{['Histórico','Detalhe da operação'].includes(module)&&panel(module,m5Table)}
 {['Por par','Por período','Relatórios'].includes(module)&&<>{panel('Estatísticas Grid M5',m5Stats)}{panel('Desempenho por par',m5SymbolTable)}{panel('Operações virtuais',m5Table)}</>}
 {module==='Desalinhamentos'&&panel('Desalinhamentos registrados',<p>{trades.filter(t=>t.had_misalignment).length} operações com desalinhamento registrado. Diagnósticos não confirmam alinhamento operacional.</p>)}
 {module==='Alertas'&&panel('Diagnósticos MT4',signalTable)}
 {module==='Configurações'&&<><DevicePairing accountId={account.id}/>{panel('Segurança',<p>Somente diagnósticos. Nenhuma operação real ou virtual é iniciada pelo painel.</p>)}</>}
 {module==='Sincronização'&&<><DevicePairing accountId={account.id}/>{panel('Status da conexão',<p>Dispositivos ativos: {devices.length}. Último heartbeat: {lastSeen?new Date(lastSeen).toLocaleString('pt-BR'):'não registrado'}. Diagnósticos recebidos: {diagnostics.length}. Sinais Grid M5: {signalRows.length}. Atualização automática a cada 60 segundos.</p>)}{panel('Registros recebidos',signalTable)}</>}
 </>}</main></div>;
}
