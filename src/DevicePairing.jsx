import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabaseClient.js';
export default function DevicePairing({accountId}){
 const [devices,setDevices]=useState([]),[token,setToken]=useState(''),[label,setLabel]=useState('Meu MT4'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const accountRef=useRef(accountId);
 accountRef.current=accountId;
 async function refresh(){
  if(!supabase||!accountId)return;
  const requestedAccount=accountId;
  const {data,error:e}=await supabase.from('sim_devices').select('id,label,is_active,created_at,last_seen_at,revoked_at').eq('account_id',accountId).order('created_at',{ascending:false});
  if(accountRef.current!==requestedAccount)return;
  if(e)setError(e.message);else setDevices(data||[]);
 }
 useEffect(()=>{setBusy(false);setToken('');setDevices([]);setNotice('');setError('');refresh();},[accountId]);
 async function pair(){
  const requestedAccount=accountId;
  setBusy(true);setError('');setNotice('');setToken('');
  try{
   const {data,error:e}=await supabase.rpc('royal_pair_mt4_device',{p_account_id:accountId,p_label:label.trim()});
   if(e)throw e;
   if(accountRef.current!==requestedAccount)return;
   if(!data?.[0]?.device_token)throw new Error('O servidor não retornou a credencial.');
   setToken(data[0].device_token);
   setNotice('Credencial gerada. Copie agora: ela não poderá ser recuperada depois.');
   await refresh();
  }catch(e){if(accountRef.current===requestedAccount)setError(e.message||'Falha ao parear.');}finally{if(accountRef.current===requestedAccount)setBusy(false);}
 }
 async function revoke(id){
  if(!window.confirm('Revogar o acesso deste dispositivo MT4?'))return;
  const requestedAccount=accountId;
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.rpc('royal_revoke_mt4_device',{p_device_id:id});
   if(e)throw e;
   if(accountRef.current!==requestedAccount)return;
   if(!data)throw new Error('Dispositivo não encontrado ou não autorizado.');
   setToken('');setNotice('Dispositivo revogado.');await refresh();
  }catch(e){if(accountRef.current===requestedAccount)setError(e.message||'Falha ao revogar.');}finally{if(accountRef.current===requestedAccount)setBusy(false);}
 }
 return <section className="panel"><h3>Dispositivos MT4 · pareamento seguro</h3>
 <p>Crie uma credencial individual para conectar o MT4 à sua conta virtual. Nunca compartilhe essa credencial.</p>
 <div className="auth-actions"><label>Identificação <input value={label} maxLength={80} onChange={e=>setLabel(e.target.value)}/></label>
 <button disabled={busy||!label.trim()||!accountId} onClick={pair}>Gerar credencial MT4</button>
 <button disabled={busy} onClick={refresh}>Atualizar dispositivos</button></div>
 {token&&<div className="device-token"><p><strong>Copie agora: exibida somente nesta sessão</strong></p><code>{token}</code><div className="auth-actions"><button onClick={()=>navigator.clipboard.writeText(token).catch(()=>setError('Copie manualmente a credencial.'))}>Copiar credencial</button><button onClick={()=>setToken('')}>Ocultar</button></div></div>}
 {notice&&<p>{notice}</p>}{error&&<p role="alert">{error}</p>}
 <div className="table-scroll"><table><thead><tr><th>Dispositivo</th><th>Status</th><th>Última comunicação</th><th>Ação</th></tr></thead><tbody>{devices.map(d=><tr key={d.id}><td>{d.label}</td><td>{d.is_active&&!d.revoked_at?'Ativo':'Revogado'}</td><td>{d.last_seen_at?new Date(d.last_seen_at).toLocaleString('pt-BR'):'Nunca'}</td><td>{d.is_active&&!d.revoked_at&&<button disabled={busy} onClick={()=>revoke(d.id)}>Revogar</button>}</td></tr>)}</tbody></table></div>
 <p>O envio automático ainda depende da instalação e configuração do EA no MT4. A chave administrativa do Supabase nunca deve ser colocada no terminal.</p>
 </section>;
}
