import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSnapshot,restoreSnapshot,prepareSnapshot,nextRevision,diffSnapshots,enforceStorageBudget,LIMITS} from '../web/history-model.mjs';
import {demoOffers,requirement} from '../web/fixtures.mjs';
import {compareOffers,evaluateOffer} from '../web/engine.mjs';

const options={id:'case-one',title:'Testovací poptávka',message:'První uložení',expectedRevision:0};
const date='2026-11-10T10:00:00.000Z';

test('history snapshots whitelist input, retain stable IDs and never restore review authority',async()=>{
  const offer={...structuredClone(demoOffers[0]),reviewed:true,productMatch:true,apiKey:'must-not-persist',totalHalers:1,status:'eligible'};
  const prepared=await prepareSnapshot(requirement,[offer]);
  assert.equal(prepared.snapshot.offers[0].apiKey,undefined);
  assert.equal(prepared.snapshot.offers[0].totalHalers,undefined);
  assert.equal(prepared.snapshot.offers[0].id,offer.id);
  assert.match(prepared.fingerprint,/^[a-f0-9]{64}$/);
  const restored=restoreSnapshot(prepared.snapshot);
  assert.equal(restored.offers[0].id,offer.id);assert.equal(restored.offers[0].reviewed,false);assert.equal(restored.offers[0].productMatch,null);
  assert.equal(compareOffers(restored.offers,restored.requirements).recommendedId,null);
});

test('versions append immutably and unchanged saves do not fabricate history',async()=>{
  const prepared=await prepareSnapshot(requirement,demoOffers);
  const first=nextRevision(null,prepared,options,date).record;
  const unchanged=nextRevision(first,prepared,{...options,expectedRevision:1},date);
  assert.equal(unchanged.unchanged,true);assert.equal(unchanged.record.revision,1);
  const modified=await prepareSnapshot({...requirement,maxDays:30},demoOffers);
  const second=nextRevision(first,modified,{...options,expectedRevision:1,message:'Nový termín dodání'},date).record;
  assert.equal(first.revisions.length,1);assert.equal(second.revisions.length,2);assert.equal(second.revision,2);
  assert.equal(second.revisions[0].snapshot.requirements.maxDays,14);
  assert.equal(second.revisions[1].snapshot.requirements.maxDays,30);
});

test('stale revisions and resurrection after removal are rejected',async()=>{
  const prepared=await prepareSnapshot(requirement,demoOffers),first=nextRevision(null,prepared,options,date).record;
  assert.throws(()=>nextRevision(first,prepared,options,date),/jiná karta/);
  assert.throws(()=>nextRevision(null,prepared,{...options,expectedRevision:1},date),/jiná karta/);
});

test('only ten versions are retained while revision numbers stay monotonic',async()=>{
  let record=null;
  for(let index=0;index<12;index++){
    const prepared=await prepareSnapshot({...requirement,maxDays:20+index},demoOffers);
    record=nextRevision(record,prepared,{...options,expectedRevision:index},date).record;
  }
  assert.equal(record.revision,12);assert.equal(record.revisions.length,10);assert.equal(record.revisions[0].number,3);
});

test('diff separates requirements, exact offer fields, additions and review state',()=>{
  const before=cleanSnapshot(requirement,demoOffers),after=structuredClone(before);
  after.requirements.maxDays=30;after.offers[0].fields.unitPrice='7000';after.offers[0].reviewed=true;after.offers.pop();
  const changes=diffSnapshots(before,after);
  assert.deepEqual(changes.find(change=>change.path==='requirements.maxDays'),{path:'requirements.maxDays',before:14,after:30});
  assert.equal(changes.find(change=>change.path==='offers.aurora.fields.unitPrice').after,'7000');
  assert.ok(changes.some(change=>change.path==='offers.pixel'&&change.after===null));
  assert.equal(changes.find(change=>change.path==='offers.aurora.reviewed').after,true);
});

test('invalid snapshots and storage limits are rejected, empty new cases work',()=>{
  assert.equal(restoreSnapshot(cleanSnapshot(requirement,[])).offers.length,0);
  for(const offers of [[demoOffers[0],demoOffers[0]],Array.from({length:31},(_,i)=>({...demoOffers[0],id:'offer-'+i})),[{...demoOffers[0],id:'bad.id'}]])assert.throws(()=>cleanSnapshot(requirement,offers));
  assert.throws(()=>restoreSnapshot({version:999}));
  assert.throws(()=>enforceStorageBudget(Array.from({length:LIMITS.cases+1},()=>({}))),/20/);
  assert.throws(()=>enforceStorageBudget([{content:'x'.repeat(LIMITS.bytes)}]),/10 MB/);
});

test('title and revision reason are required, bounded and control-free',async()=>{
  const prepared=await prepareSnapshot(requirement,demoOffers);
  for(const change of [{title:''},{title:'x\ny'},{message:'ano'},{message:'a'.repeat(301)},{message:'řádek\npříkazu'}])assert.throws(()=>nextRevision(null,prepared,{...options,...change},date));
});

test('large supported quantities use exact half-up VAT instead of float intermediates',()=>{
  const offer=structuredClone(demoOffers[0]);
  Object.assign(offer.fields,{unitPrice:'99999999,03',quantity:99999,shippingPrice:'0 Kč',priceVat:'excl',vatRate:21});
  const result=evaluateOffer(offer,{...requirement,quantity:99999});
  assert.equal(result.totalHalers,1209987888263117);
  assert.equal(Number.isSafeInteger(result.totalHalers),true);
});
