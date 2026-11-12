# OfferLens: když se spuštění nedaří

Základní postup s přesným příkazem a adresou je na [začátku README](../README.md#spuštění-krok-za-krokem-windows). Pro rychlé posouzení projektu stačí [veřejná ukázka](https://omegacatt.github.io/datadesk/portfolio/#offerlens).

- **„Příkaz nebyl rozpoznán“:** nainstalujte Node.js 24 nebo novější a otevřete nové okno Terminálu. Node ověříte příkazem `node --version`, Python příkazem `py -3 --version`. Pokud máte více verzí Pythonu, zkontrolujte, že vybraná má alespoň 3.13.
- **Soubor server.py / server.mjs nebyl nalezen:** Terminál je v jiné složce. Zavřete ho, v Průzkumníku otevřete rozbalenou složku projektu a z jejího adresního řádku znovu spusťte `powershell`. ZIP musí být rozbalený.
- **„Adresa je již používána“ / EADDRINUSE:** pravděpodobně už běží druhé okno aplikace. Otevřete uvedenou adresu, nebo původní běh ukončete v jeho Terminálu pomocí Ctrl+C. Není potřeba mazat data.
- **Stránka se nenačte:** zkontrolujte, že Terminál zůstal otevřený a neskončil chybou. Adresu napište včetně `http://`; nejde o vyhledávání na internetu ani o `https://`.
- **Kde zůstávají data:** jde o místní ukázku s fiktivními vstupy. Konkrétní ukládání a jeho limity popisuje README. Nepoužívejte skutečné personální či zákaznické soubory.
- **Mac nebo Linux:** ve složce projektu otevřete Terminal. U Python aplikací použijte `python3` místo `py -3` a virtuální Python `.venv/bin/python` místo `.\.venv\Scripts\python.exe`; u ReleaseGuardu použijte `npm`/`npx` místo `.cmd`. Ostatní příkazy a adresa zůstávají stejné. Primární ověřovaný postup je Windows.

## English quick start

View the [existing public portfolio preview](https://omegacatt.github.io/datadesk/portfolio/#offerlens) without installing anything. Server-based projects are demonstrated through stored results; this is not a public live backend. For the full local application, download and extract this repository's ZIP, install Node.js 24+, open a terminal in the extracted project directory and follow the commands at the top of the README. Keep that terminal running and open http://127.0.0.1:4174. Stop with Ctrl+C. The demonstration uses fictional data; the basic prepared-data demo requires no paid AI calls. Detailed developer tests remain separate from the basic walkthrough.

## Volitelné: čtení textového PDF na Windows

Zastavte server pomocí Ctrl+C. Nainstalujte Python 3.13+ a ve stejném Terminálu postupně zadejte:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:OFFERLENS_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
node server.mjs
```

Nastavení cesty platí pro toto okno Terminálu. Při příštím spuštění PDF zopakujte poslední dva příkazy. Jde o PDF s textovou vrstvou; skenované obrázky nečte (OCR není součástí).

## Volitelné: AI předvyplnění

AI není potřeba pro připravené nabídky, ruční editaci, přesné výpočty ani místní historii. Pro skutečné AI předvyplnění je potřeba vlastní serverový OpenAI API klíč s dostupným kreditem. Postupujte podle `.env.example` a nepřidávejte klíč do GitHubu, screenshotů ani formuláře aplikace. Tlačítko AI odesílá vložený text poskytovateli; používejte jen schválené podklady. Připravené nabídky ukazují skutečné výpočty bez nového volání AI.
