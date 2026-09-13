"""Generate the app icons for the installable build.

    python tools/make_icons.py

Scripted so the icon set can be regenerated if the look changes, rather than
being four mystery PNGs nobody can reproduce.

A maskable icon is included: Android crops icons to whatever shape the launcher
uses (circle, squircle, rounded square), so anything important has to sit inside
the middle ~80%. Without one the horse gets its ears cropped off.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "icons")
# The colour-emoji font lives somewhere different on every OS and there is no PIL fallback
# worth having — a missing font here silently draws tofu boxes into the shipped icons. So
# the candidates are listed per platform, the first one that exists wins, and ICON_FONT
# overrides the lot for a machine that keeps its fonts somewhere unusual.
EMOJI_FONTS = {
    'win32': [r"C:\Windows\Fonts\seguiemj.ttf"],
    'darwin': ["/System/Library/Fonts/Apple Color Emoji.ttc"],
}.get(sys.platform, ["/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
                     "/usr/share/fonts/noto-cjk/NotoColorEmoji.ttf"])
EMOJI_FONT = next((p for p in ([os.environ["ICON_FONT"]] if os.environ.get("ICON_FONT")
                               else EMOJI_FONTS) if os.path.exists(p)), None)

SKY_TOP = (150, 205, 235)
SKY_BOT = (196, 228, 178)
CREAM = (255, 248, 234)


def emoji_font(px):
    """The emoji font at `px`, or the nearest size it will admit to, and the ratio between.

    Scalable colour fonts (Windows' seguiemj, Noto Color Emoji as CBDT) take any size and
    the ratio is 1. Apple Color Emoji is a fixed-strike bitmap font — PIL raises "invalid
    pixel size" for anything but the strike, so fall back to the sizes Apple actually
    ships and let the caller resample. 137 is the one that has existed for a decade.
    """
    try:
        return ImageFont.truetype(EMOJI_FONT, px), 1.0
    except OSError:
        for strike in (160, 137, 96, 64, 48, 32, 20):
            try:
                return ImageFont.truetype(EMOJI_FONT, strike), px / float(strike)
            except OSError:
                continue
        raise


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
        # Windows' seguiemj scales to any pixel size. Apple Color Emoji does not: it is a
        # bitmap font with one strike, and asking for any other size raises "invalid pixel
        # size", which lands in the except below and quietly ships a plain cream circle
        # instead of the horse. So draw at whatever size the font admits to having and
        # resample — for an outline font STRIKE is None and this is the old code path.
        font, scale = emoji_font(glyph)
        drawn = Image.new("RGBA", (font.size * 2, font.size * 2), (0, 0, 0, 0))
        dd = ImageDraw.Draw(drawn)
        box = dd.textbbox((0, 0), "\U0001F434", font=font, embedded_color=True)
        dd.text((-box[0], -box[1]), "\U0001F434", font=font, embedded_color=True)
        drawn = drawn.crop((0, 0, box[2] - box[0], box[3] - box[1]))
        if scale != 1:
            drawn = drawn.resize((max(1, int(drawn.width * scale)), max(1, int(drawn.height * scale))),
                                 Image.LANCZOS)
        img.paste(drawn, ((size - drawn.width) // 2, (size - drawn.height) // 2), drawn)
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
