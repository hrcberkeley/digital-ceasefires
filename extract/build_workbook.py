#!/usr/bin/env python3
"""Combine the extracted CSVs into one .xlsx with the eight content tabs,
so the owner can open it in Google Sheets (File > Import > Insert new sheet(s),
or just upload the file directly -- Sheets converts .xlsx on open) instead of
importing eight CSVs one at a time.

Usage: uv run build_workbook.py --data ../data --out "../Digital Ceasefire Platform.xlsx"
"""
import argparse
import csv
from pathlib import Path

from openpyxl import Workbook

CONTENT_TABS = ["site_text", "sections", "provisions", "options", "definitions", "law_clauses", "footnotes", "posts"]

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

    wb.save(args.out)
    print(f"Wrote {args.out} with tabs: {', '.join(CONTENT_TABS)}")


if __name__ == "__main__":
    main()
