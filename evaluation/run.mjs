import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extractWithAi} from '../ai.mjs';
import {readLocalKey} from '../server.mjs';
import {parseHalers,FIELD_KEYS} from '../web/engine.mjs';
export function scoreExtraction(expected,actual){
 const checks=Object.entries(expected).map(([field,value])=>{
   const found=actual[field]??null;
   const normalize=v=>v===null||v==='unknown'?v:['unitPrice','shippingPrice'].includes(field)?parseHalers(v):typeof v==='string'?v.trim():v;
   return {field,expected:value,actual:found,pass:normalize(value)===normalize(found),unsupportedPopulation:(value===null||value==='unknown')&&found!==null&&found!=='unknown'};
 });return {checks,passed:checks.filter(check=>check.pass).length,total:checks.length,falsePopulated:checks.filter(check=>check.unsupportedPopulation).length};
}
export function validateCases(cases){if(!Array.isArray(cases)||cases.length!==12||new Set(cases.map(item=>item.id)).size!==cases.length)throw Error('Expected 12 unique curated cases.');for(const item of cases)if(typeof item.text!=='string'||item.text.length<30||Object.keys(item.expected).some(key=>!FIELD_KEYS.includes(key)))throw Error('Invalid curated case.');return cases}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const cases=validateCases(JSON.parse(await readFile(new URL('./cases.json',import.meta.url),'utf8')));
 if(!process.argv.includes('--live'))console.log('12 curated cases validated offline. No AI extraction or accuracy was measured. Use --live --limit 8 for a bounded provider run.');
 else{
   const limitIndex=process.argv.indexOf('--limit'),limit=limitIndex<0?8:Number(process.argv[limitIndex+1]);if(!Number.isInteger(limit)||limit<1||limit>12)throw Error('Limit must be 1–12 calls.');
   const apiKey=await readLocalKey();if(!apiKey)throw Error('Local API key unavailable.');
   const results=[];for(const item of cases.slice(0,limit)){try{const output=await extractWithAi(item.text,{apiKey});results.push({id:item.id,category:item.category,...scoreExtraction(item.expected,output.fields),output});console.log(item.id+': '+results.at(-1).passed+'/'+results.at(-1).total)}catch{results.push({id:item.id,error:'Provider extraction failed; no raw error/credentials recorded.'});console.log(item.id+': provider failure')}}
   const report={timestamp:new Date().toISOString(),model:'gpt-5.4-mini',mode:'live',limits:{calls:limit},note:'Curated fictional data; exact expected-field checks, not general AI accuracy. Quote occurrence is checked by runtime; factual interpretation still requires review.',fieldsPassed:results.reduce((sum,item)=>sum+(item.passed||0),0),fieldsExpected:cases.slice(0,limit).reduce((sum,item)=>sum+Object.keys(item.expected).length,0),falsePopulated:results.reduce((sum,item)=>sum+(item.falsePopulated||0),0),results};
   await mkdir(new URL('./reports/',import.meta.url),{recursive:true});const name='live-'+report.timestamp.replaceAll(/[:.]/g,'-')+'.json';await writeFile(new URL('./reports/'+name,import.meta.url),JSON.stringify(report,null,2));console.log('Saved '+name+'; '+report.fieldsPassed+'/'+report.fieldsExpected+' fields.');
 }
}
