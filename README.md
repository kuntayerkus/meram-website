# Meram — marketing site

Static site. No build step, no dependencies, no framework. Serve the folder:

```bash
node ../serve.mjs .        # or any static server
npx --yes serve -l 4321 .
```

```
index.html                  the home page (English)
tr/index.html               the home page (Turkish)

download/  privacy/         English pages — each a real folder + index.html, so
terms/  refunds/            "/privacy/" resolves on any static host
contact/  changelog/  about/
guides/                     two long-form guides, same folder convention

tr/indir/  tr/gizlilik/     the Turkish mirror, one folder per page, using
tr/kosullar/  tr/iade/      Turkish URLs rather than /tr/privacy/
tr/iletisim/  tr/surum-notlari/
tr/hakkinda/  tr/rehberler/

assets/css/style.css        design system + every component
assets/js/main.js           springs, the Aurora Ribbon engine, the scroll stage,
                            the refinement demo, the dial, and the CONFIG block
assets/fonts/               self-hosted woff2 (Archivo, Instrument Serif)
assets/img/                 SVG mark and icon, OG cards (EN + TR)
robots.txt  sitemap.xml     every page, with hreflang pairs
vercel.json                 clean URLs, cache headers, security headers
OPEN-QUESTIONS.md           facts and placeholders the owner needs to confirm
```

Every page after the home page repeats the same nav/footer markup (no build
step, no templating). If you add a top-level page, copy the header and footer
from an existing one, update the active states, **and add both language
variants to `sitemap.xml`.**

## Bilingual

English lives at `/`, Turkish at `/tr/`. They are two complete copies, not a
translation layer — the Turkish copy is written in Turkish rather than
translated out of English, because the product is aimed at people writing
Turkish and translated marketing copy reads like it.

- Every page carries `hreflang` links to its counterpart and to `x-default`.
- `main.js` reads `document.documentElement.lang` and picks its strings from
  one `I18N` object. There is one JavaScript file for both languages.
- The language switch in the nav points at the *equivalent* page, never at the
  other language's home page. Check that by hand when adding a page.
- The two OG cards (`og-image.png`, `og-image-tr.png`) are generated from the
  site's own fonts and palette.

## What to change before launch

| What | Where |
|---|---|
| GitHub repo (download + changelog come from its releases) | `CONFIG.GITHUB_REPO` in `assets/js/main.js` |
| Support email | `CONFIG.SUPPORT_EMAIL`, rendered into `[data-cfg="support-email"]` |
| Planned prices, trial length | `CONFIG.PLAN_*` and `CONFIG.TRIAL_DAYS` |
| Turning the planned plans into something buyable | `CONFIG.PURCHASE_ENABLED` + `CONFIG.CHECKOUT_URL` |
| The dial's assumption about dictation speed | `CONFIG.DICTATION_WPM` |
| Domain, if it is not `meram.app` | one find/replace across the HTML (`canonical`, `og:url`, `hreflang`, `sitemap.xml`) |
| Everything still needing the owner's input | see `OPEN-QUESTIONS.md` |

Elements tagged `data-cfg="…"` render from `CONFIG` at runtime; the static HTML
carries the same values inline as a no-JS fallback, so keep the two in sync.

## The idea

**The page is the ribbon.** Meram's entire interface is one 200×38 capsule
running five states, so the page runs the same five at poster scale:

```
rest → speaking → thinking → done → the guarantee
```

`#flow` is a sticky full-viewport stage with a tall spacer below it supplying
the scroll distance. Scroll progress drives which act is showing and the canvas
underneath.

The third act is **thinking** — and in the product, the capsule inverts from
dark glass to a sheet of paper while it refines. So the page does too: the whole
viewport, the nav included, flips to paper and the light thread becomes an ink
line. It is the one moment on the site that could not be borrowed from another
product, because it is a direct quotation of this one.

The canvas is not an illustration. Ribbon geometry is derived from the copy
column's **measured** box rather than a guessed fraction, so the two never
overlap at any viewport width. Above 1080px they sit side by side; below, the
thread takes the band above the copy.

## The Aurora Ribbon is real

`assets/js/main.js` contains a faithful port of the app's own `AuroraRibbon.tsx`:

- the same 300×64 viewBox, 64 samples, three curtains, 16px amplitude, and the
  `sin(πu)^0.9` edge taper
- the same spring constants, converted from the app's framer-motion values —
  `response = 2π/√(k/m)`, `damping ratio = c/(2√(km))`
- the same stroke weights (3.2 / 2.2 / 1.6 bloom, 1.6 / 1.1 / 0.8 thread, a
  0.6px filament), the same peak-hold with exponential release, the same comet
  with a trail, the same one-sweep confirmation on `done`
- the same five states and the same labels

