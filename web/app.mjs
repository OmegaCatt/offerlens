import { compareOffers, comparisonCsv, decisionBrief, formatCzk, FIELD_KEYS, importReport } from './engine.mjs';
import { demoOffers, requirement as defaultRequirement } from './fixtures.mjs';
import {validateRequirement,decodeWorkspace} from './workspace.mjs';
import {prepareSnapshot,restoreSnapshot,diffSnapshots} from './history-model.mjs';
import {listCases,readCase,saveCase,removeCase} from './history-store.mjs';
import {importPdf,sourceLocation} from './pdf-client.mjs';
let requirement=structuredClone(defaultRequirement);

const $ = id => document.getElementById(id);
const clone = value => structuredClone(value);
const state = { offers: clone(demoOffers), view: 'overview', aiConfigured: false, busy: false, generation:0,
  caseId:null, caseTitle:'Ukázková poptávka', caseRevision:0, dirty:false, saving:false, historyGeneration:0, activeDetail:null };

function cancelExtraction(){
  state.activeExtraction?.abort();state.activeExtraction=null;
  state.busy=false;
  $('ai-button').disabled=false;$('ai-button').textContent='Vytěžit údaje pomocí AI ✦';
}
function invalidatePending(){
  state.generation++;cancelExtraction();
  for(const id of ['add-dialog','detail-dialog'])if($(id).open)$(id).close();
}
function changed(){state.generation++;cancelExtraction();state.dirty=true;renderCaseStatus();}
function renderCaseStatus(){
  const node=$('case-status');if(!node)return;
  node.textContent=state.caseTitle+' · '+(state.caseId?'otevřena v'+(state.loadedRevision||state.caseRevision)+(state.loadedRevision&&state.loadedRevision!==state.caseRevision?' / poslední v'+state.caseRevision:''):'zatím neuloženo')+(state.dirty?' · neuložené změny':'');
  $('case-save').disabled=state.saving;
}
async function mayReplace(){
  if(!state.dirty)return true;
  const dialog=child('dialog',{'aria-label':'Neuložené změny'});
  return new Promise(resolve=>{
    let accepted=false;
    dialog.append(child('h2',{},'Ponechat neuložené změny?'),child('p',{},'Přepnutí nahradí obsah pracovní plochy. Nejprve můžete změny uložit do místní historie nebo JSON.'),child('div',{class:'dialog-actions'},child('button',{class:'button subtle',onclick:()=>dialog.close()},'Zůstat zde'),child('button',{class:'button primary',onclick:()=>{accepted=true;dialog.close()}},'Nahradit pracovní plochu')));
    document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted)},{once:true});dialog.showModal();
  });
}
const names = { supplier:'Dodavatel', product:'Produkt', quantity:'Počet kusů', unitPrice:'Cena za kus', priceVat:'DPH u ceny', shippingPrice:'Doprava', shippingVat:'DPH u dopravy', vatRate:'Sazba DPH (%)', leadDays:'Dodání (kalendářní dny)', warrantyMonths:'Záruka (měsíce)', currency:'Měna' };
const enumOptions = { priceVat:[['unknown','Neznámé'],['excl','Bez DPH'],['incl','Včetně DPH']], shippingVat:[['unknown','Neznámé'],['excl','Bez DPH'],['incl','Včetně DPH']] };
const number = n => new Intl.NumberFormat('cs-CZ').format(n);
const child = (tag, attrs = {}, ...contents) => {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  for (const c of contents.flat(Infinity)) if (c !== null && c !== undefined) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
};
function toast(message) { const n=$('toast'); n.textContent=message; n.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>n.classList.remove('visible'),3500); }
const statusText = { eligible:'Splňuje zadání', blocked:'Nesplňuje', review:'K ověření' };
const chip = status => child('span',{class:`chip ${status}`},statusText[status]);
function analysis() { return compareOffers(state.offers, requirement); }
function sectionTitle(title, subtitle, link) { return child('div',{class:'section-title'},child('div',{},child('h2',{},title),child('p',{},subtitle)),link ? child('a',{href:link,class:'text-link'},'Zobrazit vše →') : null); }
function requirementBar() { return child('div',{class:'requirements'},
  child('div',{class:'req-title'},child('strong',{},'Zadání poptávky'),child('p',{},'Aktuální zadání · CZK')),
  ...[['PRODUKT',requirement.product],['MNOŽSTVÍ',`${requirement.quantity} kusů`],['DODÁNÍ',`do ${requirement.maxDays} dní`],['ROZPOČET',formatCzk(requirement.budgetHalers)]].map(([label,value])=>child('div',{},child('span',{class:'req-label'},label),child('strong',{class:'req-value'},value)))); }
