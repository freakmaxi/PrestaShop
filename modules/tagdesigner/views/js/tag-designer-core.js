/**
 * The part of the tag designer shared by the product page (tag-designer.js) and the back office engraving page
 * (tag-engraving-tool.js): the text inputs with their counters, the font and icon pickers and the preview of both
 * sides. A subclass says which size and colour to draw (look()) and calls start() once it is set up.
 *
 * cfg.type "qr": a QR tag, whose back is a pet-id QR code (tag-qr.js) and which has no address fields. Until the
 * tag exists the preview shows a sample code.
 */
(function () {
  'use strict';

  const R = window.TagRenderer;
  const ROLES = ['name', 'icon', 'font', 'line1', 'line2', 'phone'];
  const TEXT_ROLES = ['name', 'line1', 'line2', 'phone'];
  const ENGRAVE = { black: '#1d1d1f', white: '#f5f5f2' };

  function storage() {
    try {
      return window.sessionStorage;
    } catch (e) {
      return null;
    }
  }

  function escapeHtml(text) {
    return String(text).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  }

  class TagDesignerForm {
    /**
     * options.saved: role => value to start from; options.max: role => character limit;
     * options.storageKey: keeps a draft in sessionStorage under this key (optional)
     */
    constructor(root, cfg, options) {
      this.root = root;
      this.cfg = cfg;
      this.texts = cfg.texts;
      this.preview = root.querySelector('.js-tag-designer-preview');
      this.status = root.querySelector('.js-tag-status');
      this.inputs = {};
      root.querySelectorAll('.js-tag-input').forEach((input) => {
        this.inputs[input.dataset.role] = input;
      });
      this.counts = {};
      root.querySelectorAll('.js-tag-count').forEach((el) => {
        this.counts[el.dataset.role] = el;
      });

      this.max = options.max || {};
      this.storageKey = options.storageKey || null;
      this.state = Object.assign(
        { name: '', line1: '', line2: '', phone: '', font: cfg.defaults.font, icon: cfg.defaults.icon },
        this.clean(options.saved),
        this.clean(this.readDraft()),
      );

      this.fontButtons = {};
      this.iconButtons = {};
      this.renderToken = 0;
      this.rendering = Promise.resolve();
      this.sampleTimer = null;
      this.sides = null;
      this.fonts = null;

      TEXT_ROLES.forEach((role) => {
        const input = this.inputs[role];
        if (!input) {
          return;
        }
        input.maxLength = this.max[role] || 250;
        input.value = this.state[role];
        input.addEventListener('input', () => this.set(role, input.value));
      });

      this.buildFonts();
      this.buildIcons();
    }

    start() {
      this.updateCounts();
      this.render();
      this.loadAllFonts();
    }

    clean(values) {
      const out = {};
      if (!values || typeof values !== 'object') {
        return out;
      }
      TEXT_ROLES.forEach((role) => {
        if (typeof values[role] === 'string' && values[role] !== '') {
          out[role] = values[role].slice(0, this.max[role] || 250);
        }
      });
      if (this.cfg.fonts.includes(values.font)) {
        out.font = values.font;
      }
      if (this.cfg.icons.includes(values.icon)) {
        out.icon = values.icon;
      }
      return out;
    }

    readDraft() {
      if (!this.storageKey) {
        return null;
      }
      try {
        const store = storage();
        return store ? JSON.parse(store.getItem(this.storageKey) || 'null') : null;
      } catch (e) {
        return null;
      }
    }

    writeDraft() {
      if (!this.storageKey) {
        return;
      }
      try {
        const store = storage();
        if (store) {
          store.setItem(this.storageKey, JSON.stringify(this.state));
        }
      } catch (e) {
        // Private mode or storage full: the draft is only a convenience
      }
    }

    set(role, value) {
      this.state[role] = value;
      this.writeDraft();
      if (role === 'name') {
        this.scheduleSamples();
      }
      if (role === 'font' || role === 'icon') {
        this.markSelected();
      }
      this.updateCounts();
      this.hideStatus();
      this.changed(role);
      this.render();
    }

    // Called after a value changed, for subclasses
    changed() {}

    url(kind, code) {
      return `${this.cfg.assets}views/${kind === 'font' ? `fonts/${code}.woff` : `icons/${code}.svg`}`;
    }

    // --- Pickers ---

    buildFonts() {
      const box = this.root.querySelector('.js-tag-fonts');
      this.cfg.fonts.forEach((code) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-designer__font';
        button.setAttribute('role', 'radio');
        button.dataset.code = code;
        button.title = code;
        button.innerHTML = `<span class="tag-designer__font-code">${escapeHtml(code)}</span><span class="tag-designer__font-sample"></span>`;
        button.addEventListener('click', () => {
          if (!button.disabled) {
            this.set('font', code);
          }
        });
        box.appendChild(button);
        this.fontButtons[code] = button;
      });
      this.markSelected();
    }

    buildIcons() {
      const box = this.root.querySelector('.js-tag-icons');
      this.cfg.icons.forEach((code) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-designer__icon';
        button.setAttribute('role', 'radio');
        button.dataset.code = code;
        button.title = code;
        button.innerHTML = `<img src="${escapeHtml(this.url('icon', code))}" alt="${escapeHtml(code)}" width="40" height="40" loading="lazy">`;
        button.addEventListener('click', () => this.set('icon', code));
        box.appendChild(button);
        this.iconButtons[code] = button;
      });
      this.markSelected();
    }

    markSelected() {
      [[this.fontButtons, this.state.font], [this.iconButtons, this.state.icon]].forEach(([buttons, selected]) => {
        Object.entries(buttons).forEach(([code, button]) => {
          const on = code === selected;
          button.classList.toggle('is-selected', on);
          button.setAttribute('aria-checked', on ? 'true' : 'false');
        });
      });
    }

    loadAllFonts() {
      // The selected font first (the preview needs it), then the others for the picker
      const order = [this.state.font, ...this.cfg.fonts.filter((code) => code !== this.state.font)];
      order.reduce((chain, code) => chain.then(() => R.loadFont(this.url('font', code))
        .then((font) => this.renderSample(code, font))
        .catch(() => this.fontButtons[code].classList.add('is-failed'))), Promise.resolve());
    }

    scheduleSamples() {
      window.clearTimeout(this.sampleTimer);
      this.sampleTimer = window.setTimeout(() => {
        this.cfg.fonts.forEach((code) => {
          R.loadFont(this.url('font', code)).then((font) => this.renderSample(code, font)).catch(() => {});
        });
      }, 150);
    }

    renderSample(code, font) {
      const button = this.fontButtons[code];
      const text = this.state.name.trim() || this.texts.nameGhost;
      const missing = R.missingChars(font, text);
      button.disabled = missing !== '';
      button.classList.toggle('is-unavailable', missing !== '');
      button.title = missing ? this.texts.fontMissing.replace('%chars%', missing) : code;

      const commands = R.textCommands(font, text, 100);
      const pts = R.points(commands);
      const sample = button.querySelector('.tag-designer__font-sample');
      if (!pts.length) {
        sample.innerHTML = '';
        return;
      }
      const b = R.bounds(pts);
      const pad = 6;
      sample.innerHTML = `<svg viewBox="${b.x0 - pad} ${b.y0 - pad} ${b.x1 - b.x0 + 2 * pad} ${b.y1 - b.y0 + 2 * pad}" aria-hidden="true"><path d="${R.toPathData(commands)}"/></svg>`;
    }

    updateCounts() {
      TEXT_ROLES.forEach((role) => {
        if (this.counts[role]) {
          this.counts[role].textContent = `${Array.from(this.state[role]).length} / ${this.max[role] || 250}`;
        }
      });
    }

    // --- Preview ---

    // What to draw for a size and a colour attribute id: { diameter, largest, tag, engrave }
    lookFor(sizeId, colourId) {
      const sizes = this.cfg.sizes;
      const diameters = Object.values(sizes);
      const diameter = sizes[sizeId] || diameters[0] || 25;
      const colour = this.cfg.colours[colourId] || { hex: '#b0b4ba', white: false };
      return {
        diameter,
        largest: Math.max(diameter, ...diameters),
        tag: colour.hex,
        engrave: colour.white ? ENGRAVE.white : ENGRAVE.black,
        white: Boolean(colour.white),
      };
    }

    look() {
      return this.lookFor(null, null);
    }

    isQr() {
      return this.cfg.type === 'qr';
    }

    // The pet-id tag of the back ({ id, url }), null for the sample code
    qrTag() {
      return null;
    }

    render() {
      const token = ++this.renderToken;
      const look = this.look();
      const s = this.state;
      const qr = this.isQr();
      this.rendering = Promise.all([
        R.loadFont(this.url('font', s.font)),
        R.loadFont(this.url('font', this.cfg.backFont)),
        R.loadIcon(this.url('icon', s.icon)),
        qr ? window.TagQr.loadLogo(this.cfg.assets) : null,
      ]).then(([font, backFont, icon, logo]) => {
        if (token !== this.renderToken) {
          return;
        }
        const front = R.layoutFront({
          diameter: look.diameter, hole: this.cfg.hole, font, name: s.name, nameGhost: this.texts.nameGhost, icon,
        });
        const tag = qr ? this.qrTag() : null;
        const back = qr
          ? window.TagQr.layoutBack({
            diameter: look.diameter,
            hole: this.cfg.hole,
            text: tag && tag.url,
            seed: tag && tag.id,
            sample: !tag,
            negative: look.white,
            logo,
          })
          : R.layoutBack({
            diameter: look.diameter,
            hole: this.cfg.hole,
            font: backFont,
            lines: [s.line1, s.line2],
            phone: s.phone,
            ghost: { lines: [this.texts.line1Ghost, this.texts.line2Ghost], phone: this.texts.phoneGhost },
          });
        this.preview.querySelector('.js-tag-front').innerHTML = R.previewSvg(front, look);
        this.preview.querySelector('.js-tag-back').innerHTML = R.previewSvg(back, look);
        // The smaller tag is drawn smaller, so the two sizes compare
        this.preview.style.setProperty('--tag-scale', String(look.diameter / look.largest));
        this.preview.querySelector('.js-tag-size').textContent = `Ø ${String(look.diameter).replace('.', ',')} mm`;
        this.fonts = { front: font, back: backFont };
        this.sides = { front, back, diameter: look.diameter, logo };
      }).catch(() => {
        if (token === this.renderToken) {
          this.showStatus([this.texts.saveFailed]);
        }
      });
      return this.rendering;
    }

    validate() {
      const errors = [];
      const s = this.state;
      if (!s.name.trim()) {
        errors.push(this.texts.nameRequired);
      }
      if (this.fonts) {
        const front = R.missingChars(this.fonts.front, s.name);
        if (front) {
          errors.push(this.texts.fontMissing.replace('%chars%', front));
        }
        const back = this.isQr() ? '' : R.missingChars(this.fonts.back, [s.line1, s.line2, s.phone].join(''));
        if (back) {
          errors.push(this.texts.backMissing.replace('%chars%', back));
        }
      }
      return errors;
    }

    showStatus(messages, kind) {
      this.status.classList.toggle('alert-danger', kind !== 'info');
      this.status.classList.toggle('alert-info', kind === 'info');
      this.status.innerHTML = messages.length > 1
        ? `<ul class="mb-0">${messages.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`
        : escapeHtml(messages[0] || '');
      this.status.hidden = false;
      if (kind !== 'info') {
        this.status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    hideStatus() {
      this.status.hidden = true;
    }
  }

  TagDesignerForm.ROLES = ROLES;
  window.TagDesignerForm = TagDesignerForm;
}());
