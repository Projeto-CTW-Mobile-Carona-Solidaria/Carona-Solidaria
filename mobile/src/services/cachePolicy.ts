export interface Snapshot<T> { data:T; savedAt:string }
export interface CacheResult<T> extends Snapshot<T> { offline:boolean; warning?:string }
export class StaleSessionError extends Error {}
/** Authorization errors must never silently fall back to a previously authorized copy. */
export async function readThroughCache<T>(options:{
  fetch:()=>Promise<T>; read:()=>Promise<Snapshot<T>|null>; write:(snapshot:Snapshot<T>)=>Promise<void>;
  isNetworkError:(error:unknown)=>boolean; isCurrent:()=>boolean; now?:()=>string;
}):Promise<CacheResult<T>> {
  const current=()=>{if(!options.isCurrent())throw new StaleSessionError('A sessão mudou.');};
  current();
  let fresh:T;
  try { fresh=await options.fetch(); }
  catch(error) {
    current(); if(!options.isNetworkError(error))throw error;
    let saved:Snapshot<T>|null=null; try{saved=await options.read();}catch{/* A broken local store must not mask the network failure. */}
    current(); if(!saved)throw error; return {...saved,offline:true};
  }
  current(); const snapshot={data:fresh,savedAt:options.now?.()??new Date().toISOString()};
  let warning:string|undefined;
  try{await options.write(snapshot);}catch{warning='Dados atualizados, mas não foi possível salvar a cópia offline.';}
  current();return {...snapshot,offline:false,warning};
}