function vendorCell(o) { return child('div',{class:'vendor'},child('span',{class:'vendor-mark'},o.name.slice(0,1).toUpperCase()),child('span',{},child('strong',{},o.name),child('small',{},o.origin==='prepared'?'Připravená fiktivní nabídka':o.origin==='ai'?'AI extrakce':'Ruční podklad'))); }
function offerTable(items) {
  return child('div',{class:'table-wrap'},child('table',{},child('thead',{},child('tr',{},...['DODAVATEL','CELKEM VČ. DPH','DODÁNÍ','ZÁRUKA','VÝSLEDEK',''].map(t=>child('th',{scope:'col'},t)))),child('tbody',{},...items.map(o=>child('tr',{},child('td',{},vendorCell(o)),child('td',{class:o.totalHalers===null?'muted':'money'},formatCzk(o.totalHalers)),child('td',{},o.fields.leadDays===null?'Nejasné':`${o.fields.leadDays} dní`),child('td',{},o.fields.warrantyMonths===null?'Nejasná':`${o.fields.warrantyMonths} měs.`),child('td',{},chip(o.status)),child('td',{},child('button',{class:'view-button',onclick:()=>showDetail(o.id)},'Zobrazit detail →')))))),child('div',{class:'table-note'},'Cena zahrnuje známou dopravu a DPH. Neúplné podmínky brání porovnání konečné ceny.'));
}
function overview() {
  const a=analysis(), recommended=a.offers.find(o=>o.id===a.recommendedId);
  const rec=child('article',{class:'recommendation'},child('div',{class:'rec-kicker'},'✦  DOPORUČENÍ PODLE ZADANÝCH PRAVIDEL'),child('div',{class:'rec-row'},child('div',{},child('h2',{},recommended?.name??'Zatím bez doporučení'),child('p',{},recommended?'Splňuje počet kusů, termín dodání, záruku i rozpočet. Nejnižší známá cena mezi vyhovujícími nabídkami.':'Žádná nabídka zatím nemá potvrzené všechny podmínky zadání.')),recommended?child('div',{class:'rec-price'},formatCzk(recommended.totalHalers),child('small',{},'celkem včetně DPH')):null),child('div',{class:'rec-bottom'},child('span',{},'Výběr vzniká výpočtem; AI pouze čte vstupní text.'),recommended?child('button',{onclick:()=>showDetail(recommended.id)},'Prohlédnout podklady ↗'):null));
  const stats=child('div',{class:'stats'},...[[a.offers.length,'Nabídek v porovnání','◈'],[a.eligibleCount,'Splňuje všechny podmínky','✓'],[a.blockedCount,'Nesplňuje zadání','!'],[a.reviewCount,'Čeká na ověření','?']].map(([value,label,symbol])=>child('div',{class:'stat'},child('span',{class:'symbol'},symbol),child('strong',{},number(value)),child('span',{},label))));
  return child('div',{},child('div',{class:'summary-grid'},rec,stats),requirementBar(),sectionTitle('Srovnání na jedné stránce','Stejná pravidla pro každého dodavatele.','#offers'),offerTable(a.offers));
}
function offersView() { const a=analysis(); const count=a.offers.length; const noun=count===1?'nabídka':count>=2&&count<=4?'nabídky':'nabídek'; return child('div',{},sectionTitle('Podklady od dodavatelů',`${count} ${noun} · každou lze otevřít a ověřit`),child('div',{class:'offer-cards'},...a.offers.map(o=>child('article',{class:'offer-card'},child('div',{class:'offer-card-head'},child('span',{class:'vendor-mark'},o.name.slice(0,1).toUpperCase()),chip(o.status)),child('h3',{},o.name),child('p',{},o.issues[0]??o.unknown[0]??'Všechny hlavní podmínky odpovídají poptávce.'),child('div',{class:'total'},formatCzk(o.totalHalers)),child('div',{class:'meta'},child('span',{},o.fields.leadDays===null?'Dodání nejasné':`Dodání ${o.fields.leadDays} dní`),child('span',{},o.fields.warrantyMonths===null?'Záruka nejasná':`Záruka ${o.fields.warrantyMonths} měs.`)),child('button',{class:'button subtle small',onclick:()=>showDetail(o.id)},'Zkontrolovat nabídku →')))));
}
function methodView() { return child('div',{},sectionTitle('Jak vzniká doporučení','Každý krok lze dohledat v původním textu.'),child('div',{class:'method-grid'},...[
  ['01','Získání údajů','AI nabídku přečte a vrátí pole s doslovnými úryvky. Pokud důkaz v textu chybí, pole zůstane nevyřešené.'],
  ['02','Výpočet bez odhadů','Ceny se převádějí na haléře. DPH, doprava a měna se započítají jen při známých podmínkách; nejasná cena se neřadí.'],
  ['03','Rozhodnutí člověka','Dodavatel může být doporučen až po ověření AI údajů a splnění počtu kusů, termínu, záruky a rozpočtu.']
].map(([n,title,desc])=>child('article',{class:'method-card'},child('span',{class:'method-number'},n),child('h3',{},title),child('p',{},desc)))),child('div',{class:'method-callout'},'Důležitá hranice: text nabídky může být neúplný nebo zavádějící. OfferLens neslibuje správnost AI extrakce; upozorňuje na chybějící důkazy a ponechává poslední kontrolu člověku.'));
}
function render() {
  const view=state.view;
  document.querySelector('.demo-pill').textContent=state.offers.length&&state.offers.every(offer=>offer.origin==='prepared')?'Připravené nabídky':'Místní podklady';
  document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('content').replaceChildren(view==='offers'?offersView():view==='method'?methodView():overview());
  renderCaseStatus();
}
function selectView() { const value=location.hash.slice(1);state.view=['overview','offers','method'].includes(value)?value:'overview';render(); }
function showDetail(id) {
  const offer=state.offers.find(o=>o.id===id); if(!offer)return;
  const evaluated=analysis().offers.find(o=>o.id===id), content=$('detail-content'); $('detail-title').textContent=offer.name;
  const inputs={};
  const matchSelect=child('select',{id:'product-match'},child('option',{value:'unknown',...(offer.productMatch===null||offer.productMatch===undefined?{selected:''}:{})},'Ještě nevím'),child('option',{value:'yes',...(offer.productMatch===true?{selected:''}:{})},'Ano, odpovídá'),child('option',{value:'no',...(offer.productMatch===false?{selected:''}:{})},'Ne, neodpovídá'));
  const fields=child('div',{class:'field-list'},...FIELD_KEYS.map(key=>{
    const value=offer.fields[key];
    const control=enumOptions[key]?child('select',{id:`field-${key}`},...enumOptions[key].map(([v,label])=>child('option',{value:v,...(value===v?{selected:''}:{})},label))):child('input',{id:`field-${key}`,type:['quantity','vatRate','leadDays','warrantyMonths'].includes(key)?'number':'text',value:value??'',...(key==='currency'?{maxlength:8}:{maxlength:100})});
    inputs[key]=control;
    return child('div',{class:'field-row'},child('label',{for:`field-${key}`},names[key]),control,child('p',{class:'evidence'},offer.evidence?.[key]?`Zdroj: ${sourceLocation(offer.raw,offer.evidence[key])} „${offer.evidence[key]}“`:'Bez potvrzeného úryvku'));
  }));
  const summary=child('div',{class:'detail-summary'},child('div',{},chip(evaluated.status),child('div',{class:'detail-flags'},...evaluated.issues.map(x=>child('p',{},'× '+x)),...evaluated.unknown.map(x=>child('p',{},'· '+x)))),child('strong',{},formatCzk(evaluated.totalHalers)));
  state.activeDetail=id;
  const generation=state.generation;
  const mustConfirm=true;
  const reviewCheck=child('input',{id:'review-check',type:'checkbox'}),reviewError=child('p',{class:'form-error',role:'alert'},'');
  content.replaceChildren(child('div',{class:'detail-grid'},child('div',{class:'source-panel'},child('h3',{},'Původní text nabídky'),child('pre',{},offer.raw)),child('div',{class:'fields-panel'},child('h3',{},'Údaje pro výpočet'),child('p',{class:'review-note'},'Úryvek pouze potvrzuje, že text existuje. Zkontrolujte, zda skutečně podporuje vyplněnou hodnotu.'),child('label',{for:'product-match'},'Odpovídá nabízený produkt poptávce?'),matchSelect,fields,mustConfirm?child('label',{class:'review-confirm',for:'review-check'},reviewCheck,child('span',{},'Porovnal(a) jsem všechny rozhodující údaje s původním textem.')):null)),summary,reviewError,child('div',{class:'detail-actions'},child('button',{class:'button subtle',onclick:()=>$('detail-dialog').close()},'Zavřít'),child('button',{class:'button primary',onclick:()=>{
    if(generation!==state.generation||!state.offers.includes(offer)){reviewError.textContent='Případ se mezitím změnil. Otevřete detail znovu.';return;}
    if(mustConfirm&&!reviewCheck.checked){reviewError.textContent='Nejprve potvrďte kontrolu rozhodujících údajů.';return;}
    const next={};for(const key of FIELD_KEYS){const raw=inputs[key].value.trim();next[key]=['quantity','vatRate','leadDays','warrantyMonths'].includes(key)?(raw===''?null:Number(raw)):raw||null;}
    offer.fields=next;offer.name=next.supplier||'Neznámý dodavatel';offer.productMatch=matchSelect.value==='yes'?true:matchSelect.value==='no'?false:null;offer.reviewed=true;changed();$('detail-dialog').close();render();toast('Údaje byly potvrzeny a porovnání přepočítáno.');
  }},'Potvrdit údaje a přepočítat')));
  content.append(child('details',{class:'remove-offer'},child('summary',{},'Odebrat nabídku…'),child('p',{},'Odstraní nabídku z pracovní plochy. Již uložené verze zůstanou zachované; další uložení zaznamená odebrání.'),child('button',{class:'button subtle',onclick:()=>{if(generation!==state.generation||!state.offers.includes(offer)){reviewError.textContent='Případ se změnil. Otevřete detail znovu.';return}state.offers=state.offers.filter(item=>item!==offer);changed();$('detail-dialog').close();render();toast('Nabídka odebrána z pracovní plochy.');}},'Odebrat z této poptávky')));
  $('detail-dialog').showModal();
}
function newOffer(raw, extraction, origin) { if(state.offers.length>=30){$('add-error').textContent='Limit je 30 nabídek na poptávku.';return}const id=crypto.randomUUID();const fields=extraction?.fields??Object.fromEntries(FIELD_KEYS.map(k=>[k,k.endsWith('Vat')?'unknown':null]));const offer={id,origin,productMatch:null,name:fields.supplier||'Nová nabídka',raw,fields,evidence:extraction?.evidence??{},unsupported:extraction?.unsupported??[],reviewed:false};state.offers.push(offer);changed();$('add-dialog').close();$('quote-text').value='';$('add-error').textContent='';state.view='offers';location.hash='offers';render();showDetail(id); }
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=child('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportReport(){const a=analysis();const report={version:1,requirements:requirement,recommendedId:a.recommendedId,offers:a.offers.map(({id,name,origin,raw,fields,evidence,productMatch,reviewed,totalHalers,status,issues,unknown})=>({id,name,origin,raw,fields,evidence,productMatch,reviewed,totalHalers,status,issues,unknown}))};download('offerlens_srovnani.json',JSON.stringify(report,null,2),'application/json;charset=utf-8');toast('Výsledek byl exportován do JSON.');}
function exportCsv(){download('offerlens_srovnani.csv',comparisonCsv(analysis()),'text/csv;charset=utf-8');toast('Výsledek byl exportován do CSV.');}
function exportBrief(){download('offerlens_podklad_k_rozhodnuti.md',decisionBrief(analysis()),'text/markdown;charset=utf-8');toast('Shrnutí rozhodnutí bylo připraveno ke stažení.');}
async function addWithAi(){
  const raw=$('quote-text').value.trim(),err=$('add-error');err.textContent='';
  if(raw.length<30||raw.length>8000){err.textContent='Text musí mít 30 až 8 000 znaků.';return;}
  if(state.offers.length>=30){err.textContent='Limit je 30 nabídek na poptávku.';return;}
  if(state.busy)return;
  const generation=state.generation,controller=new AbortController();state.activeExtraction=controller;
  state.busy=true;$('ai-button').disabled=true;$('ai-button').textContent='AI čte nabídku…';
  try{
    const res=await fetch('/api/extract',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({text:raw})});
    const data=await res.json();if(generation!==state.generation)return;
    if(!res.ok)throw new Error(data.error||'Extrakce selhala.');
    $('quota-note').textContent=`Zbývá ${data.remainingAiCalls} AI volání v aktuálním denním okně.`;
    newOffer(raw,data,'ai');toast(data.unsupported?.length?`AI vynechala ${data.unsupported.length} polí bez doloženého úryvku.`:'AI vyplnila údaje. Před porovnáním je ověřte.');
  }catch(error){if(generation===state.generation&&error.name!=='AbortError')err.textContent=error.message||'AI extrakce selhala.';}
  finally{if(state.activeExtraction===controller){state.activeExtraction=null;state.busy=false;$('ai-button').disabled=false;$('ai-button').textContent='Vytěžit údaje pomocí AI ✦';}}
}
window.addEventListener('hashchange',selectView);
$('add-button').addEventListener('click',()=>{$('add-error').textContent='';$('add-dialog').showModal();});
$('manual-button').addEventListener('click',()=>{const raw=$('quote-text').value.trim();if(raw.length<10||raw.length>8000){$('add-error').textContent='Vložte 10 až 8 000 znaků textu nabídky.';return}newOffer(raw,null,'manual');});
$('ai-button').addEventListener('click',addWithAi);
$('quote-text').addEventListener('input',()=>{state.generation++;if(state.activeExtraction){cancelExtraction();$('add-error').textContent='Text se změnil. Předchozí extrakce byla zrušena.';}});
$('export-button').addEventListener('click',exportReport);
$('export-csv-button').addEventListener('click',exportCsv);
$('export-brief-button').addEventListener('click',exportBrief);
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  let generation=state.generation;
  try{
    if(file.size>1_000_000)throw new Error('Soubor je příliš velký (limit 1 MB).');
    if(!await mayReplace())return;invalidatePending();generation=state.generation;
    const text=await file.text();if(generation!==state.generation)return;const offers=importReport(text,requirement);
    state.offers=offers;state.caseId=null;state.caseTitle='Importované porovnání';state.caseRevision=0;state.loadedRevision=0;state.dirty=true;state.view='offers';location.hash='offers';render();
    toast(`Načteno ${offers.length} nabídek. Před rozhodnutím znovu ověřte jejich údaje.`);
  }catch(error){if(generation===state.generation)toast(`Načtení se nepodařilo: ${error.message}`);}
  event.target.value='';
});
$('reset-button').addEventListener('click',async()=>{if(!await mayReplace())return;invalidatePending();requirement=clone(defaultRequirement);state.offers=clone(demoOffers);state.caseId=null;state.caseRevision=0;state.loadedRevision=0;state.caseTitle='Ukázková poptávka';state.dirty=false;state.view='overview';location.hash='overview';render();toast('Připravené fiktivní nabídky byly obnoveny.');});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
fetch('/api/health').then(r=>r.json()).then(x=>{state.aiConfigured=x.aiConfigured;$('quota-note').textContent=`Zbývá ${x.remainingAiCalls} AI volání v aktuálním denním okně.`;if(!x.aiConfigured)$('ai-button').title='Na místním serveru není nastaven API klíč.'}).catch(()=>{});
selectView();

