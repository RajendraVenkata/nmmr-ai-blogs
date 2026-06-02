#!/usr/bin/env python3
"""Generate an SVG recreation of the 'Agentic AI Tech Stack' landscape diagram.

Reproduces the layout and information (tool names as text labels — brand logos
are not reproduced) as a clean, self-contained vector image. No external deps.

Usage: python3 make-diagram.py [out.svg]
"""
import sys, html

OUT = sys.argv[1] if len(sys.argv) > 1 else "agentic-ai-tech-stack.svg"

# ---------------------------------------------------------------- content ----
# Each layer: title, header color, and one or more columns. A column has an
# optional small label and a list of item names.
LAYERS = [
    ("APPLICATIONS", "#2563EB", [
        (None, ["ChatGPT", "Claude", "Perplexity", "Gemini", "Higgsfield", "Lovable"]),
    ]),
    ("AI AGENT HARNESS", "#EA580C", [
        ("PERSONAL AGENT", ["Gemini Spark"]),
        ("CODING AGENT", ["Claude Code", "Cursor"]),
    ]),
    ("AGENTIC FRAMEWORKS  &  RUNTIMES / SDKs", "#7C3AED", [
        ("AGENTIC FRAMEWORKS",
         ["LangGraph", "CrewAI", "AG2 (AutoGen)", "Mastra", "CAMEL AI", "PydanticAI"]),
        ("RUNTIMES / SDKs", ["OpenAI Agent SDK", "Google ADK"]),
    ]),
    ("TOOLS / APIs  +  AUTOMATION", "#0E7490", [
        ("TOOLS & APIs",
         ["Composio", "Exa", "Tavily", "Arcade", "Firecrawl", "Perplexity",
          "Browserbase", "Manus"]),
        ("AUTOMATION", ["Zapier", "Make", "n8n", "Workato"]),
        ("SANDBOX", ["E2B", "Daytona", "Modal"]),
    ]),
    ("STANDARDS / PROTOCOLS", "#E11D48", [
        (None, ["Model Context Protocol (MCP)", "A2A", "OpenAPI Initiative",
                "OpenTelemetry", "AG-UI"]),
    ]),
    ("KNOWLEDGE / DATA / CONTEXT  &  MEMORY", "#047857", [
        ("BEGINNER-FRIENDLY DBs", ["ChromaDB", "Haystack", "LlamaIndex"]),
        ("PRODUCTION-GRADE DBs", ["Pinecone", "Weaviate", "Qdrant", "Neo4j"]),
        ("MEMORY", ["mem0", "Zep", "Letta", "supermemory", "cognee"]),
    ]),
    ("ROUTING", "#F97316", [
        (None, ["LiteLLM", "OpenRouter", "Hugging Face"]),
    ]),
    ("MODEL PROVIDERS", "#4F46E5", [
        ("CLOSED WEIGHTS", ["Gemini", "OpenAI", "Anthropic", "Mistral"]),
        ("OPEN WEIGHTS",
         ["Llama (Meta)", "Mistral", "OpenAI (open)", "Gemma", "DeepSeek", "Qwen", "Kimi"]),
    ]),
    ("SERVING ENGINE", "#FB7185", [
        (None, ["vLLM", "TensorRT-LLM", "TGI", "SGLang"]),
    ]),
    ("INFERENCE HARDWARE", "#1D4ED8", [
        ("ASIC INFERENCING", ["Groq", "Cerebras", "Google TPU", "AWS Trainium"]),
        ("STANDALONE GPU", ["Fireworks AI", "Baseten"]),
        ("CLOUD INFERENCING", ["Nebius / Token Factory", "Google Cloud", "AWS"]),
    ]),
]

SIDEBARS = [
    ("OBSERVABILITY / MONITORING / EVALS", "#15803D",
     ["LangSmith", "Braintrust", "Arize", "Langfuse", "Fiddler", "Helicone"]),
    ("AI SAFETY / SECURITY", "#B91C1C",
     ["Okta", "Robust Intelligence", "watsonx.governance", "Portkey", "Lakera", "promptfoo"]),
]

