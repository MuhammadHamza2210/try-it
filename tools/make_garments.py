"""
Generates several clean transparent-PNG kurta cutouts in different colors for the
Try It garment picker. Shoulder seams sit at the engine's DEFAULT_ANCHORS
(0.26, 0.14) and (0.74, 0.14), so they drop onto the body with no tuning.

Run:  python make_garments.py
Output: ../public/garments/<slug>.png
"""
import os
from PIL import Image, ImageDraw

W, H = 600, 700
SS = 4  # supersample for smooth (anti-aliased) edges

# (slug, body color, trim/embroidery color)
KURTAS = [
    ("ivory-kurta", (243, 238, 228, 255), (198, 160, 90, 255)),
    ("navy-kurta", (33, 48, 86, 255), (222, 226, 235, 255)),
    ("charcoal-kurta", (46, 46, 52, 255), (198, 160, 90, 255)),
    ("emerald-kurta", (21, 94, 70, 255), (214, 190, 120, 255)),
    ("maroon-kurta", (108, 30, 42, 255), (222, 200, 150, 255)),
]

here = os.path.dirname(os.path.abspath(__file__))
out_dir = os.path.normpath(os.path.join(here, "..", "public", "garments"))
os.makedirs(out_dir, exist_ok=True)


def P(pts):
    return [(x * SS, y * SS) for x, y in pts]


# Kurta silhouette, symmetric about x=300. Shoulders at (156,98)/(444,98).
OUTLINE = [
    (262, 108), (156, 98), (96, 132), (72, 236), (150, 226), (158, 236),
    (150, 470), (118, 664), (482, 664), (450, 470), (442, 236), (450, 226),
    (528, 236), (504, 132), (444, 98), (338, 108), (300, 190),
]


def make(slug, body, trim):
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    d.polygon(P(OUTLINE), fill=body)

    # Neckline V trim
    d.line(P([(262, 108), (300, 190), (338, 108)]), fill=trim, width=9 * SS, joint="curve")
    # Center placket + buttons
    d.line(P([(300, 190), (300, 440)]), fill=trim, width=10 * SS, joint="curve")
    for by in (230, 285, 340, 395):
        d.ellipse(P([(295, by - 5), (305, by + 5)]), fill=trim)
    # Hem band + sleeve cuffs
    d.line(P([(126, 656), (474, 656)]), fill=trim, width=12 * SS)
    d.line(P([(80, 232), (146, 224)]), fill=trim, width=9 * SS)
    d.line(P([(454, 224), (520, 232)]), fill=trim, width=9 * SS)
    # Embroidery accents near neckline/shoulders
    for cx, cy in [(230, 150), (370, 150), (205, 190), (395, 190),
                   (250, 235), (350, 235), (300, 470), (270, 520), (330, 520)]:
        r = 6
        d.ellipse(P([(cx - r, cy - r), (cx + r, cy + r)]), outline=trim, width=2 * SS)

    out = img.resize((W, H), Image.LANCZOS)
    dest = os.path.join(out_dir, f"{slug}.png")
    out.save(dest)
    print(f"Saved {dest}")


if __name__ == "__main__":
    for slug, body, trim in KURTAS:
        make(slug, body, trim)
    print(f"Done — {len(KURTAS)} kurtas in {out_dir}")
