#!/usr/bin/env python3
"""Builds the designer's icons and fonts from the design folder.

    python3 tools/build-assets.py ~/Mega/Projects/HouseOfLeo/design

Icons (<design>/_svg/Cnn.svg) are rewritten as one 512x512 viewBox with absolute path data and no transforms,
so the renderer and the engraving export can read the points directly. Each path is filled black (engraved) or
white (left bare: a light area drawn over a dark one, like the panels of the football).

Fonts (<design>/_fonts/Coded/STnn.ttf) are subset to Latin (German, Turkish, French, Spanish...) and saved as WOFF,
which opentype.js reads in the browser.
"""
import re
import subprocess
import sys
from pathlib import Path

MODULE = Path(__file__).resolve().parent.parent
ICONS_OUT = MODULE / 'views' / 'icons'
FONTS_OUT = MODULE / 'views' / 'fonts'

UNICODES = 'U+0020-007E,U+00A0-00FF,U+0100-017F,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC'

# A fill lighter than this is a bare area, everything darker is engraved
LIGHT_LUMINANCE = 0.85

NUMBER = re.compile(r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
TOKEN = re.compile(r'[MmLlHhVvCcZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
ARGS = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'Z': 0}


def fmt(v: float) -> str:
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def absolute_path(d: str, dx: float, dy: float) -> str:
    """Rewrites path data with absolute M/L/C/Z commands, moved by (dx, dy)."""
    tokens = TOKEN.findall(d)
    out = []
    x = y = sx = sy = 0.0
    i = 0
    cmd = None
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd in 'Zz':
                out.append('Z')
                x, y = sx, sy
                continue
        if cmd is None:
            raise ValueError('path data starts without a command')
        n = ARGS[cmd.upper()]
        vals = [float(t) for t in tokens[i:i + n]]
        if len(vals) < n:
            raise ValueError(f'missing arguments for {cmd}')
        i += n
        rel = cmd.islower()
        c = cmd.upper()
        if c == 'M':
            x, y = (x + vals[0], y + vals[1]) if rel else (vals[0], vals[1])
            sx, sy = x, y
            out.append(f'M{fmt(x + dx)} {fmt(y + dy)}')
            # Extra pairs after a moveto are linetos
            cmd = 'l' if rel else 'L'
        elif c == 'L':
            x, y = (x + vals[0], y + vals[1]) if rel else (vals[0], vals[1])
            out.append(f'L{fmt(x + dx)} {fmt(y + dy)}')
        elif c == 'H':
            x = x + vals[0] if rel else vals[0]
            out.append(f'L{fmt(x + dx)} {fmt(y + dy)}')
        elif c == 'V':
            y = y + vals[0] if rel else vals[0]
            out.append(f'L{fmt(x + dx)} {fmt(y + dy)}')
        elif c == 'C':
            pts = vals if not rel else [vals[k] + (x if k % 2 == 0 else y) for k in range(6)]
            out.append('C' + ' '.join(fmt(p + (dx if k % 2 == 0 else dy)) for k, p in enumerate(pts)))
            x, y = pts[4], pts[5]
    return ''.join(out)


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    r, g, b = (int(h[k:k + 2], 16) / 255 for k in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def build_icon(src: Path) -> str:
    svg = src.read_text()
    paths = []
    for tag in re.findall(r'<path\b[^>]*>', svg, re.S):
        d = re.search(r'\sd="([^"]*)"', tag, re.S)
        if not d:
            continue
        dx = dy = 0.0
        transform = re.search(r'transform="([^"]*)"', tag)
        if transform:
            m = re.fullmatch(r'\s*translate\(([^)]*)\)\s*', transform.group(1))
            if not m:
                raise ValueError(f'{src.name}: unsupported transform {transform.group(1)}')
            parts = [float(v) for v in NUMBER.findall(m.group(1))]
            dx, dy = parts[0], parts[1] if len(parts) > 1 else 0.0
        colour = re.search(r'fill="(#[0-9A-Fa-f]{3,6})"', tag) or re.search(r'fill:\s*(#[0-9A-Fa-f]{3,6})', tag)
        light = colour is not None and luminance(colour.group(1)) > LIGHT_LUMINANCE
        paths.append(f'<path fill="{"#fff" if light else "#000"}" d="{absolute_path(d.group(1), dx, dy)}"/>')
    if re.search(r'<g\b[^>]*transform', svg):
        raise ValueError(f'{src.name}: group transforms are not supported')
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' + ''.join(paths) + '</svg>\n'


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    design = Path(sys.argv[1]).expanduser()

    ICONS_OUT.mkdir(parents=True, exist_ok=True)
    icons = sorted((design / '_svg').glob('C[0-9][0-9].svg'))
    for src in icons:
        (ICONS_OUT / src.name).write_text(build_icon(src))
    print(f'{len(icons)} icons -> {ICONS_OUT}')

    FONTS_OUT.mkdir(parents=True, exist_ok=True)
    fonts = sorted((design / '_fonts' / 'Coded').glob('ST[0-9][0-9].ttf'))
    for src in fonts:
        subprocess.run([
            'pyftsubset', str(src), f'--unicodes={UNICODES}', '--flavor=woff',
            '--layout-features=kern,liga,calt,clig', f'--output-file={FONTS_OUT / (src.stem + ".woff")}',
        ], check=True, stderr=subprocess.DEVNULL)
    print(f'{len(fonts)} fonts -> {FONTS_OUT}')


if __name__ == '__main__':
    main()
