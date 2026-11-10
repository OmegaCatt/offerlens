import {evaluateOffer,parseHalers} from './engine.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const text=(value,max=200)=>typeof value==='string'&&value.trim()&&value.length<=max;
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const unique=rows=>new Set(rows.map(row=>row.id)).size===rows.length;
export function cleanBasket(input,{restore=false}={}){
  if(input?.format!=='offerlens-basket'||input.version!==2||!text(input.title,100)||input.currency!=='CZK'||!Number.isSafeInteger(input.budgetHalers)||input.budgetHalers<=0||input.budgetHalers>1e11||!Array.isArray(input.requirements)||!input.requirements.length||input.requirements.length>20||!unique(input.requirements)||!Array.isArray(input.offers)||input.offers.length>30||!unique(input.offers))throw Error('Neplatná vícepoložková poptávka.');
  const requirements=input.requirements.map(row=>{
    if(!id(row.id)||!text(row.product)||!integer(row.quantity,1,100000)||!integer(row.maxDays,1,365)||!integer(row.minWarrantyMonths,0,240))throw Error('Neplatný řádek poptávky.');
    return {id:row.id,product:row.product.trim(),quantity:row.quantity,maxDays:row.maxDays,minWarrantyMonths:row.minWarrantyMonths};
  });
  const offers=input.offers.map(offer=>{
    if(!id(offer.id)||!text(offer.supplier)||typeof offer.raw!=='string'||offer.raw.length>8000||!Array.isArray(offer.lines)||offer.lines.length>20)throw Error('Neplatná nabídka.');
    // Unknown/duplicate line IDs are retained for explicit blocking, never silently discarded.
    const lines=offer.lines.map(line=>{
      if(!id(line.requirementId)||!line.fields||typeof line.fields!=='object')throw Error('Neplatná položka nabídky.');
      const fields={};for(const key of ['product','quantity','unitPrice','priceVat','vatRate','leadDays','warrantyMonths','currency']){
        const value=line.fields[key]??null;
        if(value!==null&&!(typeof value==='string'&&value.length<=300)&&!(typeof value==='number'&&Number.isFinite(value)))throw Error('Neplatná hodnota položky.');fields[key]=value;
      }
      return {requirementId:line.requirementId,fields,reviewed:restore?false:line.reviewed===true,productMatch:restore?null:typeof line.productMatch==='boolean'?line.productMatch:null};
    });
    const shippingPrice=offer.shippingPrice??null;
    if(shippingPrice!==null&&!(typeof shippingPrice==='string'&&shippingPrice.length<=100))throw Error('Neplatná doprava.');
    return {id:offer.id,supplier:offer.supplier.trim(),raw:offer.raw,shippingPrice,shippingVat:['incl','excl','unknown'].includes(offer.shippingVat)?offer.shippingVat:'unknown',shippingVatRate:integer(offer.shippingVatRate,0,30)?offer.shippingVatRate:null,shippingReviewed:restore?false:offer.shippingReviewed===true,lines};
  });
  const result={format:'offerlens-basket',version:2,title:input.title.trim(),currency:'CZK',budgetHalers:input.budgetHalers,requirements,offers};
  if(new TextEncoder().encode(JSON.stringify(result)).length>1_000_000)throw Error('Limit případu je 1 MB.');return result;
}
export function decodeBasket(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>1_000_000)throw Error('Limit případu je 1 MB.');return cleanBasket(JSON.parse(text),{restore:true})}
export function compareBasket(input){
  const basket=cleanBasket(input);
  const offers=basket.offers.map(offer=>{
    const issues=[],unknown=[],results=[];let sum=0n;
    if(offer.raw.trim().length<10)unknown.push('Chybí původní podklad nabídky.');
    const allowed=new Set(basket.requirements.map(row=>row.id));
    if(offer.lines.some(line=>!allowed.has(line.requirementId)))issues.push('Nabídka obsahuje neznámý řádek.');
    for(const requirement of basket.requirements){
      const lines=offer.lines.filter(line=>line.requirementId===requirement.id);
      if(lines.length!==1){issues.push(requirement.product+': '+(lines.length?'duplicitní položka':'chybějící položka'));continue}
      const line=lines[0];
      const result=evaluateOffer({id:requirement.id,origin:'manual',reviewed:line.reviewed,productMatch:line.productMatch,fields:{...line.fields,shippingPrice:'0',shippingVat:'incl'}},{...requirement,currency:'CZK',budgetHalers:Number.MAX_SAFE_INTEGER});
      results.push({...result,requirement});issues.push(...result.issues.map(value=>requirement.product+': '+value));unknown.push(...result.unknown.map(value=>requirement.product+': '+value));
      if(result.totalHalers!==null)sum+=BigInt(result.totalHalers);
    }
    const shipping=parseHalers(offer.shippingPrice);
    if(shipping===null)unknown.push('Doprava není známá.');
    if(!offer.shippingReviewed)unknown.push('Doprava čeká na lidskou kontrolu.');
    if(shipping!==0&&(!['incl','excl'].includes(offer.shippingVat)||!integer(offer.shippingVatRate,0,30)))unknown.push('DPH dopravy není známá.');
    if(shipping!==null){sum+=shipping===0||offer.shippingVat==='incl'?BigInt(shipping):(BigInt(shipping)*BigInt(100+(offer.shippingVatRate??0))+50n)/100n;}
    const calculable=shipping!==null&&(shipping===0||['incl','excl'].includes(offer.shippingVat)&&integer(offer.shippingVatRate,0,30))&&results.length===basket.requirements.length&&results.every(line=>line.totalHalers!==null)&&!issues.some(value=>/duplicitní|neznámý/.test(value));
    if(sum>BigInt(Number.MAX_SAFE_INTEGER))unknown.push('Součet překračuje přesný podporovaný rozsah.');
    const totalHalers=calculable&&sum<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sum):null;
    if(totalHalers!==null&&totalHalers>basket.budgetHalers)issues.push('Celková cena překračuje rozpočet.');
    return {...offer,results,issues,unknown,totalHalers,status:issues.length?'blocked':unknown.length||totalHalers===null?'review':'eligible'};
  });
  const eligible=offers.filter(offer=>offer.status==='eligible').sort((a,b)=>a.totalHalers-b.totalHalers);
  return {offers,recommendedId:eligible[0]?.id??null};
}
export function nextBasketRevision(existing,prepared,options,now=new Date().toISOString()){
  if(!id(options.id)||!text(options.title,100)||!text(options.message,300)||options.message.trim().length<5||!/^[a-f0-9]{64}$/.test(prepared.fingerprint))throw Error('Vyplňte název a důvod (5–300 znaků).');
  if((existing?.revision??0)!==options.expectedRevision)throw Error('Případ změnila jiná karta. Otevřete aktuální verzi nebo uložte kopii.');
  const snapshot=cleanBasket(prepared.snapshot);const number=(existing?.revision??0)+1;
  return {record:{id:options.id,version:2,title:options.title,revision:number,createdAt:existing?.createdAt??now,updatedAt:now,revisions:[...(existing?.revisions??[]),{number,savedAt:now,message:options.message,title:options.title,fingerprint:prepared.fingerprint,snapshot}].slice(-10)},unchanged:false};
}
export async function prepareBasket(input){const snapshot=cleanBasket(input);const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(snapshot)));return {snapshot,fingerprint:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}}
export const basketDemo=()=>({format:'offerlens-basket',version:2,title:'Vybavení dvou pracovních míst',currency:'CZK',budgetHalers:4_000_000,requirements:[{id:'monitor',product:'Monitor 27 palců',quantity:2,maxDays:14,minWarrantyMonths:24},{id:'dock',product:'USB-C dokovací stanice',quantity:2,maxDays:14,minWarrantyMonths:24}],offers:[{id:'complete',supplier:'Sever Office (fiktivní)',raw:'Monitory 27 palců: 2 ks po 6 000 Kč bez DPH, sazba 21 %. Dokovací stanice USB-C: 2 ks po 2 000 Kč bez DPH, sazba 21 %. Vše do 7 kalendářních dnů, záruka 36 měsíců. Doprava celkem 100 Kč včetně DPH.',shippingPrice:'100',shippingVat:'incl',shippingVatRate:21,shippingReviewed:false,lines:[{requirementId:'monitor',fields:{product:'Monitor 27 palců',quantity:2,unitPrice:'6000',priceVat:'excl',vatRate:21,leadDays:7,warrantyMonths:36,currency:'CZK'},reviewed:false,productMatch:null},{requirementId:'dock',fields:{product:'USB-C dokovací stanice',quantity:2,unitPrice:'2000',priceVat:'excl',vatRate:21,leadDays:7,warrantyMonths:36,currency:'CZK'},reviewed:false,productMatch:null}]},{id:'partial',supplier:'Částečná dodávka (fiktivní)',raw:'Dostupný pouze 1 monitor 27 palců po 5 000 Kč včetně DPH. Stanice nedodáváme. Dodání 5 kalendářních dnů, záruka 24 měsíců. Doprava zdarma.',shippingPrice:'0',shippingVat:'incl',shippingVatRate:21,shippingReviewed:false,lines:[{requirementId:'monitor',fields:{product:'Monitor 27 palců',quantity:1,unitPrice:'5000',priceVat:'incl',vatRate:21,leadDays:5,warrantyMonths:24,currency:'CZK'},reviewed:false,productMatch:null}]}]});
