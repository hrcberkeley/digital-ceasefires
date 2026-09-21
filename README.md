# Digital Ceasefire Platform

Static site + one Apps Script backend for the HRC Digital Ceasefire & Deescalation
Handbook (working draft v1.4). Built from `Digital Ceasefire Platform PRD and Build
Handoff.pdf`. This file is the map of what exists and what you still need to do on
the Google side (nothing here can create a Google Sheet or Apps Script deployment
for you — that needs your own account).

## Layout

```
index.html      The static site lives at the repo root, so GitHub Pages serves it
css/ js/        as-is with no build step and no Pages source setting to change.
data/           snapshot.json (shipped with the site) + generated CSVs + diff_report.md
extract/        Python extraction pipeline (handbook -> CSVs)
apps-script/    Code.gs -- paste into the Sheet's Apps Script editor
source/         Handbook draft + PRD. GITIGNORED: this repo is public. Back these up.
Digital Ceasefire Platform.xlsx   All 13 tabs combined, ready to upload to Drive
```

Everything lives in one repo: the site, the pipeline that generates its data, and
the Apps Script that depends on both. They change together, so splitting them meant
the pipeline and `Code.gs` were unversioned. The extra folders don't affect Pages —
it serves the root and ignores the rest. Only `source/` is held back, because a
public repo is the wrong place for a working draft.

The site works today with **no Google account at all** — it reads
`data/snapshot.json`, a bundled copy of the extracted content. Once you wire
up the Sheet and Apps Script (below), it switches to live data automatically.

## What's done vs. what needs your Google account

Everything that's pure code is built and tested (in a local browser, against the
bundled snapshot). Three things genuinely can't be done without your own Google
account, so they're implemented and ready but unverified end-to-end:

- Publishing the Sheet's CSVs and pointing `js/config.js` at them
- The registration Google Form + Apps Script deployment
- Sending real reviewer emails

## One-time setup (do this once, ~1 hour, matches PRD section 10)

1. **Create the spreadsheet.** In your HRC Workspace account, create a sheet named
   `Digital Ceasefire Platform`. Import `Digital Ceasefire Platform.xlsx` (File >
   Import > Replace spreadsheet) — this creates all thirteen tabs with the right
   columns and the extracted v1.4 content already in the eight content ones.
2. **Publish the seven content tabs.** File > Share > Publish to web, pick each
   tab individually (`site_text`, `sections`, `provisions`, `options`,
   `definitions`, `law_clauses`, `footnotes`, `posts` — that's eight, the PRD's
   table just groups posts separately), format **CSV**, publish, copy each URL.
   Also publish `reviewers_public` and `feedback_public` (see "Published tabs"
   below). **Never publish** `registrations`, `reviewers`, or `feedback`.
3. **Paste those URLs into `js/config.js`** — `CSV_URLS` for the eight content tabs,
   `REVIEWERS_CSV_URL` / `FEEDBACK_CSV_URL` for the two `_public` ones, plus
   `REGISTRATION_FORM_URL` once step 4 is done and `APPS_SCRIPT_URL` once step 8
   is done. Redeploy the static site after editing this file.
