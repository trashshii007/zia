#!/usr/bin/env python3
"""Rebuilds Zia's Tabler icons from the @tabler/icons npm package.

    curl -sSL https://registry.npmjs.org/@tabler/icons/-/icons-<version>.tgz | tar xz
    scripts/tabler-icons.py package

Writes icons/tabler/{outline,filled}/*.svg, recoloured with context-fill so
Zen can tint them, and icons/tabler-names.js, the picker's search index
(each icon's name, tags and category).
"""
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons" / "tabler"


def clean(svg, style):
    svg = re.sub(r"\s+", " ", svg).strip()
    svg = svg.replace("> <", "><")
    # Tabler's invisible 24x24 box
    svg = re.sub(r'<path stroke="none" d="M0 0h24v24H0z" fill="none" ?/>', "", svg)
    svg = re.sub(r' (width|height|class)="[^"]*"', "", svg)
    svg = svg.replace("currentColor", "context-fill")
    if style == "outline":
        svg = svg.replace('stroke="context-fill"', 'stroke="context-fill" stroke-opacity="context-fill-opacity"', 1)
    else:
        svg = svg.replace('fill="context-fill"', 'fill="context-fill" fill-opacity="context-fill-opacity"', 1)
    return svg.replace(" />", "/>").replace(" >", ">")


def main(package):
    package = Path(package)
    meta = json.loads((package / "icons.json").read_text())
    if OUT.exists():
        shutil.rmtree(OUT)
    names = {}
    for style in ("outline", "filled"):
        (OUT / style).mkdir(parents=True)
        for src in sorted((package / "icons" / style).glob("*.svg")):
            (OUT / style / src.name).write_text(clean(src.read_text(), style))
            names.setdefault(src.stem, set()).add(style)
    shutil.copy(package / "LICENSE", OUT / "LICENSE")

    rows = []
    for name in sorted(names):
        info = meta.get(name, {})
        words = [str(tag).lower() for tag in info.get("tags", [])]
        if info.get("category"):
            words.append(info["category"].lower())
        words = [w for w in dict.fromkeys(words) if w and w not in name.split("-")]
        flags = ("o" if "outline" in names[name] else "") + ("f" if "filled" in names[name] else "")
        rows.append(f"{name}|{flags}|{' '.join(words)}")
    version = json.loads((package / "package.json").read_text())["version"]
    (ROOT / "icons" / "tabler-names.js").write_text(
        f"// Tabler Icons {version}: name|styles (o outline, f filled)|search words. Made by scripts/tabler-icons.py\n"
        f"this.ZiaTablerIcons = {json.dumps(rows, separators=(',', ':'))};\n"
    )
    print(f"{sum(1 for r in rows if 'o' in r.split('|')[1])} outline, "
          f"{sum(1 for r in rows if 'f' in r.split('|')[1])} filled")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "package")
