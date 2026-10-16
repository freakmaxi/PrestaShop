/**
 * QR codes of the pet-id tags, in the House of Leo style of tools/generate-qr.js (rounded dots, rounded finder
 * patterns, the logo in the middle, error correction H):
 *
 * - back of the QR tag: the code made round like tools/circle-qr.js, the space around it filled with dots that
 *   look like more code. The filling comes from the tag id, so every download of a tag gives the same file.
 *   Light tags engrave the code, dark ones everything around it (negative), so the code stays dark and readable.
 * - access card: the plain square code of the access key on a business card.
 *
 * Sides use the shapes of tag-renderer.js (millimetres, centre at 0, 0); the code is one even-odd path.
 */
(function (global) {
  'use strict';

  const R = global.TagRenderer;

  // Proportions of the reference design, in modules (one module = 469.221 in tools/generate-qr.js)
  const STYLE = {
    unit: 469.221, // logo units per module (views/img/qr-logo.svg)
    dot: 422.301 / 469.221,
    dotRadius: 115.742 / 469.221,
    finderRadii: [656.908 / 469.221, 469.221 / 469.221, 347.221 / 469.221], // 7, 5 and 3 modules wide
    quiet: 4, // modules of quiet zone around the code, filled with dots on the round code
    logoMargin: { x: 0.5, y: 0.25 }, // modules between the logo and the nearest dot
    density: 0.48, // share of the filling cells with a dot
  };

  const LAYOUT = {
    tagMargin: 0, // mm between the tag edge and the round code: none, the code covers the whole back
    card: { width: 85.6, height: 54, radius: 3.18 }, // mm, ISO/IEC 7810 ID-1
    cardCode: 40, // mm, the square code with its quiet zone
  };

  // Shown on the product page and before a tag has its code: an unknown hol.red code redirects to the shop
  const SAMPLE = 'https://hol.red/xxxxxx';

  const KAPPA = 0.5522847;
  const CLIP_STEPS = 2880; // the circle as a polygon when a dot is cut by the edge

  // --- QR matrix ---

  function matrix(text) {
    const qr = global.QRCodeCore.create(text, { errorCorrectionLevel: 'H' });
    const { size, data } = qr.modules;
    return { size, dark: (col, row) => data[row * size + col] === 1 };
  }

  // --- Random filling: the same for the same seed ---

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function random(seed) {
    let a = hash(String(seed));
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Contours, in modules ---

  // Rounded rectangle, clockwise on screen (y down)
  function roundedRect(x, y, w, h, r) {
    const k = r * KAPPA;
    return [
      { type: 'M', x: x + r, y },
      { type: 'L', x: x + w - r, y },
      { type: 'C', x1: x + w - r + k, y1: y, x2: x + w, y2: y + r - k, x: x + w, y: y + r },
      { type: 'L', x: x + w, y: y + h - r },
      { type: 'C', x1: x + w, y1: y + h - r + k, x2: x + w - r + k, y2: y + h, x: x + w - r, y: y + h },
      { type: 'L', x: x + r, y: y + h },
      { type: 'C', x1: x + r - k, y1: y + h, x2: x, y2: y + h - r + k, x, y: y + h - r },
      { type: 'L', x, y: y + r },
      { type: 'C', x1: x, y1: y + r - k, x2: x + r - k, y2: y, x: x + r, y },
      { type: 'Z' },
    ];
  }

  function circle(cx, cy, r) {
    const k = r * KAPPA;
    return [
      { type: 'M', x: cx, y: cy - r },
      { type: 'C', x1: cx + k, y1: cy - r, x2: cx + r, y2: cy - k, x: cx + r, y: cy },
      { type: 'C', x1: cx + r, y1: cy + k, x2: cx + k, y2: cy + r, x: cx, y: cy + r },
      { type: 'C', x1: cx - k, y1: cy + r, x2: cx - r, y2: cy + k, x: cx - r, y: cy },
      { type: 'C', x1: cx - r, y1: cy - k, x2: cx - k, y2: cy - r, x: cx, y: cy - r },
      { type: 'Z' },
    ];
  }

  function dot(col, row) {
    const inset = (1 - STYLE.dot) / 2;
    return roundedRect(col + inset, row + inset, STYLE.dot, STYLE.dot, STYLE.dotRadius);
  }

  function finderOrigins(size) {
    return [[0, 0], [size - 7, 0], [0, size - 7]];
  }

  // Endpoints only, like tools/generate-qr.js measures the logo
  function endpointBounds(paths) {
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    paths.forEach((path) => path.commands.forEach((c) => {
      if (c.type !== 'Z') {
        box.x0 = Math.min(box.x0, c.x);
        box.y0 = Math.min(box.y0, c.y);
        box.x1 = Math.max(box.x1, c.x);
        box.y1 = Math.max(box.y1, c.y);
      }
    }));
    return box;
  }

  /**
   * The square code: { size, contours } in modules, the grid from (0, 0) to (size, size). Every closed contour is
   * a boundary between dark and light, so the code is drawn with the even-odd rule. logo: loadIcon() result.
   */
  function squareCode(text, logo) {
    const m = matrix(text);
    const n = m.size;
    const contours = [];

    finderOrigins(n).forEach(([x, y]) => {
      STYLE.finderRadii.forEach((radius, i) => {
        contours.push(roundedRect(x + i, y + i, 7 - 2 * i, 7 - 2 * i, radius));
      });
    });

    // The logo in the middle, in modules; the dots it would touch are left out
    let zone = null;
    if (logo) {
      const scale = 1 / STYLE.unit;
      const placed = logo.map((path) => ({
        commands: path.commands.map((c) => {
          const out = { type: c.type };
          ['', '1', '2'].forEach((suffix) => {
            if (c[`x${suffix}`] !== undefined) {
              out[`x${suffix}`] = n / 2 + c[`x${suffix}`] * scale;
              out[`y${suffix}`] = n / 2 + c[`y${suffix}`] * scale;
            }
          });
          return out;
        }),
      }));
      const box = endpointBounds(placed);
      zone = {
        x0: box.x0 - STYLE.logoMargin.x,
        x1: box.x1 + STYLE.logoMargin.x,
        y0: box.y0 - STYLE.logoMargin.y,
        y1: box.y1 + STYLE.logoMargin.y,
      };
      placed.forEach((path) => contours.push(path.commands));
    }

    const inset = (1 - STYLE.dot) / 2;
    const inFinder = (col, row) => finderOrigins(n).some(([x, y]) => col >= x && col < x + 7 && row >= y && row < y + 7);
    const inLogo = (col, row) => zone !== null
      && col + inset + STYLE.dot > zone.x0 && col + inset < zone.x1
      && row + inset + STYLE.dot > zone.y0 && row + inset < zone.y1;
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        if (m.dark(col, row) && !inFinder(col, row) && !inLogo(col, row)) {
          contours.push(dot(col, row));
        }
      }
    }

    return { size: n, contours };
  }

  // --- Round code ---

  // A dot polygon cut by the circle (convex shapes: Sutherland-Hodgman against the nearby edges of the circle)
  function clipToCircle(commands, cx, cy, radius) {
    let poly = [];
    let from = null;
    commands.forEach((c) => {
      if (c.type === 'M' || c.type === 'L') {
        poly.push([c.x, c.y]);
      } else if (c.type === 'C') {
        for (let i = 1; i <= 6; i += 1) {
          const t = i / 6;
          const u = 1 - t;
          poly.push([
            u * u * u * from.x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            u * u * u * from.y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          ]);
        }
      }
      if (c.type !== 'Z') {
        from = c;
      }
    });
    if (poly.length > 1) {
      const [ax, ay] = poly[0];
      const [bx, by] = poly[poly.length - 1];
      if (Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9) {
        poly.pop();
      }
    }

    const centreX = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const centreY = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const angle = Math.atan2(centreY - cy, centreX - cx);
    const reach = (4 * STYLE.dot) / radius; // wider than the dot seen from the centre
    const step = (2 * Math.PI) / CLIP_STEPS;
    const first = Math.floor((angle - reach) / step);
    const last = Math.ceil((angle + reach) / step);
    const vertex = (i) => [cx + radius * Math.cos(i * step), cy + radius * Math.sin(i * step)];

    for (let i = first; i < last && poly.length; i += 1) {
      const [ex0, ey0] = vertex(i);
      const [ex1, ey1] = vertex(i + 1);
      // Inside is to the left of the edge going round the circle (positive angles turn towards +y)
      const side = ([x, y]) => (ex1 - ex0) * (y - ey0) - (ey1 - ey0) * (x - ex0);
      const out = [];
      poly.forEach((p, k) => {
        const q = poly[(k + 1) % poly.length];
        const sp = side(p);
        const sq = side(q);
        if (sp >= 0) {
          out.push(p);
        }
        if ((sp >= 0) !== (sq >= 0)) {
          const t = sp / (sp - sq);
          out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      });
      poly = out;
    }
    if (poly.length < 3) {
      return null;
    }
    return [
      ...poly.map(([x, y], i) => ({ type: i ? 'L' : 'M', x, y })),
      { type: 'Z' },
    ];
  }

  /**
   * The round code: the square code with its quiet zone, inside the circle through its corners. Cells outside the
   * code get dots at random (seeded), except the ring of one module around the finder patterns; dots on the edge
   * are cut by the circle. Returns { radius, cx, cy, contours } in modules.
   */
  function roundCode(text, logo, seed) {
    const code = squareCode(text, logo);
    const n = code.size;
    const side = n + 2 * STYLE.quiet;
    const radius = (side * Math.SQRT2) / 2;
    const cx = n / 2;
    const cy = n / 2;
    const next = random(seed);
    const contours = code.contours.slice();

    const nearFinder = (col, row) => finderOrigins(n).some(([x, y]) => col >= x - 1 && col <= x + 7 && row >= y - 1 && row <= y + 7);
    const reach = Math.ceil(radius - n / 2) + 1;
    const outside = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 > radius * radius;
    for (let row = -reach; row < n + reach; row += 1) {
      for (let col = -reach; col < n + reach; col += 1) {
        if (col >= 0 && col < n && row >= 0 && row < n) {
          continue;
        }
        // One draw per cell, so the pattern does not depend on the cells skipped before it
        const pick = next() < STYLE.density;
        if (!pick || nearFinder(col, row) || outside(col + 0.5, row + 0.5)) {
          continue;
        }
        const commands = dot(col, row);
        const corners = [[col, row], [col + 1, row], [col, row + 1], [col + 1, row + 1]];
        if (corners.some(([x, y]) => outside(x, y))) {
          const clipped = clipToCircle(commands, cx, cy, radius);
          if (clipped) {
            contours.push(clipped);
          }
        } else {
          contours.push(commands);
        }
      }
    }

    return { radius, cx, cy, contours };
  }

  function mapContours(contours, map) {
    const out = [];
    contours.forEach((commands) => {
      commands.forEach((c) => {
        const p = { type: c.type };
        if (c.type !== 'Z') {
          [p.x, p.y] = map(c.x, c.y);
        }
        if (c.type === 'C') {
          [p.x1, p.y1] = map(c.x1, c.y1);
          [p.x2, p.y2] = map(c.x2, c.y2);
        }
        out.push(p);
      });
    });
    return out;
  }

  /**
   * Back of a QR tag, as a side for TagRenderer.previewSvg() / engravingSvg().
   *
   * spec: { diameter, hole, text (the hol.red link), seed (the tag id), negative (dark tag), logo, sample }
   */
  function layoutBack(spec) {
    const code = roundCode(spec.text || SAMPLE, spec.logo, spec.seed || 'sample');
    const r = spec.diameter / 2 - LAYOUT.tagMargin;
    const scale = r / code.radius;
    const map = (x, y) => [(x - code.cx) * scale, (y - code.cy) * scale];
    const contours = spec.negative ? [circle(code.cx, code.cy, code.radius), ...code.contours] : code.contours;
    return {
      diameter: spec.diameter,
      hole: spec.hole,
      shapes: [{ kind: spec.sample ? 'sample' : 'engrave', evenodd: true, commands: mapContours(contours, map) }],
    };
  }

  /**
   * Access card: the square code of the access key in the middle of the card. Returns { width, height, radius,
   * shapes } in mm, centre at (0, 0).
   */
  function layoutCard(spec) {
    const code = squareCode(spec.text, spec.logo);
    const side = code.size + 2 * STYLE.quiet;
    const scale = LAYOUT.cardCode / side;
    const map = (x, y) => [(x - code.size / 2) * scale, (y - code.size / 2) * scale];
    return {
      width: LAYOUT.card.width,
      height: LAYOUT.card.height,
      radius: LAYOUT.card.radius,
      shapes: [{ kind: 'engrave', evenodd: true, commands: mapContours(code.contours, map) }],
    };
  }

  function esc(text) {
    return String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  function cardRect(card) {
    return `x="${-card.width / 2}" y="${-card.height / 2}" width="${card.width}" height="${card.height}" rx="${card.radius}"`;
  }

  function cardPreviewSvg(card) {
    const pad = 0.6;
    const paths = card.shapes.map((shape) => `<path d="${R.toPathData(shape.commands)}" fill="#1d1d1f" fill-rule="evenodd"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-card.width / 2 - pad} ${-card.height / 2 - pad} ${card.width + 2 * pad} ${card.height + 2 * pad}" role="img">`
      + `<rect ${cardRect(card)} fill="#c9ccd1" stroke="#000" stroke-opacity="0.2" stroke-width="0.2"/>`
      + paths
      + '</svg>';
  }

  // Engraving file of the card: real size in mm; the card outline is in the "guide" group, like the tags
  function cardEngravingSvg(card, title) {
    const paths = card.shapes.map((shape) => `<path d="${R.toPathData(shape.commands, true)}" fill="#000000" fill-rule="evenodd"/>`).join('\n    ');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<svg xmlns="http://www.w3.org/2000/svg" width="${card.width}mm" height="${card.height}mm" viewBox="${-card.width / 2} ${-card.height / 2} ${card.width} ${card.height}">\n`
      + `  <title>${esc(title || '')}</title>\n`
      + '  <g id="guide" fill="none" stroke="#ff0000" stroke-width="0.02">\n'
      + `    <rect ${cardRect(card)}/>\n`
      + '  </g>\n'
      + '  <g id="engraving">\n'
      + `    ${paths}\n`
      + '  </g>\n'
      + '</svg>\n';
  }

  function loadLogo(assets) {
    return R.loadIcon(`${assets}views/img/qr-logo.svg`);
  }

  global.TagQr = {
    STYLE,
    LAYOUT,
    SAMPLE,
    loadLogo,
    squareCode,
    roundCode,
    layoutBack,
    layoutCard,
    cardPreviewSvg,
    cardEngravingSvg,
  };
}(window));
