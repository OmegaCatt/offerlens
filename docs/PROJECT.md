# OfferLens — project memory

Updated 2026-10-30. Second portfolio application after DataDesk. It demonstrates AI extraction, deterministic calculations, source snippets, uncertainty handling, human correction and QA.

## Scenario
Compare fictional Czech supplier quotes for ten office monitors. Requirements: 10 units, delivery within 14 days, warranty at least 24 months, budget 90,000 CZK including VAT. One offer is cheapest but misses the deadline; one has unclear shipping; a compliant offer is available. The app must not imply that the lowest listed unit price is the best procurement choice.

## Product decisions
- Prepared fictional quotes work without an API call and are labeled as prepared data.
- Pasted quote text can be extracted by the OpenAI Responses API with strict JSON schema. The API key is read by the local Node server from process environment or ignored `.env.local` (environment wins) and is never sent to the browser.
- Every extracted nonempty field needs a verbatim source snippet found in the original text. This does not prove semantic correctness. Fields without matching snippets stay unresolved. A human can edit every field and must explicitly confirm review and product match.
- Money is calculated in integer haléře by deterministic code, separated by VAT basis. Unknown shipping or VAT basis prevents a final total and recommendation.
- The first release supports CZK only, one product line per quote, text paste and JSON/CSV export. No PDF/OCR, user accounts or live supplier integration. Do not claim those features.
- OfferLens has its own warm ivory, indigo and coral visual identity, distinct from DataDesk.
- The local server limits AI calls to 20 per 24-hour process window and two concurrent calls. It is not authenticated and must not be deployed publicly without stronger controls.

## Status
Implemented and verified locally: 10 tests passed, browser desktop/mobile review, JSON/CSV download checks, one real API smoke test, security scan and subsequent endpoint fixes. README and docs/QA.md contain the user-facing details. GitHub publication remains to be done after final source review.
