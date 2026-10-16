# Design & UX review — 2026-10-16

Reviewed live at desktop (1366px) and mobile (375px): Home, Handbook, Builder, Updates, About.

Overall: clean, readable, honest. Typography and spacing are solid. The main problems are
discoverability in the Handbook, control overload at the top of the Builder, and mobile chrome.
The site has no visual identity yet (no HRC mark, a rust accent unrelated to HRC red).

## Hard — Opus

- **Visual identity.** No HRC logo anywhere; accent is a rust (#b0492f) that isn't HRC red; active
  nav pairs blue text on a pink-rust fill. → HRC wordmark in the footer as the institutional credit,
  HRC red (#c41e24) as the single extra color, tokenised; nav active state = ink + red underline.
- **Subtle cyber theme.** → Monospace "eyebrow" label above the hero, a faint grid texture behind
  the hero that fades out, a 3px red rule on top of the header. Nothing animated, nothing on reading pages.

## Medium — Sonnet

- **"Add to my agreement" is invisible** in the Handbook (opacity 0 until hover). Undiscoverable,
  unreachable on touch, and when shown it overlays the provision text. → Always-visible small button
  in a reserved right gutter.
- **Raw Markdown in Handbook text.** Note to Users paragraphs show `[Access Now](http://…)` literally
  (prov-p-note-to-users-14, -16). → Render inline Markdown links in provision text.
- **TOC highlight doesn't follow scroll.** Active item only reflects the URL. → Scroll-spy with
  IntersectionObserver.
- **Handbook has no page title (H1).**
- **Mobile chrome eats the screen.** Sticky header wraps to 3 rows (~150px); the Handbook TOC is
  ~40 links long before any content. → Header not sticky on mobile; TOC collapsed into a `<details>`.
- **Builder: too many controls before the work.** Banner, title, drafts row, context row, three
  export buttons and a warning card all stack above the two panes (panes start ~60% down the
  viewport). → One "Export ▾" menu; undefined-terms warning as a compact banner.
- **Builder title caret** ("Build Your Own Agreement ▾") is a tiny, unclear toggle. → Explicit
  "Show / hide instructions" control.

## Easy — Haiku

- **Updates page** column is centred while every other page is left-aligned with the header. → Align.
- **Home hero has no primary call to action** (`.hero-ctas` CSS exists but is unused). → Add
  "Build an Agreement" (primary) + "Read the Handbook".
- **Defined-term underlines are heavy** — 320 dotted underlines on one page. → Lighter, lower-contrast.
- **No `<meta name="description">`** for link previews.

## Not doing (noted)

- PDF download link is hidden until `HANDBOOK_PDF_URL` is set — by design.
- Footer copy "updates automatically" is developer-speak; rewritten alongside the logo work.
