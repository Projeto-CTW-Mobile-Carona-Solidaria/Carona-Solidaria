import { useCallback,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text,View } from 'react-native';
import { api } from '../../services/api';
import { statusLabels,type Vehicle } from '../../types';
import { Badge,Button,Field,FormRow,Notice,Screen,Section,Busy,s } from '../../components/ui';
export default function VehicleScreen(){
  const [vehicle,setVehicle]=useState<Vehicle|null>(null);const [plate,setPlate]=useState('');const [model,setModel]=useState('');const [color,setColor]=useState('');const [seats,setSeats]=useState('4');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const v=await api<Vehicle|null>('/api/me/vehicle');setVehicle(v);if(v){setPlate(v.plate);setModel(v.model);setColor(v.color);setSeats(String(v.seats));}}catch(e){setError(e instanceof Error?e.message:'Erro ao consultar veículo.');}finally{setLoading(false);}},[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  async function save(){if(!/^[A-Z]{3}[- ]?[0-9][A-Z0-9][0-9]{2}$/i.test(plate)||!model.trim()||!color.trim()||!/^([1-8])$/.test(seats)){setError('Confira a placa, modelo, cor e quantidade de assentos (1 a 8 passageiros).');return;}setBusy(true);setError('');setMessage('');try{setVehicle(await api<Vehicle>('/api/me/vehicle','PUT',{plate,model:model.trim(),color:color.trim(),seats:Number(seats)}));setMessage('Veículo enviado para análise do RH.');}catch(e){setError(e instanceof Error?e.message:'Erro ao enviar.');}finally{setBusy(false);}}
  return <Screen title="Seu veículo" subtitle="Para oferecer carona, aguarde a aprovação do RH.">{loading&&<Busy/>}<Notice text={error} error/><Notice text={message}/><View style={s.toolbar}>
    {vehicle&&<View style={s.row}><Text style={s.label}>Status do veículo</Text><Badge text={statusLabels[vehicle.status]} tone={vehicle.status==='APPROVED'?'success':vehicle.status==='REJECTED'?'danger':'warning'}/></View>}
    <Button title="Atualizar análise" variant="tertiary" icon="refresh" disabled={loading||busy} onPress={()=>{void load();}}/></View>
    {vehicle?.rejectionReason&&<Notice text={vehicle.rejectionReason} error/>}
    <View style={s.form}><Section title="Dados do veículo"><FormRow><Field label="Placa" placeholder="ABC1D23" value={plate} onChangeText={setPlate} autoCapitalize="characters" maxLength={8}/><Field label="Modelo" placeholder="Honda Civic" value={model} onChangeText={setModel} maxLength={100}/></FormRow><FormRow><Field label="Cor" value={color} onChangeText={setColor} maxLength={40}/><Field label="Assentos para passageiros (sem motorista)" value={seats} onChangeText={setSeats} keyboardType="number-pad" maxLength={1}/></FormRow></Section>
    <Text style={s.helper}>Alterar um veículo exige uma nova análise. Encerre as caronas ativas antes de alterar o cadastro.</Text><Button title={busy?'Enviando…':vehicle?.status==='REJECTED'?'Corrigir e reenviar ao RH':'Enviar para análise do RH'} disabled={busy||loading} onPress={()=>{void save();}}/></View>
  </Screen>;
}