# ----------------------------------------------------------------- layout ----
W = 1800
M = 22                      # outer margin (lime border thickness area)
PANEL_PAD = 26
TITLE_H = 92
LEFT_X = M + PANEL_PAD
LEFT_W = 1150
SB_GAP = 16
SB_W = 250
SB1_X = LEFT_X + LEFT_W + 28
SB2_X = SB1_X + SB_W + SB_GAP
CONTENT_TOP = M + TITLE_H + 10
LAYER_GAP = 13

CHIP_H = 28
CHIP_PADX = 15
CHIP_GAP = 9
ROW_GAP = 9
LABEL_H = 22
BODY_TOP_PAD = 24          # room below the header pill
BODY_BOT_PAD = 16
COL_GAP = 18

out = []


def esc(s):
    return html.escape(str(s))


def tw(s, size, bold=False):
    # crude Arial width estimate
    return len(str(s)) * size * (0.60 if bold else 0.56)


def rrect(x, y, w, h, r, fill, stroke=None, sw=1, dash=None, opacity=None):
    a = f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" ry="{r}" fill="{fill}"'
    if stroke:
        a += f' stroke="{stroke}" stroke-width="{sw}"'
    if dash:
        a += f' stroke-dasharray="{dash}"'
    if opacity is not None:
        a += f' opacity="{opacity}"'
    return a + '/>'


def text(x, y, s, size, fill, anchor="start", weight="normal", spacing=None):
    a = (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
         f'text-anchor="{anchor}" font-weight="{weight}" '
         f'font-family="Arial, Helvetica, sans-serif"')
    if spacing:
        a += f' letter-spacing="{spacing}"'
    return a + f'>{esc(s)}</text>'


def chips_height(items, maxw, size=14):
    """Compute height a wrapped chip flow would occupy."""
    x = 0
    rows = 1
    for it in items:
        cw = tw(it, size, True) + CHIP_PADX * 2
        if x > 0 and x + cw > maxw:
            rows += 1
            x = 0
        x += cw + CHIP_GAP
    return rows * CHIP_H + (rows - 1) * ROW_GAP


def draw_chips(items, x0, y0, maxw, accent, size=14):
    x = x0
    y = y0
    for it in items:
        cw = tw(it, size, True) + CHIP_PADX * 2
        if x > x0 and x + cw > x0 + maxw:
            x = x0
            y += CHIP_H + ROW_GAP
        out.append(rrect(x, y, cw, CHIP_H, 8, "#FFFFFF", stroke=accent, sw=1.4))
        out.append(text(x + cw / 2, y + CHIP_H / 2 + 5, it, size, "#0F172A",
                        anchor="middle", weight="600"))
        x += cw + CHIP_GAP


def col_height(col, w):
    label, items = col
    h = chips_height(items, w)
    if label:
        h += LABEL_H
    return h


def draw_layer(layer, x, y, w):
    title, color, cols = layer
    n = len(cols)
    inner_w = w - 2 * 14
    col_w = (inner_w - COL_GAP * (n - 1)) / n
    body_h = max(col_height(c, col_w) for c in cols)
    height = BODY_TOP_PAD + body_h + BODY_BOT_PAD

    # layer container
    out.append(rrect(x, y, w, height, 14, "#FFFFFF", stroke=color, sw=2.4))

    # header pill on the top edge
    ts = 17
    pill_w = tw(title, ts, True) + 40
    px = x + (w - pill_w) / 2
    out.append(rrect(px, y - 16, pill_w, 32, 16, color))
    out.append(text(x + w / 2, y - 16 + 22, title, ts, "#FFFFFF",
                    anchor="middle", weight="700", spacing="0.5"))

    # columns
    cx = x + 14
    for i, col in enumerate(cols):
        label, items = col
        cyy = y + BODY_TOP_PAD
        if label:
            out.append(text(cx, cyy + 12, label, 12, "#64748B",
                            weight="700", spacing="0.4"))
            cyy += LABEL_H
        draw_chips(items, cx, cyy, col_w, color)
        if i < n - 1:
            dvx = cx + col_w + COL_GAP / 2
            out.append(f'<line x1="{dvx:.1f}" y1="{y+14:.1f}" x2="{dvx:.1f}" '
                       f'y2="{y+height-14:.1f}" stroke="#E2E8F0" stroke-width="1.5"/>')
        cx += col_w + COL_GAP
    return height


