"""
Generates a transparent-PNG kurta cutout for the Virtual Try-On quick-start.
Shoulder seams are placed at the engine's DEFAULT_ANCHORS: (0.26, 0.14) and
(0.74, 0.14), so it drops onto the body correctly with no tuning.

Run:  python make_sample_garment.py
Output: ../public/sample-garment.png
"""
import os
from PIL import Image, ImageDraw

W, H = 600, 700
SS = 4  # supersample for smooth (anti-aliased) edges

# Palette — "rosewood" to match the seeded "Rosewood Embroidered Lawn" product
BODY = (168, 86, 104, 255)      # rosewood
TRIM = (238, 226, 200, 255)     # cream neckline/hem trim
GOLD = (198, 160, 90, 255)      # embroidery accents

img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def P(pts):
    """Scale a list of (x, y) points by the supersample factor."""
    return [(x * SS, y * SS) for x, y in pts]


# ── Kurta silhouette (symmetric about x=300) ──
# Shoulder anchors: left (156, 98), right (444, 98)  → 0.26/0.74 x, 0.14 y
outline = [
    (262, 108),  # neck left top
    (156, 98),   # LEFT shoulder  ← anchor
    (96, 132),   # left sleeve top
    (72, 236),   # left sleeve outer hem
    (150, 226),  # left sleeve inner hem
    (158, 236),  # left armpit
    (150, 470),  # left waist
    (118, 664),  # left hem
    (482, 664),  # right hem
    (450, 470),  # right waist
    (442, 236),  # right armpit
    (450, 226),  # right sleeve inner hem
    (528, 236),  # right sleeve outer hem
    (504, 132),  # right sleeve top
    (444, 98),   # RIGHT shoulder ← anchor
    (338, 108),  # neck right top
    (300, 190),  # neck V bottom
]
d.polygon(P(outline), fill=BODY)

# ── Neckline V trim ──
d.line(P([(262, 108), (300, 190), (338, 108)]), fill=TRIM, width=9 * SS, joint="curve")

# ── Center placket + buttons ──
d.line(P([(300, 190), (300, 440)]), fill=TRIM, width=10 * SS, joint="curve")
for by in (230, 285, 340, 395):
    d.ellipse(P([(295, by - 5), (305, by + 5)]), fill=GOLD)

# ── Hem band + sleeve cuffs ──
d.line(P([(126, 656), (474, 656)]), fill=TRIM, width=12 * SS)
d.line(P([(80, 232), (146, 224)]), fill=TRIM, width=9 * SS)   # left cuff
d.line(P([(454, 224), (520, 232)]), fill=TRIM, width=9 * SS)  # right cuff

# ── Embroidery accents near the neckline/shoulders ──
for cx, cy in [(230, 150), (370, 150), (205, 190), (395, 190),
               (250, 235), (350, 235), (300, 470), (270, 520), (330, 520)]:
    r = 6
    d.ellipse(P([(cx - r, cy - r), (cx + r, cy + r)]), outline=GOLD, width=2 * SS)

# Downscale with LANCZOS for clean anti-aliased edges
out = img.resize((W, H), Image.LANCZOS)

here = os.path.dirname(os.path.abspath(__file__))
dest = os.path.normpath(os.path.join(here, "..", "public", "sample-garment.png"))
out.save(dest)
print(f"Saved {dest} ({out.size[0]}x{out.size[1]})")
