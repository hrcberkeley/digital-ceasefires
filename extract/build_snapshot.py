#!/usr/bin/env python3
"""Bundle the extracted CSVs into one snapshot.json the static site ships with,
used whenever the published Google Sheet CSVs can't be reached (see js/data.js).

Usage: uv run build_snapshot.py --data ../data --out ../data/snapshot.json
"""
import argparse
import csv
import json
from pathlib import Path

TABS = ["site_text", "sections", "provisions", "options", "definitions", "law_clauses", "footnotes", "posts"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("../data"))
    ap.add_argument("--out", type=Path, default=Path("../data/snapshot.json"))
    args = ap.parse_args()

    snapshot = {}
    for name in TABS:
        with (args.data / f"{name}.csv").open(newline="", encoding="utf-8") as f:
            snapshot[name] = list(csv.DictReader(f))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Wrote {args.out} ({sum(len(v) for v in snapshot.values())} rows across {len(snapshot)} tabs)")


if __name__ == "__main__":
    main()