def draw_sidebar(sb, x, y, w, total_h):
    title, color, items = sb
    out.append(rrect(x, y, w, total_h, 16, "#FFFFFF", stroke=color, sw=2.4))
    # header pill (may wrap into 2 lines)
    words = title.split(" / ")
    line1 = words[0]
    line2 = " / ".join(words[1:]) if len(words) > 1 else ""
    ph = 30 if not line2 else 48
    out.append(rrect(x + 12, y - 15, w - 24, ph, 12, color))
    if line2:
        out.append(text(x + w / 2, y - 15 + 19, line1, 13, "#FFFFFF",
                        anchor="middle", weight="700", spacing="0.3"))
        out.append(text(x + w / 2, y - 15 + 37, line2, 13, "#FFFFFF",
                        anchor="middle", weight="700", spacing="0.3"))
    else:
        out.append(text(x + w / 2, y - 15 + 20, line1, 13, "#FFFFFF",
                        anchor="middle", weight="700", spacing="0.3"))

    top = y + ph + 8
    avail = total_h - (ph + 8) - 16
    n = len(items)
    slot = avail / n
    ih = min(54, slot - 10)
    for i, it in enumerate(items):
        iy = top + i * slot + (slot - ih) / 2
        out.append(rrect(x + 14, iy, w - 28, ih, 10, "#F8FAFC", stroke=color, sw=1.4))
        out.append(text(x + w / 2, iy + ih / 2 + 5, it, 15, "#0F172A",
                        anchor="middle", weight="600"))


# ----------------------------------------------------------------- render ----
# First pass: measure left stack height.
y = CONTENT_TOP
heights = []
for layer in LAYERS:
    n = len(layer[2])
    inner_w = LEFT_W - 28
    col_w = (inner_w - COL_GAP * (n - 1)) / n
    bh = max(col_height(c, col_w) for c in layer[2])
    heights.append(BODY_TOP_PAD + bh + BODY_BOT_PAD)
left_total = sum(heights) + LAYER_GAP * (len(LAYERS) - 1)
content_bottom = CONTENT_TOP + left_total
H = content_bottom + PANEL_PAD + M

# Background lime panel + inner white board.
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H:.0f}" '
           f'viewBox="0 0 {W} {H:.0f}">')
out.append(rrect(0, 0, W, H, 0, "#C6F125"))
out.append(rrect(M, M, W - 2 * M, H - 2 * M, 24, "#FFFFFF", stroke="#0B1020", sw=4))

# Title.
out.append(text(W / 2, M + 60, "AGENTIC AI TECH STACK", 46, "#0B1020",
                anchor="middle", weight="800", spacing="1"))

# Left layers.
y = CONTENT_TOP
for layer in LAYERS:
    h = draw_layer(layer, LEFT_X, y, LEFT_W)
    y += h + LAYER_GAP

# Right sidebars (fill the same vertical extent as the layer stack).
draw_sidebar(SIDEBARS[0], SB1_X, CONTENT_TOP, SB_W, left_total)
draw_sidebar(SIDEBARS[1], SB2_X, CONTENT_TOP, SB_W, left_total)

# Footer note.
out.append(text(W / 2, H - 14, "NMMR AI Blogs  ·  rajendravenkata.com", 16,
                "#0B1020", anchor="middle", weight="600"))

out.append('</svg>')

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print(f"wrote {OUT}  ({W}x{int(H)})")