4. **Create the Google Form** (Email + Role, both required; optional "why do you
   want to review" question). Role dropdown options should match `site_text`'s
   `roles` row: NGO / civil society, Lawyer / legal scholar, Technical expert,
   Mediator / negotiator, Government, International organization, Academic,
   Other. Turn off "Require sign-in." Under Responses, link to the spreadsheet,
   rename the new tab to `registrations`.
5. **Add checkboxes** in `reviewers`: select the `approved` and `resend` columns,
   Insert > Checkbox.
6. **Add the script.** Extensions > Apps Script, paste `apps-script/Code.gs`. Set
   `SITE_URL` at the top of the file to wherever you host the site (e.g. your
   GitHub Pages URL).
7. **Create the triggers** (clock icon > Add trigger — not the `onEdit`/`onFormSubmit`
   simple-trigger names, since those can't send email): `onRegistration` from
   spreadsheet, on form submit; `onReviewerEdit` from spreadsheet, on edit.
   Authorize when asked.
8. **Deploy the web app.** Deploy > New deployment > Web app, execute as
   yourself, who has access: Anyone. Copy the `/exec` URL into `config.js`'s
   `APPS_SCRIPT_URL`. After any future code change: Deploy > Manage deployments
   > Edit > New version (the URL keeps serving old code otherwise).
9. **Test with your own email**: submit the form, tick `approved`, open the
   emailed link, post a comment, check it lands in `feedback`.

Day to day: approve reviewers by ticking `approved`; hide a comment by setting
its `status` to `hidden`; revoke access by setting a reviewer's `status` to
`revoked`; edit handbook text and blog posts directly in the tabs (changes
appear on the site within about 5 minutes — Google's own publish delay).

## Published tabs (why there are two `_public` ones)

"Publish to web" makes a tab readable by **anyone with the link** — there is no
token, no expiry, and no way to un-share it retroactively. So the site never reads
`reviewers` or `feedback` directly: those hold reviewer emails and the sign-in
tokens themselves, and publishing a list of tokens hands out working credentials.

Two projection tabs stand in, each one `QUERY` formula in A1 (created by
`build_workbook.py`, so re-running it keeps them in sync with the column order):

- `reviewers_public` — `token_hash` and `role`, active reviewers only. No email
  (the site never needs one) and no raw token.
- `feedback_public` — every comment field except `token`.

Sign-in still works because the reviewer already holds their token, from the link
`sendReviewLink()` emailed them. The browser hashes it (`sha256()` in
`js/review-auth.js`) and matches that against `token_hash`, which `onRegistration()`
wrote with the identical `sha256Base64()` in `Code.gs`. Possession is proven without
the published list ever being a set of usable credentials.

This is only safe because tokens are `Utilities.getUuid()` — 122 bits. A short or
predictable token would still be brute-forceable from its hash, so don't swap that
generator for something friendlier-looking.

Encrypting the emails instead would not work: a static site has nowhere to keep a
key, so anything it can decrypt, a reader can decrypt too. Not publishing the column
is the only real fix.

Revoking access: set a reviewer's `status` to anything but `active` and their row
drops out of `reviewers_public` at Google's next publish refresh (~5 min).

## Re-running extraction for a new handbook version

```bash
cd extract
uv run extract.py --source path/to/new-handbook.md --version 1.5 --outdir ../data --previous ../data
uv run build_snapshot.py --data ../data --out ../data/snapshot.json
uv run build_workbook.py --data ../data --out "../Digital Ceasefire Platform.xlsx"
```

Read `data/diff_report.md` before importing — it lists new/changed/retired rows
and flags things worth a human look (duplicate paragraphs, headings that are
bold text instead of real markdown headings, table-of-contents mismatches,
capitalized phrases that look like a near-miss of a defined term). Stable IDs
carry over automatically; a removed provision is marked `retired`, never reused.

The extractor's input is the handbook's **markdown export**, not the raw PDF —
it already has clean headings, footnote markers, and preserved italics, which is
strictly more reliable than re-deriving that structure from PDF layout. If a
future version only ships as `.docx`/PDF, export it to markdown the same way
(Google Docs > File > Download > Markdown, or pandoc) before pointing
`--source` at it.

## Design choices I made where the PRD was silent

- **Preselection heuristic**: `preselect_for` is only populated for section 3.0's
  prohibited-acts provisions (the core of what a context implies) — everything
  else (permissible ops, monitoring commission composition, dissemination,
  signatures) starts unselected, since I can't make legal-drafting judgment
  calls about what's "recommended" beyond the obvious core. `applies_to`
  defaults to all three contexts unless the text signals it's IHL/Armed-Conflict
  specific. Both are ordinary Sheet cells — edit them any time, no redeploy needed.
- **Comment layer** is inline under each provision/definition/law clause rather
  than a single detached sidebar — same information, avoids a "what's the
  current item" synchronization problem, and works the same on mobile.
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
- Final role list for reviewers (I used the PRD's draft list).
- Which Google account owns the Sheet and sends emails?
- Is the review round tied to v1.4, or do comments carry over to the final text?
- Can one agreement cover mixed contexts? v1 assumes a single choice, per the PRD.

## Issues found in the v1.4 source text

See `data/diff_report.md` for the live list (regenerated each extraction run).
As of this build it includes the six issues the PRD's drafters already flagged
by hand (3.2.8/3.2.9 missing from the table of contents — actually caused by
those two subsections being bolded text instead of real headings in the source,
which the extractor now recovers automatically but still flags for a source
fix; 3.3.6 duplicating 3.3.2's second paragraph; etc.), found automatically
rather than hardcoded, so they'll keep getting caught in future versions too.
