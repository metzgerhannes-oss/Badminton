#!/usr/bin/env python3
"""Generate static iOS/PWA PNG icons from the unchanged official club logo SVG.

The committed SVG contains the original 192px WebP as an embedded image. This
script decodes those original bytes without recreating or altering the crest.
Only a neutral navy outer tile and a white rounded backing are added.
Requires Pillow (release time only); website runtime has no dependency.
"""
from __future__ import annotations

import base64
import io
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "spvgg-schmetterlinge.svg"
MATCH = re.search(r"data:image/webp;base64,([A-Za-z0-9+/=]+)", SOURCE.read_text(encoding="utf-8"))
if not MATCH:
    raise SystemExit("Official logo SVG lacks the expected embedded WebP")
with Image.open(io.BytesIO(base64.b64decode(MATCH.group(1)))) as original:
    crest = original.convert("RGB").copy()
    if crest.size != (192, 192):
        raise SystemExit(f"Unexpected crest dimensions: {crest.size}")

for size, filename in (
    (180, "schmetterlinge-apple-touch-icon-180.png"),
    (192, "schmetterlinge-pwa-192.png"),
    (512, "schmetterlinge-pwa-512.png"),
):
    # Padding makes the crest legible in iOS rounded-square icons and ensures
    # maskable Android crops cannot clip the original SpVgg Mössingen logo.
    tile = Image.new("RGB", (size, size), "#0d2b4c")
    inset = round(size * 0.12)
    # Keep the corners of the white embedded original from spilling outside
    # the rounded backing. Mask the whole white plate including the crest.
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, size - inset - 1, size - inset - 1),
        radius=round(size * 0.15), fill=255,
    )
    plate = Image.new("RGB", (size, size), "#ffffff")
    side = round(size * 0.72)
    resized = crest.resize((side, side), Image.Resampling.LANCZOS)
    plate.paste(resized, ((size - side) // 2, (size - side) // 2))
    tile.paste(plate, (0, 0), mask)
    target = ROOT / "assets" / filename
    tile.save(target, format="PNG", optimize=True)
    print(f"{target.relative_to(ROOT)}: {size}x{size}, {target.stat().st_size} bytes")
