{**
 * Tag designer, shown instead of the customization form for the products set up in the module
 * (included by the child theme's catalog/_partials/product-customization.tpl).
 *
 * It has no .product-customization class on purpose: the theme replaces that element when the combination
 * changes, the designer keeps its state instead. views/js/tag-designer.js saves the design as the product's
 * customization text fields before the product is added to the cart.
 *}
<section class="tag-designer js-tag-designer" aria-labelledby="tag-designer-title">
  <script type="application/json" class="js-tag-designer-config">{$tag_designer|json_encode nofilter}</script>
  {foreach from=$customizations.fields item="field"}
    {if $field.type === 'text'}
      <input type="hidden" class="js-tag-designer-saved" data-name="{$field.input_name}" data-max="{$customization_max_lengths[$field.id_customization_field]|default:250}" value="{$field.text}">
    {/if}
  {/foreach}

  <h2 class="tag-designer__title h4" id="tag-designer-title">{l s='Design your tag' d='Modules.Tagdesigner.Shop'}</h2>

  <div class="tag-designer__preview js-tag-designer-preview" aria-live="polite">
    <div class="tag-designer__sides">
      <figure class="tag-designer__side">
        <div class="tag-designer__tag js-tag-front" role="img" aria-label="{l s='Front of the tag' d='Modules.Tagdesigner.Shop'}"></div>
        <figcaption>{l s='Front' d='Modules.Tagdesigner.Shop'}</figcaption>
      </figure>
      <figure class="tag-designer__side">
        <div class="tag-designer__tag js-tag-back" role="img" aria-label="{l s='Back of the tag' d='Modules.Tagdesigner.Shop'}"></div>
        <figcaption>{l s='Back' d='Modules.Tagdesigner.Shop'}</figcaption>
      </figure>
    </div>
    <p class="tag-designer__size js-tag-size"></p>
  </div>

  <fieldset class="tag-designer__group">
    <legend class="tag-designer__legend">{l s='Front' d='Modules.Tagdesigner.Shop'}</legend>

    <div class="tag-designer__field">
      <label class="form-label required" for="tag-designer-name">{l s='Pet name' d='Modules.Tagdesigner.Shop'}</label>
      <input class="form-control js-tag-input" data-role="name" id="tag-designer-name" type="text" autocomplete="off" spellcheck="false">
      <small class="form-text js-tag-count" data-role="name"></small>
    </div>

    <div class="tag-designer__field">
      <span class="form-label d-block" id="tag-designer-font">{l s='Font' d='Modules.Tagdesigner.Shop'}</span>
      <div class="tag-designer__fonts js-tag-fonts" role="radiogroup" aria-labelledby="tag-designer-font"></div>
    </div>

    <div class="tag-designer__field">
      <span class="form-label d-block" id="tag-designer-icon">{l s='Icon' d='Modules.Tagdesigner.Shop'}</span>
      <div class="tag-designer__icons js-tag-icons" role="radiogroup" aria-labelledby="tag-designer-icon"></div>
    </div>
  </fieldset>

  <fieldset class="tag-designer__group">
    <legend class="tag-designer__legend">{l s='Back' d='Modules.Tagdesigner.Shop'}</legend>

    <div class="tag-designer__field">
      <label class="form-label" for="tag-designer-line1">{l s='Address line 1' d='Modules.Tagdesigner.Shop'}</label>
      <input class="form-control js-tag-input" data-role="line1" id="tag-designer-line1" type="text" autocomplete="off">
      <small class="form-text js-tag-count" data-role="line1"></small>
    </div>
    <div class="tag-designer__field">
      <label class="form-label" for="tag-designer-line2">{l s='Address line 2' d='Modules.Tagdesigner.Shop'}</label>
      <input class="form-control js-tag-input" data-role="line2" id="tag-designer-line2" type="text" autocomplete="off">
      <small class="form-text js-tag-count" data-role="line2"></small>
    </div>
    <div class="tag-designer__field">
      <label class="form-label" for="tag-designer-phone">{l s='Phone number' d='Modules.Tagdesigner.Shop'}</label>
      <input class="form-control js-tag-input" data-role="phone" id="tag-designer-phone" type="tel" autocomplete="off">
      <small class="form-text js-tag-count" data-role="phone"></small>
    </div>
  </fieldset>

  <div class="tag-designer__status alert alert-danger js-tag-status" role="alert" hidden></div>
</section>
