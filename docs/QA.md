# Etapa 10. 11. 2026 – OL-3/4/5

**Nově textové PDF, vícepoložková poptávka a doložená extrakční evaluace.** Navigace „Více položek“ otevírá basket.html: vlastní zadání do 20 položek, 30 dodavatelů, cena/DPH/množství/termín/záruka po řádcích, doprava právě jednou. Částečné, duplicitní a neznámé řádky brání doporučení; dělení nákupu mezi dodavatele se neoptimalizuje. Lidská kontrola každé položky a dopravy je povinná. CZK. Jednořádkové poptávky a jejich historie zůstávají samostatné.

Košík má oddělenou místní IndexedDB historii 20 případů / posledních 10 verzí / 10 MB. Kontrola verze a zápis jsou atomické. JSON přenáší aktuální stav; import i otevření historické verze ruší lidská potvrzení. Nedoložená potvrzení, součty a doporučení se nepřebírají.

PDF se čte místně bez AI: **Python 3.13+ a pypdf 6.21.4**, instalace python -m pip install -r requirements.txt. Na Windows lze určit OFFERLENS_PYTHON. Běžná jednořádková aplikace bez PDF stále běží pouze na Node. Proces má 15 sekund, 2 MB vstupu, 50 stran a omezení dekódování; výsledek do 8 000 znaků se stranami, bez tichého zkrácení. Šifrované PDF a sken bez textu se odmítnou; není implementováno OCR. Originální binární soubor se neukládá. AI se spustí zvlášť tlačítkem a odešle vložený text OpenAI. Endpoint má limit dvou souběžných importů a kontrolu Host/Origin.

Ověření: 33 Node testů, skutečný PDF parser, celá původní browser regrese a nový košík/historie/atomický konflikt/JSON/PDF v obou režimech, desktop i mobil bez JS chyb/přetečení. Vývojové PDF vytváří ReportLab: python -m pip install -r requirements-dev.txt. Pro browser QA pnpm qa, pro syntax pnpm check. Živé AI: první běh 71/74 a druhý 73/74 očekávaných polí, 12 fiktivních nabídek; nejde o obecnou přesnost. Podrobnosti a nezměněné reporty: [evaluace](../evaluation/README.md).

English: text-only PDF ingestion via a bounded local Python/pypdf worker (no OCR), page-aware evidence in the single-product workspace, and a separate multi-item basket with per-line human review, partial-supply blocking, exact VAT and shipping once. Its bounded IndexedDB history is separate from legacy cases; restored/imported confirmations never authorize recommendations. See evaluation/README.md for two actual 12-case live extraction runs (71/74, then 73/74 fields), limitations and preserved reports. Production authentication, shared approvals and supplier integrations remain out of scope.

## Historické etapy níže (aktuální rozsah je výše)

# Etapa 10. 11. 2026 – OL-2a až OL-2f

