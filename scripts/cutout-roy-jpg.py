"""
Cuts the white background out of the four JPEG Roy sprites (look-left, look-right,
point-down, soccer-ball) so they match the transparent 512px PNGs made by cutout-roy.mjs.

Same rules as the PNG script: flood-fill from the image border only (so white inside the
character stays opaque), feather the cut edge, crop to the character, center in a square,
and downscale to 512px. Needs Pillow only.

Usage: python scripts/cutout-roy-jpg.py [assets/mascot/roy]
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

WHITE_MIN = 202   # min(r,g,b) at or above this is background or glow
FEATHER_LO = 150  # at or below this an edge pixel stays fully opaque
PAD = 0.04
SIZE = 512
MIN_SPECK = 120   # drop disconnected specks smaller than this many pixels

SOURCES = ["look-left", "look-right", "point-down", "soccer-ball"]

# The ball's white panels touch the page white through the gap under it, so the border fill
# would eat them. Anything inside this (x, y, radius) circle stays part of the character.
KEEP_CIRCLES = {"soccer-ball": (565, 725, 91)}


def cut(path: Path, keep=None) -> Image.Image:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    bg = bytearray(w * h)

    def is_white(x, y):
        r, g, b = px[x, y]
        return min(r, g, b) >= WHITE_MIN

    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_white(x, y) and not bg[y * w + x]:
                bg[y * w + x] = 1
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_white(x, y) and not bg[y * w + x]:
                bg[y * w + x] = 1
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny * w + nx] and is_white(nx, ny):
                bg[ny * w + nx] = 1
                queue.append((nx, ny))

    if keep:
        kx, ky, kr = keep
        for y in range(max(0, ky - kr), min(h, ky + kr + 1)):
            for x in range(max(0, kx - kr), min(w, kx + kr + 1)):
                if (x - kx) ** 2 + (y - ky) ** 2 <= kr * kr:
                    bg[y * w + x] = 0

    # Drop specks: small foreground islands (compression dust, stray marks).
    seen = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            i = sy * w + sx
            if bg[i] or seen[i]:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[i] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    j = ny * w + nx
                    if 0 <= nx < w and 0 <= ny < h and not bg[j] and not seen[j]:
                        seen[j] = 1
                        q.append((nx, ny))
            if len(comp) < MIN_SPECK:
                for x, y in comp:
                    bg[y * w + x] = 1

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            if bg[y * w + x]:
                continue
            r, g, b = px[x, y]
            alpha = 255
            near_bg = any(
                0 <= x + dx < w and 0 <= y + dy < h and bg[(y + dy) * w + x + dx]
                for dx in (-1, 0, 1) for dy in (-1, 0, 1)
            )
            if near_bg:
                m = min(r, g, b)
                alpha = max(0, min(255, round(255 * (WHITE_MIN - m) / (WHITE_MIN - FEATHER_LO))))
                if 0 < alpha < 255:  # un-blend the white the edge picked up
                    a = alpha / 255
                    r = max(0, min(255, round((r - 255 * (1 - a)) / a)))
                    g = max(0, min(255, round((g - 255 * (1 - a)) / a)))
                    b = max(0, min(255, round((b - 255 * (1 - a)) / a)))
            op[x, y] = (r, g, b, alpha)

    box = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    out = out.crop(box)
    cw, ch = out.size
    side = round(max(cw, ch) * (1 + PAD * 2))
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(out, ((side - cw) // 2, (side - ch) // 2))
    return square.resize((SIZE, SIZE), Image.LANCZOS)


if __name__ == "__main__":
    folder = Path(sys.argv[1] if len(sys.argv) > 1 else "assets/mascot/roy")
    for name in SOURCES:
        src = folder / f"{name}.jpg"
        if not src.exists():
            print("missing", src)
            continue
        cut(src, KEEP_CIRCLES.get(name)).save(folder / f"{name}.png", optimize=True)
        print("wrote", folder / f"{name}.png")
