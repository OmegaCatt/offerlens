# OfferLens

Read the parent workspace plan and docs/PROJECT.md plus docs/QA.md before editing. Keep fictional data, Czech-first documentation and explicit limits.

Keep calculations deterministic and exact in integer halers; VAT intermediate multiplication uses BigInt. Do not trust imported or restored review/product-match flags or calculated recommendations. Text excerpts establish occurrence, not semantic correctness. Verification is separate from procurement approval.

History is browser-local IndexedDB, explicit-save only, bounded to 20 cases, 10 revisions and 10 MB. Preserve stable offer IDs for diffs. Conflict checking and writing must stay in one readwrite transaction with no awaited work inside it. Opening an older revision appends on later save; it never rewrites newer history. The JSON export is current state, not a history archive.

Never commit env files or keys. Browser QA starts the server with an empty key and isolates storage. Run node --test, pnpm check and pnpm qa for related changes. Document actual behavior and leave PDF/multiple-lines/live evaluation as future scope until implemented and verified.

OL-3/4/5 implemented: bounded Python/pypdf PDF endpoint, separate basket.html with basket-model and separate history database. Keep line identity, coverage/review gates, shipping-once and integer VAT. PDF evidence retains page labels. Test pnpm qa (both browser suites), requirements-dev for actual PDF fixtures, and unit cases. Never mark general AI accuracy from the small curated set; preserve live reports.
