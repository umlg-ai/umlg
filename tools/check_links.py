#!/usr/bin/env python3
"""Check relative links in Markdown files.

Usage:
    python3 tools/check_links.py
"""

from __future__ import annotations

import pathlib
import re
import sys

LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
SKIP_PREFIXES = ("http://", "https://", "mailto:", "tel:", "#")


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    broken: list[str] = []
    checked = 0

    for md in sorted(root.rglob("*.md")):
        if "node_modules" in md.parts:
            continue
        text = md.read_text(encoding="utf-8")
        for raw in LINK.findall(text):
            target = raw.split(" ", 1)[0].strip("<>")
            if target.startswith(SKIP_PREFIXES):
                continue
            if target.startswith("/"):
                broken.append(f"{md.relative_to(root)}: absolute link {target}")
                continue
            path = (md.parent / target.split("#", 1)[0]).resolve()
            checked += 1
            if not path.exists():
                broken.append(f"{md.relative_to(root)}: missing {target}")

    for item in broken:
        print(f"error: {item}")

    if broken:
        print(f"\nFAILED: {len(broken)} broken link(s), {checked} checked")
        return 1

    print(f"OK: {checked} relative links checked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
