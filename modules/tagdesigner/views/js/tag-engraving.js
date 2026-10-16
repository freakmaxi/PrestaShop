/**
 * Order page and engraving page history: draws each tag design and makes its engraving files (one SVG per side),
 * with the same layout as the product page preview.
 *
 * A QR tag has one pet-id tag per tag ordered: its first download creates it on the server (data.petIdUrl), then
 * its back (the round QR code) and its access card (tag-card.js, both sides) are made from it.
 */
(function () {
  'use strict';

  const R = window.TagRenderer;
  const ENGRAVE = { black: '#1d1d1f', white: '#f5f5f2' };

  function download(name, svg) {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safe(text) {
    return String(text || '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Order lines are numbered (REF-1-front.svg), a design with its own file name is not (Etsy-123-front.svg)
  function fileName(reference, index, side, file) {
    return file ? `${safe(file) || 'engraving'}-${side}.svg` : `${safe(reference) || 'order'}-${index + 1}-${side}.svg`;
  }

  // The pet-id tag of a QR tag, created by the server the first time
  function petIdTag(data, design, unit) {
    const body = new FormData();
    body.append('source', design.file !== undefined ? 'engraving' : 'order');
    body.append('id', String(design.file !== undefined ? design.id : design.line));
    body.append('unit', String(unit));
    return fetch(data.petIdUrl, { method: 'POST', body, credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` })))
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error || 'pet-id tag not created');
        }
        return result.tag;
      });
  }

  function escapeHtml(text) {
    return String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  // The QR tags of a design: one line each with its link and the back and card downloads
  function showQrTags(row, data, design, index, ctx) {
    const box = row.querySelector('.js-tag-qr-units');
    const known = {};
    (design.tags || []).forEach((tag) => {
      known[tag.unit] = tag;
    });
    const count = Math.max(1, design.quantity || 1);
    const name = (unit, side) => fileName(data.reference, index, count > 1 ? `${unit + 1}-${side}` : side, design.file);
    const label = (unit) => (design.file !== undefined ? 'QR' : `Tag ${unit + 1}`);

    const line = (unit) => {
      const tag = known[unit];
      const link = tag ? `<a href="${escapeHtml(tag.url)}" target="_blank" rel="noopener">${escapeHtml(tag.url.replace(/^https:\/\//, ''))}</a>`
        : '<span class="text-muted">not created yet</span>';
      return `<div class="tag-qr-unit" data-unit="${unit}"><span class="tag-qr-unit__label">${label(unit)}:</span> ${link} `
        + `<button type="button" class="btn btn-default btn-outline-secondary btn-sm js-tag-qr-download" data-kind="back">QR back SVG</button> `
        + `<button type="button" class="btn btn-default btn-outline-secondary btn-sm js-tag-qr-download" data-kind="card-front">Card front SVG</button> `
        + `<button type="button" class="btn btn-default btn-outline-secondary btn-sm js-tag-qr-download" data-kind="card-back">Card back SVG</button></div>`;
    };
    const draw = () => {
      box.innerHTML = Array.from({ length: count }, (_, unit) => line(unit)).join('');
    };
    draw();

    box.addEventListener('click', (event) => {
      const button = event.target.closest('.js-tag-qr-download');
      if (!button) {
        return;
      }
      const unit = parseInt(button.closest('.tag-qr-unit').dataset.unit, 10);
      const kind = button.dataset.kind;
      button.disabled = true;
      ctx.error.hidden = true;
      const made = known[unit] ? Promise.resolve(known[unit]) : petIdTag(data, design, unit);
      made.then((tag) => {
        const first = !known[unit];
        known[unit] = tag;
        const what = `${design.file || `${data.reference} #${index + 1}`}${count > 1 ? ` tag ${unit + 1}` : ''}`;
        if (kind === 'card-front' || kind === 'card-back') {
          const spec = {
            lang: design.lang,
            name: design.values.name,
            accessKey: tag.accessKey,
            reference: design.file || data.reference,
            font: ctx.font,
            textFont: ctx.backFont,
            icon: ctx.icon,
            logo: ctx.logo,
          };
          const front = kind === 'card-front';
          const card = front ? window.TagCard.layoutFront(spec) : window.TagCard.layoutBack(spec);
          download(name(unit, kind), window.TagCard.engravingSvg(card, `${what} access card ${front ? 'front' : 'back'} (${design.lang}): ${design.values.name}`));
        } else {
          const side = window.TagQr.layoutBack({
            diameter: design.diameter, hole: ctx.settings.hole, text: tag.url, seed: tag.id, negative: ctx.white, logo: ctx.logo,
          });
          download(name(unit, 'back'), R.engravingSvg(side, `${what} back: ${tag.url} (${design.diameter} mm)`));
          if (unit === 0) {
            row.querySelector('.js-tag-engraving-back').innerHTML = R.previewSvg(side, ctx.look);
          }
        }
        if (first) {
          draw();
        }
      }).catch((e) => {
        ctx.error.textContent = `Could not make the QR code: ${e.message}`;
        ctx.error.hidden = false;
      }).finally(() => {
        button.disabled = false;
      });
    });
  }

  function show(box, data) {
    const settings = data.settings;
    const url = (kind, code) => `${settings.assets}views/${kind === 'font' ? `fonts/${code}.woff` : `icons/${code}.svg`}`;

    box.querySelectorAll('.js-tag-engraving-design').forEach((row) => {
      const index = parseInt(row.dataset.index, 10);
      const design = data.designs[index];
      const v = design.values;
      const error = row.querySelector('.js-tag-engraving-error');
      if (!design.diameter) {
        error.textContent = 'The size of this combination is not set in the module settings.';
        error.hidden = false;
        return;
      }

      const qr = design.type === 'qr';
      Promise.all([
        R.loadFont(url('font', v.font)),
        R.loadFont(url('font', settings.backFont)),
        R.loadIcon(url('icon', v.icon)),
        qr ? window.TagQr.loadLogo(settings.assets) : null,
      ]).then(([font, backFont, icon, logo]) => {
        const colour = design.colour || { hex: '#b0b4ba', white: false };
        const look = { tag: colour.hex, engrave: colour.white ? ENGRAVE.white : ENGRAVE.black };
        const first = qr && design.tags && design.tags[0];
        const sides = {
          front: R.layoutFront({ diameter: design.diameter, hole: settings.hole, font, name: v.name, icon }),
          back: qr
            ? window.TagQr.layoutBack({
              diameter: design.diameter,
              hole: settings.hole,
              text: first && first.url,
              seed: first && first.id,
              sample: !first,
              negative: Boolean(colour.white),
              logo,
            })
            : R.layoutBack({
              diameter: design.diameter, hole: settings.hole, font: backFont, lines: [v.line1, v.line2], phone: v.phone,
            }),
        };
        row.querySelector('.js-tag-engraving-front').innerHTML = R.previewSvg(sides.front, look);
        row.querySelector('.js-tag-engraving-back').innerHTML = R.previewSvg(sides.back, look);
        if (qr) {
          showQrTags(row, data, design, index, {
            settings, logo, look, white: Boolean(colour.white), error, font, backFont, icon,
          });
        }

        row.querySelectorAll('.js-tag-engraving-download').forEach((button) => {
          const side = button.dataset.side;
          button.disabled = false;
          button.addEventListener('click', () => {
            const title = `${design.file || `${data.reference} #${index + 1}`} ${side}: ${v.name} (${design.diameter} mm)`;
            download(fileName(data.reference, index, side, design.file), R.engravingSvg(sides[side], title));
          });
        });
      }).catch((e) => {
        error.textContent = `Could not draw this design: ${e.message}`;
        error.hidden = false;
      });
    });
  }

  window.TagEngraving = { download, fileName };

  function init() {
    if (!R || !window.opentype) {
      return;
    }
    document.querySelectorAll('.js-tag-engraving').forEach((box) => {
      show(box, JSON.parse(box.querySelector('.js-tag-engraving-data').textContent));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
