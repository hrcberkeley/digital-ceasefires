# Digital Ceasefire Platform

Static site for the HRC Digital Ceasefire & Deescalation
Handbook (v1.5, October 2026). Built from `Digital Ceasefire Platform PRD and Build
Handoff.pdf`. This file is the map of what exists and what you still need to do on
the Google side (nothing here can create a Google Sheet for you — that needs your
own account).

## Layout

```
index.html      The static site lives at the repo root, so GitHub Pages serves it
css/ js/        as-is with no build step and no Pages source setting to change.
data/           snapshot.json (shipped with the site) + generated CSVs + diff_report.md
extract/        Python extraction pipeline (handbook -> CSVs)
source/         Handbook draft + PRD. GITIGNORED: this repo is public. Back these up.
Digital Ceasefire Platform.xlsx   All 8 tabs combined, ready to upload to Drive
```

The extra folders don't affect Pages — it serves the root and ignores the rest.
Only `source/` is held back, because a public repo is the wrong place for a working
draft.

The site works today with **no Google account at all** — it reads
`data/snapshot.json`, a bundled copy of the extracted content. Once you wire
up the Sheet (below), it switches to live data automatically.

## What's done vs. what needs your Google account

Everything that's pure code is built and tested (in a local browser, against the
bundled snapshot). Publishing the Sheet's CSVs and pointing `js/config.js` at them
needs your own Google account, so it is unverified end-to-end.

## One-time setup (do this once, ~1 hour, matches PRD section 10)

1. **Create the spreadsheet.** In your HRC Workspace account, create a sheet named
   `Digital Ceasefire Platform`. Import `Digital Ceasefire Platform.xlsx` (File >
   Import > Replace spreadsheet) — this creates the eight tabs with the right
   columns and the extracted v1.4 content.
2. **Publish the eight content tabs.** File > Share > Publish to web, pick each
   tab individually (`site_text`, `sections`, `provisions`, `options`,
   `definitions`, `law_clauses`, `footnotes`, `posts` — that's eight, the PRD's
   table just groups posts separately), format **CSV**, publish, copy each URL.
3. **Paste those URLs into `js/config.js`** (`CSV_URLS`). Redeploy the static site
   after editing this file.

Day to day: edit handbook text and blog posts directly in the tabs (changes
appear on the site within about 5 minutes — Google's own publish delay).

## Re-running extraction for a new handbook version

```bash
cd extract
pandoc ../source/new-handbook.docx -t markdown-smart --wrap=none --lua-filter docx_to_md.lua -o ../source/new-handbook.md
uv run extract.py --source ../source/new-handbook.md --version 1.5 --outdir ../data --previous ../data
uv run build_snapshot.py --data ../data --out ../data/snapshot.json
uv run --with openpyxl build_workbook.py --data ../data --out "../Digital Ceasefire Platform.xlsx"
```

Read `data/diff_report.md` before importing -- it lists new/changed/retired rows
and flags things worth a human look (duplicate paragraphs, headings that are
bold text instead of real headings, table-of-contents mismatches, capitalized
phrases that look like a near-miss of a defined term). Stable IDs carry over
automatically; a removed provision is marked `retired`, never reused.

`docx_to_md.lua` turns the Word file into the markdown shape `extract.py`
expects: it drops underline/highlight styling, unwraps indented paragraphs, and
turns each boxed "Note to Users" (section guidance) into guidance paragraphs.

Then update the Google Sheet tab by tab, so each tab keeps its gid (and the
published CSV URLs in `js/config.js` keep working): open the tab, File > Import >
Upload `data/<tab>.csv` > **Replace current sheet**. Do this for `sections`,
`provisions`, `options`, `definitions`, `law_clauses`, `footnotes` (`site_text`
and `posts` only if their seeds changed). Don't use "Replace spreadsheet" --
that recreates the tabs with new gids and breaks the published links.

## Design choices I made where the PRD was silent

- **Preselection heuristic**: `preselect_for` is only populated for section 3.0's
  prohibited-acts provisions (the core of what a context implies) — everything
  else (permissible ops, monitoring commission composition, dissemination,
  signatures) starts unselected, since I can't make legal-drafting judgment
  calls about what's "recommended" beyond the obvious core. `applies_to`
  defaults to all three contexts unless the text signals it's IHL/Armed-Conflict
  specific. Both are ordinary Sheet cells — edit them any time, no redeploy needed.
- **Bracket-alternative detection** treats the three-way `[Armed Conflict]
  [Grey Zone Activity] [Internal Disturbance]` pattern as a single reusable
  `o-context` option everywhere it appears, and skips signature-block fill-in
  fields (`[name of signatory A1]` etc.) rather than turning them into bogus
  multiple-choice options.
- **Undefined-terms warning** in the builder is a best-effort heuristic (same
  one the extractor uses to flag near-misses) — it'll have occasional false
  positives/negatives, it's meant as a nudge to double check, not a hard gate.
- **"Provision updated" handling** (milestone 9) can't show a true old-vs-new
  diff, since nothing snapshots a provision's text at add-time — only edits are
  stored, not originals. The banner instead offers "keep using the updated
  text" or "freeze my current wording," which is the honest version of that
  feature given what's actually stored.

## Open questions for the drafters (from the PRD, still open)

- Who curates `requires_law`, and by when?
- Which Google account owns the Sheet?
- Can one agreement cover mixed contexts? v1 assumes a single choice, per the PRD.

## Issues found in the v1.4 source text

See `data/diff_report.md` for the live list (regenerated each extraction run).
As of this build it includes the six issues the PRD's drafters already flagged
by hand (3.2.8/3.2.9 missing from the table of contents — actually caused by
those two subsections being bolded text instead of real headings in the source,
which the extractor now recovers automatically but still flags for a source
fix; 3.3.6 duplicating 3.3.2's second paragraph; etc.), found automatically
rather than hardcoded, so they'll keep getting caught in future versions too.
