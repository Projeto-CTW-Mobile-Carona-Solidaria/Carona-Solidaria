import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Auth } from '../types';
import { API_URL } from './api';

// The web preview keeps credentials in memory. Native credentials use the OS vault.
const SESSION_KEY='carona.session.v1';
export async function saveSession(auth:Auth|null) {
  if (Platform.OS==='web') return;
  if (auth) await SecureStore.setItemAsync(SESSION_KEY,JSON.stringify({api:API_URL,auth}));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}
export async function loadSession():Promise<Auth|null> {
  if (Platform.OS==='web') return null;
  const raw=await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try { const saved=JSON.parse(raw); return saved.api===API_URL && Date.parse(saved.auth.expiresAt)>Date.now() ? saved.auth : null; }
  catch { return null; }
}
export type Snapshot<T> = { data:T; savedAt:string };
const prefix=(id:number) => `carona:${encodeURIComponent(API_URL)}:${id}:`;
export async function readCache<T>(id:number,key:string):Promise<Snapshot<T>|null> {
  const raw=await AsyncStorage.getItem(prefix(id)+key);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function writeCache<T>(id:number,key:string,value:Snapshot<T>) { await AsyncStorage.setItem(prefix(id)+key,JSON.stringify(value)); }
export async function clearCache(id:number) { const keys=await AsyncStorage.getAllKeys(); await AsyncStorage.multiRemove(keys.filter(k => k.startsWith(prefix(id)))); }
