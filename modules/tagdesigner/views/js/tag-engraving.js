/**
 * Order page and engraving page history: draws each tag design and makes its engraving files (one SVG per side),
 * with the same layout as the product page preview.
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

      Promise.all([
        R.loadFont(url('font', v.font)),
        R.loadFont(url('font', settings.backFont)),
        R.loadIcon(url('icon', v.icon)),
      ]).then(([font, backFont, icon]) => {
        const sides = {
          front: R.layoutFront({ diameter: design.diameter, hole: settings.hole, font, name: v.name, icon }),
          back: R.layoutBack({
            diameter: design.diameter, hole: settings.hole, font: backFont, lines: [v.line1, v.line2], phone: v.phone,
          }),
        };
        const colour = design.colour || { hex: '#b0b4ba', white: false };
        const look = { tag: colour.hex, engrave: colour.white ? ENGRAVE.white : ENGRAVE.black };
        row.querySelector('.js-tag-engraving-front').innerHTML = R.previewSvg(sides.front, look);
        row.querySelector('.js-tag-engraving-back').innerHTML = R.previewSvg(sides.back, look);

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
