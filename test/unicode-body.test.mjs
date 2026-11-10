import test from 'node:test';import assert from 'node:assert/strict';import {createOfferServer} from '../server.mjs';import {FIELD_KEYS} from '../web/engine.mjs';
test('8000 Czech characters fit bounded JSON bytes without losing the advertised character limit',async()=>{
 let calls=0;const fields=Object.fromEntries(FIELD_KEYS.map(key=>[key,key.endsWith('Vat')?'unknown':null]));
 const server=createOfferServer({apiKey:'test-only',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({fields,evidence:[]})}]}]})}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const url='http://127.0.0.1:'+server.address().port+'/api/extract';const send=text=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});assert.equal((await send('ě'.repeat(8000))).status,200);assert.equal((await send('ě'.repeat(8001))).status,400);assert.equal(calls,1)}finally{await new Promise(resolve=>server.close(resolve))}
});
