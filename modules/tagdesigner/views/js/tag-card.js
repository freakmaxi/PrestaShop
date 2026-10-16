/**
 * Access card of a QR tag: a black aluminium business card (85.6 x 54 mm), engraved on both sides. Engraving
 * shows the bare silver metal, so text, logo and symbols are engraved and the QR code is engraved in negative:
 * its modules stay black on a silver square.
 *
 * - front: the House of Leo logo and name, "Pet ID · Access card", the pet's name in its font with its icon,
 *   the three steps of editing the pet's page, and the access key as a square QR code
 * - back: whom to contact with which order number when the tag or the card is lost
 *
 * Never the tag's hol.red link: with the tag and the card apart, finding one is not enough to edit the page.
 * The texts follow the order's language (English or German). Millimetres, origin at the top left corner.
 */
(function (global) {
  'use strict';

  const R = global.TagRenderer;
  const Q = global.TagQr;

  const CARD = { width: 85.6, height: 54, radius: 3.18 };

  const TEXTS = {
    en: {
      title: 'PET ID · ACCESS CARD',
      steps: ['Scan the tag', 'Tap the person icon', 'Scan this card'],
      keep: 'Keep this card safe',
      lost: 'Lost your pet\'s tag or this card?',
      contact: 'Contact us with your order number:',
      order: 'Order %s',
    },
    de: {
      title: 'PET ID · ZUGANGSKARTE',
      steps: ['Marke scannen', 'Personen-Symbol antippen', 'Diese Karte scannen'],
      keep: 'Bewahren Sie diese Karte sicher auf',
      lost: 'Marke oder Karte verloren?',
      contact: 'Schreiben Sie uns mit Ihrer Bestellnummer:',
      order: 'Bestellung %s',
    },
  };
  const LANGUAGES = Object.keys(TEXTS);
  const BRAND = 'HOUSE OF LEO';
  const SITE = 'houseofleo.de';

  // --- Placing paths ---

  function move(commands, map) {
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

  // Letters with extra space between them (tracking in em)
  function trackedCommands(font, text, size, tracking) {
    if (!tracking) {
      return R.textCommands(font, text, size);
    }
    const scale = size / font.unitsPerEm;
    const glyphs = font.stringToGlyphs(text);
    const commands = [];
    let x = 0;
    glyphs.forEach((glyph, i) => {
      commands.push(...glyph.getPath(x, 0, size).commands);
      x += glyph.advanceWidth * scale + tracking * size;
      if (i < glyphs.length - 1) {
        x += font.getKerningValue(glyph, glyphs[i + 1]) * scale;
      }
    });
    return commands;
  }

  // Characters the font cannot draw are left out (a missing "·" must not become an empty box)
  function drawable(font, text) {
    const missing = R.missingChars(font, text);
    return missing ? Array.from(text).filter((ch) => !missing.includes(ch)).join('').replace(/\s{2,}/g, ' ') : text;
  }

  /**
   * One line of text on its baseline, shrunk to fit width. align: left (x is the start), center or right.
   */
  function line(font, text, { x, baseline, cap, width, align = 'left', tracking = 0 }) {
    const commands = trackedCommands(font, drawable(font, text), R.fontSizeForCap(font, cap), tracking);
    const pts = R.points(commands);
    if (!pts.length) {
      return [];
    }
    const b = R.bounds(pts);
    const s = Math.min(1, width / (b.x1 - b.x0));
    const w = (b.x1 - b.x0) * s;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    return [{ kind: 'engrave', commands: move(commands, (px, py) => [left + (px - b.x0) * s, baseline + py * s]) }];
  }

  // Paths (loadIcon() format) scaled to fit a box, centred in it
  function inBox(paths, box) {
    const all = [];
    paths.forEach((path) => all.push(...R.points(path.commands)));
    if (!all.length) {
      return [];
    }
    const b = R.bounds(all);
    const s = Math.min(box.w / (b.x1 - b.x0), box.h / (b.y1 - b.y0));
    const dx = box.x + (box.w - (b.x1 - b.x0) * s) / 2;
    const dy = box.y + (box.h - (b.y1 - b.y0) * s) / 2;
    return paths.map((path) => ({
      kind: path.bare ? 'bare' : 'engrave',
      commands: move(path.commands, (px, py) => [dx + (px - b.x0) * s, dy + (py - b.y0) * s]),
    }));
  }

  // --- Symbols of the steps, in a unit box: one even-odd path each ---

  const SYMBOLS = {
    // The tag: a disc with its ring hole
    tag: () => [Q.circle(0.5, 0.5, 0.48), Q.circle(0.5, 0.17, 0.09)],
    // The person icon of the pet-id page
    person: () => [Q.circle(0.5, 0.27, 0.22), Q.roundedRect(0.1, 0.56, 0.8, 0.44, 0.2)],
    // This card: its outline and a small code
    card: () => [
      Q.roundedRect(0, 0.18, 1, 0.64, 0.1),
      Q.roundedRect(0.08, 0.26, 0.84, 0.48, 0.05),
      Q.roundedRect(0.56, 0.34, 0.28, 0.32, 0.03),
    ],
  };

  function symbol(name, x, y, size) {
    const commands = [];
    SYMBOLS[name]().forEach((contour) => commands.push(...move(contour, (px, py) => [x + px * size, y + py * size])));
    return { kind: 'engrave', evenodd: true, commands };
  }

  // --- The access key as a negative square code ---

  function code(text, logo, x, y, side) {
    const square = Q.squareCode(text, logo);
    const q = Q.STYLE.quiet;
    const total = square.size + 2 * q;
    const s = side / total;
    const map = (px, py) => [x + (px + q) * s, y + (py + q) * s];
    const commands = [];
    // The silver square around the code (with its quiet zone), the modules left black
    [Q.roundedRect(-q, -q, total, total, 3), ...square.contours].forEach((contour) => commands.push(...move(contour, map)));
    return { kind: 'engrave', evenodd: true, commands };
  }

  /**
   * spec: { lang, name, accessKey, reference, font (pet name), textFont, icon (loadIcon), logo (loadLogo) }
   */
  function layoutFront(spec) {
    const t = TEXTS[spec.lang] || TEXTS.en;
    const shapes = [];

    // Brand: the logo with the name and the card's title beside it
    shapes.push(...inBox(spec.logo, { x: 4, y: 4, w: 7, h: 7.5 }));
    shapes.push(...line(spec.textFont, BRAND, { x: 12.4, baseline: 7.9, cap: 2.6, width: 29.6, tracking: 0.12 }));
    shapes.push(...line(spec.textFont, t.title, { x: 12.4, baseline: 11.4, cap: 1.45, width: 29.6, tracking: 0.08 }));

    // The pet: its icon and its name, as on the front of the tag
    if (spec.icon) {
      shapes.push(...inBox(spec.icon, { x: 4, y: 16.5, w: 11, h: 11 }));
    }
    if (spec.font && spec.name) {
      const commands = R.textCommands(spec.font, spec.name.trim(), R.fontSizeForCap(spec.font, 6));
      const pts = R.points(commands);
      if (pts.length) {
        const b = R.bounds(pts);
        // As large as the box allows, whatever the font's own proportions
        const box = { x: 17.5, y: 17, w: 24.5, h: 10 };
        const s = Math.min(box.w / (b.x1 - b.x0), box.h / (b.y1 - b.y0));
        const dx = box.x + (box.w - (b.x1 - b.x0) * s) / 2;
        const dy = box.y + (box.h - (b.y1 - b.y0) * s) / 2;
        shapes.push({ kind: 'engrave', commands: move(commands, (px, py) => [dx + (px - b.x0) * s, dy + (py - b.y0) * s]) });
      }
    }

    // How to edit the pet's page
    ['tag', 'person', 'card'].forEach((name, i) => {
      const baseline = 35.5 + i * 4.6;
      shapes.push(...line(spec.textFont, String(i + 1), { x: 4, baseline, cap: 1.6, width: 2 }));
      shapes.push(symbol(name, 6.3, baseline - 2.75, 3.3));
      shapes.push(...line(spec.textFont, t.steps[i], { x: 10.8, baseline, cap: 1.6, width: 31.2 }));
    });
    shapes.push(...line(spec.textFont, t.keep, { x: 4, baseline: 50, cap: 1.35, width: 38 }));

    // The access key
    shapes.push(code(spec.accessKey, spec.logo, 45.6, 9, 36));

    return Object.assign({ side: 'front', lang: spec.lang }, CARD, { shapes });
  }

  function layoutBack(spec) {
    const t = TEXTS[spec.lang] || TEXTS.en;
    const mid = CARD.width / 2;
    const width = CARD.width - 8;
    const shapes = [];
    shapes.push(...inBox(spec.logo, { x: mid - 6, y: 5, w: 12, h: 12 }));
    shapes.push(...line(spec.textFont, BRAND, { x: mid, baseline: 23, cap: 3, width, align: 'center', tracking: 0.15 }));
    shapes.push(...line(spec.textFont, t.lost, { x: mid, baseline: 30.5, cap: 2, width, align: 'center' }));
    shapes.push(...line(spec.textFont, t.contact, { x: mid, baseline: 35, cap: 1.6, width, align: 'center' }));
    shapes.push(...line(spec.textFont, t.order.replace('%s', spec.reference), { x: mid, baseline: 41, cap: 2.4, width, align: 'center' }));
    shapes.push(...line(spec.textFont, SITE, { x: mid, baseline: 49, cap: 1.7, width, align: 'center' }));
    return Object.assign({ side: 'back', lang: spec.lang }, CARD, { shapes });
  }

  // --- SVG ---

  const LOOK = { card: '#26262a', engrave: '#d4d6da' };

  function esc(text) {
    return String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  function outline(card) {
    return `x="0" y="0" width="${card.width}" height="${card.height}" rx="${card.radius}"`;
  }

  function rule(shape) {
    return shape.evenodd ? ' fill-rule="evenodd"' : '';
  }

  function previewSvg(card) {
    const paths = card.shapes.map((shape) => (
      `<path d="${R.toPathData(shape.commands)}" fill="${shape.kind === 'bare' ? LOOK.card : LOOK.engrave}"${rule(shape)}/>`
    )).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 ${card.width + 1} ${card.height + 1}" role="img">`
      + `<rect ${outline(card)} fill="${LOOK.card}"/>`
      + paths
      + '</svg>';
  }

  // Engraving file: real size in mm, engraved black, the card outline in the "guide" group (as the tags)
  function engravingSvg(card, title) {
    const paths = card.shapes.map((shape) => (
      `<path d="${R.toPathData(shape.commands, true)}" fill="${shape.kind === 'bare' ? '#ffffff' : '#000000'}"${rule(shape)}/>`
    )).join('\n    ');
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<svg xmlns="http://www.w3.org/2000/svg" width="${card.width}mm" height="${card.height}mm" viewBox="0 0 ${card.width} ${card.height}">\n`
      + `  <title>${esc(title || '')}</title>\n`
      + '  <g id="guide" fill="none" stroke="#ff0000" stroke-width="0.02">\n'
      + `    <rect ${outline(card)}/>\n`
      + '  </g>\n'
      + '  <g id="engraving">\n'
      + `    ${paths}\n`
      + '  </g>\n'
      + '</svg>\n';
  }

  global.TagCard = { CARD, TEXTS, LANGUAGES, layoutFront, layoutBack, previewSvg, engravingSvg };
}(window));
