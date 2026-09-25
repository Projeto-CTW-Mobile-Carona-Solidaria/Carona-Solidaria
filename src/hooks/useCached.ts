import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { api, NetworkError, currentToken } from '../services/api';
import { readCache, writeCache } from '../services/storage';
import { readThroughCache } from '../services/cachePolicy';

/** Read-only offline snapshots. Only network failures trigger fallback, never 401/403. */
export function useCached<T>(path:string,key:string) {
  const {user,session}=useAuth(); const [data,setData]=useState<T|null>(null); const [loading,setLoading]=useState(true);
  const [error,setError]=useState(''); const [offline,setOffline]=useState(false); const [savedAt,setSavedAt]=useState<string|null>(null);
  const version=useRef(0);
  const refresh=useCallback(async () => {
    if (!user) return; const request=++version.current; const valid=() => request===version.current && currentToken()===session;
    setLoading(true); setError('');
    try {
      const result=await readThroughCache({fetch:()=>api<T>(path),read:()=>readCache<T>(user.id,key),write:snapshot=>writeCache(user.id,key,snapshot),isNetworkError:e=>e instanceof NetworkError,isCurrent:valid});
      if (!valid()) return;
      setData(result.data);setOffline(result.offline);setSavedAt(result.savedAt);setError(result.warning??'');
    } catch (e) {
      if (!valid()) return;
      if (e instanceof NetworkError) {
        setOffline(true);setData(null);setSavedAt(null);setError('Sem conexão e sem dados salvos. Conecte-se e toque em Atualizar.');
      } else { setData(null); setError(e instanceof Error?e.message:'Não foi possível carregar.'); }
    } finally { if (valid()) setLoading(false); }
  },[user?.id,session,path,key]);
  useEffect(() => { void refresh(); const subscription=AppState.addEventListener('change',state => { if (state==='active') void refresh(); });
    return () => {version.current++; subscription.remove();}; },[refresh]);
  return {data,loading,error,offline,savedAt,refresh};
}
