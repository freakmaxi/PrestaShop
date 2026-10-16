/**
 * Tag designer on the product page: the customer types the texts and picks the font and the icon, the preview
 * follows every change and the chosen size and colour. Before "Add to cart" goes through, the design is saved as
 * the product's customization text fields (the same POST as the theme's "Save customization" button), so the cart
 * line carries it. The fields, pickers and preview are in tag-designer-core.js.
 */
(function () {
  'use strict';

  const Form = window.TagDesignerForm;
  const WIDE = window.matchMedia('(min-width: 992px)');

  // What the cart already has for this product, and the per-field limits
  function cartDesign(root, cfg) {
    const saved = {};
    const max = {};
    root.querySelectorAll('.js-tag-designer-saved').forEach((input) => {
      const role = Form.ROLES.find((r) => cfg.fields[r] === input.dataset.name);
      if (role) {
        saved[role] = input.value;
        max[role] = parseInt(input.dataset.max, 10) || 250;
      }
    });
    return { saved, max };
  }

  class ShopDesigner extends Form {
    constructor(root, cfg) {
      const { saved, max } = cartDesign(root, cfg);
      super(root, cfg, { saved, max, storageKey: `tagdesigner:${cfg.productId}` });

      // The cart's design: adding it again needs no new save
      const empty = { name: '', line1: '', line2: '', phone: '', font: '', icon: '' };
      this.savedSignature = saved.name ? this.signature(Object.assign(empty, saved)) : null;
      this.bypass = false;

      this.placeDesigner();
      this.placePreview();
      WIDE.addEventListener('change', () => this.placePreview());

      // Size and colour: the theme replaces the variant inputs after a change, so they are always looked up
      document.addEventListener('change', (event) => {
        if (event.target.matches('[data-product-attribute]')) {
          this.render();
        }
      });
      if (window.prestashop && typeof window.prestashop.on === 'function') {
        window.prestashop.on('updatedProduct', () => this.render());
      }
      document.addEventListener('click', (event) => this.onAddToCart(event), true);

      this.start();
    }

    signature(state) {
      return JSON.stringify(Form.ROLES.map((role) => (state || this.state)[role] || ''));
    }

    // --- Placement ---

    // Size and colour come first: the designer moves below them, inside the add-to-cart form. The theme only
    // replaces the variants element itself after a change, so the designer stays. Its inputs have no name, so
    // they are not sent with the form, and Enter in them must not submit it.
    placeDesigner() {
      const variants = document.querySelector('#add-to-cart-or-refresh .js-product-variants');
      if (variants) {
        variants.after(this.root);
      }
      this.root.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.target.matches('input')) {
          event.preventDefault();
        }
      });
    }

    // Desktop: in the image column, next to the form. Mobile: at the top of the designer
    placePreview() {
      // The sticky preview goes below the theme's sticky header
      const header = document.querySelector('.js-sticky-header');
      const sticky = header && ['sticky', 'fixed'].includes(getComputedStyle(header).position);
      this.preview.style.setProperty('--tag-sticky-top', `${sticky ? header.offsetHeight : 0}px`);

      const left = document.querySelector('.product__left');
      if (WIDE.matches && left && this.root.closest('.product__right')) {
        left.prepend(this.preview);
        this.preview.classList.add('is-aside');
      } else {
        this.root.querySelector('.tag-designer__title').after(this.preview);
        this.preview.classList.remove('is-aside');
      }
    }

    selectedAttribute(groupId) {
      const form = document.getElementById('add-to-cart-or-refresh') || document;
      const input = form.querySelector(`[data-product-attribute="${groupId}"]:checked`)
        || form.querySelector(`select[data-product-attribute="${groupId}"]`);
      return input ? String(input.value) : null;
    }

    look() {
      return this.lookFor(this.selectedAttribute(this.cfg.sizeGroup), this.selectedAttribute(this.cfg.colourGroup));
    }

    // --- Saving ---

    customizationInputs() {
      return Array.from(document.querySelectorAll('#product_customization_id, .js-product-customization-id'));
    }

    onAddToCart(event) {
      const button = event.target.closest('[data-button-action="add-to-cart"]');
      if (!button || this.bypass || !button.closest('#add-to-cart-or-refresh')) {
        return;
      }

      const errors = this.validate();
      const saved = this.savedSignature === this.signature()
        && this.customizationInputs().some((input) => parseInt(input.value, 10) > 0);
      if (!errors.length && saved) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (errors.length) {
        this.showStatus(errors);
        return;
      }

      button.disabled = true;
      this.showStatus([this.texts.saving], 'info');
      this.save().then(() => {
        this.hideStatus();
        button.disabled = false;
        this.bypass = true;
        button.click();
        this.bypass = false;
      }).catch((error) => {
        button.disabled = false;
        this.showStatus(error.messages || [this.texts.saveFailed]);
      });
    }

    save() {
      const body = new FormData();
      // A QR tag has only the front fields
      Form.ROLES.filter((role) => this.cfg.fields[role]).forEach((role) => body.append(this.cfg.fields[role], this.state[role].trim()));
      body.append('submitCustomizedData', '1');
      const signature = this.signature();

      return fetch(this.cfg.saveUrl, { method: 'POST', body, credentials: 'same-origin' })
        .then((response) => response.text())
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const messages = Array.from(doc.querySelectorAll('#notifications .alert-danger')).flatMap((alert) => {
            const items = alert.querySelectorAll('li');
            return items.length
              ? Array.from(items, (li) => li.textContent.trim())
              : [alert.textContent.trim()];
          }).filter(Boolean);
          const idInput = doc.querySelector('#product_customization_id');
          const id = idInput ? parseInt(idInput.value, 10) : 0;
          if (messages.length || !id) {
            const error = new Error('save failed');
            error.messages = messages.length ? messages : null;
            throw error;
          }
          this.customizationInputs().forEach((input) => {
            input.value = String(id);
          });
          this.savedSignature = signature;
        });
    }
  }

  function init() {
    const root = document.querySelector('.js-tag-designer');
    if (!root || !Form || !window.TagRenderer || !window.opentype) {
      return;
    }
    const cfg = JSON.parse(root.querySelector('.js-tag-designer-config').textContent);
    root.tagDesigner = new ShopDesigner(root, cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
