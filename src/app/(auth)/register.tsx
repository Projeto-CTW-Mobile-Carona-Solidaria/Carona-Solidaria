import { useState } from 'react';
import { Link } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../services/api';
import type { Auth } from '../../types';
import { Screen,Card,Field,Button,Notice } from '../../components/ui';
export default function Register() {
  const {login}=useAuth(); const [email,setEmail]=useState('');const [employeeId,setEmployeeId]=useState('');const [invitationCode,setCode]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit() {
    if (!email.includes('@')||!employeeId.trim()||!invitationCode.trim()||password.length<10||password!==confirm) {setError('Preencha o convite, matrícula e e-mail. Use uma senha com pelo menos 10 caracteres e confirme-a.');return;}
    setBusy(true);setError('');try {await login(await api<Auth>('/api/auth/register','POST',{email:email.trim(),employeeId:employeeId.trim(),invitationCode:invitationCode.trim(),password}));}catch(e){setError(e instanceof Error?e.message:'Erro ao ativar cadastro.');}finally{setBusy(false);}
  }
  return <Screen title="Seu primeiro acesso" subtitle="Use os dados e o código entregues pelo RH após a confirmação do seu vínculo."><Card>
    <Field label="E-mail cadastrado pelo RH" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"/>
    <Field label="Matrícula" value={employeeId} onChangeText={setEmployeeId}/><Field label="Código do convite" value={invitationCode} onChangeText={setCode} autoCapitalize="none" autoCorrect={false}/>
    <Field label="Senha (mínimo 10 caracteres)" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"/>
    <Field label="Confirmar senha" value={confirm} onChangeText={setConfirm} secureTextEntry/><Notice text={error} error/>
    <Button title={busy?'Ativando…':'Ativar cadastro'} disabled={busy} onPress={()=>{void submit();}}/><Link href="/(auth)/login">Voltar para entrar</Link>
  </Card></Screen>;
}
