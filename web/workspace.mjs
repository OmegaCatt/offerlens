import {importReport} from './engine.mjs';
export function validateRequirement(r){
 if(!r||typeof r.product!=='string'||!r.product.trim()||r.product.length>200||r.currency!=='CZK'||!Number.isSafeInteger(r.budgetHalers)||r.budgetHalers<=0||r.budgetHalers>1e11||['quantity','maxDays','minWarrantyMonths'].some(k=>!Number.isInteger(r[k])||r[k]<1||r[k]>100000))throw Error('Neplatné zadání poptávky.');
 return {product:r.product.trim(),quantity:r.quantity,maxDays:r.maxDays,minWarrantyMonths:r.minWarrantyMonths,budgetHalers:r.budgetHalers,currency:r.currency};
}
export function decodeWorkspace(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>1_000_000)throw Error('Limit případu je 1 MB.');
 const saved=JSON.parse(text);
 if(saved?.format!=='offerlens-workspace'||saved.version!==1)throw Error('Nepodporovaný případ.');
 const requirements=validateRequirement(saved.requirements);
 return {requirements,offers:importReport(JSON.stringify({version:1,requirements,offers:saved.offers}),requirements)};
}
