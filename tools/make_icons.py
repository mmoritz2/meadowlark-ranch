"""Generate the app icons for the installable build.

    python tools/make_icons.py

Scripted so the icon set can be regenerated if the look changes, rather than
being four mystery PNGs nobody can reproduce.

A maskable icon is included: Android crops icons to whatever shape the launcher
uses (circle, squircle, rounded square), so anything important has to sit inside
the middle ~80%. Without one the horse gets its ears cropped off.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
EMOJI_FONT = r"C:\Windows\Fonts\seguiemj.ttf"

SKY_TOP = (150, 205, 235)
SKY_BOT = (196, 228, 178)
CREAM = (255, 248, 234)


def base(size, pad_frac):
    """Sky-to-meadow gradient, matching the game's own palette."""
    img = Image.new("RGB", (size, size), SKY_TOP)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / float(size - 1)
        d.line([(0, y), (size, y)],
               fill=tuple(int(SKY_TOP[i] + (SKY_BOT[i] - SKY_TOP[i]) * t) for i in range(3)))
    glyph = int(size * (1.0 - pad_frac * 2) * 0.86)
    try:
        font = ImageFont.truetype(EMOJI_FONT, glyph)
        box = d.textbbox((0, 0), "\U0001F434", font=font, embedded_color=True)
        d.text(((size - (box[2] - box[0])) / 2 - box[0],
                (size - (box[3] - box[1])) / 2 - box[1]),
               "\U0001F434", font=font, embedded_color=True)
    except Exception as e:
        print("  emoji font unavailable (%s) - drawing a fallback mark" % e)
        r = glyph // 2
        d.ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r], fill=CREAM)
    return img


def rounded(img, radius_frac=0.22):
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1],
                                           radius=int(size * radius_frac), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.06, True),
        ("icon-512.png", 512, 0.06, True),
        # maskable: everything inside the middle 80%, square edges, launcher crops it
        ("icon-maskable-512.png", 512, 0.18, False),
        ("apple-touch-icon.png", 180, 0.06, False),   # iOS applies its own mask
    ]
    for name, size, pad, round_it in jobs:
        img = base(size, pad)
        img = rounded(img) if round_it else img.convert("RGBA")
        path = os.path.join(OUT, name)
        img.save(path)
        print("  %-24s %dx%d  %6.1f KB" % (name, size, size, os.path.getsize(path) / 1024.0))


main()
