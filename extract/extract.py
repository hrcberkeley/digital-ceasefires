#!/usr/bin/env python3
"""Turn the Digital Ceasefire Handbook markdown export into the seven content CSVs
plus a diff report, per section 4 of the PRD.

Source of truth: the handbook's markdown export (already has clean headings,
italic guidance, footnote markers and a table of contents), not the raw PDF --
re-deriving that structure from PDF layout would be strictly more code for the
same result. If a future handbook version only ships as .docx/.pdf, export it
to markdown the same way (Google Docs / pandoc) before pointing --source here.

Usage:
    uv run extract.py --source "../HRC_..._v1.4.md" --version 1.4 --outdir ../data
    uv run extract.py --source path/to/v1.5.md --version 1.5 --outdir ../data --previous ../data
"""
from __future__ import annotations

import argparse
import csv
import difflib
import itertools
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

CONTEXT_CODES = {"Armed Conflict": "ac", "Grey Zone Activity": "gz", "Internal Disturbance": "id"}
CONTEXT_TERMS = set(CONTEXT_CODES)

# bracket choices that look like fill-in-the-blank signature fields, not real
# alternatives -- these are left as literal text instead of becoming options.
NON_OPTION_PREFIXES = re.compile(r"^(name of|designate|location of|date,)", re.I)

FIELDNAMES = {
    "sections": ["section_id", "parent_id", "number", "title", "guidance", "order", "status"],
    "provisions": [
        "provision_id", "section_id", "order", "text", "footnote_ids",
        "requires_definitions", "requires_law", "requires_provisions",
        "party_placeholders", "applies_to", "preselect_for", "status",
        "version_added", "version_changed",
    ],
    "options": ["option_id", "label", "choices", "default", "help"],
    "definitions": ["definition_id", "term", "text", "footnote_ids", "requires_definitions", "status"],
    "law_clauses": ["law_id", "group", "text", "footnote_ids", "requires_definitions", "applies_to", "status"],
    "footnotes": ["footnote_id", "text", "url"],
    "site_text": ["key", "text", "notes"],
    "posts": ["post_id", "date", "title", "author_role", "body_markdown", "status"],
}

GROUP_ABBREV = {"International Law": "il", "IHL": "ihl", "ICL": "icl", "IHRL": "ihrl"}
GROUP_LABELS = {
    "International Law": "International Law",
    "International Humanitarian Law": "IHL",
    "International Criminal Law": "ICL",
    "International Human Rights Law": "IHRL",
}


def slugify(text: str, max_words: int = 6) -> str:
    words = re.findall(r"[A-Za-z0-9]+", text.lower())[:max_words]
    return "-".join(words) or "x"


# ---------------------------------------------------------------------------
# Document loading: split into blank-line-delimited blocks, each block's soft
# line-wraps joined into one string. Headings and footnote definitions are
# recognizable line-by-line so they're kept as single-line blocks.
# ---------------------------------------------------------------------------

@dataclass
class Block:
    text: str
    level: int = 0  # 0 = body paragraph, 1/2/3 = heading level


def read_source(path: Path) -> str:
    """The markdown export escapes literal brackets as \\[ \\] (Google Docs -> Markdown),
    distinct from real [link](url)/[^N] syntax which is left unescaped. Unescape them
    globally so \\[Armed Conflict\\] reads as the bracket placeholder it is."""
    raw = path.read_text(encoding="utf-8")
    return raw.replace("\\[", "[").replace("\\]", "]")


def load_blocks(path: Path) -> list[Block]:
    raw = read_source(path)
    # footnote definitions run to end of file; split them off first.
    fn_split = re.search(r"\n\[\^1\]:", raw)
    body_raw = raw[: fn_split.start()] if fn_split else raw
    paragraphs = re.split(r"\n\s*\n", body_raw)
    blocks: list[Block] = []
    for para in paragraphs:
        lines = [l.strip() for l in para.strip("\n").split("\n") if l.strip()]
        if not lines:
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", lines[0])
        if heading and len(lines) == 1:
            blocks.append(Block(text=lines[0], level=len(heading.group(1))))
        else:
            blocks.append(Block(text=" ".join(lines), level=0))
    return blocks


