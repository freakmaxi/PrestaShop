{**
 * Tag designer settings
 *}
<form method="post" action="{$action|escape:'html':'UTF-8'}" class="form-horizontal">
  <div class="panel">
    <div class="panel-heading"><i class="icon-cogs"></i> {l s='Sizes and colours' d='Modules.Tagdesigner.Admin'}</div>

    <div class="form-group">
      <label class="control-label col-lg-3" for="td-size-group">{l s='Size attribute group' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-4">
        <select name="tagdesigner[sizeGroup]" id="td-size-group">
          <option value="0">-</option>
          {foreach $form.groups as $group}
            <option value="{$group.id|intval}" {if $group.id == $form.values.sizeGroup}selected{/if}>{$group.name|escape:'html':'UTF-8'}</option>
          {/foreach}
        </select>
      </div>
    </div>
    {if $form.sizeAttributes}
      <div class="form-group">
        <label class="control-label col-lg-3">{l s='Diameter (mm)' d='Modules.Tagdesigner.Admin'}</label>
        <div class="col-lg-4">
          {foreach $form.sizeAttributes as $attribute}
            <div class="input-group" style="margin-bottom:6px">
              <span class="input-group-addon" style="min-width:120px;text-align:left">{$attribute.name|escape:'html':'UTF-8'}</span>
              <input type="text" name="tagdesigner[sizes][{$attribute.id|intval}]" value="{$form.values.sizes[$attribute.id]|default:''|escape:'html':'UTF-8'}">
              <span class="input-group-addon">mm</span>
            </div>
          {/foreach}
        </div>
      </div>
    {/if}

    <div class="form-group">
      <label class="control-label col-lg-3" for="td-colour-group">{l s='Colour attribute group' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-4">
        <select name="tagdesigner[colourGroup]" id="td-colour-group">
          <option value="0">-</option>
          {foreach $form.groups as $group}
            <option value="{$group.id|intval}" {if $group.id == $form.values.colourGroup}selected{/if}>{$group.name|escape:'html':'UTF-8'}</option>
          {/foreach}
        </select>
        <p class="help-block">{l s='The preview uses each colour\'s colour code (Catalog > Attributes & Features).' d='Modules.Tagdesigner.Admin'}</p>
      </div>
    </div>
    {if $form.colourAttributes}
      <div class="form-group">
        <label class="control-label col-lg-3">{l s='Engraved in white' d='Modules.Tagdesigner.Admin'}</label>
        <div class="col-lg-4">
          {foreach $form.colourAttributes as $attribute}
            <div class="checkbox">
              <label>
                <input type="checkbox" name="tagdesigner[white][{$attribute.id|intval}]" value="1" {if in_array($attribute.id, $form.values.white)}checked{/if}>
                <span style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:4px;background:{$attribute.color|escape:'html':'UTF-8'}"></span>
                {$attribute.name|escape:'html':'UTF-8'}
              </label>
            </div>
          {/foreach}
          <p class="help-block">{l s='Unticked colours are engraved in black.' d='Modules.Tagdesigner.Admin'}</p>
        </div>
      </div>
    {/if}
  </div>

  <div class="panel">
    <div class="panel-heading"><i class="icon-pencil"></i> {l s='Engraving' d='Modules.Tagdesigner.Admin'}</div>
    <div class="form-group">
      <label class="control-label col-lg-3" for="td-back-font">{l s='Back side font' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-2">
        <select name="tagdesigner[backFont]" id="td-back-font">
          {foreach $form.fonts as $font}
            <option value="{$font|escape:'html':'UTF-8'}" {if $font == $form.values.backFont}selected{/if}>{$font|escape:'html':'UTF-8'}</option>
          {/foreach}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="control-label col-lg-3" for="td-hole">{l s='Ring hole diameter' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-2">
        <div class="input-group">
          <input type="text" name="tagdesigner[hole]" id="td-hole" value="{$form.values.hole|escape:'html':'UTF-8'}">
          <span class="input-group-addon">mm</span>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="control-label col-lg-3" for="td-default-font">{l s='Preselected font and icon' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-2">
        <select name="tagdesigner[defaultFont]" id="td-default-font">
          {foreach $form.fonts as $font}
            <option value="{$font|escape:'html':'UTF-8'}" {if $font == $form.values.defaultFont}selected{/if}>{$font|escape:'html':'UTF-8'}</option>
          {/foreach}
        </select>
      </div>
      <div class="col-lg-2">
        <select name="tagdesigner[defaultIcon]" aria-label="{l s='Preselected icon' d='Modules.Tagdesigner.Admin'}">
          {foreach $form.icons as $icon}
            <option value="{$icon|escape:'html':'UTF-8'}" {if $icon == $form.values.defaultIcon}selected{/if}>{$icon|escape:'html':'UTF-8'}</option>
          {/foreach}
        </select>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-heading"><i class="icon-qrcode"></i> {l s='QR tags (pet-id)' d='Modules.Tagdesigner.Admin'}</div>
    <p>
      {if $petid.configured}
        <span class="label label-success">{l s='Connected' d='Modules.Tagdesigner.Admin'}</span>
      {else}
        <span class="label label-warning">{l s='Admin key missing' d='Modules.Tagdesigner.Admin'}</span>
      {/if}
      {l s='The QR code and the access card of a QR tag are made the first time its files are downloaded: the shop creates the tag in pet-id and its hol.red link.' d='Modules.Tagdesigner.Admin'}
    </p>
    <table class="table" style="max-width:720px">
      <tr><th>PETID_ADMIN_KEY</th><td>{if $petid.configured}{l s='set' d='Modules.Tagdesigner.Admin'}{else}<span class="text-danger">{l s='not set' d='Modules.Tagdesigner.Admin'}</span>{/if}</td></tr>
      <tr><th>PETID_API_URL</th><td><code>{$petid.endpoints.api|escape:'html':'UTF-8'}</code></td></tr>
      <tr><th>PETID_SHORTENER_URL</th><td><code>{$petid.endpoints.shortener|escape:'html':'UTF-8'}</code></td></tr>
      <tr><th>PETID_TAG_URL</th><td><code>{$petid.endpoints.tagUrl|escape:'html':'UTF-8'}</code></td></tr>
    </table>
    <p class="help-block">{l s='Environment variables of the store container; the key comes from a secret.' d='Modules.Tagdesigner.Admin'}</p>
  </div>

  <div class="panel">
    <div class="panel-heading"><i class="icon-tag"></i> {l s='Products' d='Modules.Tagdesigner.Admin'}</div>
    <p>{l s='Each product needs text customization fields (Catalog > Products > Details > Customization): six for an address tag, three (pet name, icon, font) for a QR tag. Map them to what the designer fills in.' d='Modules.Tagdesigner.Admin'}</p>
    {foreach $form.products as $product}
      <h4>#{$product.id|intval} {$product.name|escape:'html':'UTF-8'}
        {if !$product.complete}<span class="label label-warning">{l s='Incomplete: the designer is off for this product' d='Modules.Tagdesigner.Admin'}</span>{/if}
      </h4>
      <div class="row" style="margin-bottom:12px">
        <div class="col-lg-2">
          <label>{l s='Back side' d='Modules.Tagdesigner.Admin'}</label>
          <select name="tagdesigner[products][{$product.id|intval}][type]">
            <option value="address" {if $product.type == 'address'}selected{/if}>{l s='Address and phone' d='Modules.Tagdesigner.Admin'}</option>
            <option value="qr" {if $product.type == 'qr'}selected{/if}>{l s='QR code (pet-id)' d='Modules.Tagdesigner.Admin'}</option>
          </select>
        </div>
        {foreach $product.typeRoles as $role}
          <div class="col-lg-2">
            <label>{$role|escape:'html':'UTF-8'}</label>
            <select name="tagdesigner[products][{$product.id|intval}][{$role|escape:'html':'UTF-8'}]">
              <option value="0">-</option>
              {foreach $product.fields as $fieldId => $label}
                <option value="{$fieldId|intval}" {if $fieldId == $product.roles[$role]|default:0}selected{/if}>{$label|escape:'html':'UTF-8'} (#{$fieldId|intval})</option>
              {/foreach}
            </select>
          </div>
        {/foreach}
      </div>
      <div class="checkbox" style="margin-bottom:18px">
        <label><input type="checkbox" name="tagdesigner[products][{$product.id|intval}][remove]" value="1"> {l s='Remove the designer from this product' d='Modules.Tagdesigner.Admin'}</label>
      </div>
    {/foreach}
    <div class="form-group">
      <label class="control-label col-lg-3" for="td-add-product">{l s='Add a product (ID)' d='Modules.Tagdesigner.Admin'}</label>
      <div class="col-lg-2">
        <input type="text" name="tagdesigner[addProduct]" id="td-add-product" value="">
      </div>
      <div class="col-lg-2">
        <select name="tagdesigner[addType]" aria-label="{l s='Back side' d='Modules.Tagdesigner.Admin'}">
          <option value="address">{l s='Address and phone' d='Modules.Tagdesigner.Admin'}</option>
          <option value="qr">{l s='QR code (pet-id)' d='Modules.Tagdesigner.Admin'}</option>
        </select>
      </div>
    </div>
    <p class="help-block">{l s='After changing the back side of a product, save once more to map its fields.' d='Modules.Tagdesigner.Admin'}</p>
    <div class="panel-footer">
      <button type="submit" name="submitTagDesigner" class="btn btn-default pull-right"><i class="process-icon-save"></i> {l s='Save' d='Admin.Actions'}</button>
    </div>
  </div>
</form>
