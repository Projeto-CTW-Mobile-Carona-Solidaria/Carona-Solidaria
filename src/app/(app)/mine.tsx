import { useCallback,useState } from 'react';
import { Link,useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { useCached } from '../../hooks/useCached';
import { api } from '../../services/api';
import { statusLabels,type Ride,type Participation } from '../../types';
import { Button,Notice,Screen,Busy,s } from '../../components/ui';
import { RideCard } from '../../components/RideCard';
export default function Mine(){
  const {user}=useAuth();const rides=useCached<Ride[]>('/api/me/rides','mine');const requests=useCached<Participation[]>('/api/me/requests','requests');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useFocusEffect(useCallback(()=>{void rides.refresh();void requests.refresh();},[rides.refresh,requests.refresh]));
  async function leave(id:number){setBusy(true);setError('');try{await api(`/api/rides/${id}/membership`,'DELETE');await Promise.all([rides.refresh(),requests.refresh()]);}catch(e){setError(e instanceof Error?e.message:'Erro ao sair.');}finally{setBusy(false);}}
  const offline=rides.offline||requests.offline;
  return <Screen title="Minhas caronas" subtitle="Seus trajetos, solicitações e grupos confirmados.">{offline&&<Notice text={`Consulta offline · última cópia: ${rides.savedAt?new Date(rides.savedAt).toLocaleString('pt-BR'):'indisponível'}. Atualize quando estiver conectado.`}/>}<Notice text={error||rides.error||requests.error} error/>
    <Button title="Atualizar caronas" secondary disabled={busy||rides.loading||requests.loading} onPress={()=>{void rides.refresh();void requests.refresh();}}/>{(rides.loading||requests.loading)&&<Busy/>}
    {rides.data?.length===0&&<Notice text="Você ainda não oferece nem solicitou uma carona. Comece pela aba Buscar ou Oferecer."/>}
    {rides.data?.map(ride=>{const own=ride.driverId===user?.id;const request=requests.data?.find(r=>r.rideId===ride.id);return <RideCard ride={ride} key={ride.id}>
      <Text style={s.label}>{own?'Você é o motorista':request?statusLabels[request.status]:'Atualize para consultar sua solicitação'}</Text>
      {(own||request?.status==='ACCEPTED')&&!offline&&<Link href={{pathname:'/(app)/group/[id]',params:{id:ride.id}}} style={{padding:14,color:'#01296F',fontWeight:'700'}}>Ver grupo e participantes →</Link>}
      {!own&&(request?.status==='PENDING'||request?.status==='ACCEPTED')&&<Button title={request.status==='PENDING'?'Cancelar solicitação':'Sair desta carona'} secondary disabled={busy||offline} onPress={()=>{void leave(ride.id);}}/>}
    </RideCard>;})}
  </Screen>;
}
