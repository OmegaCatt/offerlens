# Ověření OfferLens

Aktualizováno 31. 10. 2026. Testováno místně na Windows, Node.js 24.

## Automatizované kontroly

`npm test`: 11/11 testů prošlo. Pokrývají parsování peněz, výběr vyhovující nabídky, neznámou dopravu a DPH, CSV vzorce, nutnost lidského potvrzení, odmítnutí AI polí bez doslovného úryvku, parametry OpenAI požadavku, ochranu HTTP endpointu, denní limit AI volání a rezervaci slotu před asynchronním čtením těla požadavku.

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
