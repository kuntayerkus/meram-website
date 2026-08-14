# Open questions

Things on this site that are placeholders, assumptions, or claims that need the
owner's confirmation before launch. Ordered by how much damage getting them
wrong would do.

---

## 1. The GitHub repository does not resolve — **blocking**

`CONFIG.GITHUB_REPO` is set to `kuntayerkus/Meram`, and
`https://api.github.com/repos/kuntayerkus/Meram/releases` currently returns
**404**. Either the repository is private, or it is named something else.

Consequences right now:

- Every download button falls back to `/download/`, which is a real page, so
  nothing is broken — but nobody can actually download anything.
- `/changelog/` and `/tr/surum-notlari/` show the "load them directly on GitHub"
  fallback instead of release notes.
- The version and file-size fields on the download page stay empty.

**Decision needed.** Releases have to be published from a **public** repository
for this to work, even if the source stays private — that is the normal pattern
(a public repo holding only releases, or making the main repo public). If
releases will live somewhere else entirely, the fetch in `main.js` §9 needs
rewriting rather than reconfiguring.

## 2. Domain: apex or `www` — **blocking for SEO**

You said `www.meram.app`. Every canonical URL, `og:url`, `hreflang` link and
sitemap entry on this site is written as **`https://meram.app`** (apex, no
`www`).

Pick one and make the other redirect to it in the Vercel dashboard:

- **Apex primary** (what the site currently claims): add both domains in Vercel,
  set `meram.app` as primary, let `www.meram.app` redirect. Nothing in the code
  changes.
- **`www` primary**: one find/replace of `https://meram.app` →
  `https://www.meram.app` across `*.html` and `sitemap.xml`.

Serving both without a redirect splits every page into two indexable URLs.

## 3. Claims that need your confirmation

| Claim | Where | Status |
|---|---|---|
| "Roughly four cents per hour of audio" | pricing, download, refunds, FAQ | From Groq's `whisper-large-v3-turbo` pricing at $0.04/hour, quoted in `docs/commercial-plan.md` §3 — which itself flags the figure as coming from a secondary source. **Confirm on your own Groq console before launch.** |
| Dictation at **130 wpm** | the dial, `CONFIG.DICTATION_WPM` | Taken from the app's dashboard mock-up (138 kelime/dk) and rounded down. If real user data says otherwise, change the constant — every number in the dial follows from it. |
| Typing at 40–45 wpm as the default | the dial's second slider | An assumption. It is a slider precisely so the visitor can disagree with it. |
| 230 working days a year | `CONFIG.WORKDAYS_PER_YEAR` | An assumption stated in the dial's footnote. |
| "Windows 10 / 11 · x64" | everywhere | From `CAPABILITIES.md`. Confirm the actual minimum Windows build the installer supports. |

## 4. Things deliberately *not* on this site

Say the word if you want any of them, but each one has a reason:

- **Social proof.** No "500+ users", no star ratings, no testimonials. There is
  no user base to count yet and inventing one is the fastest way to lose the
  audience this product is written for.
- **Screenshots of the hub.** `meram-onizleme/*.png` are good, but they still say
  **Speechy** in the sidebar. They can go on the site the moment they are
  regenerated under the new name — the download or about page would be the
  natural home.
- **A demo video.** The strongest missing asset (see README, "Known next step").
- **An offline-mode claim.** Cannot be made until on-device Whisper ships.
- **Anything about macOS other than "not yet".**

## 5. Legal text needs a lawyer's eye

`/terms/`, `/privacy/`, `/refunds/` and their Turkish counterparts are written to
be accurate and readable, not to be litigated. Before real money changes hands,
have someone qualified look at:

- the liability cap (currently "limited to zero" because the beta is free — that
  stops being defensible the moment anyone pays);
- whether Turkish consumer law needs specific language for distance sales;
- KVKK/GDPR wording, if EU users are in scope. The site currently collects
  nothing at all, which is the easiest possible position — keep it that way as
  long as you can.

## 6. Smaller items

- **Company details.** The footer says "Grio Works" and "© 2026 Grio Works". Once
  the sole proprietorship is registered, Turkish e-commerce rules may require the
  trade name, tax office and registration number in the footer or on a dedicated
  page.
- **The notify-me flow** opens the visitor's mail client with a prefilled
  message. It works with no backend, but it loses everyone who has no mail client
  configured. Swap it for a real form (a Vercel function plus a list) when there
  is something to notify people about.
- **`/download/` has no checksums.** Once releases exist, publish a SHA-256 file
  alongside each build and link it — it is the only verification an unsigned
  installer can offer.
- **Favicon is SVG only.** Fine everywhere modern; add a 32×32 `favicon.ico` if
  you care about old Windows browsers.
- **The `theme-color` is dark** on every page. The paper inversion is a
  scroll-driven effect, not a light theme, so this is correct — but it means the
  browser chrome stays dark while the page is white for one section.
