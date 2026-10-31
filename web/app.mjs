import { compareOffers, comparisonCsv, formatCzk, FIELD_KEYS, importReport } from './engine.mjs';
import { demoOffers, requirement } from './fixtures.mjs';

const $ = id => document.getElementById(id);
const clone = value => structuredClone(value);
const state = { offers: clone(demoOffers), view: 'overview', aiConfigured: false, busy: false };
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
  child('div',{class:'req-title'},child('strong',{},'Zadání poptávky'),child('p',{},'OL–001 · kancelářské vybavení')),
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
  document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('content').replaceChildren(view==='offers'?offersView():view==='method'?methodView():overview());
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
    return child('div',{class:'field-row'},child('label',{for:`field-${key}`},names[key]),control,child('p',{class:'evidence'},offer.evidence?.[key]?`Zdroj: „${offer.evidence[key]}“`:'Bez potvrzeného úryvku'));
  }));
  const summary=child('div',{class:'detail-summary'},child('div',{},chip(evaluated.status),child('div',{class:'detail-flags'},...evaluated.issues.map(x=>child('p',{},'× '+x)),...evaluated.unknown.map(x=>child('p',{},'· '+x)))),child('strong',{},formatCzk(evaluated.totalHalers)));
  const mustConfirm=offer.origin!=='prepared'&&!offer.reviewed;
  const reviewCheck=child('input',{id:'review-check',type:'checkbox'}),reviewError=child('p',{class:'form-error',role:'alert'},'');
  content.replaceChildren(child('div',{class:'detail-grid'},child('div',{class:'source-panel'},child('h3',{},'Původní text nabídky'),child('pre',{},offer.raw)),child('div',{class:'fields-panel'},child('h3',{},'Údaje pro výpočet'),child('p',{class:'review-note'},'Úryvek pouze potvrzuje, že text existuje. Zkontrolujte, zda skutečně podporuje vyplněnou hodnotu.'),child('label',{for:'product-match'},'Odpovídá nabízený produkt poptávce?'),matchSelect,fields,mustConfirm?child('label',{class:'review-confirm',for:'review-check'},reviewCheck,child('span',{},'Porovnal(a) jsem všechny rozhodující údaje s původním textem.')):null)),summary,reviewError,child('div',{class:'detail-actions'},child('button',{class:'button subtle',onclick:()=>$('detail-dialog').close()},'Zavřít'),child('button',{class:'button primary',onclick:()=>{
    if(mustConfirm&&!reviewCheck.checked){reviewError.textContent='Nejprve potvrďte kontrolu rozhodujících údajů.';return;}
    const next={};for(const key of FIELD_KEYS){const raw=inputs[key].value.trim();next[key]=['quantity','vatRate','leadDays','warrantyMonths'].includes(key)?(raw===''?null:Number(raw)):raw||null;}
    offer.fields=next;offer.name=next.supplier||'Neznámý dodavatel';offer.productMatch=matchSelect.value==='yes'?true:matchSelect.value==='no'?false:null;offer.reviewed=true;$('detail-dialog').close();render();toast('Údaje byly potvrzeny a porovnání přepočítáno.');
  }},'Potvrdit údaje a přepočítat')));
  $('detail-dialog').showModal();
}
function newOffer(raw, extraction, origin) { const id=crypto.randomUUID();const fields=extraction?.fields??Object.fromEntries(FIELD_KEYS.map(k=>[k,k.endsWith('Vat')?'unknown':null]));const offer={id,origin,productMatch:null,name:fields.supplier||'Nová nabídka',raw,fields,evidence:extraction?.evidence??{},unsupported:extraction?.unsupported??[],reviewed:false};state.offers.push(offer);$('add-dialog').close();$('quote-text').value='';$('add-error').textContent='';state.view='offers';location.hash='offers';render();showDetail(id); }
function download(name,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=child('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function exportReport(){const a=analysis();const report={version:1,requirements:requirement,recommendedId:a.recommendedId,offers:a.offers.map(({id,name,origin,raw,fields,evidence,productMatch,reviewed,totalHalers,status,issues,unknown})=>({id,name,origin,raw,fields,evidence,productMatch,reviewed,totalHalers,status,issues,unknown}))};download('offerlens_srovnani.json',JSON.stringify(report,null,2),'application/json;charset=utf-8');toast('Výsledek byl exportován do JSON.');}
function exportCsv(){download('offerlens_srovnani.csv',comparisonCsv(analysis()),'text/csv;charset=utf-8');toast('Výsledek byl exportován do CSV.');}
async function addWithAi(){const raw=$('quote-text').value.trim(),err=$('add-error');err.textContent='';if(raw.length<30||raw.length>8000){err.textContent='Text musí mít 30 až 8 000 znaků.';return}if(state.busy)return;state.busy=true;$('ai-button').disabled=true;$('ai-button').textContent='AI čte nabídku…';try{const res=await fetch('/api/extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:raw})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Extrakce selhala.');$('quota-note').textContent=`Zbývá ${data.remainingAiCalls} AI volání v aktuálním denním okně.`;newOffer(raw,data,'ai');toast(data.unsupported?.length?`AI vynechala ${data.unsupported.length} polí bez doloženého úryvku.`:'AI vyplnila údaje. Před porovnáním je ověřte.');}catch(error){err.textContent=error.message||'AI extrakce selhala.'}finally{state.busy=false;$('ai-button').disabled=false;$('ai-button').textContent='Vytěžit údaje pomocí AI ✦';}}
window.addEventListener('hashchange',selectView);
$('add-button').addEventListener('click',()=>{$('add-error').textContent='';$('add-dialog').showModal();});
$('manual-button').addEventListener('click',()=>{const raw=$('quote-text').value.trim();if(raw.length<10){$('add-error').textContent='Vložte alespoň 10 znaků textu nabídky.';return}newOffer(raw,null,'manual');});
$('ai-button').addEventListener('click',addWithAi);
$('export-button').addEventListener('click',exportReport);
$('export-csv-button').addEventListener('click',exportCsv);
$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>1_000_000)throw new Error('Soubor je příliš velký (limit 1 MB).');
    const offers=importReport(await file.text(),requirement);
    state.offers=offers;state.view='offers';location.hash='offers';render();
    toast(`Načteno ${offers.length} nabídek. Před rozhodnutím znovu ověřte jejich údaje.`);
  }catch(error){toast(`Načtení se nepodařilo: ${error.message}`);}
  event.target.value='';
});
$('reset-button').addEventListener('click',()=>{state.offers=clone(demoOffers);state.view='overview';location.hash='overview';render();toast('Připravené fiktivní nabídky byly obnoveny.');});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
fetch('/api/health').then(r=>r.json()).then(x=>{state.aiConfigured=x.aiConfigured;$('quota-note').textContent=`Zbývá ${x.remainingAiCalls} AI volání v aktuálním denním okně.`;if(!x.aiConfigured)$('ai-button').title='Na místním serveru není nastaven API klíč.'}).catch(()=>{});
selectView();