Vzdálené ověření: commit `6b650ba` úspěšně prošel [GitHub Actions 42720866316](https://github.com/OmegaCatt/offerlens/actions/runs/42720866316), včetně jednotkových testů, syntaxe, browser QA a nahrání artefaktu `offerlens-history-qa`. Nejde pouze o připravený workflow.

Místní měření Node 24.22.1, deset vzorků a 30 nabídek po 8 000 znacích: snapshot 275 503 B, medián přípravy/otisku 6,74 ms, medián vytvoření verze 3,31 ms. Kontrola souhrnného limitu pro 8 272 471 B trvala v jednom vzorku 45,73 ms. Příkaz `node scripts/benchmark-history.mjs`. Měření pokrývá pouze CPU/serializaci v Node, nikoli diskovou latenci IndexedDB v prohlížeči nebo AI a síť.

22 Node testů prošlo. Nové kontroly: očištění snapshotu, stabilní ID, zrušení důvěry v obnovená potvrzení, neměnnost starých verzí, vynechání totožného uložení, konfliktní verze a opětovné vytvoření smazaného případu, posledních deset verzí, rozdíly polí/zadání/odebrání, limity 20 případů/10 MB/30 nabídek, prázdný případ a důvody uložení.

Přesná regrese DPH: 99 999 × 99 999 999,03 Kč bez DPH při 21 % a dopravě zdarma dává 1 209 987 888 263 117 haléřů. Původní float mezivýpočet dával o haléř více. BigInt mezivýpočet zachovává zaokrouhlení poloviny nahoru a výstup Number zůstává bezpečným celým číslem v podporovaných mezích.

Browser QA nad skutečným serverem a CSP, Playwright/Edge, 1440 × 1000 a šířka 390 px: IndexedDB přetrvá reload, verze a obchodně popsané rozdíly, otevření starší verze bez přepsání novější, dvě karty se stale zápisem, uložení kopie, nové lidské potvrzení, prázdný případ, horní limit nabídek a odebrání/náhrada, zadržená extrakce a lokální import proti resetu, běžný report i přenosný JSON. Samostatný izolovaný profil ověřuje současné IndexedDB transakce, odmítnutí 21. případu bez ztráty předchozích, odmítnutí stale smazání a uvolnění místa. Žádné přetečení celé stránky ani JavaScript chyby. Screenshoty: docs/screenshots/overview.png, history.png, history-mobile.png.

Extrakce ve stale-response testu je výslovně simulovaná; testovací server nemá klíč. Tento průchod neověřuje novou živou AI extrakci. CI opakuje Node testy, syntax a browser QA a uchovává screenshoty sedm dnů. Přesný výsledek konkrétního commitu je v GitHub Actions; připravený workflow sám není důkaz úspěšného vzdáleného běhu.

Historie je omezená na daný browser origin/profil, bez uživatelských účtů, podepsání a sdílení. Neobsahuje schválení nákupu. Aktuální JSON nezálohuje celou historii. Nejvýše deset zachovaných verzí znamená, že starší revize se po dalším uložení odstraňují. Skutečná kvóta prohlížeče může být nižší než 10 MB; selhání transakce ponechá předchozí záznamy. PDF, více položek a živá evaluace extrakce nejsou součást této etapy.

Následující záznamy jsou historické etapy.

# Ověření 9. 11. 2026

14 automatických testů prošlo. Browser QA ověřilo úpravu termínu, export případu, reset a obnovení vlastního zadání, nutnost opětovného ověření a mobilní šířku 390 px bez přetečení a JS chyb. AI extrakce nebyla v tomto průchodu živě volána. Více položek a PDF/OCR jsou další etapou.

# Ověření OfferLens

Aktualizováno 31. 10. 2026. Testováno místně na Windows, Node.js 24.

## Automatizované kontroly

`npm test`: 12/12 testů prošlo. Pokrývají parsování peněz, výběr vyhovující nabídky, neznámou dopravu a DPH, Markdown podklad k rozhodnutí, CSV vzorce, nutnost lidského potvrzení, odmítnutí AI polí bez doslovného úryvku, parametry OpenAI požadavku, ochranu HTTP endpointu, denní limit AI volání a rezervaci slotu před asynchronním čtením těla požadavku.

Po doplnění technického přehledu prohlížeč otevřel panel, stáhl Markdown se správným doporučením a ověřil mobilní šířku 390 px bez vodorovného přetečení. Připravený scénář nevolal placené API.

`node --check server.mjs` a `node --check web/app.mjs` prošly.

## Ruční průchod

- Připravená ukázka správně doporučila Aurora Office za 84 445,90 Kč.
- Ručně vložená fiktivní nabídka zůstala k ověření. Po doplnění polí a potvrzení se spočítala na 84 700 Kč; původní levnější vyhovující nabídka zůstala doporučená.
- Pokus o potvrzení nové nabídky bez zaškrtnutí kontroly zobrazil chybu a dialog zůstal otevřený.
- JSON a CSV se skutečně stáhly. CSV obsahovalo tři řádky a správnou cenu 84445,90; JSON mělo tři nabídky a `recommendedId: aurora`.
- Kontrola zobrazení proběhla na běžné šířce i při 390 px. Mobilní tabulka se vodorovně posouvá a detail nabídky je čitelný.
- Jedno skutečné volání OpenAI API nad fiktivní nabídkou vrátilo strukturované údaje; neplatný doslovný úryvek byl odmítnut. Opakovaná volání se pro regresní testy nahrazují mockem, aby se zbytečně nečerpal placený API provoz.

## Rychlost

Místní orientační měření: porovnání 10 000 nabídek trvalo 20,18 ms. Padesát sekvenčních HTTP GET požadavků na úvodní stránku trvalo celkem 97,15 ms. Tato čísla nejsou produkční benchmark a neměří latenci externí AI služby.

## Bezpečnost a omezení

Standardní Codex Security scan původní implementace identifikoval dva nízce závažné místní problémy: chybějící souhrnný limit placených AI volání a kontrolu souběhu před asynchronním čtením těla. Obojí bylo následně upraveno; nové regresní testy procházejí. Místní HTTP rozhraní stále není autentizované, a proto se nesmí bez dalších kontrol vystavit veřejně. Limit 20 volání se resetuje po 24 hodinách nebo restartu procesu.

Doslovný úryvek z nabídky potvrzuje jen výskyt textu, nikoli správnost významu AI hodnoty. Rozhodující údaje musí člověk porovnat s původním textem. Aplikace neuchovává vložené nabídky na serveru ani v databázi.

## Načtení JSON, 31. 10. 2026

Automatický test ověřil, že import nepřebírá podvržené doporučení, součet ani příznak lidského schválení. V prohlížeči prošel export ukázky, její opětovné načtení a stav k ověření. Mobilní viewport 390 px neměl vodorovné přetečení.
