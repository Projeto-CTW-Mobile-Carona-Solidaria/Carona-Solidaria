import { useCallback,useState } from 'react';
import { useLocalSearchParams,useFocusEffect,Link } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../services/api';
import { whatsapp,shareRide } from '../../../services/native';
import { participationStatus,formatDays,type Group } from '../../../types';
import { Button,Card,EmptyState,Notice,Screen,Busy,s } from '../../../components/ui';
import { RideCard } from '../../../components/RideCard';
export default function GroupScreen(){
  const {id}=useLocalSearchParams<{id:string}>();const {user}=useAuth();const [group,setGroup]=useState<Group|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [confirm,setConfirm]=useState(false);
  const load=useCallback(async()=>{setLoading(true);setError('');try{setGroup(await api<Group>(`/api/rides/${id}`));}catch(e){setGroup(null);setError(e instanceof Error?e.message:'Erro ao consultar grupo.');}finally{setLoading(false);}},[id]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  async function act(path:string,method:string,body?:unknown){setBusy(true);setError('');try{await api(path,method,body);setConfirm(false);await load();}catch(e){setError(e instanceof Error?e.message:'Erro na operação.');}finally{setBusy(false);}}
  const own=group?.ride.driverId===user?.id;
  return <Screen title={`Grupo ${id}`}><Link href="/(app)/mine" style={s.link}>Minhas caronas</Link><Notice text={error} error/><Button title="Atualizar grupo" variant="tertiary" icon="refresh" disabled={loading||busy} onPress={()=>{void load();}}/>{loading&&<Busy/>}
    {group&&<>{group.ride.active&&<Link href={{pathname:'/(app)/journey/[id]',params:{id}}} style={s.link}>{own?'Planejar e iniciar viagem no mapa':'Acompanhar viagem no mapa'}</Link>}<RideCard ride={group.ride}><Text style={s.muted}>Placa: {group.plate}</Text><Notice text={group.ride.specialParkingEligible?'Grupo elegível às vagas especiais: possui passageiro confirmado que não é parente.':'Sem elegibilidade para vaga especial no momento. Parentes não contam para o programa.'}/>
      <Button title="Compartilhar trajeto" variant="tertiary" onPress={()=>{void shareRide(group.ride).catch(e=>setError(e.message));}}/>
      {!own&&<Button title="WhatsApp do motorista" variant="tertiary" onPress={()=>{void whatsapp(group.driverWhatsapp).catch(e=>setError(e.message));}}/>}
    </RideCard><Text accessibilityRole="header" style={s.subtitle}>Participantes e solicitações</Text>{group.participants.length===0&&<EmptyState text="Ainda não há solicitações para esta carona."/>}
    {group.participants.map(p=><Card key={p.id}><Text style={s.subtitle}>{p.passengerName}</Text><Text style={s.muted}>{participationStatus(p)}{p.relative?' · Parente do motorista':''}</Text>
      <Text style={s.muted}>Dias solicitados: {formatDays(p.days)}</Text><Text style={s.helper}>Motorista: {p.driverApproved?'aprovado':'não aprovado'} · RH: {p.rhApproved?'aprovado':'não aprovado'}</Text>
      {own&&p.status==='PENDING'&&group.ride.active&&<><Button title={p.driverApproved?'Sua aprovação foi registrada':'Aprovar passageiro'} disabled={busy||p.driverApproved} onPress={()=>{void act(`/api/rides/${id}/requests/${p.id}`,'PATCH',{accepted:true});}}/><Button title="Recusar" secondary disabled={busy} onPress={()=>{void act(`/api/rides/${id}/requests/${p.id}`,'PATCH',{accepted:false});}}/></>}
      {p.status==='ACCEPTED'&&<Button title="Conversar no WhatsApp" variant="tertiary" onPress={()=>{void whatsapp(p.whatsapp).catch(e=>setError(e.message));}}/>}
      {own&&p.status==='ACCEPTED'&&<Button title="Remover passageiro" variant="danger" disabled={busy} onPress={()=>{void act(`/api/rides/${id}/participants/${p.id}`,'DELETE');}}/>}
    </Card>)}
    {own&&group.ride.active&&(confirm?<Card><Notice text="Encerrar remove todos os participantes e cancela as solicitações pendentes."/><Button title="Confirmar encerramento" variant="danger" disabled={busy} onPress={()=>{void act(`/api/rides/${id}`,'DELETE');}}/><Button title="Voltar" secondary onPress={()=>setConfirm(false)}/></Card>:<Button title="Encerrar carona" variant="danger" disabled={busy} onPress={()=>setConfirm(true)}/>)}
    </>}
  </Screen>;
}
