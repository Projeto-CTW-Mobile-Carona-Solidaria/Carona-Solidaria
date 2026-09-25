import { useState } from 'react';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../services/api';
import type { Auth } from '../../types';
import { Screen,Card,Field,Button,Notice,s } from '../../components/ui';
export default function Login() {
  const {login}=useAuth(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {setError('Informe um e-mail válido e sua senha.');return;}
    setBusy(true);setError('');
    try {await login(await api<Auth>('/api/auth/login','POST',{email:email.trim(),password}));} catch(e) {setError(e instanceof Error?e.message:'Não foi possível entrar.');} finally {setBusy(false);}
  }
  return <Screen title="Juntos no caminho." subtitle="Compartilhe a viagem para o trabalho. Menos carros, mais conexão.">
    <Card><Text style={s.subtitle}>Entre na sua conta</Text><Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={()=>{void submit();}}/>
      <Notice text={error} error/><Button title={busy?'Entrando…':'Entrar'} disabled={busy} onPress={()=>{void submit();}}/>
      <Link href="/(auth)/register" style={{color:'#01296F',paddingVertical:12,textAlign:'center'}}>Primeiro acesso? Ative seu convite</Link>
    </Card><Text style={s.muted}>Exclusivo para colaboradores da WEG. Solicite seu convite ao RH. Administradores e RH utilizam o aplicativo desktop.</Text>
  </Screen>;
}
