"""Generate the sonrchart brand assets: the "Return" icon in the up/down palette.

Usage: python -I scripts/make_brand.py <Archivo[wdth,wght].ttf> <IBMPlexMono-Medium.ttf> <repo root>
"""
import io
import os
import subprocess
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

ARCHIVO, PLEX, REPO = sys.argv[1], sys.argv[2], sys.argv[3]

BG = "#0E1216"
RING_OUTER, RING_MID, RING_INNER = "#14302A", "#1B5444", "#4BA98A"
UP, DOWN = "#35C98D", "#FF6A76"
INK_DARK_BG, INK_LIGHT_BG = "#E6EBE9", "#1A1F29"
GREEN_ON_LIGHT = "#1F9E6B"
MUTED = "#9AA5AE"


def icon_body(transform=""):
    """The Return icon in a 100x100 box: Sonr's rings, candles where its line was."""
    t = f' transform="{transform}"' if transform else ""
    return (
        f"<g{t}>"
        f'<rect width="100" height="100" rx="22" fill="{BG}"/>'
        '<g fill="none" stroke-width="1.4">'
        f'<circle cx="50" cy="50" r="29" stroke="{RING_OUTER}"/>'
        f'<circle cx="50" cy="50" r="20" stroke="{RING_MID}"/>'
        f'<circle cx="50" cy="50" r="12.4" stroke="{RING_INNER}"/>'
        "</g>"
        '<g stroke-width="1.6" stroke-linecap="round">'
        f'<line x1="37" y1="50" x2="37" y2="64" stroke="{UP}"/>'
        f'<line x1="50" y1="46" x2="50" y2="61" stroke="{DOWN}"/>'
        f'<line x1="63" y1="32" x2="63" y2="54" stroke="{UP}"/>'
        "</g>"
        f'<rect x="34.5" y="52.5" width="5" height="9" rx="1.2" fill="{UP}"/>'
        f'<rect x="47.5" y="48.5" width="5" height="8" rx="1.2" fill="{DOWN}"/>'
        f'<rect x="60.5" y="35.5" width="5" height="15" rx="1.2" fill="{UP}"/>'
        "</g>"
    )


class Face:
    def __init__(self, font):
        self.glyphs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.upm = font["head"].unitsPerEm
        self.xh = font["OS/2"].sxHeight
        self.cap = font["OS/2"].sCapHeight

    def path(self, text, x, baseline, size, tracking=0.0):
        """Outline `text`. Returns (path d, advance width)."""
        scale = size / self.upm
        pen = SVGPathPen(self.glyphs)
        cursor = x
        for i, ch in enumerate(text):
            name = self.cmap[ord(ch)]
            self.glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
            cursor += self.glyphs[name].width * scale
            if i < len(text) - 1:
                cursor += tracking * size
        return pen.getCommands(), cursor - x


archivo_black = Face(instancer.instantiateVariableFont(TTFont(ARCHIVO), {"wght": 900, "wdth": 100}))
archivo_medium = Face(instancer.instantiateVariableFont(TTFont(ARCHIVO), {"wght": 500, "wdth": 100}))
plex = Face(TTFont(PLEX))


def fmt(n):
    return f"{n:.2f}".rstrip("0").rstrip(".")


def svg(w, h, body, view=None):
    vb = view or f"0 0 {fmt(w)} {fmt(h)}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
        f'width="{fmt(w)}" height="{fmt(h)}">{body}</svg>\n'
    )


# Lockup: the icon, then "sonr" in Archivo Black and "chart" in Plex Mono,
# the lowercase centred on the icon.
WORD = 62.5
GAP = 16
baseline = 50 + (archivo_black.xh + archivo_black.cap) / archivo_black.upm * WORD / 4
sonr_d, sonr_w = archivo_black.path("sonr", 100 + GAP, baseline, WORD, -0.02)
chart_x = 100 + GAP + sonr_w + 0.02 * WORD
chart_d, chart_w = plex.path("chart", chart_x, baseline, WORD * 0.85, -0.01)
LOCK_W = chart_x + chart_w


def lockup(ink, green, height=120):
    body = icon_body() + f'<path d="{sonr_d}" fill="{ink}"/><path d="{chart_d}" fill="{green}"/>'
    return svg(height * LOCK_W / 100, height, body, f"0 0 {fmt(LOCK_W)} 100")


def write(path, content):
    path = os.path.join(REPO, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb" if isinstance(content, bytes) else "w") as f:
        f.write(content)


def png(svg_text, width, height=None):
    args = ["rsvg-convert", "-w", str(width)] + (["-h", str(height)] if height else [])
    return subprocess.run(args, input=svg_text.encode(), capture_output=True, check=True).stdout


B = "brand"
icon = svg(512, 512, icon_body(), "0 0 100 100")
write(f"{B}/sonrchart-icon.svg", icon)
for n in (1024, 512, 256, 180, 128, 64, 32):
    write(f"{B}/png/sonrchart-icon-{n}.png", png(icon, n, n))

logos = {
    "sonrchart-logo": lockup(INK_DARK_BG, UP),  # for dark backgrounds
    "sonrchart-logo-on-light": lockup(INK_LIGHT_BG, GREEN_ON_LIGHT),
}
for name, s in logos.items():
    write(f"{B}/{name}.svg", s)
    for w in (600, 1200):
        write(f"{B}/png/{name}-{w}w.png", png(s, w))

frames = [Image.open(io.BytesIO(png(icon, n, n))) for n in (16, 32, 48)]
buf = io.BytesIO()
frames[2].save(buf, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[:2])
write(f"{B}/favicon.ico", buf.getvalue())
write("demo/favicon.svg", icon)

# Social preview (GitHub repo settings and link cards), 1280x640.
W, H = 1280, 640
lock_h = 150
k = lock_h / 100
lx = (W - LOCK_W * k) / 2
card = f'<rect width="{W}" height="{H}" fill="{BG}"/>'
card += (
    f'<g transform="translate({fmt(lx)} 150) scale({k:.4f})">'
    + icon_body()
    + f'<path d="{sonr_d}" fill="{INK_DARK_BG}"/><path d="{chart_d}" fill="{UP}"/></g>'
)
TAG = "Own the glass, not the ocean."
tag_w = archivo_medium.path(TAG, 0, 0, 46, -0.01)[1]
card += f'<path d="{archivo_medium.path(TAG, (W - tag_w) / 2, 410, 46, -0.01)[0]}" fill="{INK_DARK_BG}"/>'
SUB = "React candlestick charts · MIT · by Rioa"
sub_w = plex.path(SUB, 0, 0, 24)[1]
card += f'<path d="{plex.path(SUB, (W - sub_w) / 2, 470, 24)[0]}" fill="{MUTED}"/>'
write(f"{B}/png/sonrchart-social-1280x640.png", png(svg(W, H, card), W, H))

print(f"lockup aspect {LOCK_W / 100:.4f}")
