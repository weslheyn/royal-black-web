import DevicePairing from './DevicePairing.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';
import {supabase} from './supabaseClient.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(Number(n)||0);
export default function LiveDashboard({onDemo}){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [account,setAccount]=useState(null),[trades,setTrades]=useState([]),[days,setDays]=useState([]),[pairs,setPairs]=useState([]),[snapshots,setSnapshots]=useState([]),[tradeCount,setTradeCount]=useState(null),[verifiedContracts,setVerifiedContracts]=useState(null);
 const [module,setModule]=useState('Dashboard'),[month,setMonth]=useState(new Date().getMonth()),[selectedDay,setSelectedDay]=useState(null),[diagnostics,setDiagnostics]=useState([]),[devices,setDevices]=useState([]);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[lastUpdated,setLastUpdated]=useState(null);
 const refreshInFlight=useRef(false);
 const refreshEpoch=useRef(0);
 useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)});
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
 return ()=>{active=false;subscription.unsubscribe()};},[]);
 useEffect(()=>{refreshEpoch.current+=1;refreshInFlight.current=false;setBusy(false);setError('');setNotice('');
 if(!session){setAccount(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);setTradeCount(null);setVerifiedContracts(null);setLastUpdated(null);setDiagnostics([]);setDevices([]);return;}
 refresh();
 const timer=setInterval(()=>{if(!document.hidden)refresh()},60000);
 return ()=>clearInterval(timer);
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
   let {data:accounts,error:aerr}=await supabase.from('sim_accounts').select('id,name,currency,initial_balance').order('created_at',{ascending:true}).limit(1);
   if(aerr)throw aerr;
   if(!accounts?.length){
    const {error:rpcError}=await supabase.rpc('royal_create_initial_account');
    if(rpcError)throw rpcError;
    ({data:accounts,error:aerr}=await supabase.from('sim_accounts').select('id,name,currency,initial_balance').limit(1));
    if(aerr)throw aerr;
   }
   const current=accounts?.[0];if(!current)throw new Error('Não foi possível obter a conta virtual.');
   const [t,d,p,s,total,contracts,diag,dev]=await Promise.all([
    supabase.from('sim_trades').select('id,symbol,direction,status,entry_price,stop_price,target5_price,opened_at,closed_at,realized_pnl,mfe_amount,mae_amount,had_misalignment').eq('account_id',current.id).order('opened_at',{ascending:false}).limit(1000),
    supabase.from('sim_daily_results').select('*').eq('account_id',current.id).order('close_date_utc',{ascending:false}).limit(1000),
    supabase.from('sim_symbol_results').select('*').eq('account_id',current.id).limit(1000),
    supabase.from('sim_equity_snapshots').select('observed_at,balance,equity,floating_pnl').eq('account_id',current.id).order('observed_at',{ascending:false}).limit(1000),
    supabase.from('sim_trades').select('id',{count:'exact',head:true}).eq('account_id',current.id),
    supabase.from('sim_contract_snapshots').select('id',{count:'exact',head:true}).eq('account_id',current.id).eq('is_verified',true),
    supabase.from('sim_diagnostic_signals').select('id,signal_key,symbol,direction,entry_price,stop_price,target5_price,source,signal_time,received_at').eq('account_id',current.id).order('received_at',{ascending:false}).limit(500),
    supabase.from('sim_devices').select('id,label,is_active,last_seen_at').eq('account_id',current.id).eq('is_active',true)
   ]);
   for(const result of [t,d,p,s,total,contracts,diag,dev])if(result.error)throw result.error;
   if(!sameSession())return;
   setAccount(current);setTradeCount(total.count);setVerifiedContracts(contracts.count);setTrades(t.data||[]);setDays(d.data||[]);setPairs(p.data||[]);setSnapshots(s.data||[]);setDiagnostics(diag.data||[]);setDevices(dev.data||[]);
   if(!Number.isSafeInteger(total.count)||total.count!==(t.data?.length||0)||[d,p,s].some(x=>(x.data?.length||0)===1000))setNotice('Histórico parcialmente carregado: alguns indicadores ou tabelas podem estar incompletos.');
   else setNotice('');
   setLastUpdated(new Date());
  }catch(e){if(!sameSession())return;setError(e.message||'Falha na consulta.');setAccount(null);setTradeCount(null);setVerifiedContracts(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);setDiagnostics([]);setDevices([]);}
  finally{if(sameSession()){refreshInFlight.current=false;setBusy(false)}}
 }
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
 const modules=['Dashboard','Operações abertas','Histórico','Detalhe da operação','Performance','Por par','Por período','Calendário','Desalinhamentos','Alertas','Relatórios','Configurações','Sincronização'];
 const now=new Date(),year=now.getFullYear(),months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
 const offset=(new Date(year,month,1).getDay()+6)%7,daysInMonth=new Date(year,month+1,0).getDate();
 const dayMap=new Map(days.map(d=>[String(d.close_date_utc),Number(d.net_pnl||0)]));
 const active=trades.filter(t=>t.status==='OPEN'),lastSeen=devices.map(d=>Date.parse(d.last_seen_at||'')).filter(Number.isFinite).sort((a,b)=>b-a)[0];
 const online=Boolean(lastSeen&&Date.now()-lastSeen<180000);
 const fmtPrice=x=>x===null||x===undefined?'—':String(x);
 const tradeRows=module==='Histórico'?trades.filter(t=>t.status==='CLOSED'):module==='Operações abertas'?active:trades;
 const signalRows=diagnostics.filter(x=>x.source==='M5_CSV');
 const chartData=snapshots.slice().reverse().map(x=>({d:new Date(x.observed_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),saldo:Number(x.balance),equity:Number(x.equity)}));
 const cards=[['Saldo virtual',metricsComplete?money(balance):'Dados parciais'],['Equity',latest?money(latest.equity):'Sem medição'],['Resultado realizado',metricsComplete?money(pnl):'Dados parciais'],['Drawdown máximo','Sem medição'],['Operações abertas',active.length],['Taxa de acerto',closed.length?(100*wins/closed.length).toFixed(1)+'%':'Sem dados']];
 const calendar=<><div className="calendar-head"><button onClick={()=>{setMonth((month+11)%12);setSelectedDay(null)}}>‹</button><strong>{months[month]} {year}</strong><button onClick={()=>{setMonth((month+1)%12);setSelectedDay(null)}}>›</button></div><div className="calendar-grid">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=><div className="week" key={x}>{x}</div>)}{Array.from({length:offset},(_,i)=><div key={'b'+i}/>)}{Array.from({length:daysInMonth},(_,i)=>{const day=i+1,date=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),v=dayMap.get(date);return <button key={day} onClick={()=>setSelectedDay(day)} className={'day '+(v>0?'positive':v<0?'negative':'')+(selectedDay===day?' selected':'')}><span>{day}</span><b>{v===undefined?'—':(v>0?'+':'')+money(v)}</b></button>})}</div>{selectedDay&&<div className="day-detail">Dia {selectedDay}/{month+1}/{year}: {dayMap.has(year+'-'+String(month+1).padStart(2,'0')+'-'+String(selectedDay).padStart(2,'0'))?money(dayMap.get(year+'-'+String(month+1).padStart(2,'0')+'-'+String(selectedDay).padStart(2,'0'))):'Sem fechamentos registrados'}</div>}</>;
 const tradeTable=<div className="table-scroll"><table><thead><tr><th>Par</th><th>Direção</th><th>Entrada</th><th>STOP</th><th>ALVO 5</th><th>Resultado</th><th>Desalinhamento</th></tr></thead><tbody>{tradeRows.map(t=><tr key={t.id}><td>{t.symbol}</td><td>{t.direction}</td><td>{fmtPrice(t.entry_price)}</td><td>{fmtPrice(t.stop_price)}</td><td>{fmtPrice(t.target5_price)}</td><td>{t.status==='CLOSED'?money(t.realized_pnl):'Sem medição'}</td><td>{t.had_misalignment?'Sim':'Não'}</td></tr>)}</tbody></table>{!tradeRows.length&&<p>Nenhuma operação virtual registrada.</p>}</div>;
 const signalTable=<div className="table-scroll"><table><thead><tr><th>Recebido</th><th>Par</th><th>Direção</th><th>Entrada</th><th>STOP</th><th>ALVO 5</th><th>Origem</th></tr></thead><tbody>{diagnostics.slice(0,80).map(x=><tr key={x.id}><td>{new Date(x.received_at).toLocaleString('pt-BR')}</td><td>{x.symbol}</td><td>{x.direction}</td><td>{fmtPrice(x.entry_price)}</td><td>{fmtPrice(x.stop_price)}</td><td>{fmtPrice(x.target5_price)}</td><td>{x.source}</td></tr>)}</tbody></table>{!diagnostics.length&&<p>Nenhum diagnóstico recebido.</p>}</div>;
 const panel=(title,content)=><section className="panel"><h3>{title}</h3>{content}</section>;
 return <div className="layout"><aside className="sidebar"><div className="brand">ROYAL <span>BLACK</span><small>FOREX SIMULATOR</small></div><nav>{modules.map(m=><button key={m} className={module===m?'active':''} onClick={()=>setModule(m)}>{m}</button>)}</nav><div className="sidefoot">MT4: {online?'ONLINE':'sem heartbeat recente'}<br/>Ambiente: dados reais · diagnóstico</div></aside><main><header><div><span className="eyebrow">ROYAL BLACK / {module}</span><h1>{module}</h1></div><div className="auth-actions"><span className="status">● {online?'MT4 ONLINE':'AGUARDANDO MT4'}</span><button onClick={refresh} disabled={busy}>Atualizar</button><button onClick={onDemo}>Demonstração</button><button onClick={()=>supabase.auth.signOut()}>Sair</button></div></header><div className="notice">Conectado ao Supabase · dados reais, sem valores ilustrativos. {lastUpdated?'Última atualização: '+lastUpdated.toLocaleTimeString('pt-BR')+'. ':''} Diagnósticos M5 não são operações abertas; negociação virtual e real permanecem desativadas.</div>{error&&<p role="alert">{error}</p>}{notice&&<p>{notice}</p>}
 {module==='Dashboard'&&<><div className="cards">{cards.map(([k,v])=><div className="metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div><div className="twocol">{panel('Evolução do saldo e equity',chartData.length?<ResponsiveContainer width="100%" height={260}><LineChart data={chartData}><CartesianGrid stroke="#293241" strokeDasharray="3 3"/><XAxis dataKey="d" stroke="#8e98aa"/><YAxis stroke="#8e98aa"/><Tooltip/><Line dataKey="saldo" stroke="#d9b778" strokeWidth={3}/><Line dataKey="equity" stroke="#55bba5" strokeWidth={2}/></LineChart></ResponsiveContainer>:<p>Sem medições de saldo e equity.</p>)}{panel('Calendário financeiro — resumo',calendar)}</div>{panel('Operações — conta virtual',tradeTable)}{panel('Sinais diagnósticos recebidos · Grid M5: '+signalRows.length,signalTable)}</>}
 {module==='Calendário'&&panel('Resultados por dia',calendar)}
 {module==='Performance'&&<><div className="cards">{cards.map(([k,v])=><div className="metric" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>{panel('Resultados por par',<div className="table-scroll"><table><tbody>{pairs.map(p=><tr key={p.symbol}><td>{p.symbol}</td><td>{money(p.net_pnl)}</td></tr>)}</tbody></table></div>)}</>}
 {['Operações abertas','Histórico','Detalhe da operação'].includes(module)&&panel(module,tradeTable)}
 {['Por par','Por período','Relatórios'].includes(module)&&panel(module,<><p>Resultados reais da conta virtual. Sem projeções ilustrativas.</p>{tradeTable}</>)}
 {module==='Desalinhamentos'&&panel('Desalinhamentos registrados',<p>{trades.filter(t=>t.had_misalignment).length} operações com desalinhamento registrado. Diagnósticos não confirmam alinhamento operacional.</p>)}
 {module==='Alertas'&&panel('Diagnósticos MT4',signalTable)}
 {module==='Configurações'&&<><DevicePairing accountId={account.id}/>{panel('Segurança',<p>Somente diagnósticos. Nenhuma operação real ou virtual é iniciada pelo painel.</p>)}</>}
 {module==='Sincronização'&&<><DevicePairing accountId={account.id}/>{panel('Status da conexão',<p>Dispositivos ativos: {devices.length}. Último heartbeat: {lastSeen?new Date(lastSeen).toLocaleString('pt-BR'):'não registrado'}. Diagnósticos recebidos: {diagnostics.length}. Sinais Grid M5: {signalRows.length}. Atualização automática a cada 60 segundos.</p>)}{panel('Registros recebidos',signalTable)}</>}
 </main></div>;
}
