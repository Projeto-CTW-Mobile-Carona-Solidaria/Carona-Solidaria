import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { VehiclesPanel } from './Vehicles';
import { AccountsPanel } from './Accounts';
import { RidesPanel } from './Rides';
import { Notice } from './ui';
import './desktop.css';

type Section='vehicles'|'members'|'rides'|'rh';
const sections:{id:Section;label:string;description:string}[]=[
  {id:'vehicles',label:'Veículos',description:'Analise os veículos cadastrados pelos colaboradores.'},
  {id:'members',label:'Colaboradores',description:'Gerencie o acesso de quem compartilha o caminho.'},
  {id:'rides',label:'Caronas e solicitações',description:'Acompanhe os grupos e aprove a participação dos passageiros.'},
  {id:'rh',label:'Equipe de RH',description:'Administre as contas responsáveis pelo programa.'},
];
export default function Admin() {
  const {user,logout}=useAuth();
  const [section,setSection]=useState<Section>('vehicles'),[leaving,setLeaving]=useState(false),[error,setError]=useState('');
  const current=sections.find(item=>item.id===section)!;
  useEffect(()=>{document.title=`${current.label} | Carona Solidária`;},[current.label]);
  if(!user)return null;
  async function signOut(){setLeaving(true);setError('');try{await logout();}catch{setError('Sua sessão local foi encerrada.');}finally{setLeaving(false);}}
  return <div className="web-desktop wd-app">
    <a className="wd-skip" href="#main-content">Pular para o conteúdo</a>
    <aside className="wd-sidebar"><div className="wd-brand"><span className="wd-brand-mark" aria-hidden="true">c.</span><span>Carona<br/>Solidária</span></div>
      <p className="wd-sidebar-label">Central de mobilidade</p>
      <nav aria-label="Administração">{sections.filter(item=>item.id!=='rh'||user.role==='ADMIN').map(item=><button type="button" key={item.id} className={item.id===section?'wd-nav-active':''} aria-current={item.id===section?'page':undefined} onClick={()=>setSection(item.id)}>{item.label}</button>)}</nav>
      <div className="wd-sidebar-note"><strong>Mais gente junto.<br/>Menos carros no caminho.</strong><p>Programa de caronas para colaboradores.</p></div>
      <div className="wd-account"><span className="wd-avatar" aria-hidden="true">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.role==='ADMIN'?'Administrador':'Recursos humanos'}</small></div></div>
      <button type="button" className="wd-signout" disabled={leaving} onClick={()=>{void signOut();}}>{leaving?'Saindo…':'Sair da conta'}</button>
    </aside>
    <main id="main-content" className="wd-main" tabIndex={-1}><div className="wd-topline"><span>Gestão do programa</span><span className="wd-tag">{user.role==='ADMIN'?'Administração':'RH'}</span></div>
      <header className="wd-page-header"><h1>{current.label}</h1><p>{current.description}</p></header><Notice error>{error}</Notice>
      {section==='vehicles'&&<VehiclesPanel/>}{section==='members'&&<AccountsPanel key="members"/>}{section==='rides'&&<RidesPanel/>}{section==='rh'&&user.role==='ADMIN'&&<AccountsPanel key="rh" rh/>}
      <footer className="wd-footer">Carona Solidária <span>Um caminho melhor, em companhia.</span></footer>
    </main>
  </div>;
}