function editRequirement(){
 const dialog=child('dialog',{'aria-label':'Upravit poptávku'}), form=child('form'), inputs={};
 dialog.append(child('h2',{},'Vlastní poptávka'),child('p',{},'Změna produktu nebo množství vyžaduje novou kontrolu shody u všech nabídek. Ceny se vždy přepočítají.'));
 for(const [key,label,value] of [['product','Produkt',requirement.product],['quantity','Počet kusů',requirement.quantity],['maxDays','Nejvýše dnů',requirement.maxDays],['minWarrantyMonths','Záruka v měsících',requirement.minWarrantyMonths],['budget','Rozpočet v Kč',requirement.budgetHalers/100]]){
  const input=child('input',{name:key,type:key==='product'?'text':'number',required:'',value,min:key==='budget'?'0.01':'1',step:key==='budget'?'0.01':'1',maxlength:'200'});inputs[key]=input;form.append(child('label',{},label,input));
 }
 const error=child('p',{role:'alert'});form.append(error,child('button',{type:'submit'},'Uložit zadání'),child('button',{type:'button',onclick:()=>dialog.close()},'Zrušit'));
 form.addEventListener('submit',e=>{e.preventDefault();try{
 const next=validateRequirement({product:inputs.product.value,quantity:Number(inputs.quantity.value),maxDays:Number(inputs.maxDays.value),minWarrantyMonths:Number(inputs.minWarrantyMonths.value),budgetHalers:Math.round(Number(inputs.budget.value)*100),currency:'CZK'});
 if(next.product!==requirement.product||next.quantity!==requirement.quantity)state.offers.forEach(o=>{o.reviewed=false;o.productMatch=null});
 requirement=next;changed();render();dialog.close();toast('Zadání uloženo, všechny nabídky přepočítány.');
 }catch(e){error.textContent=e.message}});dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
}
const tools=child('div',{class:'workspace-tools'},child('button',{type:'button',onclick:editRequirement},'Upravit poptávku'),child('button',{type:'button',onclick:()=>download('offerlens_pripad.json',JSON.stringify({format:'offerlens-workspace',version:1,requirements:requirement,offers:state.offers}), 'application/json')},'Stáhnout případ JSON'));
const input=child('input',{type:'file',accept:'.json',hidden:''});
tools.append(child('button',{type:'button',onclick:()=>input.click()},'Otevřít případ'),input);
input.id='workspace-file';
input.addEventListener('change',async()=>{let generation=state.generation;try{const file=input.files[0];if(!file)return;if(file.size>1_000_000)throw Error('Limit případu je 1 MB.');if(!await mayReplace())return;invalidatePending();generation=state.generation;const text=await file.text();if(generation!==state.generation)return;const saved=decodeWorkspace(text);requirement=saved.requirements;state.offers=saved.offers;state.caseId=null;state.caseRevision=0;state.loadedRevision=0;state.caseTitle='Importovaná poptávka';state.dirty=true;render();toast('Poptávka obnovena. Nabídky vyžadují nové ověření.')}catch(e){if(generation===state.generation)toast(e.message)}finally{input.value=''}});
document.querySelector('main .shell').prepend(tools);

