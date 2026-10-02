import { useState } from 'react';
import { api } from '../services/api';
import { statusLabels, type Vehicle } from '../types';
import { Badge,Empty,Modal,Notice,Table,field,useResource } from './ui';

type ReviewVehicle=Vehicle&{ownerId:number;ownerName:string;submittedAt:string};
export function VehiclesPanel(){
  const {data,loading,error,refresh}=useResource<ReviewVehicle[]>('/api/rh/vehicles');
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('PENDING'),[message,setMessage]=useState('');
  const [review,setReview]=useState<{vehicle:ReviewVehicle;approved:boolean}|null>(null);
  const rows=(data??[]).filter(v=>(filter==='ALL'||v.status===filter)&&`${v.ownerName} ${v.plate} ${v.model}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <>
    <div className="wd-summary"><strong>{data?.filter(v=>v.status==='PENDING').length??'—'}</strong><div><b>veículos aguardando análise</b><p>A aprovação libera o colaborador para oferecer caronas.</p></div></div>
    <div className="wd-toolbar"><label className="wd-search">Buscar veículo ou colaborador<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, placa ou modelo"/></label><label>Situação<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="PENDING">Pendentes</option><option value="APPROVED">Aprovados</option><option value="REJECTED">Recusados</option><option value="ALL">Todos</option></select></label><button className="wd-button wd-tertiary" disabled={loading} onClick={()=>{setMessage('');void refresh();}}>Atualizar</button></div>
    <Notice error>{error}</Notice><Notice>{message}</Notice>
    {loading?<Empty>Carregando veículos…</Empty>:data&&<><div className="wd-list-heading"><h2>Veículos cadastrados</h2><span>{rows.length} registro(s)</span></div>
      {rows.length?<Table label="Veículos cadastrados" headers={['Veículo','Colaborador','Vagas','Situação','Análise']}>
        {rows.map(v=><tr key={v.id}><td><strong>{v.model}</strong><small>{v.plate} · {v.color}</small></td><td>{v.ownerName}<small>Enviado em {new Date(v.submittedAt).toLocaleDateString('pt-BR')}</small></td><td>{v.seats}</td><td><Badge tone={v.status==='APPROVED'?'good':v.status==='PENDING'?'pending':'bad'}>{statusLabels[v.status]}</Badge>{v.rejectionReason&&<small>{v.rejectionReason}</small>}</td><td>{v.status==='PENDING'?<div className="wd-row-actions"><button className="wd-button wd-small" onClick={()=>setReview({vehicle:v,approved:true})}>Aprovar</button><button className="wd-button wd-small" onClick={()=>setReview({vehicle:v,approved:false})}>Recusar</button></div>:<span className="wd-muted">Análise concluída</span>}</td></tr>)}
      </Table>:<Empty>Nenhum veículo nesta seleção. Altere os filtros ou atualize a lista.</Empty>}</>}
    {review&&<Modal title={review.approved?'Aprovar veículo':'Recusar veículo'} onClose={()=>setReview(null)} submitLabel={review.approved?'Aprovar veículo':'Recusar veículo'} danger={!review.approved} submit={async form=>{
      await api(`/api/rh/vehicles/${review.vehicle.id}`,'PATCH',{approved:review.approved,reason:field(form,'reason')});setMessage(review.approved?'Veículo aprovado. O colaborador já pode oferecer caronas.':'Veículo recusado. O motivo ficará disponível para o colaborador.');await refresh();
    }}><p><strong>{review.vehicle.model} · {review.vehicle.plate}</strong><br/>{review.vehicle.ownerName}</p>{review.approved?<p>Confirme que o veículo está apto a participar do programa.</p>:<label>Motivo da recusa<textarea name="reason" required maxLength={500} rows={4} placeholder="Informe o que precisa ser corrigido."/></label>}</Modal>}
  </>;
}
