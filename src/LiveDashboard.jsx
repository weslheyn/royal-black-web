import DevicePairing from './DevicePairing.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabaseClient.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(Number(n)||0);
export default function LiveDashboard({onDemo}){
 const [session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [account,setAccount]=useState(null),[trades,setTrades]=useState([]),[days,setDays]=useState([]),[pairs,setPairs]=useState([]),[snapshots,setSnapshots]=useState([]),[tradeCount,setTradeCount]=useState(null),[verifiedContracts,setVerifiedContracts]=useState(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[lastUpdated,setLastUpdated]=useState(null);
 const refreshInFlight=useRef(false);
 const refreshEpoch=useRef(0);
 useEffect(()=>{if(!supabase)return;let active=true;supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)});
 const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));
 return ()=>{active=false;subscription.unsubscribe()};},[]);
 useEffect(()=>{refreshEpoch.current+=1;refreshInFlight.current=false;setBusy(false);setError('');setNotice('');
 if(!session){setAccount(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);setTradeCount(null);setVerifiedContracts(null);setLastUpdated(null);return;}
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
   const [t,d,p,s,total,contracts]=await Promise.all([
    supabase.from('sim_trades').select('id,symbol,direction,status,entry_price,stop_price,target5_price,opened_at,closed_at,realized_pnl,mfe_amount,mae_amount,had_misalignment').eq('account_id',current.id).order('opened_at',{ascending:false}).limit(1000),
    supabase.from('sim_daily_results').select('*').eq('account_id',current.id).order('close_date_utc',{ascending:false}).limit(1000),
    supabase.from('sim_symbol_results').select('*').eq('account_id',current.id).limit(1000),
    supabase.from('sim_equity_snapshots').select('observed_at,balance,equity,floating_pnl').eq('account_id',current.id).order('observed_at',{ascending:false}).limit(1000),
    supabase.from('sim_trades').select('id',{count:'exact',head:true}).eq('account_id',current.id),
    supabase.from('sim_contract_snapshots').select('id',{count:'exact',head:true}).eq('account_id',current.id).eq('is_verified',true)
   ]);
   for(const result of [t,d,p,s,total,contracts])if(result.error)throw result.error;
   if(!sameSession())return;
   setAccount(current);setTradeCount(total.count);setVerifiedContracts(contracts.count);setTrades(t.data||[]);setDays(d.data||[]);setPairs(p.data||[]);setSnapshots(s.data||[]);
   if(!Number.isSafeInteger(total.count)||total.count!==(t.data?.length||0)||[d,p,s].some(x=>(x.data?.length||0)===1000))setNotice('Histórico parcialmente carregado: alguns indicadores ou tabelas podem estar incompletos.');
   else setNotice('');
   setLastUpdated(new Date());
  }catch(e){if(!sameSession())return;setError(e.message||'Falha na consulta.');setAccount(null);setTradeCount(null);setVerifiedContracts(null);setTrades([]);setDays([]);setPairs([]);setSnapshots([]);}
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
 return <div className="live-screen"><header><div><span className="eyebrow">ROYAL BLACK / DADOS DO SUPABASE</span><h1>Painel da conta virtual</h1></div><div className="auth-actions"><button onClick={refresh} disabled={busy}>Atualizar</button><button onClick={onDemo}>Demonstração</button><button onClick={()=>supabase.auth.signOut()}>Sair</button></div></header><div className="notice">Dados da sua conta no Supabase. Sem conexão com o MT4, as operações permanecem vazias. Datas diárias em UTC; ajuste de fuso ainda pendente. Atualização automática a cada 60 segundos com a aba ativa. {lastUpdated?'Última consulta: '+lastUpdated.toLocaleTimeString('pt-BR')+'.':''}</div>{error&&<p role="alert">{error}</p>}{notice&&<p>{notice}</p>}
 <div className="cards">{[['Saldo calculado',metricsComplete?money(balance):'Parcial — histórico limitado'],['Equity observada',latest?money(latest.equity):'Sem medição'],['Lucro realizado',metricsComplete?money(pnl):'Parcial — histórico limitado'],['Operações abertas',metricsComplete?trades.filter(t=>t.status==='OPEN').length:'Parcial — histórico limitado'],['Operações fechadas',metricsComplete?closed.length:'Parcial — histórico limitado'],['Taxa de acerto',!metricsComplete?'Parcial — histórico limitado':closed.length?(100*wins/closed.length).toFixed(1)+'%':'Sem dados']].map(([label,value])=><div className="metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
 <section className="panel"><h3>Prontidão da simulação</h3><p>Contratos verificados para cálculo de fechamento: <strong>{verifiedContracts===null?"Não consultado":verifiedContracts}</strong>.</p>{verifiedContracts===0?<p role="alert">Nenhum contrato de corretora verificado. O servidor não pode liquidar operações virtuais com resultado em USD até que exista uma especificação contratual verificada.</p>:null}<p>O código do MT4 ainda requer compilação no MetaEditor e teste integrado. Este painel não confirma que o terminal esteja conectado.</p></section>
 <DevicePairing accountId={account.id}/>
 <section className="panel"><h3>Calendário financeiro · dias com fechamento (UTC)</h3>{!dailyComplete?<p role="alert">Histórico parcial: os resultados diários abaixo podem estar incompletos.</p>:null}{days.length?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Operações</th><th>Resultado</th></tr></thead><tbody>{days.map(d=><tr key={d.close_date_utc}><td>{d.close_date_utc}</td><td>{d.closed_trades}</td><td className={Number(d.net_pnl)>=0?'profit':'loss'}>{money(d.net_pnl)}</td></tr>)}</tbody></table></div>:<p>Não há operações encerradas.</p>}</section>
 <section className="panel"><h3>Resultados por par</h3>{!symbolComplete?<p role="alert">Histórico parcial: os resultados por par abaixo podem estar incompletos.</p>:null}{pairs.length?<div className="table-scroll"><table><thead><tr><th>Par</th><th>Operações</th><th>Resultado</th><th>Desalinhamentos</th></tr></thead><tbody>{pairs.map(p=><tr key={p.symbol}><td>{p.symbol}</td><td>{p.closed_trades}</td><td className={Number(p.net_pnl)>=0?'profit':'loss'}>{money(p.net_pnl)}</td><td>{p.misaligned_trades}</td></tr>)}</tbody></table></div>:<p>Nenhum resultado registrado.</p>}</section>
 <section className="panel"><h3>Operações recentes</h3>{trades.length?<div className="table-scroll"><table><thead><tr><th>Par</th><th>Direção</th><th>Status</th><th>STOP</th><th>ALVO 5</th><th>Resultado</th><th>Desalinhamento</th></tr></thead><tbody>{trades.slice(0,50).map(t=><tr key={t.id}><td>{t.symbol}</td><td>{t.direction}</td><td>{t.status}</td><td>{t.stop_price}</td><td>{t.target5_price}</td><td>{t.status==='CLOSED'?money(t.realized_pnl):'—'}</td><td>{t.had_misalignment?'Sim':'Não'}</td></tr>)}</tbody></table></div>:<p>Nenhuma operação recebida do MT4.</p>}</section>
 </div>;
}
