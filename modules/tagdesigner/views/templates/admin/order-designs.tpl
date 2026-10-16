{**
 * Order page: the ordered tag designs with their engraving files (made in the browser by views/js/tag-engraving.js)
 *}
<div class="card mt-2 tag-engraving js-tag-engraving">
  <script type="application/json" class="js-tag-engraving-data">{['settings' => $settings, 'designs' => $designs, 'reference' => $order_reference, 'petIdUrl' => $petid_url]|json_encode nofilter}</script>
  <div class="card-header">
    <h3 class="card-header-title">{l s='Tag engraving' d='Modules.Tagdesigner.Admin'}</h3>
  </div>
  <div class="card-body">
    {foreach $designs as $index => $design}
      <div class="row align-items-center js-tag-engraving-design" data-index="{$index|intval}" style="{if !$design@last}border-bottom:1px solid #e5e5e5;margin-bottom:1rem;padding-bottom:1rem{/if}">
        <div class="col-md-4 d-flex" style="gap:12px">
          <div class="js-tag-engraving-front" style="width:120px;height:120px"></div>
          <div class="js-tag-engraving-back" style="width:120px;height:120px"></div>
        </div>
        <div class="col-md-5">
          <strong>{$design.name|escape:'html':'UTF-8'}</strong> × {$design.quantity|intval}
          <table class="table table-sm mb-0 mt-1">
            <tr><th>{l s='Size' d='Modules.Tagdesigner.Admin'}</th><td>{if $design.diameter}{$design.diameter|escape:'html':'UTF-8'} mm{else}<span class="text-danger">{l s='unknown' d='Modules.Tagdesigner.Admin'}</span>{/if}</td></tr>
            <tr><th>{l s='Colour' d='Modules.Tagdesigner.Admin'}</th><td>{if $design.colour}{$design.colour.name|escape:'html':'UTF-8'}, {if $design.colour.white}{l s='white engraving' d='Modules.Tagdesigner.Admin'}{else}{l s='black engraving' d='Modules.Tagdesigner.Admin'}{/if}{else}<span class="text-danger">{l s='unknown' d='Modules.Tagdesigner.Admin'}</span>{/if}</td></tr>
            <tr><th>{l s='Name' d='Modules.Tagdesigner.Admin'}</th><td>{$design.values.name|escape:'html':'UTF-8'} <span class="text-muted">({$design.values.font|escape:'html':'UTF-8'}, {$design.values.icon|escape:'html':'UTF-8'})</span></td></tr>
            {if $design.type == 'qr'}
              <tr><th>{l s='Back' d='Modules.Tagdesigner.Admin'}</th><td>{l s='QR code (pet-id), with an access card' d='Modules.Tagdesigner.Admin'}</td></tr>
            {else}
              <tr><th>{l s='Back' d='Modules.Tagdesigner.Admin'}</th><td>{$design.values.line1|escape:'html':'UTF-8'}<br>{$design.values.line2|escape:'html':'UTF-8'}<br>{$design.values.phone|escape:'html':'UTF-8'}</td></tr>
            {/if}
          </table>
          {if $design.type == 'qr'}<div class="tag-qr-units js-tag-qr-units"></div>{/if}
        </div>
        <div class="col-md-3 text-md-right">
          <button type="button" class="btn btn-outline-secondary btn-sm mb-1 js-tag-engraving-download" data-side="front" disabled>{l s='Front SVG' d='Modules.Tagdesigner.Admin'}</button>
          {if $design.type != 'qr'}<button type="button" class="btn btn-outline-secondary btn-sm mb-1 js-tag-engraving-download" data-side="back" disabled>{l s='Back SVG' d='Modules.Tagdesigner.Admin'}</button>{/if}
          <p class="small text-danger mb-0 js-tag-engraving-error" hidden></p>
        </div>
      </div>
    {/foreach}
    <p class="small text-muted mb-0">{l s='Files are at real size in mm, with the text as outlines. The red "guide" group is the tag outline and the hole, for positioning.' d='Modules.Tagdesigner.Admin'} {l s='A QR tag gets its pet-id QR code and access card the first time one of them is downloaded; later downloads give the same files.' d='Modules.Tagdesigner.Admin'}</p>
  </div>
</div>
<style>
  .tag-qr-units { margin-top: .5rem; }
  .tag-qr-unit { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; }
  .tag-qr-unit__label { font-weight: 600; }
</style>
{foreach $scripts as $script}
  <script src="{$assets|escape:'html':'UTF-8'}{$script|escape:'html':'UTF-8'}"></script>
{/foreach}
