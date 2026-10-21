/**
 * Tag renderer: lays out one side of a round tag as SVG paths, in millimetres with the centre at (0, 0) and y
 * pointing down. The product page preview and the engraving export (order page) use the same layout, so what the
 * customer sees is what is engraved. Text is converted to outlines with opentype.js.
 */
(function (global) {
  'use strict';

  // Layout of a round tag. Sizes ending in "Cap" are cap heights as a fraction of the diameter (the largest the
  // text gets; long text shrinks to fit)
  const LAYOUT = {
    margin: 1, // mm, from the edge, for everything but the phone number
    phoneMargin: 0.5, // mm, the phone number follows the edge closer
    holeEdge: 1, // mm, between the tag edge and the ring hole
    gap: 0.8, // mm, between the name and the icon, and between the address and the phone number
    nameCap: 0.24,
    nameShare: 0.56, // part of the height below the hole that sets the name's size, the rest sets the icon's
    nameCentre: -0.03, // vertical centre of the name as a fraction of the diameter (0 is the middle of the tag)
    iconMax: 0.38, // largest icon height as a fraction of the diameter
    iconScale: 0.81, // the fitted icon is drawn at this size, centred on the same point
    lineCap: 0.068,
    lineLeading: 1.7, // distance between the two address baselines, in cap heights
    linesCentre: -0.01, // vertical centre of the address block as a fraction of the diameter
    phoneCap: 0.075,
    phoneTracking: 0.06, // extra space between letters on the curve, in em
    phoneMaxAngle: 62, // degrees each side of the bottom
  };

  const fontCache = new Map();
  const iconCache = new Map();

  function cached(cache, key, load) {
    if (!cache.has(key)) {
      const promise = load().catch((error) => {
        cache.delete(key); // allow a retry
        throw error;
      });
      cache.set(key, promise);
    }
    return cache.get(key);
  }

  function fetchOk(url) {
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      return response;
    });
  }

  function loadFont(url) {
    return cached(fontCache, url, () => fetchOk(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => global.opentype.parse(buffer)));
  }

  // Icons are built by tools/build-assets.py: a 512x512 viewBox, absolute M/L/C/Z path data, fill black (engraved)
  // or white (bare)
  function loadIcon(url) {
    return cached(iconCache, url, () => fetchOk(url)
      .then((response) => response.text())
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        return Array.from(doc.querySelectorAll('path')).map((path) => ({
          commands: parsePathData(path.getAttribute('d') || ''),
          bare: (path.getAttribute('fill') || '').toLowerCase() === '#fff',
        }));
      }));
  }

  function parsePathData(d) {
    const tokens = d.match(/[MLCZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    const commands = [];
    let i = 0;
    const num = () => parseFloat(tokens[i++]);
    while (i < tokens.length) {
      const type = tokens[i++];
      if (type === 'M' || type === 'L') {
        commands.push({ type, x: num(), y: num() });
      } else if (type === 'C') {
        commands.push({ type, x1: num(), y1: num(), x2: num(), y2: num(), x: num(), y: num() });
      } else if (type === 'Z') {
        commands.push({ type });
      }
    }
    return commands;
  }

  // --- Path helpers (commands as opentype.js makes them: M, L, Q, C, Z) ---

  function transform(commands, map) {
    return commands.map((c) => {
      const out = { type: c.type };
      if (c.type === 'Z') {
        return out;
      }
      [out.x, out.y] = map(c.x, c.y);
      if (c.type === 'Q' || c.type === 'C') {
        [out.x1, out.y1] = map(c.x1, c.y1);
      }
      if (c.type === 'C') {
        [out.x2, out.y2] = map(c.x2, c.y2);
      }
      return out;
    });
  }

  // End and control points: a curve stays inside the hull of its control points, so testing these is enough to
  // keep the outline inside an area
  function points(commands) {
    const pts = [];
    commands.forEach((c) => {
      if (c.type === 'Z') {
        return;
      }
      pts.push([c.x, c.y]);
      if (c.type === 'Q' || c.type === 'C') {
        pts.push([c.x1, c.y1]);
      }
      if (c.type === 'C') {
        pts.push([c.x2, c.y2]);
      }
    });
    return pts;
  }

  function bounds(pts) {
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    pts.forEach(([x, y]) => {
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x);
      box.y1 = Math.max(box.y1, y);
    });
    return box;
  }

  // cubicOnly: quadratic curves (TrueType outlines) are written as the equivalent cubic ones, for laser software
  // that only reads M/L/C/Z
  function toPathData(commands, cubicOnly) {
    const n = (v) => (Math.round(v * 1000) / 1000).toString();
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    return commands.map((c) => {
      const fromX = x;
      const fromY = y;
      if (c.type === 'Z') {
        x = startX;
        y = startY;
      } else {
        x = c.x;
        y = c.y;
      }
      if (c.type === 'M') {
        startX = c.x;
        startY = c.y;
      }
      switch (c.type) {
        case 'M': return `M${n(c.x)} ${n(c.y)}`;
        case 'L': return `L${n(c.x)} ${n(c.y)}`;
        case 'Q':
          if (cubicOnly) {
            const x1 = fromX + (2 / 3) * (c.x1 - fromX);
            const y1 = fromY + (2 / 3) * (c.y1 - fromY);
            const x2 = c.x + (2 / 3) * (c.x1 - c.x);
            const y2 = c.y + (2 / 3) * (c.y1 - c.y);
            return `C${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(c.x)} ${n(c.y)}`;
          }
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default: return 'Z';
      }
    }).join('');
  }

  // Largest scale up to maxScale at which the points, centred on (cx, cy), all pass inside(x, y)
  function fitScale(pts, cx, cy, maxScale, inside) {
    const box = bounds(pts);
    const bx = (box.x0 + box.x1) / 2;
    const by = (box.y0 + box.y1) / 2;
    const fits = (s) => pts.every(([x, y]) => inside(cx + (x - bx) * s, cy + (y - by) * s));
    if (fits(maxScale)) {
      return maxScale;
    }
    let lo = 0;
    let hi = maxScale;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  function placeOnBox(commands, box, cx, cy, scale) {
    const bx = (box.x0 + box.x1) / 2;
    const by = (box.y0 + box.y1) / 2;
    return transform(commands, (x, y) => [cx + (x - bx) * scale, cy + (y - by) * scale]);
  }

  // --- Text ---

  function capHeight(font) {
    const os2 = font.tables.os2;
    if (os2 && os2.sCapHeight > 0) {
      return os2.sCapHeight / font.unitsPerEm;
    }
    const box = font.charToGlyph('H').getBoundingBox();
    return box.y2 > 0 ? box.y2 / font.unitsPerEm : 0.7;
  }

  function fontSizeForCap(font, cap) {
    return cap / capHeight(font);
  }

  function textCommands(font, text, size) {
    return font.getPath(text, 0, 0, size, { kerning: true }).commands;
  }

  // Characters the font cannot draw: no glyph (an empty box) or an empty one (some fonts ship a blank "+")
  function missingChars(font, text) {
    const missing = new Set();
    Array.from(text).forEach((ch) => {
      if (/\s/.test(ch)) {
        return;
      }
      if (font.charToGlyphIndex(ch) === 0 || font.charToGlyph(ch).getPath(0, 0, 72).commands.length === 0) {
        missing.add(ch);
      }
    });
    return Array.from(missing).join('');
  }

  // Text along the bottom edge, reading left to right and upright: glyph tops face the centre
  function arcCommands(font, text, size, tracking, baseRadius) {
    const glyphs = font.stringToGlyphs(text);
    const scale = size / font.unitsPerEm;
    const advances = glyphs.map((glyph, i) => {
      let advance = glyph.advanceWidth * scale;
      if (i < glyphs.length - 1) {
        advance += font.getKerningValue(glyph, glyphs[i + 1]) * scale + tracking * size;
      }
      return advance;
    });
    const total = advances.reduce((a, b) => a + b, 0);
    const commands = [];
    let start = 0;
    glyphs.forEach((glyph, i) => {
      const width = glyph.advanceWidth * scale;
      const phi = (start + width / 2 - total / 2) / baseRadius;
      const sin = Math.sin(phi);
      const cos = Math.cos(phi);
      const local = glyph.getPath(-width / 2, 0, size).commands;
      commands.push(...transform(local, (x, y) => [
        baseRadius * sin + x * cos + y * sin,
        baseRadius * cos - x * sin + y * cos,
      ]));
      start += advances[i];
    });
    return { commands, angle: total / baseRadius };
  }

  // --- Layout ---

  function geometry(diameter, holeDiameter) {
    const r = diameter / 2;
    const holeY = -r + LAYOUT.holeEdge + holeDiameter / 2;
    return {
      r,
      holeY,
      holeR: holeDiameter / 2,
      // Nothing is engraved above this line: the hole plus the margin
      top: holeY + holeDiameter / 2 + LAYOUT.margin,
      inner: r - LAYOUT.margin,
    };
  }

  function inCircle(x, y, radius) {
    return x * x + y * y <= radius * radius;
  }

  /**
   * Front: the name a little above the middle, the icon below it.
   *
   * spec: { diameter, hole, font, name, nameGhost, icon } where icon is the result of loadIcon() or null and
   * nameGhost is shown (and never exported) while the name is empty.
   */
  function layoutFront(spec) {
    const g = geometry(spec.diameter, spec.hole);
    const d = spec.diameter;
    const shapes = [];
    // The sizes come from splitting the height below the hole between the name and the icon; the name is then
    // drawn lower, around nameCentre, and the icon below it
    const split = g.top + (g.inner - g.top) * LAYOUT.nameShare;
    let nameBottom = split;

    const text = spec.name.trim() || spec.nameGhost || '';
    if (text && spec.font) {
      const commands = textCommands(spec.font, text, fontSizeForCap(spec.font, LAYOUT.nameCap * d));
      const pts = points(commands);
      if (pts.length) {
        const box = bounds(pts);
        const size = fitScale(pts, 0, (g.top + split) / 2, 1, (x, y) => inCircle(x, y, g.inner) && y >= g.top && y <= split);
        const cy = LAYOUT.nameCentre * d;
        const scale = fitScale(pts, 0, cy, size, (x, y) => inCircle(x, y, g.inner) && y >= g.top);
        nameBottom = cy + ((box.y1 - box.y0) * scale) / 2;
        shapes.push({
          kind: spec.name.trim() ? 'engrave' : 'ghost',
          commands: placeOnBox(commands, box, 0, cy, scale),
        });
      }
    }

    if (spec.icon) {
      const all = [];
      spec.icon.forEach((path) => all.push(...points(path.commands)));
      if (all.length) {
        const box = bounds(all);
        const top = split + LAYOUT.gap;
        const height = Math.min(g.inner - top, LAYOUT.iconMax * d);
        const maxScale = height / Math.max(box.y1 - box.y0, box.x1 - box.x0);
        const inside = (x, y) => inCircle(x, y, g.inner) && y >= top;
        // The circle narrows towards the bottom: try a few heights and keep the one that allows the largest icon
        let best = { scale: 0, cy: top };
        for (let i = 0; i <= 12; i += 1) {
          const cy = top + ((g.inner - top) * i) / 12;
          const scale = fitScale(all, 0, cy, maxScale, inside);
          if (scale > best.scale + 1e-6) {
            best = { scale, cy };
          }
        }
        // At the size it is drawn, the icon goes in the middle of the heights where it fits below the name
        const drawn = best.scale * LAYOUT.iconScale;
        const below = (x, y) => inCircle(x, y, g.inner) && y >= nameBottom + LAYOUT.gap;
        const fitting = [];
        for (let i = 0; i <= 48; i += 1) {
          const cy = top + ((g.inner - top) * i) / 48;
          if (fitScale(all, 0, cy, drawn, below) >= drawn - 1e-6) {
            fitting.push(cy);
          }
        }
        const cy = fitting.length ? (fitting[0] + fitting[fitting.length - 1]) / 2 : best.cy;
        // Every path is placed on the bounds of the whole icon
        spec.icon.forEach((path) => {
          shapes.push({
            kind: path.bare ? 'bare' : 'engrave',
            commands: placeOnBox(path.commands, box, 0, cy, drawn),
          });
        });
      }
    }

    return { diameter: d, hole: spec.hole, shapes };
  }

  /**
   * Back: two address lines in the middle and the phone number along the bottom edge.
   *
   * spec: { diameter, hole, font, lines: [line1, line2], phone, ghost: { lines: [...], phone } }
   */
  function layoutBack(spec) {
    const g = geometry(spec.diameter, spec.hole);
    const d = spec.diameter;
    const font = spec.font;
    const shapes = [];
    if (!font) {
      return { diameter: d, hole: spec.hole, shapes };
    }

    // Phone number first: the address has to stay clear of it
    let phoneInner = g.inner;
    let phoneTop = Infinity;
    const phone = spec.phone.trim();
    const phoneText = phone || (spec.ghost && spec.ghost.phone) || '';
    if (phoneText) {
      const outer = g.r - LAYOUT.phoneMargin;
      let size = fontSizeForCap(font, LAYOUT.phoneCap * d);
      let arc = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        // Start with the baseline at the edge, then move it in by how far the glyphs reach past the limit
        let base = outer;
        for (let i = 0; i < 3; i += 1) {
          arc = arcCommands(font, phoneText, size, LAYOUT.phoneTracking, base);
          const reach = Math.max(...points(arc.commands).map(([x, y]) => Math.hypot(x, y)));
          base -= reach - outer;
        }
        const maxAngle = (2 * LAYOUT.phoneMaxAngle * Math.PI) / 180;
        if (arc.angle <= maxAngle) {
          break;
        }
        size *= maxAngle / arc.angle;
      }
      const pts = points(arc.commands);
      phoneInner = Math.min(...pts.map(([x, y]) => Math.hypot(x, y)));
      phoneTop = Math.min(...pts.map(([, y]) => y));
      shapes.push({ kind: phone ? 'engrave' : 'ghost', commands: arc.commands });
    }

    // Address: both lines at the same size, centred, shrunk together until they fit
    const ghostLines = (spec.ghost && spec.ghost.lines) || [];
    const lines = spec.lines.map((line, i) => {
      const value = line.trim();
      return { text: value || ghostLines[i] || '', ghost: !value };
    }).filter((line) => line.text);
    if (lines.length) {
      const cap = LAYOUT.lineCap * d;
      const size = fontSizeForCap(font, cap);
      const step = LAYOUT.lineLeading * cap;
      const parts = lines.map((line, i) => {
        const commands = textCommands(font, line.text, size);
        const box = bounds(points(commands));
        const dx = -(box.x0 + box.x1) / 2;
        const dy = (i - (lines.length - 1) / 2) * step + cap / 2;
        return { ghost: line.ghost, commands: transform(commands, (x, y) => [x + dx, y + dy]) };
      });
      const all = [];
      parts.forEach((part) => all.push(...points(part.commands)));
      const clear = phoneInner - LAYOUT.gap;
      const inside = (x, y) => inCircle(x, y, g.inner) && y >= g.top
        && (inCircle(x, y, clear) || y < phoneTop - LAYOUT.gap);
      const cy = LAYOUT.linesCentre * d;
      const scale = fitScale(all, 0, cy, 1, inside);
      const box = bounds(all);
      parts.forEach((part) => {
        shapes.push({ kind: part.ghost ? 'ghost' : 'engrave', commands: placeOnBox(part.commands, box, 0, cy, scale) });
      });
    }

    return { diameter: d, hole: spec.hole, shapes };
  }

  // --- SVG output ---

  let uid = 0;

  /**
   * Product page / order page preview. look: { tag: '#hex', engrave: '#hex' }. Shapes: kind engrave, bare (drawn
   * in the tag colour), ghost (a placeholder text, faded) or sample (a placeholder QR code); evenodd: fill rule
   */
  function previewSvg(side, look) {
    uid += 1;
    const id = `tagr${uid}`;
    const r = side.diameter / 2;
    const g = geometry(side.diameter, side.hole);
    const pad = 0.6;
    const paths = side.shapes.map((shape) => {
      const fill = shape.kind === 'bare' ? look.tag : look.engrave;
      const opacity = shape.kind === 'ghost' ? ' fill-opacity="0.32"' : '';
      const rule = shape.evenodd ? ' fill-rule="evenodd"' : '';
      return `<path d="${toPathData(shape.commands)}" fill="${fill}"${opacity}${rule}/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-r - pad} ${-r - pad} ${2 * (r + pad)} ${2 * (r + pad)}" role="img">`
      + '<defs>'
      + `<mask id="${id}m"><circle r="${r}" fill="#fff"/><circle cy="${g.holeY}" r="${g.holeR}" fill="#000"/></mask>`
      + `<radialGradient id="${id}s" cx="0.32" cy="0.26" r="0.85">`
      + '<stop offset="0" stop-color="#fff" stop-opacity="0.38"/>'
      + '<stop offset="0.55" stop-color="#fff" stop-opacity="0.06"/>'
      + '<stop offset="1" stop-color="#000" stop-opacity="0.18"/>'
      + '</radialGradient>'
      + `<filter id="${id}d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.25" stdDeviation="0.3" flood-opacity="0.25"/></filter>`
      + '</defs>'
      + `<g mask="url(#${id}m)">`
      + `<circle r="${r}" fill="${look.tag}" filter="url(#${id}d)"/>`
      + paths
      + `<circle r="${r}" fill="url(#${id}s)"/>`
      + `<circle r="${r - 0.08}" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="0.16"/>`
      + `<circle cy="${g.holeY}" r="${g.holeR + 0.08}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="0.16"/>`
      + '</g>'
      + '</svg>';
  }

  /**
   * Engraving file: real size in mm, text as outlines, ghosts and samples left out. The tag outline and the hole
   * are in their own group ("guide", red hairline) for positioning in the laser software.
   */
  function engravingSvg(side, title) {
    const r = side.diameter / 2;
    const g = geometry(side.diameter, side.hole);
    const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const paths = side.shapes.filter((shape) => shape.kind !== 'ghost' && shape.kind !== 'sample').map((shape) => (
      `<path d="${toPathData(shape.commands, true)}" fill="${shape.kind === 'bare' ? '#ffffff' : '#000000'}"${shape.evenodd ? ' fill-rule="evenodd"' : ''}/>`
    )).join('\n    ');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<svg xmlns="http://www.w3.org/2000/svg" width="${side.diameter}mm" height="${side.diameter}mm" viewBox="${-r} ${-r} ${2 * r} ${2 * r}">\n`
      + `  <title>${esc(title || '')}</title>\n`
      + '  <g id="guide" fill="none" stroke="#ff0000" stroke-width="0.02">\n'
      + `    <circle cx="0" cy="0" r="${r}"/>\n`
      + `    <circle cx="0" cy="${g.holeY}" r="${g.holeR}"/>\n`
      + '  </g>\n'
      + '  <g id="engraving">\n'
      + `    ${paths}\n`
      + '  </g>\n'
      + '</svg>\n';
  }

  global.TagRenderer = {
    LAYOUT,
    loadFont,
    loadIcon,
    missingChars,
    fontSizeForCap,
    textCommands,
    points,
    bounds,
    toPathData,
    layoutFront,
    layoutBack,
    previewSvg,
    engravingSvg,
  };
}(window));
