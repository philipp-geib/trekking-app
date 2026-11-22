# Pfeile für die Live-Aktivität (Sperrbildschirm): weiß auf transparent, je ≤ 4 KB (Grenze von iOS).
# python3 scripts/live-icons.py  → assets/liveActivity/*.png
import math, os
from PIL import Image, ImageDraw

S, K = 96, 4  # Endgröße, Überabtastung
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'liveActivity')
W = 11 * K  # Strichbreite

def arrow(d, pts):
    pts = [(x * K, y * K) for x, y in pts]
    d.line(pts, fill=255, width=W, joint='curve')
    for x, y in (pts[0],):
        r = W / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    a = math.atan2(y2 - y1, x2 - x1)
    L, B = 26 * K, 22 * K
    tip = (x2 + math.cos(a) * L * 0.55, y2 + math.sin(a) * L * 0.55)
    l = (x2 + math.cos(a + math.pi / 2) * B, y2 + math.sin(a + math.pi / 2) * B)
    r = (x2 + math.cos(a - math.pi / 2) * B, y2 + math.sin(a - math.pi / 2) * B)
    d.polygon([tip, l, r], fill=255)

def mirror(pts):
    return [(S - x, y) for x, y in pts]

SHAPES = {
    'straight': [(48, 86), (48, 30)],
    'right': [(36, 86), (36, 48), (66, 48)],
    'slight-right': [(40, 86), (40, 58), (62, 34)],
    'sharp-right': [(36, 88), (36, 26), (62, 56)],
    'uturn': [(62, 86), (62, 44), (60, 34), (48, 28), (36, 34), (34, 44), (34, 62)],
}

def save(name, img):
    img = img.resize((S, S), Image.LANCZOS)
    rgba = Image.new('RGBA', (S, S), (255, 255, 255, 0))
    rgba.putalpha(img)
    p = os.path.join(OUT, f'{name}.png')
    rgba.quantize(16).save(p, optimize=True)
    assert os.path.getsize(p) <= 4096, (name, os.path.getsize(p))

os.makedirs(OUT, exist_ok=True)
for name, pts in SHAPES.items():
    for nm, pp in ((name, pts),) + (((name.replace('right', 'left'), mirror(pts)),) if 'right' in name else ()):
        img = Image.new('L', (S * K, S * K), 0)
        arrow(ImageDraw.Draw(img), pp)
        save(nm, img)

# Ziel: Fahne
img = Image.new('L', (S * K, S * K), 0)
d = ImageDraw.Draw(img)
d.line([(32 * K, 86 * K), (32 * K, 14 * K)], fill=255, width=W)
for row in range(3):
    for col in range(4):
        if (row + col) % 2 == 0:
            x, y = (36 + col * 10) * K, (16 + row * 10) * K
            d.rectangle([x, y, x + 10 * K, y + 10 * K], fill=255)
d.rectangle([36 * K, 16 * K, 76 * K, 46 * K], outline=255, width=3 * K)
save('finish', img)

# abseits der Tour: Ausrufezeichen im Dreieck
img = Image.new('L', (S * K, S * K), 0)
d = ImageDraw.Draw(img)
d.line([(48 * K, 14 * K), (86 * K, 80 * K), (10 * K, 80 * K), (48 * K, 14 * K)], fill=255, width=W, joint='curve')
d.line([(48 * K, 40 * K), (48 * K, 60 * K)], fill=255, width=W)
d.ellipse([43 * K, 66 * K, 53 * K, 76 * K], fill=255)
save('off', img)

# Aufzeichnung ohne Tour: Punkt im Ring
img = Image.new('L', (S * K, S * K), 0)
d = ImageDraw.Draw(img)
d.ellipse([14 * K, 14 * K, 82 * K, 82 * K], outline=255, width=W)
d.ellipse([34 * K, 34 * K, 62 * K, 62 * K], fill=255)
save('rec', img)
