# Aktuální rozsah a kontrola 10. 11. 2026

Aktuální funkce, technologie, API, způsob použití, firemní zavedení a omezení jsou v [README](../README.md). Znovu prošlo 34 Node testů a odpovídající skutečný browser průchod desktop/mobil. Jde o fiktivní portfolio projekt. Výsledky a případné opravy jsou v [QA](QA.md).

Předchozí ověřený kód 2dcc28c: [úspěšné GitHub Actions](https://github.com/OmegaCatt/offerlens/actions/runs/42730920542). Nový commit této revize má vlastní CI; aktuální stav je v hlavním protokolu portfolia. Níže uvedené historické plány nejsou seznam nehotových funkcí.

<details>
<summary>Historická projektová rozhodnutí a průběžné etapy</summary>

# Etapa 10. 11. 2026 – OL-3/4/5

**Nově textové PDF, vícepoložková poptávka a doložená extrakční evaluace.** Navigace „Více položek“ otevírá basket.html: vlastní zadání do 20 položek, 30 dodavatelů, cena/DPH/množství/termín/záruka po řádcích, doprava právě jednou. Částečné, duplicitní a neznámé řádky brání doporučení; dělení nákupu mezi dodavatele se neoptimalizuje. Lidská kontrola každé položky a dopravy je povinná. CZK. Jednořádkové poptávky a jejich historie zůstávají samostatné.

Košík má oddělenou místní IndexedDB historii 20 případů / posledních 10 verzí / 10 MB. Kontrola verze a zápis jsou atomické. JSON přenáší aktuální stav; import i otevření historické verze ruší lidská potvrzení. Nedoložená potvrzení, součty a doporučení se nepřebírají.

PDF se čte místně bez AI: **Python 3.13+ a pypdf 6.21.4**, instalace python -m pip install -r requirements.txt. Na Windows lze určit OFFERLENS_PYTHON. Běžná jednořádková aplikace bez PDF stále běží pouze na Node. Proces má 15 sekund, 2 MB vstupu, 50 stran a omezení dekódování; výsledek do 8 000 znaků se stranami, bez tichého zkrácení. Šifrované PDF a sken bez textu se odmítnou; není implementováno OCR. Originální binární soubor se neukládá. AI se spustí zvlášť tlačítkem a odešle vložený text OpenAI. Endpoint má limit dvou souběžných importů a kontrolu Host/Origin.

Ověření: 33 Node testů, skutečný PDF parser, celá původní browser regrese a nový košík/historie/atomický konflikt/JSON/PDF v obou režimech, desktop i mobil bez JS chyb/přetečení. Vývojové PDF vytváří ReportLab: python -m pip install -r requirements-dev.txt. Pro browser QA pnpm qa, pro syntax pnpm check. Živé AI: první běh 71/74 a druhý 73/74 očekávaných polí, 12 fiktivních nabídek; nejde o obecnou přesnost. Podrobnosti a nezměněné reporty: [evaluace](../evaluation/README.md).

English: text-only PDF ingestion via a bounded local Python/pypdf worker (no OCR), page-aware evidence in the single-product workspace, and a separate multi-item basket with per-line human review, partial-supply blocking, exact VAT and shipping once. Its bounded IndexedDB history is separate from legacy cases; restored/imported confirmations never authorize recommendations. See evaluation/README.md for two actual 12-case live extraction runs (71/74, then 73/74 fields), limitations and preserved reports. Production authentication, shared approvals and supplier integrations remain out of scope.

## Historické etapy níže (aktuální rozsah je výše)

# Etapa 10. 11. 2026 – OL-2a až OL-2f

22 Node testů prošlo. Nové kontroly: očištění snapshotu, stabilní ID, zrušení důvěry v obnovená potvrzení, neměnnost starých verzí, vynechání totožného uložení, konfliktní verze a opětovné vytvoření smazaného případu, posledních deset verzí, rozdíly polí/zadání/odebrání, limity 20 případů/10 MB/30 nabídek, prázdný případ a důvody uložení.

Přesná regrese DPH: 99 999 × 99 999 999,03 Kč bez DPH při 21 % a dopravě zdarma dává 1 209 987 888 263 117 haléřů. Původní float mezivýpočet dával o haléř více. BigInt mezivýpočet zachovává zaokrouhlení poloviny nahoru a výstup Number zůstává bezpečným celým číslem v podporovaných mezích.

Browser QA nad skutečným serverem a CSP, Playwright/Edge, 1440 × 1000 a šířka 390 px: IndexedDB přetrvá reload, verze a obchodně popsané rozdíly, otevření starší verze bez přepsání novější, dvě karty se stale zápisem, uložení kopie, nové lidské potvrzení, prázdný případ, horní limit nabídek a odebrání/náhrada, zadržená extrakce a lokální import proti resetu, běžný report i přenosný JSON. Samostatný izolovaný profil ověřuje současné IndexedDB transakce, odmítnutí 21. případu bez ztráty předchozích, odmítnutí stale smazání a uvolnění místa. Žádné přetečení celé stránky ani JavaScript chyby. Screenshoty: docs/screenshots/overview.png, history.png, history-mobile.png.

Extrakce ve stale-response testu je výslovně simulovaná; testovací server nemá klíč. Tento průchod neověřuje novou živou AI extrakci. CI opakuje Node testy, syntax a browser QA a uchovává screenshoty sedm dnů. Přesný výsledek konkrétního commitu je v GitHub Actions; připravený workflow sám není důkaz úspěšného vzdáleného běhu.

Historie je omezená na daný browser origin/profil, bez uživatelských účtů, podepsání a sdílení. Neobsahuje schválení nákupu. Aktuální JSON nezálohuje celou historii. Nejvýše deset zachovaných verzí znamená, že starší revize se po dalším uložení odstraňují. Skutečná kvóta prohlížeče může být nižší než 10 MB; selhání transakce ponechá předchozí záznamy. PDF, více položek a živá evaluace extrakce nejsou součást této etapy.

Následující záznamy jsou historické etapy.

# Etapa 9. 11. 2026

14 automatických testů prošlo. Browser QA ověřilo úpravu termínu, export případu, reset a obnovení vlastního zadání, nutnost opětovného ověření a mobilní šířku 390 px bez přetečení a JS chyb. AI extrakce nebyla v tomto průchodu živě volána. Více položek a PDF/OCR jsou další etapou.

# OfferLens — project memory

Updated 2026-10-31. Second portfolio application after DataDesk. It demonstrates AI extraction, deterministic calculations, source snippets, uncertainty handling, human correction and QA.

## Scenario
Compare fictional Czech supplier quotes for ten office monitors. Requirements: 10 units, delivery within 14 days, warranty at least 24 months, budget 90,000 CZK including VAT. One offer is cheapest but misses the deadline; one has unclear shipping; a compliant offer is available. The app must not imply that the lowest listed unit price is the best procurement choice.

## Product decisions
- Prepared fictional quotes work without an API call and are labeled as prepared data.
- Pasted quote text can be extracted by the OpenAI Responses API with strict JSON schema. The API key is read by the local Node server from process environment or ignored `.env.local` (environment wins) and is never sent to the browser.
- Every extracted nonempty field needs a verbatim source snippet found in the original text. This does not prove semantic correctness. Fields without matching snippets stay unresolved. A human can edit every field and must explicitly confirm review and product match.
- Money is calculated in integer haléře by deterministic code, separated by VAT basis. Unknown shipping or VAT basis prevents a final total and recommendation.
- The release supports CZK only, one product line per quote, text paste, JSON/CSV export and a short Markdown decision brief. No PDF/OCR, user accounts or live supplier integration. Do not claim those features.
- OfferLens has its own warm ivory, indigo and coral visual identity, distinct from DataDesk.
- The local server limits AI calls to 20 per 24-hour process window and two concurrent calls. It is not authenticated and must not be deployed publicly without stronger controls.

## Status
Implemented and verified locally: 12 tests passed, browser desktop/mobile review, JSON/CSV/Markdown download checks, one earlier real API smoke test, security scan and subsequent endpoint fixes. The interface includes an expandable note about technologies, the OpenAI API and human review. README and docs/QA.md contain user-facing details. The repository is published on GitHub.


</details>
