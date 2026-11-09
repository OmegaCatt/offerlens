import {performance} from 'node:perf_hooks';
import {prepareSnapshot,nextRevision,enforceStorageBudget} from '../web/history-model.mjs';
import {demoOffers,requirement} from '../web/fixtures.mjs';

const offers=Array.from({length:30},(_,index)=>({...structuredClone(demoOffers[0]),id:'benchmark-'+index,
  raw:('Fiktivní podklad pro měření historie. '.repeat(250)).slice(0,8000)}));
const prepareTimes=[],revisionTimes=[];let record=null,prepared;
for(let index=0;index<10;index++){
  const started=performance.now();prepared=await prepareSnapshot({...requirement,maxDays:20+index},offers);
  prepareTimes.push(performance.now()-started);
  const adding=performance.now();record=nextRevision(record,prepared,{id:'benchmark',title:'Fiktivní výkonnostní případ',message:'Ověření přípravy verze '+index,expectedRevision:index}).record;
  revisionTimes.push(performance.now()-adding);
}
const records=Array.from({length:3},(_,index)=>({...record,id:'record-'+index}));
const budgetStarted=performance.now();enforceStorageBudget(records);const budgetMs=performance.now()-budgetStarted;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return +( (sorted[4]+sorted[5])/2 ).toFixed(2)};
console.log(JSON.stringify({runtime:process.version,offers:30,rawCharsPerOffer:8000,samples:10,
  snapshotBytes:new TextEncoder().encode(JSON.stringify(prepared.snapshot)).length,
  prepareMedianMs:median(prepareTimes),revisionAddMedianMs:median(revisionTimes),
  budgetCheckBytes:new TextEncoder().encode(JSON.stringify(records)).length,budgetCheckMs:+budgetMs.toFixed(2),
  scope:'Local Node CPU/serialization only; no browser IndexedDB disk latency, AI call or network measured.'}));
