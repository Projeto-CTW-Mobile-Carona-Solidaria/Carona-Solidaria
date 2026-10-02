import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Auth } from '../types';
import './desktop.css';

export default function WebLogin() {
  const { login }=useAuth();
  useEffect(()=>{document.title='Entrar | Carona Solidária';},[]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const data=new FormData(event.currentTarget);setBusy(true);setError('');
    try { await login(await api<Auth>('/api/auth/login','POST',{email:String(data.get('email')).trim(),password:String(data.get('password'))})); }
    catch(e) { setError(e instanceof Error?e.message:'Não foi possível entrar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="web-desktop wd-login">
    <header className="wd-login-header">
      <div className="wd-brand"><span className="wd-brand-mark" aria-hidden="true">c.</span><span>Carona Solidária</span></div>
      <span>Central de mobilidade</span>
    </header><div className="wd-login-content">
    <section className="wd-login-form" aria-labelledby="login-title"><div>
      <h1 id="login-title">Entre na sua conta</h1><p>Entre com sua conta de RH ou administrador para gerenciar o programa.</p>
      <form onSubmit={event=>{void submit(event);}}><fieldset disabled={busy}>
        <label>E-mail<input name="email" type="email" autoComplete="username" required placeholder="voce@empresa.com"/></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required maxLength={72}/></label>
        {error&&<p className="wd-alert wd-error" role="alert">{error}</p>}
        <button className="wd-button wd-primary" type="submit">{busy?'Entrando…':'Entrar'}</button>
      </fieldset></form>
    </div></section><aside className="wd-login-help"><h2>Vai oferecer ou solicitar uma carona?</h2><p>Utilize o aplicativo mobile. Para ativar sua conta de colaborador, solicite um convite ao RH.</p><p>Mobilidade para colaboradores da WEG.</p></aside></div>
  </main>;
}
