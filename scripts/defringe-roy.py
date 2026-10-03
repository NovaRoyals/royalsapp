"""
Removes the pale halo the white page left around Roy's edges.

The cut-outs were made from art on white, so the antialiased rim still carries white and
shows as a light outline on deep green. For every pixel within three pixels of the edge:

  * how white it is decides how much of it to remove (fur is never close to white, so a
    near-white rim pixel is background, not Roy)
  * what survives is recolored from the fur just inside the edge, so no white tint remains

Pieces that are small and have no solid body near them (confetti, the heart, speed lines) are
left alone. Needs Pillow only. Safe to re-run; a second pass changes almost nothing.

Usage: python scripts/defringe-roy.py [assets/mascot/roy]
"""
import sys
from pathlib import Path

from PIL import Image, ImageFilter

WHITE_LO = 140   # min(r,g,b) at or below this is never treated as fringe
WHITE_HI = 215   # at or above this the pixel is entirely background
BAND = 7         # MinFilter size: pixels not fully inside by 3px are the edge band
RADIUS = 5       # how far to look inward for fur color
MIN_SOLID = 10   # solid-body pixels needed nearby, else the piece is left untouched
SPECK_AREA = 45  # separate pieces smaller than this many pixels are stray dots, not art


def drop_specks(img: Image.Image) -> int:
    from collections import deque

    w, h = img.size
    px = img.load()
    seen = bytearray(w * h)
    removed = 0
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if seen[i] or px[sx, sy][3] <= 20:
                continue
            comp, queue = [], deque([(sx, sy)])
            seen[i] = 1
            while queue:
                x, y = queue.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1), (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not seen[j] and px[nx, ny][3] > 20:
                        seen[j] = 1
                        queue.append((nx, ny))
            if len(comp) < SPECK_AREA:
                for x, y in comp:
                    px[x, y] = (0, 0, 0, 0)
                removed += len(comp)
    return removed


def defringe(path: Path) -> int:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    alpha = img.getchannel("A")
    deep_img = alpha.filter(ImageFilter.MinFilter(BAND))
    deep = deep_img.load()
    changed = 0
    out = img.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or deep[x, y] >= 250:
                continue
            m = min(r, g, b)
            if m <= WHITE_LO:
                continue
            # average the solid fur nearby, ignoring anything near-white
            sr = sg = sb = n = 0
            for yy in range(max(0, y - RADIUS), min(h, y + RADIUS + 1)):
                for xx in range(max(0, x - RADIUS), min(w, x + RADIUS + 1)):
                    if deep[xx, yy] >= 250:
                        pr, pg, pb, _ = px[xx, yy]
                        if min(pr, pg, pb) <= 190:
                            sr += pr
                            sg += pg
                            sb += pb
                            n += 1
            if n < MIN_SOLID:
                continue
            white = min(1.0, max(0.0, (m - WHITE_LO) / (WHITE_HI - WHITE_LO)))
            new_alpha = round(a * (1 - white))
            op[x, y] = (round(sr / n), round(sg / n), round(sb / n), new_alpha)
            changed += 1
    removed = drop_specks(out)
    out.save(path, optimize=True)
    return changed + removed


if __name__ == "__main__":
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/mascot/roy")
    total = 0
    for png in sorted(folder.glob("*.png")):
        count = defringe(png)
        total += count
        print(f"{png.name:16} {count:5} edge pixels cleaned")
    print("total", total)
