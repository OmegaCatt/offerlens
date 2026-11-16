# OfferLens: video ukázka

**[Stáhnout MP4 — 0:51, bez zvuku](https://raw.githubusercontent.com/OmegaCatt/offerlens/main/docs/videos/offerlens.mp4)** · [Soubor na GitHubu](https://github.com/OmegaCatt/offerlens/blob/main/docs/videos/offerlens.mp4)

Podklady nabídky, změna dodací lhůty, přepočet a místní historie.

## Co ve videu uvidíte

- Porovnání tří připravených nabídek a původního textu dodavatele.
- Změna dodací lhůty na 30 dnů a přepočet doporučení.
- Uložení první verze do místní historie prohlížeče.

Video zachycuje skutečnou aplikaci nad izolovanými fiktivními daty. Má rozlišení **1920 × 1080**, **25 snímků/s**, přibližně **3.5 MB** a české titulky přímo v obrazu. Pohyb myši i kliknutí jsou viditelné. **Neobsahuje zvukovou stopu.**

Odkaz stáhne video MP4. Po stažení jej otevřete v běžném přehrávači videa. Ukázka nepotřebuje instalaci aplikace. Pro vlastní vyzkoušení pokračujte [návodem ke spuštění](../README.md#spuštění-krok-za-krokem-windows).

## Jak byl záznam ověřen

Při pořizování proběhl skutečný HTTP/browser scénář s kontrolami výsledků. AI API nebylo volané. Ověřeno celé dekódování výsledného MP4, H.264/yuv420p, rozlišení, absence audio stopy, samostatné přehrání/posun a obrazové snímky titulkových úseků a kliknutí. Jde o ověření konkrétní ukázky; záznam neměří obecnou přesnost AI ani produkční připravenost aplikace.

[Metadata záznamu](videos/offerlens-recording.json) obsahují kontrolované výsledky, zdrojový commit `047798e9e724ae864dc0f19766aadf60e24f9d40` a otisky nahrávacích skriptů. SHA-256 MP4: `e564d45617734ffe72192f432e6670d95e80b4d5a787ac13c1a935ad7fb075c4`. Časy kroků v metadatech jsou orientační; titulky jsou přímo v obrazu.

Scénář: [scripts/record-demo.mjs](../scripts/record-demo.mjs). Nahrávací vrstva: [scripts/recording.mjs](../scripts/recording.mjs). Při vývojovém zopakování je potřeba Playwright a plný FFmpeg s libx264 (`PORTFOLIO_FFMPEG`); běžné přehrání videa je nevyžaduje.

## English

**[Download the silent Full HD demo (0:51)](https://raw.githubusercontent.com/OmegaCatt/offerlens/main/docs/videos/offerlens.mp4).** Open the downloaded MP4 in a standard video player. Czech captions are burned into the image; the pointer and actual clicks are visible. Recorded from the real application using isolated fictional data, with result assertions and no AI API calls. Full decoding, playback, seeking and absence of audio were verified. [Run the application locally](../README.md#spuštění-krok-za-krokem-windows).
