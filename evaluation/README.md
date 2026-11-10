# Evaluace extrakce OL-5

Dvanáct fiktivních textů s 74 předem určenými očekáváními po polích. Kromě úplné nabídky: pracovní dny, chybějící doprava/DPH, EUR, instrukce uvnitř podkladu, desetinné ceny, rozporné ceny, součet místo ceny za kus, částečná dostupnost a rozmezí termínu.

node evaluation/run.mjs jen ověří strukturu sady; neměří AI. --live --limit 12 provede nejvýše 12 sekvenčních placených volání s místním klíčem a uloží nový report. Klíč ani surové provozní chyby se neukládají. Peněžní řetězce se porovnávají přes parseHalers, ostatní hodnoty přesně; chybějící a neznámé hodnoty mají explicitní očekávání.

## Skutečné běhy 10. 11. 2026

- První: 71/74 polí. E01 vrátil „Dodavatel Alfa“ místo „Alfa“ (stylistický rozdíl, v přesné metrice chyba). E05 ztratilo EUR. E09 zvolilo jednu ze dvou rozporných jednotkových cen, přestože mělo platný doslovný citát: věcná chyba. Změněn pokyn pro extrakci a přidán konzervativní detektor více explicitně označených jednotkových cen s regresním testem.
- Druhý: 73/74 polí. Původní report zachován. Zbývající rozdíl E10 je uveden v živém reportu; tento vzorek není obecná přesnost a další běh se může lišit. Žádné očekávání nebylo upraveno podle odpovědi modelu.

Oba reporty jsou v reports/. Ručně byly porovnány nesprávné výstupy a příslušné úryvky s texty v cases.json. Ostatní hodnoty kontroluje metrika a runtime ověření doslovného výskytu; nejde o úplný ruční sémantický audit všech vět. Detektor rozporů není obecný jazykový analyzátor. Před doporučením stále musí člověk ověřit údaje i shodu produktu. Aritmetiku a vícepoložkové pokrytí ověřují jiné deterministické testy, nesměšují se s metrikou AI.

E10 ve druhém běhu chybně použilo celkových 25 000 Kč jako cenu za kus. Po běhu doplněna konzervativní blokace výslovně uvedené celkové ceny a věty o chybějící jednotkové ceně, plus regresní test. Tato dodatečná ochrana prošla offline regresí, nebyla v této etapě znovu měřena živým během. Původní výsledek 73/74 zůstává zachovaný.
