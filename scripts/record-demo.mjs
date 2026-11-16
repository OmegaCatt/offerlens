import {record,nodeServer} from './recording.mjs';
import {createOfferServer} from '../server.mjs';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
await record({root,slug:'offerlens',start:()=>nodeServer(createOfferServer({apiKey:''})),walk:async({p,cue,hold,ui})=>{
  await p.locator('.recommendation h2').waitFor();assert.match(await p.locator('.recommendation h2').innerText(),/Aurora/);
  await cue('Tři připravené nabídky na deset monitorů. Cena zahrnuje dopravu a DPH.');await hold(4);
  await cue('Otevřeme podklady dodavatele Aurora Office.');await hold(1.2);await ui.click(p.locator('.view-button').first());await p.locator('#detail-dialog').waitFor({state:'visible'});
  await cue('V detailu lze porovnat vyplněné údaje s původním textem nabídky.');await ui.click(p.locator('.evidence-source').first());await hold(4);
  await cue('Upravíme poptávku: prodloužíme dobu dodání na 30 dnů.');await ui.click(p.locator('[data-close="detail-dialog"]'));
  await ui.click(p.getByRole('button',{name:'Upravit poptávku',exact:true}));const dialog=p.getByRole('dialog',{name:'Upravit poptávku',exact:true});await ui.fill(dialog.locator('input[name=maxDays]'), '30');await ui.click(dialog.getByRole('button',{name:'Uložit zadání',exact:true}));
  assert.match(await p.locator('.recommendation h2').innerText(),/Nova/);await cue('Při termínu 30 dnů vyhovuje i levnější nabídka Nova Display.');await hold(4);
  await cue('Poptávku uložíme do místní historie.');await ui.click(p.locator('#case-save'));const save=p.getByRole('dialog',{name:'Uložit do místní historie',exact:true});await ui.fill(save.locator('#save-title'), 'Monitory - ukázková poptávka');await ui.fill(save.locator('#save-message'), 'Porovnání při dodání do 30 dnů.');await ui.click(save.getByRole('button',{name:'Uložit verzi',exact:true}));await save.waitFor({state:'hidden'});assert.match(await p.locator('#case-status').innerText(),/v1/);
  await cue('Uložena první verze. Otevřeme místní historii.');await hold(1.2);await ui.click(p.locator('#case-history'));await p.locator('.saved-case').first().waitFor();await cue('Uložená poptávka je v místní historii tohoto prohlížeče.');await hold(4);await ui.click(p.locator('#history-dialog .close'));
  return {preparedOffers:3,initialRecommendation:'Aurora',changedLeadDays:30,savedVersion:1,liveAiCalls:0};
}});
