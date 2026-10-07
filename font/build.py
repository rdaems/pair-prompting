"""Builds ../app/pixel.woff2 from Super Atlas's bitmap font (atlas_glyphs.py) plus
the characters a chat needs that a game did not (€, accents, braces, quotes).

One dot = 125 units, 8 dots to the em, so at font-size 16px a dot is 2 CSS px
(24px = 3 px). Baseline under row 6; row 7 is the descender.

  docker run --rm -u 1000:1000 -e HOME=/tmp -v ~/docker/config/pair:/w -w /w/font python:3-slim \
    sh -c 'pip -q install --user fonttools brotli && python build.py'
"""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

from atlas_glyphs import GLYPHS

EXTRA = {
    "{": ".##|.#.|.#.|#..|.#.|.#.|.##",
    "}": "##.|.#.|.#.|..#|.#.|.#.|##.",
    "`": "#.|.#|..|..|..|..|..",
    "\\": "#..|#..|.#.|.#.|.#.|..#|..#",
    "€": ".###|#...|###.|#...|###.|#...|.###",
    "·": ".|.|.|#|.|.|.",
    "•": "...|...|###|###|###|...|...",
    "—": ".....|.....|.....|#####|.....|.....|.....",
    "–": "....|....|....|####|....|....|....",
    "…": ".....|.....|.....|.....|.....|.....|#.#.#",
    "’": "#|#|.|.|.|.|.",
    "‘": "#|#|.|.|.|.|.",
    "“": "#.#|#.#|...|...|...|...|...",
    "”": "#.#|#.#|...|...|...|...|...",
    "◆": ".....|..#..|.###.|#####|.###.|..#..|.....",
    "♥": ".....|##.##|#####|#####|.###.|..#..|.....",
    "★": "..#..|..#..|#####|.###.|.#.#.|#...#|.....",
    "é": "..#.|.#..|.##.|#..#|####|#...|.###|....",
    "è": ".#..|..#.|.##.|#..#|####|#...|.###|....",
    "ê": ".##.|#..#|.##.|#..#|####|#...|.###|....",
    "ë": "#..#|....|.##.|#..#|####|#...|.###|....",
    "á": "..#.|.#..|.##.|...#|.###|#..#|.###|....",
    "à": ".#..|..#.|.##.|...#|.###|#..#|.###|....",
    "â": ".##.|#..#|.##.|...#|.###|#..#|.###|....",
    "ä": "#..#|....|.##.|...#|.###|#..#|.###|....",
    "ó": "..#.|.#..|.##.|#..#|#..#|#..#|.##.|....",
    "ò": ".#..|..#.|.##.|#..#|#..#|#..#|.##.|....",
    "ô": ".##.|#..#|.##.|#..#|#..#|#..#|.##.|....",
    "ö": "#..#|....|.##.|#..#|#..#|#..#|.##.|....",
    "ú": "..#.|.#..|#..#|#..#|#..#|#..#|.###|....",
    "ù": ".#..|..#.|#..#|#..#|#..#|#..#|.###|....",
    "û": ".##.|#..#|#..#|#..#|#..#|#..#|.###|....",
    "ü": "#..#|....|#..#|#..#|#..#|#..#|.###|....",
    "í": "..#|.#.|.#.|.#.|.#.|.#.|.#.|...",
    "ì": "#..|.#.|.#.|.#.|.#.|.#.|.#.|...",
    "î": ".#.|#.#|...|.#.|.#.|.#.|.#.|...",
    "ï": "#.#|...|.#.|.#.|.#.|.#.|.#.|...",
    "ç": "...|...|.##|#..|#..|#..|.##|.#.",
    "ñ": ".#.#|#.#.|###.|#..#|#..#|#..#|#..#|....",
    "ß": ".##.|#..#|#.#.|#..#|#..#|#..#|#.#.|#...",
}

U = 125


def rows_of(spec):
    rows = spec.split("|")
    while len(rows) < 8:
        rows.append("." * len(rows[0]))
    return rows


def draw(rows):
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        x = 0
        while x < len(row):
            if row[x] != "#":
                x += 1
                continue
            x0 = x
            while x < len(row) and row[x] == "#":
                x += 1
            y0, y1 = (6 - r) * U, (7 - r) * U
            # clockwise: TrueType outer contours
            pen.moveTo((x0 * U, y0))
            pen.lineTo((x0 * U, y1))
            pen.lineTo((x * U, y1))
            pen.lineTo((x * U, y0))
            pen.closePath()
    return pen.glyph()


glyphs = {**GLYPHS, **EXTRA}
order = [".notdef"]
cmap, outlines, metrics = {}, {}, {}
notdef = rows_of("###|#.#|#.#|#.#|#.#|#.#|###")
outlines[".notdef"] = draw(notdef)
metrics[".notdef"] = (4 * U, 0)
for ch, spec in glyphs.items():
    name = "uni%04X" % ord(ch)
    rows = rows_of(spec)
    w = len(rows[0])
    order.append(name)
    cmap[ord(ch)] = name
    outlines[name] = draw(rows)
    metrics[name] = ((w + 1) * U, 0)
# a no-break space as wide as a space
cmap[0xA0] = cmap[0x20]

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(outlines)
fb.setupHorizontalMetrics({n: (metrics[n][0], outlines[n].xMin if hasattr(outlines[n], "xMin") else 0) for n in order})
fb.setupHorizontalHeader(ascent=875, descent=-125)
fb.setupNameTable({"familyName": "Pair Pixel", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=875, sTypoDescender=-125, sTypoLineGap=0, usWinAscent=875, usWinDescent=125, fsSelection=0x40 | 0x80)
fb.setupPost()
fb.font.flavor = "woff2"
fb.save("../app/pixel.woff2")
print(len(order), "glyphs")
