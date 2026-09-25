import { Platform } from 'react-native';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8079' : 'http://localhost:8079')).replace(/\/$/, '');
let token: string | null = null;
let unauthorized: (() => void) | undefined;
export function configureSession(value: string | null, callback?: () => void) { token = value; unauthorized = callback; }
export function currentToken() { return token; }
export class ApiError extends Error { constructor(public status:number, message:string) { super(message); } }
export class NetworkError extends Error { constructor() { super('Sem conexão com o servidor. Confira sua rede e tente novamente.'); } }
export async function api<T>(path:string, method='GET', body?:unknown):Promise<T> {
  if (!__DEV__ && !API_URL.startsWith('https://')) throw new Error('Configure uma API HTTPS para a versão de produção.');
  const requestToken=token;
  const controller=new AbortController(); const timeout=setTimeout(() => controller.abort(), 12000);
  try {
    let response:Response;
    try { response=await fetch(`${API_URL}${path}`, { method, signal:controller.signal,
      headers:{ Accept:'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json'}), ...(requestToken ? {Authorization:`Bearer ${requestToken}`} : {}) },
      body:body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new NetworkError(); }
    const text=await response.text();
    let data:any;
    try { data=text ? JSON.parse(text) : null; } catch { throw new ApiError(response.status,'O servidor retornou uma resposta inválida.'); }
    if (!response.ok) {
      if (response.status===401 && requestToken && requestToken===token) unauthorized?.();
      throw new ApiError(response.status, data?.message ?? 'Não foi possível concluir a operação.');
    }
    return data as T;
  } finally { clearTimeout(timeout); }
}