function saveToHistory(asCopy=false){
  const dialog=child('dialog',{'aria-label':'Uložit do místní historie'}),form=child('form',{class:'history-form'});
  const title=child('input',{id:'save-title',value:state.caseTitle,required:'',maxlength:100,minlength:2});
  const message=child('input',{id:'save-message',required:'',minlength:5,maxlength:300,placeholder:'Například: Upřesněná doprava od dodavatele'});
  const error=child('p',{class:'form-error',role:'alert'});
  const submit=child('button',{class:'button primary',type:'submit'},asCopy?'Uložit novou kopii':'Uložit verzi');
  const cancel=child('button',{class:'button subtle',type:'button',onclick:()=>dialog.close()},'Zrušit');
  form.append(child('h2',{},asCopy?'Nová kopie poptávky':'Uložit poptávku'),child('p',{},'Pouze v tomto prohlížeči. Uchovává se posledních 10 verzí, nejvýše 20 poptávek a 10 MB. Nejde o sdílený nebo podepsaný audit.'),child('label',{for:'save-title'},'Název poptávky'),title,child('label',{for:'save-message'},'Co ukládáte a proč'),message,error,child('div',{class:'dialog-actions'},cancel,submit));
  form.onsubmit=async event=>{
    event.preventDefault();if(state.saving)return;
    const generation=state.generation,capturedId=state.caseId,capturedRevision=state.caseRevision;
    const options={id:asCopy||!capturedId?crypto.randomUUID():capturedId,title:title.value,message:message.value,expectedRevision:asCopy?0:capturedRevision};
    state.saving=true;submit.disabled=true;cancel.disabled=true;renderCaseStatus();
    try{
      const prepared=await prepareSnapshot(clone(requirement),clone(state.offers));
      const result=await saveCase(prepared,options);
      if(generation===state.generation){
        state.caseId=result.record.id;state.caseTitle=result.record.title;state.caseRevision=result.record.revision;state.loadedRevision=result.record.revision;state.dirty=false;
      }else if(capturedId&&!asCopy&&state.caseId===capturedId&&state.caseRevision===capturedRevision){state.caseRevision=result.record.revision;}
      dialog.close();render();toast(result.unchanged?'Beze změn – nová verze nevznikla.':'Místní verze '+result.record.revision+' byla uložena.');
    }catch(caught){error.textContent=caught.message;}
    finally{state.saving=false;submit.disabled=false;cancel.disabled=false;renderCaseStatus();}
  };
  dialog.append(form);dialog.addEventListener('cancel',event=>{if(state.saving)event.preventDefault()});dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
}

