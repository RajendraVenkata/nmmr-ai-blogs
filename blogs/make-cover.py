#!/usr/bin/env python3
"""Generate a 1200x630 social cover image for the Agentic AI Tech Stack post.

Outputs a raster PNG (LinkedIn/X/Facebook render this as a large card; SVG is
ignored by those platforms). Re-run to tweak. Requires Pillow.

Usage: python3 make-cover.py [output.png]
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
OUT = sys.argv[1] if len(sys.argv) > 1 else "agentic-ai-tech-stack-cover.png"

TITLE = "Agentic AI Tech Stack"
SUBTITLE = "A layered map of the tools that build, run, observe & secure autonomous AI agents"
BRAND = "NMMR AI BLOGS"
DOMAIN = "rajendravenkata.com"

# Layer labels evoke the stack theme (top -> bottom of the diagram).
LAYERS = [
    "Applications",
    "Agent Harness",
    "Frameworks & Runtimes",
    "Tools / Standards / Memory",
    "Model Providers & Serving",
    "Inference Hardware",
]

FONT_DIR = "/System/Library/Fonts/Supplemental/"
def font(name, size):
    return ImageFont.truetype(FONT_DIR + name, size)

f_brand = font("Arial Bold.ttf", 30)
f_title = font("Arial Bold.ttf", 86)
f_sub = font("Arial.ttf", 33)
f_layer = font("Arial Bold.ttf", 26)
f_domain = font("Arial.ttf", 28)

img = Image.new("RGB", (W, H))
px = img.load()
# Diagonal gradient: deep slate -> indigo (matches the site's indigo accent).
top = (15, 23, 42)      # slate-900
bot = (49, 46, 129)     # indigo-900
for y in range(H):
    t = y / (H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

d = ImageDraw.Draw(img, "RGBA")

# Right-side faint "stack" bands to suggest layered architecture.
band_x = 760
band_w = 380
band_h = 60
gap = 16
total = len(LAYERS) * band_h + (len(LAYERS) - 1) * gap
start_y = (H - total) // 2
for i, label in enumerate(LAYERS):
    y = start_y + i * (band_h + gap)
    alpha = 38 + i * 6
    d.rounded_rectangle([band_x, y, band_x + band_w, y + band_h], radius=12,
                        fill=(129, 140, 248, alpha))
    d.text((band_x + 22, y + band_h // 2), label, font=f_layer,
           fill=(226, 232, 255, 235), anchor="lm")

# Accent bar.
d.rounded_rectangle([80, 150, 130, 162], radius=6, fill=(129, 140, 248, 255))

# Brand (top-left).
d.text((80, 70), BRAND, font=f_brand, fill=(165, 180, 252, 255))

# Title (left column, may wrap to 2 lines).
def wrap(text, fnt, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

title_lines = wrap(TITLE, f_title, 640)
ty = 200
for line in title_lines:
    d.text((80, ty), line, font=f_title, fill=(255, 255, 255, 255))
    ty += 96

# Subtitle.
sub_lines = wrap(SUBTITLE, f_sub, 640)
ty += 14
for line in sub_lines:
    d.text((80, ty), line, font=f_sub, fill=(203, 213, 225, 255))
    ty += 44

# Domain (bottom-left).
d.text((80, H - 70), DOMAIN, font=f_domain, fill=(148, 163, 184, 255))

img.save(OUT, "PNG")
print(f"wrote {OUT} ({W}x{H})")
