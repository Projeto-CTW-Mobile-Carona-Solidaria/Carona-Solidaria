import { useState } from 'react';
import { api } from '../services/api';
import { DAYS,dayLabels,formatDays,participationStatus,type Ride,type Group,type Participation } from '../types';
import { Badge,Empty,Modal,Notice,Table,useResource } from './ui';

function Seats({ride}:{ride:Ride}){return <div className="wd-seats">{DAYS.filter(day=>ride.days.includes(day)).map(day=><span key={day} className={(ride.availableSeatsByDay[day]??0)>0?'':'wd-full'}>{dayLabels[day]} <b>{ride.availableSeatsByDay[day]??0}</b></span>)}</div>;}
export function RidesPanel(){
  const {data,loading,error,refresh}=useResource<Ride[]>('/api/rh/groups');
  const [selected,setSelected]=useState<number|null>(null),[query,setQuery]=useState(''),[filter,setFilter]=useState('ACTIVE');
  if(selected!==null)return <GroupPanel id={selected} onBack={()=>{setSelected(null);void refresh();}}/>;
  const rows=(data??[]).filter(r=>(filter==='ALL'||(filter==='ACTIVE'?r.active:!r.active))&&`${r.id} ${r.driverName} ${r.origin} ${r.destination}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  return <>
    <div className="wd-info-strip"><strong>Duas aprovações, uma viagem confirmada.</strong><p>O motorista e o RH aprovam cada passageiro. A vaga é ocupada apenas nos dias solicitados após as duas decisões.</p></div>
    <div className="wd-toolbar"><label className="wd-search">Buscar carona<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Grupo, motorista ou trajeto"/></label><label>Situação<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ACTIVE">Ativas</option><option value="CLOSED">Encerradas</option><option value="ALL">Todas</option></select></label><button className="wd-button wd-tertiary" disabled={loading} onClick={()=>{void refresh();}}>Atualizar</button></div>
    <Notice error>{error}</Notice>{loading?<Empty>Carregando caronas…</Empty>:data&&<><div className="wd-list-heading"><h2>Grupos de carona</h2><span>{rows.length} grupo(s)</span></div>{rows.length?<Table label="Grupos de carona" headers={['Grupo / motorista','Trajeto','Vagas por dia','Vaga especial','Participações']}>
      {rows.map(r=><tr key={r.id}><td><strong>Grupo {r.id}</strong><small>{r.driverName}</small>{!r.active&&<Badge>Encerrada</Badge>}</td><td><strong>{r.origin} → {r.destination}</strong><small>{r.departureTime} · {formatDays(r.days)}</small></td><td>{r.active?<Seats ride={r}/>:<span className="wd-muted">Encerrada</span>}</td><td><Badge tone={r.specialParkingEligible?'good':'neutral'}>{r.specialParkingEligible?'Elegível':'Não elegível'}</Badge></td><td><button className="wd-button wd-small" onClick={()=>setSelected(r.id)}>Ver solicitações</button></td></tr>)}
    </Table>:<Empty>Nenhuma carona nesta seleção. Altere os filtros ou aguarde novas ofertas dos colaboradores.</Empty>}</>}
  </>;
}
function GroupPanel({id,onBack}:{id:number;onBack:()=>void}){
  const {data,loading,error,refresh}=useResource<Group>(`/api/rides/${id}`);
  const [decision,setDecision]=useState<{person:Participation;accepted:boolean}|null>(null),[message,setMessage]=useState('');
  return <><div className="wd-toolbar"><button className="wd-button wd-tertiary" onClick={onBack}>← Voltar às caronas</button><button className="wd-button wd-tertiary" disabled={loading} onClick={()=>{setMessage('');void refresh();}}>Atualizar grupo</button></div><Notice error>{error}</Notice><Notice>{message}</Notice>
    {loading?<Empty>Carregando grupo…</Empty>:data&&<>
      <section className="wd-group-detail"><div><Badge tone={data.ride.active?'good':'neutral'}>{data.ride.active?'Carona ativa':'Carona encerrada'}</Badge><h2>Grupo {id} · {data.ride.origin} → {data.ride.destination}</h2><p>{data.ride.driverName} · {data.ride.departureTime} · {data.plate}</p><p>WhatsApp do motorista: {data.driverWhatsapp}</p></div><div><strong>Vagas disponíveis por dia</strong><Seats ride={data.ride}/><p>{data.ride.specialParkingEligible?'Elegível a vaga especial.':'Sem elegibilidade a vaga especial.'}</p></div></section>
      <div className="wd-list-heading"><h2>Passageiros e solicitações</h2><span>{data.participants.length} participação(ões)</span></div>
      {data.participants.length?<Table label="Passageiros e solicitações" headers={['Passageiro','Dias solicitados','Situação','Aprovações','Decisão do RH']}>
        {data.participants.map(p=><tr key={p.id}><td><strong>{p.passengerName}</strong><small>{p.relative?'Parente do motorista':'Sem parentesco declarado'}</small></td><td>{formatDays(p.days)}</td><td><Badge tone={p.status==='ACCEPTED'?'good':p.status==='PENDING'?'pending':'neutral'}>{participationStatus(p)}</Badge></td><td><div className="wd-approvals"><span>Motorista <b>{p.driverApproved?'Aprovou':'Não aprovou'}</b></span><span>RH <b>{p.rhApproved?'Aprovou':'Não aprovou'}</b></span></div></td><td>{p.status==='PENDING'&&data.ride.active?<div className="wd-row-actions"><button className="wd-button wd-small" disabled={p.rhApproved} onClick={()=>setDecision({person:p,accepted:true})}>{p.rhApproved?'RH aprovou':'Aprovar'}</button><button className="wd-button wd-small" onClick={()=>setDecision({person:p,accepted:false})}>Recusar</button></div>:<span className="wd-muted">{p.status==='ACCEPTED'?'Confirmado':'Encerrada'}</span>}</td></tr>)}
      </Table>:<Empty>Este grupo ainda não recebeu solicitações.</Empty>}
      <p className="wd-footnote">Parentes ocupam vagas, mas não contam para a elegibilidade ao estacionamento especial.</p>
    </>}
    {decision&&<Modal title={decision.accepted?'Aprovar participação pelo RH':'Recusar participação pelo RH'} onClose={()=>setDecision(null)} submitLabel={decision.accepted?'Aprovar pelo RH':'Recusar solicitação'} danger={!decision.accepted} submit={async()=>{
      const result=await api<Participation>(`/api/rides/${id}/requests/${decision.person.id}`,'PATCH',{accepted:decision.accepted});
      setMessage(result.status==='ACCEPTED'?'Participação confirmada. As vagas foram atualizadas nos dias solicitados.':result.status==='PENDING'?'Aprovação do RH registrada. Aguardando o motorista.':'Solicitação recusada.');await refresh();
    }}><p><strong>{decision.person.passengerName}</strong><br/>Dias: {formatDays(decision.person.days)}</p><p>{decision.accepted?'A participação só será confirmada com a aprovação do motorista e disponibilidade em todos os dias solicitados.':'A recusa encerra esta solicitação e não ocupa vagas.'}</p></Modal>}
  </>;
}
