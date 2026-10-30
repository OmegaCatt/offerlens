import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { compareOffers, comparisonCsv, evaluateOffer, parseHalers, validateAiPayload } from '../web/engine.mjs';
import { demoOffers, requirement } from '../web/fixtures.mjs';
import { extractWithAi, extractionSchema } from '../ai.mjs';
import { createOfferServer } from '../server.mjs';

test('money parser uses exact halers and rejects ambiguous or negative input',()=>{
  assert.equal(parseHalers('6 900 Kč'),690000);assert.equal(parseHalers('790,50 Kč'),79050);assert.equal(parseHalers('0 Kč'),0);
  for(const value of ['1,250.50 Kč','-10 Kč','1.234 Kč','6 900,999 Kč','neznámé'])assert.equal(parseHalers(value),null,value);
});
test('prepared comparison chooses compliant supplier instead of lowest unit price',()=>{
  const result=compareOffers(demoOffers,requirement);
  assert.equal(result.recommendedId,'aurora');assert.equal(result.eligibleCount,1);assert.equal(result.blockedCount,2);
  assert.equal(result.offers.find(x=>x.id==='aurora').totalHalers,8444590);
  assert.equal(result.offers.find(x=>x.id==='nova').totalHalers,7950000);
  assert.equal(result.offers.find(x=>x.id==='pixel').totalHalers,null);
});
test('uncertain shipping or VAT prevents a final total',()=>{
  for(const change of [{shippingPrice:null},{shippingVat:'unknown'},{priceVat:'unknown'},{vatRate:null}]){
    const offer=structuredClone(demoOffers[0]);Object.assign(offer.fields,change);
    assert.equal(evaluateOffer(offer,requirement).totalHalers,null);
  }
});
test('CSV export keeps exact totals and neutralizes spreadsheet formulas',()=>{
  const offers=structuredClone(demoOffers);offers[0].name='=HYPERLINK("https://evil.example")';
  const csv=comparisonCsv(compareOffers(offers,requirement));
  assert.match(csv,/^\ufeff"Dodavatel"/);
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/evil.example""\)"/);
  assert.match(csv,/"84445,90"/);
  assert.equal(csv.split('\r\n').filter(Boolean).length,4);
});
test('AI-derived offer requires human confirmation before recommendation',()=>{
  const offer={...structuredClone(demoOffers[0]),origin:'ai',reviewed:false,productMatch:null};
  assert.equal(evaluateOffer(offer,requirement).status,'review');
  offer.reviewed=true;assert.equal(evaluateOffer(offer,requirement).status,'review');
  offer.productMatch=true;assert.equal(evaluateOffer(offer,requirement).status,'eligible');
  offer.productMatch=false;assert.equal(evaluateOffer(offer,requirement).status,'blocked');
});
test('unsupported AI fields are cleared even if JSON schema is valid',()=>{
  const raw='Dodavatel Alfa nabízí 10 monitorů. Cena 6 900 Kč bez DPH. Doprava zdarma. Dodání do 7 dnů. Záruka 36 měsíců.';
  const fields={supplier:'Alfa',product:'Monitor',quantity:10,unitPrice:'6 900 Kč',priceVat:'excl',shippingPrice:'0 Kč',shippingVat:'incl',vatRate:21,leadDays:7,warrantyMonths:36,currency:'CZK'};
  const evidence=[{field:'supplier',quote:'Alfa'},{field:'quantity',quote:'10 monitorů'},{field:'leadDays',quote:'Dodání do 7 dnů'},{field:'warrantyMonths',quote:'Záruka 36 měsíců'},{field:'unitPrice',quote:'999 Kč'}];
  const out=validateAiPayload(raw,{fields,evidence});assert.equal(out.fields.unitPrice,null);assert.ok(out.unsupported.includes('unitPrice'));assert.equal(out.evidence.unitPrice,undefined);assert.equal(out.fields.quantity,10);
});
test('AI request uses strict structured output and returns checked data',async()=>{
  let sent;
  const raw='Dodavatel Alfa nabízí 10 monitorů za 6 900 Kč bez DPH. Dodání do 7 dnů.';
  const fields=Object.fromEntries(Object.keys(extractionSchema.properties.fields.properties).map(k=>[k,null]));
  fields.supplier='Alfa';fields.priceVat='unknown';fields.shippingVat='unknown';
  const out=await extractWithAi(raw,{apiKey:'test-only',fetchImpl:async(url,options)=>{sent={url,options};return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({fields,evidence:[{field:'supplier',quote:'Alfa'}]})}]}]})};}});
  assert.equal(out.fields.supplier,'Alfa');assert.equal(sent.url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(sent.options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.text.format.schema.additionalProperties,false);
});
test('local server blocks cross-origin extraction and oversized input',async()=>{
  const server=createOfferServer({apiKey:'test-only',fetchImpl:async()=>{throw new Error('must not call')}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const port=server.address().port, base=`http://127.0.0.1:${port}`;
    const health=await (await fetch(base+'/api/health')).json();assert.equal(health.aiConfigured,true);
    const badOrigin=await fetch(base+'/api/extract',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(50)})});assert.equal(badOrigin.status,403);
    const tooLong=await fetch(base+'/api/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(8001)})});assert.equal(tooLong.status,400);
    const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
    const secret=await fetch(base+'/.env.local');assert.equal(secret.status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('AI endpoint enforces a daily call budget without spending on rejected input',async()=>{
  let calls=0, time=0;
  const fields=Object.fromEntries(Object.keys(extractionSchema.properties.fields.properties).map(k=>[k,null]));
  fields.priceVat='unknown';fields.shippingVat='unknown';
  const server=createOfferServer({apiKey:'test-only',maxAiCalls:1,windowMs:1000,now:()=>time,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({fields,evidence:[]})}]}]})};}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`, send=()=>fetch(base+'/api/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Fiktivní nabídka monitorů obsahuje alespoň třicet znaků.'})});
    assert.equal((await send()).status,200);
    assert.equal((await send()).status,429);
    assert.equal(calls,1);
    time=1001;
    assert.equal((await send()).status,200);
    assert.equal(calls,2);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('concurrency slot is reserved before an incomplete request body',async()=>{
  const server=createOfferServer({apiKey:'test-only',fetchImpl:async()=>{throw new Error('not needed')}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port, pending=[];
  try{
    for(let i=0;i<2;i++){
      const request=http.request({hostname:'127.0.0.1',port,path:'/api/extract',method:'POST',headers:{'content-type':'application/json','content-length':'100'}},response=>response.resume());
      request.on('error',()=>{});request.flushHeaders();pending.push(request);
    }
    await new Promise(resolve=>setTimeout(resolve,30));
    const third=await fetch(`http://127.0.0.1:${port}/api/extract`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Fiktivní nabídka monitorů obsahuje alespoň třicet znaků.'})});
    assert.equal(third.status,429);
  }finally{for(const request of pending)request.destroy();await new Promise(resolve=>server.close(resolve));}
});
