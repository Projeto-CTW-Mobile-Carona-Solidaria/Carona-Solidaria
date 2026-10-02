import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Person } from '../types';
import { Badge,Empty,Modal,Notice,Table,field,useResource } from './ui';

type Invite={user:Person;invitationCode:string};
type AccountAction={kind:'create'}|{kind:'edit'|'renew';person:Person};
export function AccountsPanel({rh=false}:{rh?:boolean}){
  const {user}=useAuth();const path=rh?'/api/admin/rh':'/api/rh/members';
  const {data,loading,error,refresh}=useResource<Person[]>(path);
  const [query,setQuery]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('ALL');
  const [action,setAction]=useState<AccountAction|null>(null),[invitation,setInvitation]=useState<Invite|null>(null),[copyMessage,setCopyMessage]=useState('');
  const rows=(data??[]).filter(p=>(filter==='ALL'||(filter==='ACTIVE'?p.active:!p.active))&&`${p.name} ${p.email} ${p.employeeId}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
  async function submit(form:FormData){
    if(!action)return;
    if(action.kind==='create'){
      const body={name:field(form,'name'),email:field(form,'email'),employeeId:field(form,'employeeId'),...(rh?{password:String(form.get('password')??'')}:{})};
      if(rh){await api(path,'POST',body);setMessage('Conta de RH cadastrada.');}
      else{setInvitation(await api<Invite>(path,'POST',body));setCopyMessage('');setMessage('Colaborador convidado.');}
    }else if(action.kind==='edit'){
      await api(`${path}/${action.person.id}`,'PATCH',{name:field(form,'name'),active:form.get('active')==='on'});setMessage('Cadastro atualizado.');
    }else{
      setInvitation(await api<Invite>(`${path}/${action.person.id}/invitation`,'POST'));setCopyMessage('');setMessage('Convite renovado. O código anterior foi invalidado.');
    }
    await refresh();
  }
  return <>
    <div className="wd-toolbar"><label className="wd-search">{rh?'Buscar na equipe':'Buscar colaborador'}<input type="search" placeholder="Nome, e-mail ou matrícula" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Conta<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Todas</option><option value="ACTIVE">Ativas</option><option value="INACTIVE">Desativadas</option></select></label><button className="wd-button wd-tertiary" disabled={loading} onClick={()=>{setMessage('');void refresh();}}>Atualizar</button><button className="wd-button wd-primary" onClick={()=>setAction({kind:'create'})}>{rh?'Cadastrar RH':'Convidar colaborador'}</button></div>
    <Notice error>{error}</Notice><Notice>{message}</Notice>
    {loading?<Empty>Carregando cadastros…</Empty>:data&&<><div className="wd-list-heading"><h2>{rh?'Equipe de RH':'Colaboradores do programa'}</h2><span>{rows.length} cadastro(s)</span></div>{rows.length?<Table label={rh?'Equipe de RH':'Colaboradores'} headers={['Nome','Matrícula','Conta','Cadastro','Ações']}>
      {rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.email}</small></td><td>{p.employeeId}</td><td><Badge tone={p.active?'good':'neutral'}>{p.active?'Ativa':'Desativada'}</Badge></td><td>{p.registered?'Concluído':'Convite pendente'}</td><td><div className="wd-row-actions"><button className="wd-button wd-small" disabled={p.id===user?.id} onClick={()=>setAction({kind:'edit',person:p})}>Editar</button>{!rh&&!p.registered&&p.active&&<button className="wd-button wd-small" onClick={()=>setAction({kind:'renew',person:p})}>Renovar convite</button>}</div></td></tr>)}
    </Table>:<Empty>{query||filter!=='ALL'?'Nenhum cadastro encontrado. Altere os filtros.':rh?'Cadastre uma conta de RH para compartilhar a gestão do programa.':'Convide o primeiro colaborador para participar do programa.'}</Empty>}</>}
    {action&&<Modal title={action.kind==='create'?(rh?'Cadastrar RH':'Convidar colaborador'):action.kind==='edit'?'Editar cadastro':'Renovar convite'} onClose={()=>setAction(null)} submit={submit} submitLabel={action.kind==='create'?(rh?'Cadastrar':'Gerar convite'):action.kind==='edit'?'Salvar alterações':'Renovar convite'}>
      {action.kind==='renew'?<p>O convite anterior de <strong>{action.person.name}</strong> será invalidado. Entregue o novo código após confirmar a identidade do colaborador.</p>:<>
        <label>Nome<input name="name" required maxLength={100} defaultValue={action.kind==='edit'?action.person.name:''} autoComplete="name"/></label>
        {action.kind==='create'?<><div className="wd-form-row"><label>E-mail<input name="email" type="email" required autoComplete="email"/></label><label>Matrícula<input name="employeeId" required maxLength={40}/></label></div>{rh?<label>Senha inicial<input name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password"/><small>Use de 10 a 72 caracteres.</small></label>:<p>Confirme o vínculo com a empresa antes de gerar o convite.</p>}</>:<><label className="wd-check"><input name="active" type="checkbox" defaultChecked={action.person.active}/>Conta ativa</label><p>Desativar encerra as caronas deste motorista, remove suas participações e revoga suas sessões. Reativar não reabre caronas encerradas.</p></>}
      </>}
    </Modal>}
    {invitation&&!action&&<Modal title="Convite de acesso" onClose={()=>setInvitation(null)}><p>Entregue este código a <strong>{invitation.user.name}</strong> por um canal interno após confirmar sua identidade. Ele é exibido somente agora e será usado no primeiro acesso.</p><label>Código do convite<textarea readOnly value={invitation.invitationCode} rows={3} onFocus={e=>e.target.select()}/></label><button type="button" className="wd-button" onClick={()=>{if(!navigator.clipboard){setCopyMessage('Selecione o código e copie com Ctrl+C.');return;}void navigator.clipboard.writeText(invitation.invitationCode).then(()=>setCopyMessage('Código copiado.')).catch(()=>setCopyMessage('Selecione o código e copie com Ctrl+C.'));}}>Copiar código</button><Notice>{copyMessage}</Notice></Modal>}
  </>;
}
