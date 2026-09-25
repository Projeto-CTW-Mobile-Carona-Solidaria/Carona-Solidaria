import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../services/api';
import type { Person } from '../../types';
import { Button,Card,Days,Field,Notice,Screen,s } from '../../components/ui';
export default function Profile() {
  const {user,updateUser,logout}=useAuth();const [name,setName]=useState(user?.name??'');const [whatsapp,setWhatsapp]=useState(user?.whatsapp??'');const [neighborhood,setNeighborhood]=useState(user?.neighborhood??'');const [days,setDays]=useState(user?.days??[]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
  async function save(){if(!name.trim()||!neighborhood.trim()||!/^[0-9]{10,15}$/.test(whatsapp)||!days.length){setError('Preencha nome, bairro, ao menos um dia e WhatsApp com DDI e DDD (somente números).');return;}setBusy(true);setError('');setMessage('');try{await updateUser(await api<Person>('/api/me','PUT',{name:name.trim(),whatsapp,neighborhood:neighborhood.trim(),days}));setMessage('Perfil atualizado.');}catch(e){setError(e instanceof Error?e.message:'Erro ao salvar.');}finally{setBusy(false);}}
  return <Screen title="Seu perfil" subtitle={`${user?.email} · Matrícula ${user?.employeeId}`}><Card>
    <Field label="Nome" value={name} onChangeText={setName} maxLength={100}/><Field label="WhatsApp com DDI e DDD" placeholder="5547999999999" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" maxLength={15}/><Field label="Bairro" value={neighborhood} onChangeText={setNeighborhood} maxLength={120}/>
    <Text style={s.label}>Dias em que precisa ou pode oferecer carona</Text><Days value={days} onChange={setDays}/><Notice text={error} error/><Notice text={message}/><Button title={busy?'Salvando…':'Salvar perfil'} disabled={busy} onPress={()=>{void save();}}/>
  </Card><Text style={s.muted}>Seu WhatsApp fica disponível aos participantes confirmados do grupo e ao motorista que recebe sua solicitação.</Text><Button title="Sair da conta e limpar dados locais" secondary disabled={busy} onPress={()=>{setBusy(true);void logout().catch(()=>{}).finally(()=>setBusy(false));}}/></Screen>;
}
