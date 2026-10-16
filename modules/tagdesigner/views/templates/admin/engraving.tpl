{**
 * Orders > Tag engraving: the designer for tags sold elsewhere (views/js/tag-engraving-tool.js) and the history of
 * the saved designs with their engraving files (views/js/tag-engraving.js)
 *}
{if !$ready}
  <div class="alert alert-warning">
    {l s='Set up the sizes and the colours of the tag first:' d='Modules.Tagdesigner.Admin'}
    <a href="{$configure_link|escape:'html':'UTF-8'}">{l s='Tag designer settings' d='Modules.Tagdesigner.Admin'}</a>
  </div>
{else}
  <form method="post" action="{$action|escape:'html':'UTF-8'}" class="tag-engraving-tool" autocomplete="off">
    <input type="hidden" name="id_engraving" value="{$edit_id|intval}">
    <input type="hidden" name="font" value="{$values.font|escape:'html':'UTF-8'}">
    <input type="hidden" name="icon" value="{$values.icon|escape:'html':'UTF-8'}">

    <div class="panel">
      <div class="panel-heading">
        <i class="icon-pencil"></i>
        {if $edit_id}
          {l s='Edit engraving' d='Modules.Tagdesigner.Admin'}: {$values.reference|escape:'html':'UTF-8'}
          <span class="panel-heading-action">
            <a class="btn btn-default btn-sm" href="{$new_link|escape:'html':'UTF-8'}">{l s='New engraving' d='Modules.Tagdesigner.Admin'}</a>
          </span>
        {else}
          {l s='New engraving' d='Modules.Tagdesigner.Admin'}
        {/if}
      </div>

      <div class="row tag-engraving__layout js-tag-engraving-tool">
        <script type="application/json" class="js-tag-designer-config">{$config|json_encode nofilter}</script>

        <div class="col-lg-7">
          <div class="tag-designer__field">
            <label class="required" for="tag-engraving-reference">{l s='Order reference' d='Modules.Tagdesigner.Admin'}</label>
            <input class="form-control js-tag-reference" id="tag-engraving-reference" name="reference" type="text" maxlength="{$limits.reference|intval}" value="{$values.reference|escape:'html':'UTF-8'}" placeholder="Etsy 1234567" required>
            <p class="help-block">{l s='Shop and order number, also the name of the files.' d='Modules.Tagdesigner.Admin'}</p>
          </div>

          <div class="tag-designer__field">
            <span class="d-block" id="tag-engraving-type"><strong>{l s='Tag' d='Modules.Tagdesigner.Admin'}</strong></span>
            <div class="tag-engraving__colours" role="radiogroup" aria-labelledby="tag-engraving-type">
              <label class="tag-engraving__colour">
                <input class="js-tag-type" type="radio" name="type" value="address" {if $values.type != 'qr'}checked{/if}>
                {l s='Address tag' d='Modules.Tagdesigner.Admin'}
              </label>
              <label class="tag-engraving__colour">
                <input class="js-tag-type" type="radio" name="type" value="qr" {if $values.type == 'qr'}checked{/if}>
                {l s='QR tag (pet-id)' d='Modules.Tagdesigner.Admin'}
              </label>
            </div>
          </div>

          <div class="row">
            <div class="col-sm-4 tag-designer__field">
              <label for="tag-engraving-size">{l s='Size' d='Modules.Tagdesigner.Admin'}</label>
              <select class="form-control js-tag-look" id="tag-engraving-size" name="size">
                {foreach $sizes as $id => $diameter}
                  <option value="{$id|intval}" {if $id == $values.size}selected{/if}>Ø {$diameter|escape:'html':'UTF-8'} mm</option>
                {/foreach}
              </select>
            </div>
            <div class="col-sm-8 tag-designer__field">
              <span class="d-block" id="tag-engraving-colour"><strong>{l s='Colour' d='Modules.Tagdesigner.Admin'}</strong></span>
              <div class="tag-engraving__colours" role="radiogroup" aria-labelledby="tag-engraving-colour">
                {foreach $colours as $id => $colour}
                  <label class="tag-engraving__colour" title="{if $colour.white}{l s='white engraving' d='Modules.Tagdesigner.Admin'}{else}{l s='black engraving' d='Modules.Tagdesigner.Admin'}{/if}">
                    <input class="js-tag-look" type="radio" name="colour" value="{$id|intval}" {if $id == $values.colour}checked{/if}>
                    <span class="tag-engraving__swatch" style="background:{$colour.hex|escape:'html':'UTF-8'}"></span>
                    {$colour.name|escape:'html':'UTF-8'}
                  </label>
                {/foreach}
              </div>
            </div>
          </div>

          <fieldset class="tag-designer__group">
            <legend class="tag-designer__legend">{l s='Front' d='Modules.Tagdesigner.Admin'}</legend>
            <div class="tag-designer__field">
              <label class="required" for="tag-engraving-name">{l s='Pet name' d='Modules.Tagdesigner.Admin'}</label>
              <input class="form-control js-tag-input" data-role="name" id="tag-engraving-name" name="name" type="text" spellcheck="false">
              <small class="form-text js-tag-count" data-role="name"></small>
            </div>
            <div class="tag-designer__field">
              <span class="d-block" id="tag-engraving-font"><strong>{l s='Font' d='Modules.Tagdesigner.Admin'}</strong></span>
              <div class="tag-designer__fonts js-tag-fonts" role="radiogroup" aria-labelledby="tag-engraving-font"></div>
            </div>
            <div class="tag-designer__field">
              <span class="d-block" id="tag-engraving-icon"><strong>{l s='Icon' d='Modules.Tagdesigner.Admin'}</strong></span>
              <div class="tag-designer__icons js-tag-icons" role="radiogroup" aria-labelledby="tag-engraving-icon"></div>
            </div>
          </fieldset>

          <div class="alert alert-info js-tag-qr-only" {if $values.type != 'qr'}hidden{/if}>
            {l s='The back is the pet-id QR code. Save the design: its QR back and access card are downloaded from the history below; the first download creates the tag in pet-id.' d='Modules.Tagdesigner.Admin'}
            {if $editing_tags}<br>{l s='QR code:' d='Modules.Tagdesigner.Admin'} <a href="{$editing_tags[0].url|escape:'html':'UTF-8'}" target="_blank" rel="noopener">{$editing_tags[0].url|escape:'html':'UTF-8'}</a> ({l s='changing the name here does not change it in pet-id' d='Modules.Tagdesigner.Admin'}){/if}
            {if !$petid_configured}<br><strong>{l s='The pet-id admin key (PETID_ADMIN_KEY) is not set on the server: the QR code cannot be made yet.' d='Modules.Tagdesigner.Admin'}</strong>{/if}
          </div>

          <fieldset class="tag-designer__group js-tag-address-only" {if $values.type == 'qr'}hidden{/if}>
            <legend class="tag-designer__legend">{l s='Back' d='Modules.Tagdesigner.Admin'}</legend>
            <div class="tag-designer__field">
              <label for="tag-engraving-line1">{l s='Address line 1' d='Modules.Tagdesigner.Admin'}</label>
              <input class="form-control js-tag-input" data-role="line1" id="tag-engraving-line1" name="line1" type="text">
              <small class="form-text js-tag-count" data-role="line1"></small>
            </div>
            <div class="tag-designer__field">
              <label for="tag-engraving-line2">{l s='Address line 2' d='Modules.Tagdesigner.Admin'}</label>
              <input class="form-control js-tag-input" data-role="line2" id="tag-engraving-line2" name="line2" type="text">
              <small class="form-text js-tag-count" data-role="line2"></small>
            </div>
            <div class="tag-designer__field">
              <label for="tag-engraving-phone">{l s='Phone number' d='Modules.Tagdesigner.Admin'}</label>
              <input class="form-control js-tag-input" data-role="phone" id="tag-engraving-phone" name="phone" type="text">
              <small class="form-text js-tag-count" data-role="phone"></small>
            </div>
          </fieldset>
        </div>

        <div class="col-lg-5">
          <div class="tag-engraving__aside">
            <div class="tag-designer__preview is-aside js-tag-designer-preview" aria-live="polite">
              <div class="tag-designer__sides">
                <figure class="tag-designer__side">
                  <div class="tag-designer__tag js-tag-front" role="img" aria-label="{l s='Front' d='Modules.Tagdesigner.Admin'}"></div>
                  <figcaption>{l s='Front' d='Modules.Tagdesigner.Admin'}</figcaption>
                </figure>
                <figure class="tag-designer__side">
                  <div class="tag-designer__tag js-tag-back" role="img" aria-label="{l s='Back' d='Modules.Tagdesigner.Admin'}"></div>
                  <figcaption>{l s='Back' d='Modules.Tagdesigner.Admin'}</figcaption>
                </figure>
              </div>
              <p class="tag-designer__size js-tag-size"></p>
            </div>
            <div class="alert alert-danger js-tag-status" role="alert" hidden></div>
            <div class="tag-engraving__actions">
              <button type="submit" name="submitTagEngraving" value="1" class="btn btn-primary">
                <i class="icon-save"></i> {if $edit_id}{l s='Save changes' d='Modules.Tagdesigner.Admin'}{else}{l s='Save to history' d='Modules.Tagdesigner.Admin'}{/if}
              </button>
              <button type="button" class="btn btn-default js-tag-tool-download" data-side="front"><i class="icon-download"></i> {l s='Front SVG' d='Modules.Tagdesigner.Admin'}</button>
              <button type="button" class="btn btn-default js-tag-tool-download js-tag-address-only" data-side="back" {if $values.type == 'qr'}hidden{/if}><i class="icon-download"></i> {l s='Back SVG' d='Modules.Tagdesigner.Admin'}</button>
            </div>
            <p class="help-block">{l s='Files are at real size in mm, with the text as outlines. The red "guide" group is the tag outline and the hole, for positioning.' d='Modules.Tagdesigner.Admin'}</p>
          </div>
        </div>
      </div>
    </div>
  </form>

  <div class="panel js-tag-engraving">
    <script type="application/json" class="js-tag-engraving-data">{['settings' => $history.settings, 'designs' => $history.designs, 'reference' => '', 'petIdUrl' => $history.petIdUrl]|json_encode nofilter}</script>
    <div class="panel-heading">
      <i class="icon-time"></i> {l s='History' d='Modules.Tagdesigner.Admin'}
      <span class="badge">{$history.total|intval}</span>
    </div>

    <form method="get" action="{$history.search_action|escape:'html':'UTF-8'}" class="form-inline tag-engraving__search">
      {foreach $history.search_params as $key => $value}
        {if $key != 'q' && $key != 'page'}<input type="hidden" name="{$key|escape:'html':'UTF-8'}" value="{$value|escape:'html':'UTF-8'}">{/if}
      {/foreach}
      <input class="form-control" type="search" name="q" value="{$history.search|escape:'html':'UTF-8'}" placeholder="{l s='Reference or pet name' d='Modules.Tagdesigner.Admin'}" aria-label="{l s='Search' d='Modules.Tagdesigner.Admin'}">
      <button type="submit" class="btn btn-default"><i class="icon-search"></i> {l s='Search' d='Modules.Tagdesigner.Admin'}</button>
      {if $history.search !== ''}<a class="btn btn-link" href="{$new_link|escape:'html':'UTF-8'}">{l s='Show all' d='Modules.Tagdesigner.Admin'}</a>{/if}
    </form>

    {if $history.designs}
      <div class="table-responsive">
        <table class="table tag-engraving-history">
          <thead>
            <tr>
              <th>{l s='Date' d='Modules.Tagdesigner.Admin'}</th>
              <th>{l s='Order reference' d='Modules.Tagdesigner.Admin'}</th>
              <th>{l s='Tag' d='Modules.Tagdesigner.Admin'}</th>
              <th>{l s='Front' d='Modules.Tagdesigner.Admin'}</th>
              <th>{l s='Back' d='Modules.Tagdesigner.Admin'}</th>
              <th></th>
              <th class="text-right">{l s='Engraving files' d='Modules.Tagdesigner.Admin'}</th>
            </tr>
          </thead>
          <tbody>
            {foreach $history.designs as $index => $design}
              <tr class="js-tag-engraving-design{if $design.id == $history.saved} success{/if}" data-index="{$index|intval}">
                <td class="text-nowrap">{dateFormat date=$design.date full=1}</td>
                <td><strong>{$design.file|escape:'html':'UTF-8'}</strong></td>
                <td class="text-nowrap">
                  {if $design.diameter}Ø {$design.diameter|escape:'html':'UTF-8'} mm{else}<span class="text-danger">{l s='size unknown' d='Modules.Tagdesigner.Admin'}</span>{/if}<br>
                  {if $design.colour}{$design.colour.name|escape:'html':'UTF-8'}{else}<span class="text-danger">{l s='colour unknown' d='Modules.Tagdesigner.Admin'}</span>{/if}
                </td>
                <td>{$design.values.name|escape:'html':'UTF-8'}<br><span class="text-muted">{$design.values.font|escape:'html':'UTF-8'}, {$design.values.icon|escape:'html':'UTF-8'}</span></td>
                <td>
                  {if $design.type == 'qr'}
                    <span class="text-muted">{l s='QR tag (pet-id)' d='Modules.Tagdesigner.Admin'}</span>
                    <div class="tag-qr-units js-tag-qr-units"></div>
                  {else}
                    {$design.values.line1|escape:'html':'UTF-8'}<br>{$design.values.line2|escape:'html':'UTF-8'}<br>{$design.values.phone|escape:'html':'UTF-8'}
                  {/if}
                </td>
                <td>
                  <div class="tag-engraving__thumbs">
                    <div class="tag-engraving__thumb js-tag-engraving-front"></div>
                    <div class="tag-engraving__thumb js-tag-engraving-back"></div>
                  </div>
                </td>
                <td class="text-right text-nowrap">
                  <button type="button" class="btn btn-default btn-sm js-tag-engraving-download" data-side="front" disabled>{l s='Front SVG' d='Modules.Tagdesigner.Admin'}</button>
                  {if $design.type != 'qr'}<button type="button" class="btn btn-default btn-sm js-tag-engraving-download" data-side="back" disabled>{l s='Back SVG' d='Modules.Tagdesigner.Admin'}</button>{/if}
                  <a class="btn btn-default btn-sm" href="{$action|escape:'html':'UTF-8'}&amp;edit={$design.id|intval}" title="{l s='Edit' d='Modules.Tagdesigner.Admin'}"><i class="icon-pencil"></i></a>
                  <form method="post" action="{$action|escape:'html':'UTF-8'}" class="tag-engraving__delete" onsubmit="return confirm('{if $design.type == 'qr'}{l s='Delete this engraving from the history? Its QR code and access key are removed from the shop; the tag stays in pet-id.' d='Modules.Tagdesigner.Admin' js=1}{else}{l s='Delete this engraving from the history?' d='Modules.Tagdesigner.Admin' js=1}{/if}');">
                    <input type="hidden" name="id_engraving" value="{$design.id|intval}">
                    <button type="submit" name="deleteTagEngraving" value="1" class="btn btn-default btn-sm" title="{l s='Delete' d='Modules.Tagdesigner.Admin'}"><i class="icon-trash"></i></button>
                  </form>
                  <p class="small text-danger mb-0 js-tag-engraving-error" hidden></p>
                </td>
              </tr>
            {/foreach}
          </tbody>
        </table>
      </div>

      {if $history.pages > 1}
        <nav class="text-center">
          <ul class="pagination">
            {for $p = 1 to $history.pages}
              <li class="{if $p == $history.page}active{/if}"><a href="{$page_link|escape:'html':'UTF-8'}&amp;page={$p|intval}">{$p|intval}</a></li>
            {/for}
          </ul>
        </nav>
      {/if}
    {else}
      <p class="text-muted">{if $history.search !== ''}{l s='No engraving matches your search.' d='Modules.Tagdesigner.Admin'}{else}{l s='No engraving saved yet.' d='Modules.Tagdesigner.Admin'}{/if}</p>
    {/if}
  </div>
{/if}