async function openSavedCase(id,number){
  if(!await mayReplace())return;
  invalidatePending();const generation=state.generation,historyGeneration=state.historyGeneration;
  try{
    const record=await readCase(id);
    if(generation!==state.generation||historyGeneration!==state.historyGeneration)return;
    if(!record||record.version!==1||!Array.isArray(record.revisions)||!Number.isSafeInteger(record.revision))throw Error('Případ neexistuje nebo má neplatný formát.');
    const revision=number===undefined?record.revisions.at(-1):record.revisions.find(item=>item.number===number);
    if(!revision)throw Error('Tato verze již není zachovaná.');
    const saved=restoreSnapshot(revision.snapshot);
    requirement=saved.requirements;state.offers=saved.offers;state.caseId=record.id;state.caseTitle=record.title;state.caseRevision=record.revision;state.loadedRevision=revision.number;state.dirty=false;
    $('history-dialog').close();state.view='overview';location.hash='overview';render();
    toast('Otevřena v'+revision.number+'. Před doporučením znovu ověřte údaje a shodu produktu.');
  }catch(caught){if(generation===state.generation)toast(caught.message);}
}

async function showVersions(id){
  const generation=++state.historyGeneration;
  try{
    const record=await readCase(id);if(generation!==state.historyGeneration||!$('history-dialog').open)return;
    if(!record||!Array.isArray(record.revisions))throw Error('Případ neexistuje.');
    const root=$('history-list');root.replaceChildren(child('h3',{},record.title),child('p',{},'Posledních '+record.revisions.length+' zachovaných verzí. Otevření starší verze nepřepisuje novější; další uložení vytvoří novou verzi.'),child('button',{class:'button subtle',onclick:showHistory},'Zpět na seznam'));
    for(let index=record.revisions.length-1;index>=0;index--){
      const revision=record.revisions[index],previous=record.revisions[index-1];
      const details=child('details',{class:'revision-details'},child('summary',{},'v'+revision.number+' · '+new Date(revision.savedAt).toLocaleString('cs-CZ')+' · '+revision.message));
      const changes=diffSnapshots(previous?.snapshot,revision.snapshot);
      details.append(child('p',{},'Název při uložení: '+revision.title));
      if(previous&&previous.title!==revision.title)details.append(child('p',{},'Název: '+previous.title+' → '+revision.title));
      for(const change of changes.slice(0,100)){const shown=describeChange(change,previous?.snapshot,revision.snapshot);details.append(child('div',{class:'revision-change'},child('strong',{},shown.title),child('pre',{},shown.before+' → '+shown.after)));}
      if(changes.length>100)details.append(child('p',{},'Zobrazeno prvních 100 z '+changes.length+' změn.'));
      details.append(child('button',{class:'button subtle',onclick:()=>openSavedCase(id,revision.number)},'Otevřít tuto verzi'));
      root.append(details);
    }
  }catch(caught){if(generation===state.historyGeneration)toast(caught.message);}
}

