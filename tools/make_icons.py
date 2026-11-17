"""Draw the app icons as PNG files (run by the Publish site workflow).

    python tools/make_icons.py <output folder>

PNG icons are required for the site to install as an app; they are drawn here
instead of being stored in the repository. The design matches site/icons/icon.svg.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

PURPLE, WHITE, GOLD = (98, 80, 214), (255, 255, 255), (255, 211, 107)
BARS = [(96, 300), (182, 220), (268, 260), (354, 150)]  # x, top (on a 512 grid)
LINE = [(120, 236), (210, 156), (296, 196), (382, 96)]


def draw(size, maskable=False):
    s = 4  # draw large, then shrink for smooth edges
    big = size * s
    img = Image.new("RGBA", (big, big), PURPLE if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = 0.12 if maskable else 0.0  # keep the art inside the maskable safe zone
    k = big * (1 - 2 * pad) / 512
    off = big * pad
    p = lambda v: off + v * k
    if not maskable:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=112 * big / 512, fill=PURPLE)
    for x, top in BARS:
        d.rounded_rectangle([p(x), p(top), p(x + 56), p(416)], radius=14 * k, fill=WHITE)
    d.line([(p(x), p(y)) for x, y in LINE], fill=GOLD, width=int(22 * k), joint="curve")
    for x, y in (LINE[0], LINE[-1]):
        r = 11 * k
        d.ellipse([p(x) - r, p(y) - r, p(x) + r, p(y) + r], fill=GOLD)
    return img.resize((size, size), Image.LANCZOS)


def main(out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    draw(192).save(out / "icon-192.png")
    draw(512).save(out / "icon-512.png")
    draw(512, maskable=True).save(out / "icon-512-maskable.png")
    print(f"icons written to {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "site/icons")
