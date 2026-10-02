import { useState } from 'react';
import { Text,Switch,View } from 'react-native';
import { useCached } from '../../hooks/useCached';
import { api } from '../../services/api';
import { locate,shareRide } from '../../services/native';
import { type Ride,type Day } from '../../types';
import { Button,Days,EmptyState,Field,Notice,Screen,Busy,s } from '../../components/ui';
import { RideCard } from '../../components/RideCard';
export default function Search() {
  const [query,setQuery]=useState(''); const [days,setDays]=useState<Day[]>([]); const [coords,setCoords]=useState<{latitude:number;longitude:number}|null>(null);
  const [path,setPath]=useState('/api/rides'); const list=useCached<Ride[]>(path,`search:${path}`);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [selected,setSelected]=useState<number|null>(null);const [relative,setRelative]=useState(false);
  const [requestedDays,setRequestedDays]=useState<Day[]>([]);
  function search(location=coords) {
    const p=new URLSearchParams();if(query.trim())p.set('query',query.trim());if(days[0])p.set('day',days[0]);
    if(location){p.set('latitude',String(location.latitude));p.set('longitude',String(location.longitude));p.set('radius','20');}
    const next=`/api/rides${p.size?'?'+p.toString():''}`;if(next===path)void list.refresh();else setPath(next);
  }
  async function nearby() {setBusy(true);setMessage('');try {const value=await locate();if(value){setCoords(value);search(value);}}catch(e){setMessage(e instanceof Error?e.message:'Erro ao obter localização.');}finally{setBusy(false);}}
  async function request(id:number) {if(!requestedDays.length)return;setBusy(true);setMessage('');try{await api(`/api/rides/${id}/requests`,'POST',{relative,days:requestedDays});setSelected(null);setRelative(false);setRequestedDays([]);setMessage('Solicitação enviada para aprovação do motorista e do RH. Acompanhe em Minhas caronas.');await list.refresh();}catch(e){setMessage(e instanceof Error?e.message:'Falha na solicitação.');}finally{setBusy(false);}}
  return <Screen title="Encontre seu caminho" subtitle="Combine uma carona com colegas que fazem o mesmo trajeto.">
    <View style={s.form}><Field label="Bairro, ponto de saída ou destino" placeholder="Ex.: Centro, WEG…" value={query} onChangeText={setQuery}/><View style={s.field}><Text style={s.label}>Dia da semana (opcional)</Text><Days value={days} onChange={setDays} single/></View>
      <Button title="Buscar caronas" disabled={busy||list.loading} onPress={()=>search()}/><View style={s.row}><Button title={busy?'Aguarde…':'Usar minha localização'} variant="tertiary" icon="location" disabled={busy} onPress={()=>{void nearby();}}/><Text style={s.helper}>Até 20 km</Text></View>
      {coords&&<Button title="Remover filtro de distância" variant="tertiary" onPress={()=>{setCoords(null);search(null);}}/>}</View>
    {list.offline&&<Notice text={`Modo offline · cópia de ${list.savedAt?new Date(list.savedAt).toLocaleString('pt-BR'):'data desconhecida'}. Vagas podem ter mudado. Conecte-se para solicitar.`}/>}
    <Notice text={message}/><Notice text={list.error} error/>{list.loading&&<Busy/>}
    <View style={[s.toolbar,s.section]}><Text accessibilityRole="header" style={s.subtitle}>Caronas disponíveis</Text><Button title="Atualizar resultados" variant="tertiary" icon="refresh" disabled={list.loading} onPress={()=>{void list.refresh();}}/></View>
    {!list.loading&&list.data?.length===0&&<EmptyState text="Nenhuma carona com vagas para estes filtros. Tente outro bairro ou dia."/>}
    {list.data?.map(ride=><RideCard key={ride.id} ride={ride}>
      {selected===ride.id?<><Text style={s.label}>Em quais dias você precisa de carona?</Text>
        <Days value={requestedDays} onChange={setRequestedDays} available={ride.days.filter(day=>(ride.availableSeatsByDay[day]??0)>0)} disabled={busy||list.offline}/>
        <Text style={s.helper}>Selecione um ou mais dias com vagas. A participação será confirmada após a aprovação do motorista e do RH.</Text>
        <View style={s.row}><Switch accessibilityLabel="Sou parente do motorista" value={relative} onValueChange={setRelative} disabled={busy}/><Text style={s.muted}>Sou parente do motorista</Text></View><Text style={s.muted}>Parentes ocupam uma vaga, mas não contam para o programa de vagas especiais.</Text><Button title="Confirmar solicitação" disabled={busy||list.offline||list.loading||!requestedDays.length||requestedDays.some(day=>(ride.availableSeatsByDay[day]??0)<=0)} onPress={()=>{void request(ride.id);}}/><Button title="Cancelar" secondary disabled={busy} onPress={()=>setSelected(null)}/></>:<Button title="Solicitar carona" disabled={busy||list.offline||list.loading} onPress={()=>{setSelected(ride.id);setRelative(false);setRequestedDays(ride.days.filter(day=>(ride.availableSeatsByDay[day]??0)>0&&(!days[0]||day===days[0])));}}/>}
      <Button title="Compartilhar trajeto" variant="tertiary" onPress={()=>{void shareRide(ride).catch(e=>setMessage(e.message));}}/>
    </RideCard>)}
  </Screen>;
}
