/**
 * Back office engraving page: the shop's designer (tag-designer-core.js) for tags sold elsewhere. Size and colour
 * come from the page's own inputs; the design is downloaded right away or saved to the history with the form.
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