async function showHistory(){
  const generation=++state.historyGeneration,root=$('history-list');root.replaceChildren(child('p',{},'Načítám místní poptávky…'));
  if(!$('history-dialog').open)$('history-dialog').showModal();
  try{
    const records=await listCases();if(generation!==state.historyGeneration||!$('history-dialog').open)return;
    root.replaceChildren();if(!records.length)root.append(child('p',{},'Zatím nemáte uloženou poptávku.'));
    for(const record of records){
      const row=child('article',{class:'saved-case','data-case':record.id},child('div',{},child('strong',{},record.title),child('p',{},'v'+record.revision+' · '+new Date(record.updatedAt).toLocaleString('cs-CZ'))));
      const remove=child('details',{},child('summary',{},'Odstranit…'),child('p',{},'Odstraní všechny místní verze. Nejprve si můžete stáhnout aktuální JSON z otevřeného případu.'),child('button',{class:'button subtle',onclick:async()=>{try{await removeCase(record.id,record.revision);if(state.caseId===record.id){state.caseId=null;state.caseRevision=0;state.loadedRevision=0;state.dirty=true;renderCaseStatus()}showHistory()}catch(caught){toast(caught.message)}}},'Odstranit z tohoto prohlížeče'));
      row.append(child('div',{class:'history-actions'},child('button',{class:'button primary',onclick:()=>openSavedCase(record.id)},'Otevřít poslední'),child('button',{class:'button subtle',onclick:()=>showVersions(record.id)},'Historie verzí'),remove));root.append(row);
    }
  }catch(caught){if(generation===state.historyGeneration)root.replaceChildren(child('p',{role:'alert'},caught.message));}
}

