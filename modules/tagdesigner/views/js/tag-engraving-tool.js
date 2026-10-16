/**
 * Back office engraving page: the shop's designer (tag-designer-core.js) for tags sold elsewhere. Size and colour
 * come from the page's own inputs; the design is downloaded right away or saved to the history with the form.
 * A QR tag has no address; its QR back and access card are downloaded from the history, once it is saved.
 */
(function () {
  'use strict';

  const Form = window.TagDesignerForm;
  const R = window.TagRenderer;

  class EngravingTool extends Form {
    constructor(root, cfg) {
      super(root, cfg, { saved: cfg.values, max: cfg.max });
      this.form = root.closest('form');
      this.reference = root.querySelector('.js-tag-reference');

      root.addEventListener('change', (event) => {
        if (event.target.matches('.js-tag-look')) {
          this.hideStatus();
          this.render();
        } else if (event.target.matches('.js-tag-type')) {
          this.setType(event.target.value);
        }
      });
      root.querySelectorAll('.js-tag-tool-download').forEach((button) => {
        button.addEventListener('click', () => this.download(button.dataset.side));
      });
      this.form.addEventListener('submit', (event) => {
        const errors = this.validate();
        if (errors.length) {
          event.preventDefault();
          this.showStatus(errors);
        }
      });

      this.changed('font');
      this.changed('icon');
      this.start();
    }

    setType(type) {
      this.cfg.type = type;
      this.root.querySelectorAll('.js-tag-address-only').forEach((el) => {
        el.hidden = type === 'qr';
      });
      this.root.querySelectorAll('.js-tag-qr-only').forEach((el) => {
        el.hidden = type !== 'qr';
      });
      this.hideStatus();
      this.render();
    }

    // The QR code of the design being edited, once made; a sample before
    qrTag() {
      return this.cfg.qrTag || null;
    }

    // The pickers are buttons: the chosen codes go with the form in hidden inputs
    changed(role) {
      const input = this.form.querySelector(`input[type="hidden"][name="${role}"]`);
      if (input) {
        input.value = this.state[role];
      }
    }

    look() {
      const size = this.root.querySelector('.js-tag-look[name="size"]');
      const colour = this.root.querySelector('.js-tag-look[name="colour"]:checked');
      return this.lookFor(size ? size.value : null, colour ? colour.value : null);
    }

    download(side) {
      const errors = this.validate();
      if (errors.length) {
        this.showStatus(errors);
        return;
      }
      this.rendering.then(() => {
        if (!this.sides) {
          return;
        }
        const reference = this.reference.value.trim();
        const title = `${reference} ${side}: ${this.state.name} (${this.sides.diameter} mm)`;
        window.TagEngraving.download(
          window.TagEngraving.fileName('', 0, side, reference || 'engraving'),
          R.engravingSvg(this.sides[side], title),
        );
      });
    }
  }

  function init() {
    const root = document.querySelector('.js-tag-engraving-tool');
    if (!root || !Form || !R || !window.opentype || !window.TagEngraving) {
      return;
    }
    const cfg = JSON.parse(root.querySelector('.js-tag-designer-config').textContent);
    root.tagDesigner = new EngravingTool(root, cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
