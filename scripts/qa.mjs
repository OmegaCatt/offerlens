import {verifyGuide,verifyGuideLinks,dismissGuide} from './guide-qa.mjs';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {createOfferServer} from '../server.mjs';
import {demoOffers,requirement} from '../web/fixtures.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const server=createOfferServer({apiKey:''});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const p=await context.newPage(),errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  p.on('pageerror',error=>errors.push(error.message));
  const base=`http://127.0.0.1:${server.address().port}`;
  const saveDialog=page=>page.getByRole('dialog',{name:'Uložit do místní historie',exact:true});
  async function save(page,title,message,{copy=false,conflict=false}={}){
    await page.locator(copy?'#case-copy':'#case-save').click();
    const dialog=saveDialog(page);await dialog.locator('#save-title').fill(title);await dialog.locator('#save-message').fill(message);
    await dialog.getByRole('button',{name:copy?'Uložit novou kopii':'Uložit verzi',exact:true}).click();
    if(conflict){await dialog.getByRole('alert').filter({hasText:'jiná karta'}).waitFor();return;}
    await dialog.waitFor({state:'hidden'});
  }
  async function edit(page,maxDays){
    await page.getByRole('button',{name:'Upravit poptávku',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Upravit poptávku',exact:true});await dialog.locator('input[name=maxDays]').fill(String(maxDays));await dialog.getByRole('button',{name:'Uložit zadání',exact:true}).click();await dialog.waitFor({state:'hidden'});
  }
  const record=(page,title)=>page.locator('.saved-case').filter({has:page.locator('strong').filter({hasText:title})});
  async function openLatest(page,title){await page.locator('#case-history').click();await record(page,title).getByRole('button',{name:'Otevřít poslední',exact:true}).click();await page.locator('#history-dialog').waitFor({state:'hidden'});}
  await p.goto(base);await verifyGuide(p,{});assert.equal(await p.evaluate(()=>[...document.styleSheets].some(sheet=>[...sheet.cssRules].some(rule=>rule.cssText.includes(':hover')||/linear-gradient|radial-gradient/.test(rule.cssText)))),false);const primary=p.locator('#add-button');const before=await primary.evaluate(e=>({color:getComputedStyle(e).backgroundColor,transform:getComputedStyle(e).transform,transition:getComputedStyle(e).transitionDuration}));await primary.hover();assert.deepEqual(await primary.evaluate(e=>({color:getComputedStyle(e).backgroundColor,transform:getComputedStyle(e).transform,transition:getComputedStyle(e).transitionDuration})),before);assert.equal(before.transition,'0s');await p.locator('#case-status').waitFor();assert.match(await p.locator('.recommendation h2').innerText(),/Aurora/);
  await save(p,'Monitory – hlavní případ','Výchozí nabídky k porovnání');assert.match(await p.locator('#case-status').innerText(),/v1/);
  await edit(p,30);assert.match(await p.locator('#case-status').innerText(),/neuložené/);
  await save(p,'Monitory – hlavní případ','Dodavatelé mohou dodat do 30 dnů');assert.match(await p.locator('#case-status').innerText(),/v2/);
  await p.reload();await openLatest(p,'Monitory – hlavní případ');assert.match(await p.locator('.recommendation h2').innerText(),/Zatím bez doporučení/);
  await p.locator('#case-history').click();await record(p,'Monitory – hlavní případ').getByRole('button',{name:'Historie verzí',exact:true}).click();
  const versions=p.locator('.revision-details');await versions.first().waitFor();await versions.first().locator('summary').click();assert.match(await versions.first().innerText(),/Nejvyšší doba dodání/);assert.match(await versions.first().innerText(),/14 → 30/);
  await versions.last().locator('summary').click();await versions.last().getByRole('button',{name:'Otevřít tuto verzi'}).click();await p.locator('#history-dialog').waitFor({state:'hidden'});assert.match(await p.locator('#case-status').innerText(),/otevřena v1 \/ poslední v2/);
  const q=await context.newPage();await q.goto(base);await dismissGuide(q);await openLatest(q,'Monitory – hlavní případ');
  await edit(p,40);await edit(q,45);await save(p,'Monitory – hlavní případ','První karta mění termín na 40');
  await save(q,'Monitory – hlavní případ','Druhá karta mění termín na 45',{conflict:true});
  await saveDialog(q).getByRole('button',{name:'Zrušit',exact:true}).click();
  await save(q,'Samostatná kopie','Zachování práce z druhé karty',{copy:true});
  await p.locator('#case-history').click();await p.waitForFunction(()=>document.querySelectorAll('.saved-case').length===2);assert.equal(await p.locator('.saved-case').count(),2);await p.locator('#history-dialog .close').click();
  // Opening a saved case never carries over the old human confirmation.
  await p.locator('.view-button').first().click();const detail=p.locator('#detail-dialog');
  await detail.getByRole('button',{name:'Potvrdit údaje a přepočítat',exact:true}).click();assert.match(await detail.locator('.form-error').innerText(),/Nejprve potvrďte/);
  await detail.locator('#review-check').check();await detail.locator('#product-match').selectOption('yes');await detail.getByRole('button',{name:'Potvrdit údaje a přepočítat',exact:true}).click();
  assert.match(await p.locator('.recommendation h2').innerText(),/Aurora/);
  await save(p,'Monitory – hlavní případ','Osobně ověřené údaje Aurora');assert.match(await p.locator('#case-status').innerText(),/v4/);
  await save(p,'Monitory – hlavní případ','Opětovné uložení stejného stavu');assert.match(await p.locator('#case-status').innerText(),/v4/);
  await p.locator('#case-new').click();await p.getByRole('dialog',{name:'Upravit poptávku',exact:true}).getByRole('button',{name:'Zrušit',exact:true}).click();
  await save(p,'Prázdná nová poptávka','Zatím bez podkladů od dodavatelů');assert.equal(await p.locator('.view-button').count(),0);
  const many={format:'offerlens-workspace',version:1,requirements:requirement,offers:Array.from({length:30},(_,i)=>({...demoOffers[0],id:'offer-'+i}))};
  await p.locator('#workspace-file').setInputFiles({name:'many.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(many))});await p.waitForFunction(()=>document.querySelectorAll('.view-button').length===30);
  await p.locator('#add-button').click();await p.locator('#quote-text').fill('Fiktivní nabídka pro kontrolu horního limitu.');await p.locator('#manual-button').click();assert.match(await p.locator('#add-error').innerText(),/30 nabídek/);await p.locator('[data-close="add-dialog"]').click();
  await p.locator('.view-button').first().click();await p.locator('#detail-dialog .remove-offer summary').click();await p.getByRole('button',{name:'Odebrat z této poptávky',exact:true}).click();assert.equal(await p.locator('.view-button').count(),29);
  await p.locator('#add-button').click();await p.locator('#quote-text').fill('Fiktivní náhradní podklad po odebrání jedné nabídky.');await p.locator('#manual-button').click();await p.locator('#detail-dialog').waitFor({state:'visible'});await p.locator('[data-close="detail-dialog"]').click();assert.equal(await p.locator('.offer-card').count(),30);
  await save(p,'Třicet nabídek','Hraniční počet nabídek pro případ');
  await p.locator('#reset-button').click();assert.match(await p.locator('.recommendation h2').innerText(),/Aurora/);
  // Deliberately delayed UI extraction fixture, no actual provider call.
  let release,arrived;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>arrived=resolve);
  await p.route('**/api/extract',async route=>{arrived();await gate;try{await route.fulfill({json:{fields:demoOffers[0].fields,evidence:demoOffers[0].evidence,unsupported:[],remainingAiCalls:20}})}catch{/* request was intentionally aborted */}});
  await p.locator('#add-button').click();await p.locator('#quote-text').fill('Fiktivní nabídka monitorů, jejíž odpověď přijde později.');await p.locator('#ai-button').click();await ready;
  await p.locator('[data-close="add-dialog"]').click();await p.locator('#reset-button').click();release();await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await p.locator('#detail-dialog').isVisible(),false);assert.equal(await p.locator('.view-button').count(),3);await p.unroute('**/api/extract');
  // Delayed local file read must not restore an old case after a reset.
  await p.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){const text=await original.call(this);if(this.name==='slow.json'){window.__slowRead=true;await new Promise(resolve=>window.__releaseFile=resolve)}return text}});
  await p.locator('#workspace-file').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...many,requirements:{...requirement,product:'Opožděný starý případ'}}))});await p.waitForFunction(()=>window.__slowRead===true);
  await p.locator('#reset-button').click();await p.evaluate(()=>window.__releaseFile());await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.ok(!(await p.locator('#content').innerText()).includes('Opožděný starý případ'));assert.equal(await p.locator('.view-button').count(),3);
  const reportDownload=p.waitForEvent('download');await p.locator('#export-button').click();const report=JSON.parse(await readFile(await(await reportDownload).path(),'utf8'));assert.equal(report.recommendedId,'aurora');
  const downloaded=p.waitForEvent('download');await p.getByRole('button',{name:'Stáhnout případ JSON',exact:true}).click();const file=JSON.parse(await readFile(await(await downloaded).path(),'utf8'));assert.equal(file.offers.length,3);
  await mkdir(path.join(root,'docs','screenshots'),{recursive:true});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(root,'docs','screenshots','overview.png')});
  await p.locator('#case-history').click();await record(p,'Monitory – hlavní případ').getByRole('button',{name:'Historie verzí',exact:true}).click();await p.locator('.revision-details').first().locator('summary').click();await p.screenshot({path:path.join(root,'docs','screenshots','history.png')});
  await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(root,'docs','screenshots','history-mobile.png')});
  await p.locator('#history-dialog .close').click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Storage contract against actual IndexedDB, in a separate empty browser profile.
  const isolated=await browser.newContext(),storagePage=await isolated.newPage();await storagePage.goto(base);await dismissGuide(storagePage);
  const storageProof=await storagePage.evaluate(async()=>{
    const {prepareSnapshot}=await import('/history-model.mjs');
    const {saveCase,listCases,removeCase}=await import('/history-store.mjs');
    const {requirement,demoOffers}=await import('/fixtures.mjs');
    const prepared=await prepareSnapshot(requirement,demoOffers);
    const options=id=>({id,title:'Testovací místní případ',message:'Kontrola atomického uložení',expectedRevision:0});
    const race=await Promise.allSettled([saveCase(prepared,options('concurrent')),saveCase(prepared,options('concurrent'))]);
    if(race.filter(item=>item.status==='fulfilled').length!==1)throw Error('Concurrent transaction lost update');
    await removeCase('concurrent',1);
    for(let i=0;i<20;i++)await saveCase(prepared,options('limit-'+i));
    let blocked=false;try{await saveCase(prepared,options('twenty-first'))}catch(error){blocked=error.message.includes('20')}
    if(!blocked||(await listCases()).length!==20)throw Error('Case limit did not roll back atomically');
    let staleDelete=false;try{await removeCase('limit-0',0)}catch{staleDelete=true}
    if(!staleDelete||(await listCases()).length!==20)throw Error('Stale delete changed storage');
    await removeCase('limit-0',1);await saveCase(prepared,options('replacement'));
    return {count:(await listCases()).length,blocked,staleDelete};
  });
  assert.deepEqual(storageProof,{count:20,blocked:true,staleDelete:true});await isolated.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: actual IndexedDB persistence, versions/diffs, two-tab conflict, simultaneous transactions, 20-case rollback, stale deletion, copy, review reset, explicit confirmation, empty draft, 30-offer limit/removal, delayed extraction/import versus reset, exports, desktop/mobile and no JS errors. No live AI calls.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