def parse_toc(path: Path) -> list[tuple[str | None, str]]:
    """(number, title) pairs from the table of contents links at the top of the doc."""
    raw = read_source(path)
    toc_block = raw.split("\n# ", 1)[0]
    entries = []
    for m in re.finditer(r"\[\*{0,2}([^\]]+?)\*{0,2}\]\(#[^)]+\)", toc_block):
        label = re.sub(r"\s+", " ", m.group(1)).strip()
        num_m = re.match(r"^([0-9]+(?:\.[0-9]+)*)\.?\s+(.*)$", label)
        if num_m:
            entries.append((num_m.group(1), num_m.group(2).strip()))
        else:
            entries.append((None, label))
    return entries


HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*(\{#[^}]+\})?\s*$")
NUMBER_TITLE_RE = re.compile(r"^([0-9]+(?:\.[0-9]+)*)\.?\s+(.*)$")
PSEUDO_HEADING_RE = re.compile(r"^\*\*([0-9]+(?:\.[0-9]+)+)\s+([^*]+?)\*\*$")


def recover_pseudo_headings(blocks: list[Block]) -> tuple[list[Block], list[str]]:
    """Some subsections in the source (3.2.8, 3.2.9 in v1.4) are bolded instead of
    marked up as real '###' headings -- a source defect the PRD calls out on its
    own. Recognize "**N.N.N Title**" body paragraphs as headings anyway, since
    otherwise they get swallowed into the previous real section with raw ** left in."""
    recovered = []
    out = []
    for b in blocks:
        m = PSEUDO_HEADING_RE.match(b.text.strip()) if b.level == 0 else None
        if m:
            depth = min(3, m.group(1).count(".") + 1)
            out.append(Block(text=f"{'#' * depth} {m.group(1)} {m.group(2).strip()}", level=depth))
            recovered.append(m.group(1))
        else:
            out.append(b)
    return out, recovered


def parse_heading(block: Block) -> tuple[str | None, str]:
    m = HEADING_RE.match(block.text)
    raw = m.group(2) if m else block.text
    raw = FOOTNOTE_MARKER_RE.sub("", raw).strip(" *")
    nt = NUMBER_TITLE_RE.match(raw)
    if nt:
        return nt.group(1), nt.group(2).strip(" *")
    return None, raw


def is_guidance(block: Block) -> bool:
    t = block.text.strip()
    return t.startswith("***") and t.endswith("***") and len(t) > 6


def is_group_label(block: Block) -> bool:
    t = block.text.strip()
    return (
        t.startswith("*") and t.endswith("*")
        and not t.startswith("**")
        and not t.endswith("**")
    )


def strip_wrap(text: str, marker: str) -> str:
    t = text.strip()
    n = len(marker)
    if t.startswith(marker) and t.endswith(marker):
        t = t[n:-n]
    return t.strip()


PROVISION_MARKER_RE = re.compile(r"^\*\*([0-9]+(?:\.[0-9]+)+)\*\*\s*(.*)$")


def strip_provision_marker(text: str) -> str:
    m = PROVISION_MARKER_RE.match(text.strip())
    return m.group(2).strip() if m else text.strip()


# ---------------------------------------------------------------------------
# Footnotes
# ---------------------------------------------------------------------------

FOOTNOTE_MARKER_RE = re.compile(r"\[\^([0-9]+)\]")
URL_RE = re.compile(r"https?://[^\s\]\)]+")


def parse_footnotes(path: Path) -> dict[str, dict]:
    raw = read_source(path)
    fn_split = re.search(r"\n\[\^1\]:", raw)
    if not fn_split:
        return {}
    tail = raw[fn_split.start():]
    entries = re.split(r"\n(?=\[\^[0-9]+\]:)", tail.strip("\n"))
    footnotes: dict[str, dict] = {}
    for entry in entries:
        m = re.match(r"^\[\^([0-9]+)\]:\s*(.*)$", entry, re.S)
        if not m:
            continue
        num, text = m.group(1), re.sub(r"\s+", " ", m.group(2)).strip()
        urls = URL_RE.findall(text)
        footnotes[num] = {"footnote_id": f"fn-{num}", "text": text, "url": urls[0] if urls else ""}
    return footnotes


def strip_bold(text: str) -> str:
    """Our schema treats provision/definition/guidance text as plain text (the
    reader doesn't run it through a markdown renderer), so leftover **bold**
    syntax from inline emphasis in the source would otherwise show up literally."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text)


def strip_footnote_markers(text: str) -> tuple[str, str]:
    ids = FOOTNOTE_MARKER_RE.findall(text)
    # "[^42], [^43]" -> "[^42] [^43]": that comma only separates two citations,
    # drop it before removing the markers so it doesn't dangle afterwards.
    text = re.sub(r"\],\s*(?=\[\^[0-9]+\])", "] ", text)
    clean = FOOTNOTE_MARKER_RE.sub("", text)
    clean = strip_bold(clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    ordered_unique = list(dict.fromkeys(ids))
    return clean, "|".join(f"fn-{n}" for n in ordered_unique)


# ---------------------------------------------------------------------------
# Bracketed alternatives -> options
# ---------------------------------------------------------------------------

BRACKET_RUN_RE = re.compile(r"(?:\[[^\[\]]+\]\s+)+\[[^\[\]]+\]")
BRACKET_RE = re.compile(r"\[([^\[\]]+)\]")


class OptionRegistry:
    def __init__(self):
        self.by_choices: dict[tuple[str, ...], str] = {}
        self.rows: dict[str, dict] = {}

    def _context_id(self, choices: list[str]) -> str | None:
        normalized = {re.sub(r"^(an?|the)\s+", "", c, flags=re.I).strip() for c in choices}
        if normalized and normalized.issubset(CONTEXT_TERMS):
            return "o-context"
        return None

    def get_or_create(self, choices: list[str], label_hint: str) -> str:
        key = tuple(choices)
        if key in self.by_choices:
            return self.by_choices[key]
        option_id = self._context_id(choices)
        if option_id is None:
            base = "o-" + slugify(label_hint, max_words=4)
            option_id, i = base, 2
            while option_id in self.rows:
                option_id = f"{base}-{i}"
                i += 1
        self.by_choices[key] = option_id
        if option_id not in self.rows:
            self.rows[option_id] = {
                "option_id": option_id,
                "label": label_hint if option_id != "o-context" else "Context",
                "choices": "|".join(choices),
                "default": choices[0],
                "help": "",
            }
        return option_id


def replace_bracket_options(text: str, registry: OptionRegistry) -> str:
    def repl(m: re.Match) -> str:
        choices = [c.strip() for c in BRACKET_RE.findall(m.group(0))]
        if any(NON_OPTION_PREFIXES.match(c) for c in choices):
            return m.group(0)
        option_id = registry.get_or_create(choices, choices[0])
        return "{{" + option_id + "}}"

    return BRACKET_RUN_RE.sub(repl, text)


PARTY_BRACKET_RE = re.compile(r"\[(Party [A-Za-z0-9]+)\]")


def party_placeholders(text: str) -> str:
    return "|".join(dict.fromkeys(PARTY_BRACKET_RE.findall(text)))


# ---------------------------------------------------------------------------
# Definitions (9.0) and requires_definitions scanning
# ---------------------------------------------------------------------------

DEF_LINE_RE = re.compile(r"^\*\*(.+?)\*\*\s*(.*)$")


def parse_definitions(blocks: list[Block], footnotes: dict, registry: OptionRegistry) -> list[dict]:
    rows = []
    in_definitions = False
    for b in blocks:
        if b.level:
            number, _ = parse_heading(b)
            in_definitions = bool(number and number.startswith("9.0"))
            continue
        if not in_definitions or is_guidance(b):
            continue
        m = DEF_LINE_RE.match(b.text.strip())
        if not m:
            continue
        term = m.group(1).rstrip(":").strip()
        rest = m.group(2)
        if rest.startswith(":"):
            rest = rest[1:]
        text = rest.strip()
        text = replace_bracket_options(text, registry)
        clean, fn_ids = strip_footnote_markers(text)
        rows.append({
            "definition_id": "d-" + slugify(term, max_words=8),
            "term": term,
            "text": clean,
            "footnote_ids": fn_ids,
            "requires_definitions": "",  # filled in a second pass once all terms are known
            "status": "published",
        })
    return rows


def build_term_matcher(terms: list[str]):
    """Longest-match-first regex matching a defined term or its simple plural."""
    ordered = sorted(set(terms), key=len, reverse=True)
    parts = []
    for t in ordered:
        esc = re.escape(t)
        parts.append(esc if t.endswith("s") else esc + r"s?")
    pattern = re.compile(r"\b(" + "|".join(parts) + r")\b")
    return pattern, ordered


def requires_for_text(text: str, pattern: re.Pattern, term_by_lower: dict[str, str], self_term: str | None) -> str:
    found: list[str] = []
    for m in pattern.finditer(text):
        matched = m.group(1)
        # normalize a trailing plural "s" back to the canonical defined term
        term = term_by_lower.get(matched.lower())
        if term is None and matched.endswith("s"):
            term = term_by_lower.get(matched[:-1].lower())
        if term is None:
            term = matched
        if term == self_term:
            continue
        found.append(term)
    ordered_unique = list(dict.fromkeys(found))
    return "|".join("d-" + slugify(t, max_words=8) for t in ordered_unique)


# ---------------------------------------------------------------------------
# Sections + provisions (1.0-8.0, 10.0) and law clauses (11.0)
# ---------------------------------------------------------------------------

IHL_SIGNAL_RE = re.compile(
    r"\b(International Humanitarian Law|Military Objective|Combatant|hostilities|kinetic)\b", re.I
)


def compute_applies_to(section_number: str, text: str) -> str:
    if IHL_SIGNAL_RE.search(text) and section_number.startswith("3."):
        return "ac"
    return "ac|gz|id"


def parse_sections_and_provisions(blocks: list[Block], footnotes: dict, registry: OptionRegistry):
    sections: list[dict] = []
    provisions: list[dict] = []
    order_counter = itertools.count(1)
    parent_stack: list[tuple[int, str]] = []  # (heading level, section_id)
    current_section: dict | None = None
    pending_guidance: list[str] = []
    prov_order = 0
    skip_section = False  # True while inside 9.0 Definitions or 11.0 Annex (handled elsewhere)

    for b in blocks:
        if b.level:
            number, title = parse_heading(b)
            if number is None:
                number = slugify(title, max_words=4)
            skip_section = number.startswith("9.0") or number.startswith("11.0")
            while parent_stack and parent_stack[-1][0] >= b.level:
                parent_stack.pop()
            parent_id = f"s-{parent_stack[-1][1]}" if parent_stack else ""
            section_id = f"s-{number}"
            current_section = {
                "section_id": section_id,
                "parent_id": parent_id,
                "number": number,
                "title": title,
                "guidance": "",
                "order": next(order_counter),
                "status": "published",
            }
            sections.append(current_section)
            parent_stack.append((b.level, number))
            pending_guidance = []
            prov_order = 0
            continue

        if skip_section:
            continue
        if is_guidance(b):
            guidance_clean, _ = strip_footnote_markers(strip_wrap(b.text, "***"))
            pending_guidance.append(guidance_clean)
            if current_section is not None:
                current_section["guidance"] = "\n\n".join(pending_guidance)
            continue

        if current_section is None:
            continue
        text = strip_provision_marker(b.text)
        text = replace_bracket_options(text, registry)
        placeholders = party_placeholders(text)
        clean, fn_ids = strip_footnote_markers(text)
        prov_order += 1
        provisions.append({
            "provision_id": f"p-{current_section['number']}-{prov_order:02d}",
            "section_id": current_section["section_id"],
            "order": prov_order,
            "text": clean,
            "footnote_ids": fn_ids,
            "requires_definitions": "",  # second pass
            "requires_law": "",
            "requires_provisions": "",
            "party_placeholders": placeholders,
            "applies_to": compute_applies_to(current_section["number"], clean),
            "preselect_for": "",  # filled below for 3.x provisions only
            "status": "published",
            "version_added": VERSION,
            "version_changed": "",
        })

    for p in provisions:
        if p["section_id"].startswith("s-3.") or p["section_id"] == "s-3.0":
            p["preselect_for"] = p["applies_to"]

    return sections, provisions


def parse_law_clauses(blocks: list[Block], footnotes: dict, registry: OptionRegistry) -> list[dict]:
    rows: list[dict] = []
    in_annex = False
    group = "International Law"
    order_by_group: dict[str, int] = {}
    for b in blocks:
        if b.level:
            number, _ = parse_heading(b)
            in_annex = bool(number and number.startswith("11.0"))
            continue
        if not in_annex or is_guidance(b):
            continue
        if is_group_label(b):
            label = strip_wrap(b.text, "*")
            group = GROUP_LABELS.get(label, group)
            continue
        text = replace_bracket_options(b.text, registry)
        clean, fn_ids = strip_footnote_markers(text)
        abbrev = GROUP_ABBREV[group]
        order_by_group[abbrev] = order_by_group.get(abbrev, 0) + 1
        applies_to = "ac" if group == "IHL" else "ac|gz|id"
        rows.append({
            "law_id": f"l-{abbrev}-{order_by_group[abbrev]:02d}",
            "group": group,
            "text": clean,
            "footnote_ids": fn_ids,
            "requires_definitions": "",  # second pass
            "applies_to": applies_to,
            "status": "published",
        })
    return rows


# ---------------------------------------------------------------------------
# diff_report.md: automatic issue detection (generic, not v1.4-specific)
# ---------------------------------------------------------------------------

NUMERIC_RE = re.compile(r"^[0-9]+(\.[0-9]+)*$")


def find_toc_mismatches(toc: list[tuple[str | None, str]], sections: list[dict]) -> list[str]:
    toc_numbers = {n for n, _ in toc if n}
    body_numbers = {s["number"] for s in sections if NUMERIC_RE.match(s["number"])}
    issues = []
    for n in sorted(body_numbers - toc_numbers, key=lambda x: [int(p) for p in x.split(".")]):
        issues.append(f"Section {n} appears in the body but is missing from the table of contents.")
    for n in sorted(toc_numbers - body_numbers, key=lambda x: [int(p) for p in x.split(".")]):
        issues.append(f"Section {n} is listed in the table of contents but not found in the body.")
    return issues


def find_duplicate_paragraphs(provisions: list[dict]) -> list[str]:
    seen: dict[str, str] = {}
    issues = []
    for p in provisions:
        norm = re.sub(r"\W+", " ", p["text"]).strip().lower()
        if len(norm) < 40:
            continue
        if norm in seen:
            issues.append(
                f"{p['provision_id']} duplicates the text of {seen[norm]} -- looks like a placeholder that wasn't updated."
            )
        else:
            seen[norm] = p["provision_id"]
    return issues


TITLE_CASE_NGRAM_RE = re.compile(r"\b(?:[A-Z][a-zA-Z]+(?:\s+|$)){2,4}")


def find_near_miss_terms(all_text: list[str], defined_terms: list[str]) -> list[str]:
    term_wordsets = {t: tuple(t.split()) for t in defined_terms}
    by_len: dict[int, list[str]] = {}
    for t, ws in term_wordsets.items():
        by_len.setdefault(len(ws), []).append(t)
    seen_phrases: set[str] = set()
    issues = []
    for text in all_text:
        for m in TITLE_CASE_NGRAM_RE.finditer(text):
            phrase = m.group(0).strip()
            words = tuple(phrase.split())
            if phrase in seen_phrases or phrase in defined_terms:
                continue
            for candidate in by_len.get(len(words), []):
                cwords = term_wordsets[candidate]
                # only flag when every word but the last matches exactly (same lead
                # phrase, different final word) -- catches "Prohibited Digital Acts"
                # vs "Prohibited Digital Operations", ignores unrelated collisions.
                if words[:-1] != cwords[:-1] or words[-1] == cwords[-1]:
                    continue
                if difflib.SequenceMatcher(None, words[-1].lower(), cwords[-1].lower()).ratio() > 0.7:
                    continue  # likely just a plural/inflection, not a real near-miss
                seen_phrases.add(phrase)
                issues.append(f"\"{phrase}\" is used but not defined -- possible near-miss of defined term \"{candidate}\".")
                break
    return issues


# ---------------------------------------------------------------------------
# Re-extraction: match new rows to a previous run's IDs
# ---------------------------------------------------------------------------

def load_previous_csv(path: Path, name: str) -> list[dict]:
    fp = path / f"{name}.csv"
    if not fp.exists():
        return []
    with fp.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def reconcile_provisions(new_rows: list[dict], previous: list[dict], version: str) -> list[dict]:
    if not previous:
        return new_rows
    prev_by_id = {r["provision_id"]: r for r in previous}
    prev_by_section: dict[str, list[dict]] = {}
    for r in previous:
        prev_by_section.setdefault(r["section_id"], []).append(r)
    used_prev_ids: set[str] = set()

    for row in new_rows:
        candidate = prev_by_id.get(row["provision_id"])
        if candidate and candidate["section_id"] == row["section_id"]:
            if candidate["text"] != row["text"]:
                row["version_changed"] = version
            row["version_added"] = candidate.get("version_added") or row["version_added"]
            used_prev_ids.add(candidate["provision_id"])
            continue
        best, best_ratio = None, 0.0
        for cand in prev_by_section.get(row["section_id"], []):
            if cand["provision_id"] in used_prev_ids:
                continue
            ratio = difflib.SequenceMatcher(None, cand["text"], row["text"]).ratio()
            if ratio > best_ratio:
                best, best_ratio = cand, ratio
        if best and best_ratio >= 0.8:
            row["provision_id"] = best["provision_id"]
            row["version_added"] = best.get("version_added") or row["version_added"]
            if best_ratio < 1.0:
                row["version_changed"] = version
            used_prev_ids.add(best["provision_id"])

    retired = [r for r in previous if r["provision_id"] not in used_prev_ids]
    for r in retired:
        r = dict(r)
        r["status"] = "retired"
        new_rows.append(r)
    return new_rows


# ---------------------------------------------------------------------------
# CSV writing + main
# ---------------------------------------------------------------------------

def write_csv(outdir: Path, name: str, rows: list[dict]):
    fp = outdir / f"{name}.csv"
    with fp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES[name])
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


VERSION = "1.4"  # overwritten by --version in main()


def main():
    global VERSION
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", required=True, type=Path, help="handbook markdown export")
    ap.add_argument("--version", default="1.4", help="handbook_version to stamp on rows, e.g. 1.4")
    ap.add_argument("--outdir", default=Path("../data"), type=Path)
    ap.add_argument("--previous", type=Path, default=None, help="directory with a prior run's CSVs, for ID matching")
    args = ap.parse_args()
    VERSION = args.version
    args.outdir.mkdir(parents=True, exist_ok=True)

    blocks = load_blocks(args.source)
    blocks, recovered_headings = recover_pseudo_headings(blocks)
    toc = parse_toc(args.source)
    footnotes = parse_footnotes(args.source)
    registry = OptionRegistry()

    definitions = parse_definitions(blocks, footnotes, registry)
    sections, provisions = parse_sections_and_provisions(blocks, footnotes, registry)
    law_clauses = parse_law_clauses(blocks, footnotes, registry)

    # second pass: requires_definitions, now that the full term list is known
    all_terms = [d["term"] for d in definitions]
    pattern, _ = build_term_matcher(all_terms)
    term_by_lower = {t.lower(): t for t in all_terms}
    for d in definitions:
        d["requires_definitions"] = requires_for_text(d["text"], pattern, term_by_lower, self_term=d["term"])
    for p in provisions:
        p["requires_definitions"] = requires_for_text(p["text"], pattern, term_by_lower, self_term=None)
    for l in law_clauses:
        l["requires_definitions"] = requires_for_text(l["text"], pattern, term_by_lower, self_term=None)

    if args.previous:
        provisions = reconcile_provisions(provisions, load_previous_csv(args.previous, "provisions"), args.version)

    site_text = load_site_text_seed()
    posts = load_posts_seed()

    write_csv(args.outdir, "sections", sections)
    write_csv(args.outdir, "provisions", provisions)
    write_csv(args.outdir, "options", list(registry.rows.values()))
    write_csv(args.outdir, "definitions", definitions)
    write_csv(args.outdir, "law_clauses", law_clauses)
    write_csv(args.outdir, "footnotes", list(footnotes.values()))
    write_csv(args.outdir, "site_text", site_text)
    write_csv(args.outdir, "posts", posts)

    # diff report
    issues = []
    issues += [
        f"Section {n} is written as bold text, not a real heading, in the source -- "
        f"recovered automatically as a subsection, but the source should be fixed."
        for n in recovered_headings
    ]
    issues += find_toc_mismatches(toc, sections)
    issues += find_duplicate_paragraphs(provisions)
    body_text = [p["text"] for p in provisions] + [d["text"] for d in definitions] + [l["text"] for l in law_clauses]
    issues += find_near_miss_terms(body_text, all_terms)

    report = [
        f"# Extraction diff report -- v{args.version}",
        "",
        f"Source: `{args.source}`",
        "",
        "## Counts",
        "",
        f"- sections: {len(sections)}",
        f"- provisions: {len([p for p in provisions if p['status'] != 'retired'])}"
        + (f" ({len([p for p in provisions if p['status'] == 'retired'])} retired)" if args.previous else ""),
        f"- options: {len(registry.rows)}",
        f"- definitions: {len(definitions)}",
        f"- law_clauses: {len(law_clauses)}",
        f"- footnotes: {len(footnotes)}",
        "",
        "## Issues to review before import",
        "",
    ]
    if issues:
        report += [f"- {i}" for i in issues]
    else:
        report.append("None found.")
    (args.outdir / "diff_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    print(f"Wrote {len(sections)} sections, {len(provisions)} provisions, {len(registry.rows)} options, "
          f"{len(definitions)} definitions, {len(law_clauses)} law clauses, {len(footnotes)} footnotes "
          f"to {args.outdir}")
    print(f"{len(issues)} issue(s) logged to {args.outdir / 'diff_report.md'}")


def load_site_text_seed() -> list[dict]:
    from site_text_seed import SITE_TEXT
    return SITE_TEXT


def load_posts_seed() -> list[dict]:
    from posts_seed import POSTS
    return POSTS


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    main()
