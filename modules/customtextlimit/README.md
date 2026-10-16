# Customization text limit

Lets you set a maximum number of characters for each **text** customization field of a product
(default 250, max 1024 — the size of `customized_data.value`).

- **Admin:** Catalog > Products > edit > Details > Customization: a "max characters" input on each row.
- **Shop:** texts over the limit are rejected server side with an error message.
- **Theme:** the limits are available in Smarty as `$customization_max_lengths` (field id => limit),
  on the product page and its ajax refresh.

Limits are stored in `PREFIX_customtextlimit`. On install, values from a `size` column previously added
to `PREFIX_customization_field` are imported.

## Theme snippet

In `catalog/_partials/product-customization.tpl`, inside the `{foreach}`:

```smarty
{assign var="max_chars" value=$customization_max_lengths[$field.id_customization_field]|default:250}

<textarea ... maxlength="{$max_chars}" ...></textarea>

<small class="form-text">{l s='%max% char. max' sprintf=['%max%' => $max_chars] d='Shop.Forms.Help'}</small>
```

## Upgrading PrestaShop

`views/PrestaShop/Admin/Sell/Catalog/Product/FormTheme/customizations.html.twig` overrides the core
template of the same path (copied from 9.2.0). After a PrestaShop upgrade, compare it with the new core file.

## Development

No dependencies; after changing `composer.json` run `composer dump-autoload --optimize --no-dev`.
