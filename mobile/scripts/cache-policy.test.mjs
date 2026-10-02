import test from 'node:test';
import assert from 'node:assert/strict';
import { readThroughCache, StaleSessionError } from '../src/services/cachePolicy.ts';
const network=new Error('offline');
const saved={data:[{id:10,availableSeats:2}],savedAt:'2026-09-25T10:00:00.000Z'};
function options(overrides={}) {return {fetch:async()=>[{id:10,availableSeats:1}],read:async()=>saved,write:async()=>{},isNetworkError:e=>e===network,isCurrent:()=>true,now:()=> '2026-09-25T11:00:00.000Z',...overrides};}
test('online refresh replaces local seat counts and records synchronization time',async()=>{
  let stored;const result=await readThroughCache(options({write:async value=>{stored=value;}}));
  assert.equal(result.offline,false);assert.equal(result.data[0].availableSeats,1);assert.equal(stored.savedAt,'2026-09-25T11:00:00.000Z');
});
test('network failure permits relevant offline consultation without inventing new availability',async()=>{
  const result=await readThroughCache(options({fetch:async()=>{throw network;}}));assert.equal(result.offline,true);assert.deepEqual(result.data,saved.data);assert.equal(result.savedAt,saved.savedAt);
});
test('401/403 errors never return an old cache',async()=>{
  for(const status of [401,403]){const denied=Object.assign(new Error('denied'),{status});let read=false;
    await assert.rejects(readThroughCache(options({fetch:async()=>{throw denied;},read:async()=>{read=true;return saved;}})),e=>e===denied);assert.equal(read,false);
  }
});
test('first offline access with no stored rides produces a recoverable network error',async()=>{
  await assert.rejects(readThroughCache(options({fetch:async()=>{throw network;},read:async()=>null})),e=>e===network);
});
test('local write failure preserves successful remote data and reports missing offline copy',async()=>{
  const result=await readThroughCache(options({write:async()=>{throw new Error('disk');}}));assert.equal(result.offline,false);assert.equal(result.data[0].availableSeats,1);assert.ok(result.warning);
});
test('logout or account switch during request prevents data being saved for a stale session',async()=>{
  let valid=true,written=false;await assert.rejects(readThroughCache(options({isCurrent:()=>valid,fetch:async()=>{valid=false;return [];},write:async()=>{written=true;}})),StaleSessionError);assert.equal(written,false);
});
test('account switch while reading offline cache prevents stale data being displayed',async()=>{
  let valid=true;await assert.rejects(readThroughCache(options({isCurrent:()=>valid,fetch:async()=>{throw network;},read:async()=>{valid=false;return saved;}})),StaleSessionError);
});
