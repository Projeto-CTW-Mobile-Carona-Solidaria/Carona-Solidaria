import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isDevice } from 'expo-device';

function defaultApiUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return __DEV__ ? `http://${window.location.hostname}:8079` : window.location.origin;
  }
  if (!__DEV__) return '';
  if (!isDevice) return Platform.OS === 'android' ? 'http://10.0.2.2:8079' : 'http://localhost:8079';

  // A LAN address from Metro also reaches the API on the development computer.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)[\d.]+$/.test(host)) {
    return `http://${host}:8079`;
  }
  return '';
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL?.trim() || defaultApiUrl()).replace(/\/+$/, '');
const localWeb = Platform.OS === 'web' && typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
let token: string | null = null;
let unauthorized: (() => void) | undefined;
export function configureSession(value: string | null, callback?: () => void) { token = value; unauthorized = callback; }
export function currentToken() { return token; }
export class ApiError extends Error { constructor(public status:number, message:string) { super(message); } }
export class NetworkError extends Error { constructor() { super('Sem conexão com o servidor. Confira sua rede e tente novamente.'); } }
export async function api<T>(path:string, method='GET', body?:unknown):Promise<T> {
  if (!API_URL && __DEV__) throw new Error('Configure EXPO_PUBLIC_API_URL com o endereço da API acessível neste dispositivo.');
  if (!__DEV__ && !API_URL.startsWith('https://') && !(localWeb && API_URL === window.location.origin)) {
    throw new Error('Configure uma API HTTPS para a versão de produção.');
  }
  const requestToken=token;
  const controller=new AbortController(); const timeout=setTimeout(() => controller.abort(), 12000);
  try {
    let response:Response;
    try { response=await fetch(`${API_URL}${path}`, { method, signal:controller.signal,
      headers:{ Accept:'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json'}), ...(requestToken ? {Authorization:`Bearer ${requestToken}`} : {}) },
      body:body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new NetworkError(); }
    if (response.status===401 && requestToken && requestToken===token) unauthorized?.();
    let text:string;
    try { text=await response.text(); }
    catch {
      if (response.ok) throw new NetworkError();
      throw new ApiError(response.status,'Não foi possível ler a resposta do servidor.');
    }
    let data;
    try { data=text ? JSON.parse(text) : null; } catch { throw new ApiError(response.status,'O servidor retornou uma resposta inválida.'); }
    if (!response.ok) {
      throw new ApiError(response.status, typeof data?.message==='string' ? data.message : 'Não foi possível concluir a operação.');
    }
    return data as T;
  } finally { clearTimeout(timeout); }
}
