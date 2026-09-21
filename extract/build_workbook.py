#!/usr/bin/env python3
"""Combine the extracted CSVs into one .xlsx with all ten tabs from PRD section 3,
so the owner can open it in Google Sheets (File > Import > Insert new sheet(s),
or just upload the file directly -- Sheets converts .xlsx on open) instead of
importing seven CSVs one at a time. Private tabs ship with headers only.

Usage: uv run build_workbook.py --data ../data --out "../Digital Ceasefire Platform.xlsx"
"""
import argparse
import csv
from pathlib import Path

from openpyxl import Workbook

CONTENT_TABS = ["site_text", "sections", "provisions", "options", "definitions", "law_clauses", "footnotes", "posts"]
PRIVATE_TABS = {
    "registrations": ["Timestamp", "Email Address", "Role", "Why do you want to review?"],
    "reviewers": ["token", "email", "role", "status", "approved", "resend", "created_at", "approved_at", "token_hash"],
    "feedback": [
        "comment_id", "parent_id", "token", "role", "provision_id", "target_type",
        "handbook_version", "selected_text", "start_offset", "end_offset", "body", "status", "created_at",
    ],
}

# Publish-to-web exposes a tab to anyone with the link, so the site reads these
# projections instead of `reviewers` / `feedback` -- they carry no email and no raw
# token. One formula each, in A1; Sheets fills the rest. Column letters track
# PRIVATE_TABS above: reviewers I=token_hash C=role D=status, feedback C=token.
PUBLIC_TAB_FORMULAS = {
    "reviewers_public": '=QUERY(reviewers!A:I, "select I, C where D = \'active\'", 1)',
    "feedback_public": '=QUERY(feedback!A:M, "select A,B,D,E,F,G,H,K,L,M", 1)',
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("../data"))
    ap.add_argument("--out", type=Path, default=Path("../Digital Ceasefire Platform.xlsx"))
    args = ap.parse_args()

    wb = Workbook()
    wb.remove(wb.active)

    for name in CONTENT_TABS:
        fp = args.data / f"{name}.csv"
        with fp.open(newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
        ws = wb.create_sheet(name)
        for row in rows:
            ws.append(row)
        ws.freeze_panes = "A2"

    for name, headers in PRIVATE_TABS.items():
        ws = wb.create_sheet(name)
        ws.append(headers)
        ws.freeze_panes = "A2"

    for name, formula in PUBLIC_TAB_FORMULAS.items():
        wb.create_sheet(name)["A1"] = formula

    wb.save(args.out)
    print(
        f"Wrote {args.out} with tabs: {', '.join(CONTENT_TABS)} "
        f"+ {', '.join(PRIVATE_TABS)} + {', '.join(PUBLIC_TAB_FORMULAS)}"
    )


if __name__ == "__main__":
    main()
