# OfferLens

**Srovnání dodavatelských nabídek s AI extrakcí, kontrolou člověka a vysvětlitelným výpočtem.**

![Přehled fiktivních nabídek](docs/screenshots/overview.png)

Projekt ukazuje běžný nákupní problém: nejlevnější nabídka nemusí splnit termín, záruku ani celkový rozpočet. Tři připravené nabídky jsou fiktivní a fungují bez API klíče. Výsledkem ukázky je doporučení **Aurora Office za 84 445,90 Kč včetně DPH**. Levnější Nova Display nesplňuje termín, u Pixel Trade chybí cena dopravy a záruka je příliš krátká.

## Co aplikace umí

- Porovná počet kusů, produkt, dodání, záruku, měnu a rozpočet.
- Počítá ceny v celých haléřích včetně známé dopravy a DPH. Neznámé položky neodhaduje.
- Umožní vložit text nabídky a předvyplnit údaje pomocí OpenAI Responses API se strukturovaným výstupem.
- Ke každému AI údaji vyžaduje doslovný úryvek původního textu. Úryvek **není důkaz správnosti hodnoty**; uživatel ji musí ověřit a výslovně potvrdit shodu produktu.
- Umožní opravit všechna pole, resetovat ukázku a stáhnout porovnání jako JSON nebo CSV.
- Při CSV exportu neutralizuje text, který by tabulkový procesor mohl vyhodnotit jako vzorec.

## Spuštění

Vyžaduje Node.js 22 nebo novější. Projekt nemá balíčkové závislosti.

```bash
npm start
```

Otevřete [http://127.0.0.1:4174](http://127.0.0.1:4174). Fiktivní ukázka funguje ihned. Pro AI extrakci vytvořte v kořeni projektu soubor `.env.local` s proměnnou `OPENAI_API_KEY`, podle `.env.example`, nebo nastavte proměnnou v prostředí procesu. Proměnná prostředí má přednost. **Skutečný klíč nikdy nevkládejte do repozitáře.**

```bash
npm test
```

## Jak vzniká výsledek

`ai.mjs` vytěží pole ze vstupního textu. `web/engine.mjs` odmítne AI hodnoty bez odpovídajícího doslovného úryvku, vypočítá celkovou cenu a aplikuje pravidla zadání. `web/app.mjs` ponechá každou novou nabídku k ověření, dokud uživatel nepotvrdí kontrolu údajů a shodu produktu. AI nikdy sama nevybírá dodavatele.

Klíč čte pouze místní `server.mjs`. Server naslouchá na `127.0.0.1`, nepodává soubory mimo `web/`, omezuje velikost vstupu, souběh na dvě extrakce a AI volání na 20 za 24 hodin v rámci běžícího procesu. Text vložený k AI extrakci se odešle OpenAI; připravené nabídky žádné API volání nepotřebují. Tento místní server není určen k veřejnému vystavení bez autentizace a trvalého limitování spotřeby.

## Ověření a hranice

Deset automatizovaných testů ověřuje výpočet, nejisté ceny, kontrolu AI výstupu, bezpečný CSV export, serverové limity a závod souběžných požadavků. Ručně jsem prošel přidání a opravu nabídky, potvrzení údajů, exporty a desktopové i mobilní rozložení. Podrobnosti jsou v [docs/QA.md](docs/QA.md).

První verze pracuje s jednou produktovou položkou v CZK a s vloženým textem. Nečte PDF/OCR, nemá účty ani databázi. Nabídky přidané během relace se drží pouze v paměti prohlížeče; lze je vyexportovat, ale JSON se zatím zpět neimportuje.

## Technologie

Vanilla JavaScript, Node.js HTTP server, OpenAI Responses API, HTML/CSS a vestavěný `node:test`. Bez frameworku a bez balíčkových závislostí.
