import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { api } from '../services/api';

export function useResource<T>(path:string) {
  const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const version=useRef(0);
  const refresh=useCallback(async()=>{
    const current=++version.current;setLoading(true);setError('');
    try {const value=await api<T>(path);if(current===version.current)setData(value);}
    catch(e){if(current===version.current){setData(null);setError(e instanceof Error?e.message:'Não foi possível carregar os dados.');}}
    finally{if(current===version.current)setLoading(false);}
  },[path]);
  useEffect(()=>{setData(null);void refresh();return()=>{version.current++;};},[refresh]);
  return {data,loading,error,refresh};
}
export function Notice({children,error=false}:{children:ReactNode;error?:boolean}) {
  return children?<div className={`wd-alert${error?' wd-error':''}`} role={error?'alert':'status'}>{children}</div>:null;
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'good'|'pending'|'bad'}) {
  return <span className={`wd-badge wd-${tone}`}>{children}</span>;
}
export function Empty({children}:{children:ReactNode}) {return <div className="wd-empty">{children}</div>;}
export function Table({label,headers,children}:{label:string;headers:string[];children:ReactNode}) {
  return <div className="wd-table-scroll" role="region" aria-label={label} tabIndex={0}><table><caption className="wd-sr-only">{label}</caption><thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export function Modal({title,children,onClose,submit,submitLabel='Salvar',danger=false}:{title:string;children:ReactNode;onClose:()=>void;submit?:(form:FormData)=>Promise<void>;submitLabel?:string;danger?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  async function onSubmit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!submit||busy)return;
    const data=new FormData(event.currentTarget);setBusy(true);setError('');
    try {await submit(data);onClose();}catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar. Tente novamente.');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} className="web-desktop wd-modal" aria-labelledby="wd-modal-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={event=>{void onSubmit(event);}}><h2 id="wd-modal-title">{title}</h2><fieldset disabled={busy}>{children}<Notice error>{error}</Notice>
      <div className="wd-modal-actions"><button type="button" className="wd-button" onClick={onClose}>{submit?'Cancelar':'Fechar'}</button>{submit&&<button type="submit" className={`wd-button ${danger?'wd-danger':'wd-primary'}`}>{busy?'Salvando…':submitLabel}</button>}</div>
    </fieldset></form>
  </dialog>;
}
export function field(data:FormData,key:string) {return String(data.get(key)??'').trim();}
