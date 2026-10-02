import { createContext,useCallback,useContext,useEffect,useState,type ReactNode } from 'react';
import { api,configureSession } from '../services/api';
import type { Auth,Person } from '../types';

type Context={user:Person|null;login:(value:Auth)=>Promise<void>;logout:()=>Promise<void>};
const AuthContext=createContext<Context|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  // Administrative tokens stay in memory and disappear on reload or tab close.
  const [auth,setAuth]=useState<Auth|null>(null);
  const clear=useCallback(()=>{configureSession(null);setAuth(null);},[]);
  async function login(value:Auth){
    if(value.user.role!=='RH'&&value.user.role!=='ADMIN'){
      configureSession(value.token);
      try{await api('/api/auth/logout','POST');}finally{clear();}
      throw new Error('Este painel é exclusivo para RH e administradores. Colaboradores devem utilizar o aplicativo mobile.');
    }
    configureSession(value.token,clear);setAuth(value);
  }
  async function logout(){try{await api('/api/auth/logout','POST');}finally{clear();}}
  useEffect(()=>{
    if(!auth)return;
    const timer=setTimeout(clear,Math.max(0,Date.parse(auth.expiresAt)-Date.now()));
    return()=>clearTimeout(timer);
  },[auth,clear]);
  return <AuthContext.Provider value={{user:auth?.user??null,login,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider ausente.');return value;}