Lend it your microphone and it is driven by a real `AnalyserNode` reading four
frequency bands, exactly as the app does. The analyser is never connected to the
destination and nothing is recorded; the stream is released when the demo ends,
when you scroll away, or when the tab is hidden.

## Honesty is the design constraint

Copy is drawn from the repository's own `CAPABILITIES.md`, which separates code
that exists from behaviour proven in a packaged build. So:

- the site says the installer is unsigned, on the home page and again on the
  download page, with the reasoning rather than a euphemism
- it says there is no offline mode, and that Windows' built-in voice typing is
  better than Meram on that specific axis today
- the planned prices sit under a heading that says "none of this exists yet" and
  are rendered as dashed cards that cannot be clicked
- the comparison table is Meram against its own roadmap, not against a
  competitor — the only comparison that cannot age into a lie

If the product changes, these change. When `CAPABILITIES.md` and the running
software disagree, the software wins and both the document and this site get
corrected.

## Colour

Monochrome, and not as a style choice: the product's own design system forbids
decorative colour, reserves chroma for destructive states, and explicitly
rejects purple AI gradients. The palette here is the app's token file converted
to sRGB.

- **Ink and paper.** `--bg #0A0A0B` through `--surface-2 #1E1E1F` on one side,
  `--paper #F5F5F5` and `--ink #1C1C1E` on the other. Zero chroma in either.
- **One functional red** (`--red #FF6B5B`), used for exactly two things: the
  refusal row in the target-lock ladder, and the strike-through on removed
  disfluencies. Never alone — always with words.
- **Accent is light, not hue.** Where a coloured site would tint a word, this one
  makes it glow: the serif italic carries a soft white `text-shadow`, the same
  emitted light the ribbon's filament gives off.

## Type

- **Archivo** variable, run **narrow** (`font-stretch: 92–93%`) at weight 840 for
  display — dense and machined. Deliberately the opposite setting to the sibling
  MixPill site, which runs the same family wide for signage presence.
- **Instrument Serif italic** for accent words — contrast by *style*, since there
  is no colour to contrast with.
- the platform system font for body **and for every mock-up**, because the
  mock-ups are pretending to be native windows and have to look like it.

Tracking is size-specific: negative on display sizes, neutral at body, positive
on small uppercase labels. Spacing is in `rem` so layout scales with the
reader's text size.

**The primary button is a keycap** — a lit face, a body underneath, and real
travel on press. This is a product you use by holding a key down; the main call
to action should feel like one.

## Motion

Follows Apple's "Designing Fluid Interfaces":

- **Springs, not durations.** `Spring` takes damping ratio + *response* and
  integrates at fixed sub-steps. Retargeting keeps position **and** velocity, so
  an animation can be grabbed and reversed mid-flight without a jump.
- **1:1 dragging** with Pointer Events and capture, rubber-banding past bounds.
- **Momentum, bounded.** Flicks project forward with Apple's exponential-decay
  function, but at a much shorter deceleration and capped — a slider is a bounded
  control with friction, not a scroll surface.
- Everything animates `transform` / `opacity` / `clip-path` on one shared
  `requestAnimationFrame` ticker, and stops when its section is off screen.

Preferences are handled independently: `prefers-reduced-motion` unpins the stage
entirely (no sticky, no canvas, every act stacked and readable — act 03 keeps its
paper as a card, because that is information rather than decoration) and resolves
springs instantly; `prefers-reduced-transparency` makes every material solid;
`prefers-contrast: more` raises text and border contrast.

## The interactive bits

- **The capsule** is the app's component, as above.
- **The disfluency pass** in `#refine` is computed in the browser from the raw
  sentence, so the strike-throughs show exactly what would be removed. The tone
  rewrites beside it are recorded examples and the page says so — this site holds
  no API key and transcribes nothing.
- **The dial** in `#maths` divides. Words ÷ typing speed, minus words ÷ dictation
  speed, and every figure under it follows from the two sliders. The dictation
  figure is the app's own dashboard average, named in `CONFIG`.
- **The mock-up clock** reads the visitor's own time. A frozen 9:41 is a
  screenshot tell.

## Fonts

Both display faces are self-hosted, subset to latin + latin-ext (which covers
Turkish: ş, ğ, ı, İ, ç, ö, ü), and licensed under the SIL Open Font License 1.1 —
licence texts sit next to them in `assets/fonts/`.

- [Archivo](https://github.com/Omnibus-Type/Archivo) — Omnibus-Type
- [Instrument Serif](https://github.com/Instrument/instrument-serif) — Instrument

## Known next step

The site demonstrates the capsule but not the *latency*, which is the thing
people actually feel. A recorded screen capture of a real dictation — key down,
speech, text landing in a real application, with the elapsed time visible — would
answer the one question this page currently answers only in words.