function describeChange(change,beforeSnapshot,afterSnapshot){
  const requirementNames={product:'Produkt',quantity:'Počet kusů',maxDays:'Nejvyšší doba dodání (dnů)',minWarrantyMonths:'Minimální záruka (měsíců)',budgetHalers:'Rozpočet',currency:'Měna'};
  const short=value=>{const text=String(value??'Neuvedeno');return text.length>400?text.slice(0,400)+'…':text};
  const value=(input,key)=>{
    if(input===null||input===undefined)return 'Neuvedeno';
    if(key==='reviewed')return input?'Potvrzeno':'Nepotvrzeno';
    if(key==='productMatch')return input?'Odpovídá':'Neodpovídá';
    if(key==='budgetHalers')return formatCzk(input);
    if(key==='priceVat'||key==='shippingVat')return {incl:'Včetně DPH',excl:'Bez DPH',unknown:'Neznámé'}[input]||short(input);
    if(key==='evidence')return Object.entries(input).map(([field,quote])=>(names[field]||field)+': '+quote).join('\n');
    if(input&&typeof input==='object')return short(input.fields?.supplier||input.fields?.product||'Nabídka');
    return short(input);
  };
  const parts=change.path.split('.');let title;
  if(parts[0]==='requirements')title='Zadání – '+(requirementNames[parts[1]]||parts[1]);
  else if(parts[0]==='offers'){
    const offer=afterSnapshot.offers.find(item=>item.id===parts[1])||beforeSnapshot?.offers.find(item=>item.id===parts[1]);
    const label=parts.length===2?'Přidání / odebrání nabídky':names[parts.at(-1)]||{raw:'Původní text',evidence:'Doslovné úryvky',reviewed:'Kontrola údajů',productMatch:'Shoda produktu'}[parts.at(-1)]||parts.at(-1);
    title=(offer?.fields.supplier||'Nabídka')+' – '+label;
  }else title='Založení historie';
  return {title,before:value(change.before,parts.at(-1)),after:value(change.after,parts.at(-1))};
}
const historyDialog=child('dialog',{id:'history-dialog','aria-labelledby':'history-title'},child('div',{class:'dialog-head'},child('h2',{id:'history-title'},'Místní poptávky a historie'),child('button',{class:'close','aria-label':'Zavřít',onclick:()=>$('history-dialog').close()},'×')),child('p',{class:'history-note'},'Ukládá se jen po vašem pokynu do tohoto prohlížeče. Jiná adresa či profil a vymazání dat prohlížeče mohou historii znepřístupnit. JSON zálohuje a přenáší aktuální stav, nikoli celou místní historii.'),child('div',{id:'history-list'}));
historyDialog.addEventListener('close',()=>state.historyGeneration++);document.body.append(historyDialog);
const caseToolbar=child('section',{class:'case-toolbar','aria-label':'Práce s poptávkami'},child('div',{},child('strong',{},'Pracovní poptávka'),child('p',{id:'case-status',role:'status'})),child('div',{class:'history-actions'},child('button',{class:'button subtle',id:'case-new',onclick:async()=>{if(!await mayReplace())return;invalidatePending();requirement=clone(defaultRequirement);state.offers=[];state.caseId=null;state.caseRevision=0;state.loadedRevision=0;state.caseTitle='Nová poptávka';state.dirty=true;render();editRequirement()}},'Nová poptávka'),child('button',{class:'button primary',id:'case-save',onclick:()=>saveToHistory()},'Uložit do historie'),child('button',{class:'button subtle',id:'case-copy',onclick:()=>saveToHistory(true)},'Uložit jako kopii'),child('button',{class:'button subtle',id:'case-history',onclick:showHistory},'Místní poptávky')));
tools.after(caseToolbar);renderCaseStatus();
document.querySelector('.tech-body').append(child('p',{},child('strong',{},'Místní historie: '),'IndexedDB uchovává nejvýše 20 poptávek, posledních 10 verzí každé a celkem 10 MB. Zápis a kontrola čísla verze probíhají v jedné transakci, aby jiná karta nepřepsala novější stav. JSON přenáší aktuální případ, nikoli celou historii. Obnovení vždy ruší potvrzení kontroly a shody produktu; nejde o schválení nákupu.'));

$('pdf-file').addEventListener('change',async()=>{const file=$('pdf-file').files[0];if(!file)return;const generation=++state.generation;cancelExtraction();$('pdf-status').textContent='Čtu PDF místně…';try{const result=await importPdf(file);if(generation!==state.generation||!$('add-dialog').open)return;$('quote-text').value=result.content;$('pdf-status').textContent='Načteno '+result.locators.length+' stran textu. '+result.warnings.join(' ');$('add-error').textContent='Zkontrolujte text. Odeslání AI spustíte zvlášť.';}catch(error){if(generation===state.generation)$('pdf-status').textContent=error.message;}finally{$('pdf-file').value='';}});

document.querySelector('.tech-body').append(child('p',{},'Textové PDF čte lokální Python/pypdf proces do 8 000 znaků, s označením stran a bez OCR. Vícepoložkový nákupní košík má samostatný odkaz v navigaci a vlastní historii. V něm se každý řádek ověřuje ručně, doprava se započítá jednou a neúplné dodávky se nedoporučí.'));
