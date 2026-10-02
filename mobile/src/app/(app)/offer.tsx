import { useCallback,useState } from 'react';
import { Link,useFocusEffect,router } from 'expo-router';
import { Text,View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../services/api';
import { locate } from '../../services/native';
import type { Ride,Vehicle } from '../../types';
import { Button,Days,Field,FormRow,Notice,Screen,Section,Busy,s } from '../../components/ui';
export default function Offer(){
  const {user}=useAuth();const [vehicle,setVehicle]=useState<Vehicle|null>(null);const [origin,setOrigin]=useState('');const [destination,setDestination]=useState('WEG');const [departureTime,setTime]=useState('07:00');const [capacity,setCapacity]=useState('1');const [days,setDays]=useState(user?.days??[]);const [coords,setCoords]=useState<{latitude:number;longitude:number}|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useFocusEffect(useCallback(()=>{let active=true;setLoading(true);api<Vehicle|null>('/api/me/vehicle').then(v=>{if(active)setVehicle(v);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]));
  async function save(){if(!origin.trim()||!destination.trim()||!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(departureTime)||!days.length||!/^([1-8])$/.test(capacity)||Number(capacity)>(vehicle?.seats??0)){setError('Confira saída, destino, horário (HH:mm), dias e vagas permitidas pelo veículo.');return;}setBusy(true);setError('');try{await api<Ride>('/api/rides','POST',{origin:origin.trim(),destination:destination.trim(),departureTime,capacity:Number(capacity),days,latitude:coords?.latitude??null,longitude:coords?.longitude??null});setOrigin('');setCoords(null);router.navigate('/(app)/mine');}catch(e){setError(e instanceof Error?e.message:'Erro ao publicar.');}finally{setBusy(false);}}
  return <Screen title="Ofereça uma carona" subtitle="Defina o trajeto e os dias. Você decide quem participa."><Notice text={error} error/>{loading?<Busy/>:vehicle?.status!=='APPROVED'?<Section><Notice text="Você precisa de um veículo aprovado para oferecer carona."/><Link href="/(app)/vehicle" style={s.link}>Ir para Meu veículo</Link></Section>:<View style={s.form}>
    <Text style={s.muted}>{vehicle.model} · {vehicle.plate}</Text>
    <Section title="Trajeto"><FormRow><Field label="Ponto de saída / bairro" value={origin} onChangeText={setOrigin} maxLength={150}/><Field label="Destino" value={destination} onChangeText={setDestination} maxLength={150}/></FormRow></Section>
    <Section title="Horário e capacidade"><FormRow><Field label="Horário (HH:mm)" value={departureTime} onChangeText={setTime} maxLength={5}/><Field label={`Vagas para passageiros (até ${vehicle.seats})`} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" maxLength={1}/></FormRow></Section>
    <Section title="Dias"><Days value={days} onChange={setDays}/></Section>
    <Section title="Localização"><Button title={coords?'Ponto aproximado de saída definido':'Usar minha localização como ponto de saída'} variant="tertiary" icon="location" disabled={busy} onPress={()=>{setBusy(true);void locate().then(setCoords).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}/>
    <Text style={s.helper}>Opcional. Use esta opção apenas se estiver no ponto de saída. Ela permite que colegas encontrem caronas por distância.</Text></Section><Button title={busy?'Aguarde…':'Publicar carona'} disabled={busy} onPress={()=>{void save();}}/>
  </View>}</Screen>;
}
