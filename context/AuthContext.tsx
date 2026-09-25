import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, configureSession, NetworkError } from '../src/services/api';
import { clearCache, loadSession, saveSession } from '../src/services/storage';
import type { Auth, Person } from '../src/types';

interface AuthContextType { session:string|null; user:Person|null; isLoading:boolean; login:(auth:Auth)=>Promise<void>; logout:()=>Promise<void>; updateUser:(user:Person)=>Promise<void> }
const AuthContext=createContext<AuthContextType|undefined>(undefined);
export function AuthProvider({children}:{children:React.ReactNode}) {
  const [auth,setAuth]=useState<Auth|null>(null); const ref=useRef<Auth|null>(null); const [isLoading,setLoading]=useState(true);
  const clear=useCallback(async () => {
    const previous=ref.current; ref.current=null; configureSession(null); setAuth(null);
    await saveSession(null); if (previous) await clearCache(previous.user.id);
  },[]);
  const login=useCallback(async (value:Auth) => {
    if (value.user.role!=='MEMBER') {
      configureSession(value.token); try { await api('/api/auth/logout','POST'); } finally { configureSession(null); }
      throw new Error('Admin e RH devem utilizar o aplicativo desktop.');
    }
    await saveSession(value); ref.current=value; setAuth(value);
    configureSession(value.token,() => { void clear().catch(() => {}); });
  },[clear]);
  useEffect(() => { let alive=true;
    (async () => {
      try {
        const stored=await loadSession(); if (!stored || !alive) return;
        configureSession(stored.token);
        try { const user=await api<Person>('/api/me'); if (alive) await login({...stored,user}); }
        catch (e) { if (alive && e instanceof NetworkError) await login(stored); else if (alive) await clear(); }
      } catch { if (alive) await clear().catch(() => {}); }
      finally { if (alive) setLoading(false); }
    })(); return () => {alive=false;};
  },[clear,login]);
  useEffect(() => { if (!auth) return; const timer=setTimeout(() => { void clear().catch(() => {}); },Math.max(0,Date.parse(auth.expiresAt)-Date.now())); return () => clearTimeout(timer); },[auth,clear]);
  const logout=async () => { try { await api('/api/auth/logout','POST'); } finally { await clear(); } };
  const updateUser=async (user:Person) => { if (ref.current) await login({...ref.current,user}); };
  return <AuthContext.Provider value={{session:auth?.token??null,user:auth?.user??null,isLoading,login,logout,updateUser}}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context=useContext(AuthContext); if (!context) throw new Error('AuthProvider ausente'); return context; }
