# Tag designer

Live preview of an engraved round tag on the product page, its engraving files on the order page, and an
engraving page for tags sold on other marketplaces (eBay, Etsy, Amazon).

- **Shop:** on a product set up in the module, the customization form is replaced by the designer: pet name,
  font (23) and icon (92) for the front, two address lines and the phone number for the back. The preview
  follows every change and the chosen size and colour (light colours are engraved in black, dark ones in white).
  Fonts that cannot draw the typed name (for example no "ü") are greyed out.
- **Cart:** "Add to cart" first saves the design as the product's six text customization fields (the same POST as
  the theme's "Save customization" button), then adds the product. The cart refuses the product without a design.
- **Order page:** a "Tag engraving" panel draws each ordered tag and downloads one SVG per side: real size in mm,
  text converted to outlines, only `M/L/C/Z` path commands. The red `guide` group is the tag outline and the
  hole, for positioning in EzCad; delete it or set it to not mark.

- **Orders > Tag engraving:** the same designer in the back office, for orders from other shops. Enter the
  order reference (e.g. "Etsy 1234567", also the file name), size, colour and the texts, then download the two
  SVGs right away or save the design to the history below. Each saved design can be downloaded again, edited,
  deleted or found by reference or pet name. It creates no order, customer, invoice or stock movement.

The product page, the order page and the engraving page use the same layout code (`views/js/tag-renderer.js`),
so the file is what the customer saw. Orders and the history keep only the design values: the files are made
when downloaded, so a later layout change also applies to older designs.

The designer's fields, pickers and preview are in `views/js/tag-designer-core.js`, shared by the product page
(`tag-designer.js`) and the engraving page (`tag-engraving-tool.js`); `tag-engraving.js` draws the order designs
and the history.

## Setup

1. Product with combinations: a size group (e.g. 25 mm, 30 mm, price impact on the size) and a colour group of type
   colour, with the colour codes set (Catalog > Attributes & Features).
2. Six **text** customization fields on the product (Catalog > Products > Details > Customization), not required,
   with their limits from `customtextlimit`: pet name 12, icon 3, font 4, address line 1 27, address line 2 25,
   phone 20.
3. Modules > Tag designer > Configure: pick the size and colour groups, the diameter of each size, the colours
   engraved in white, the back font and the hole diameter; add the product by ID and check the field mapping.

The engraving page takes the sizes, colours and fonts from the same settings, and the character limits from the
first product's fields (12 / 27 / 25 / 20 when it has none).

The theme hook-up is in the child theme's `catalog/_partials/product-customization.tpl`, which includes
`views/templates/front/designer.tpl` when `$tag_designer` is set.

## Layout

Everything is in millimetres in `LAYOUT` at the top of `views/js/tag-renderer.js`: 1 mm margin from the edge
(0.5 mm for the phone number), the hole 1 mm from the edge, maximum text sizes. Long texts shrink until they fit
inside the circle, below the hole, and (address) clear of the phone number.

## Icons and fonts

Built from the design folder; run again after adding or changing one:

```sh
python3 tools/build-assets.py ~/Mega/Projects/HouseOfLeo/design
```

- `_svg/Cnn.svg` → `views/icons/`: one 512×512 viewBox, absolute path data, no transforms; fills become black
  (engraved) or white (left bare, like the panels of the football C14).
- `_fonts/Coded/STnn.ttf` → `views/fonts/`: subset to Latin (German, Turkish, French...) as WOFF. Needs fontTools
  (`pyftsubset`).

Some fonts lack characters (ST04, ST05, ST08, ST12 and ST18 have no umlauts; several have no ğ/ş/İ; ST22 has an
empty "+"). The designer checks this per typed text.

`views/lib/opentype-1.3.4.min.js` is [opentype.js](https://github.com/opentypejs/opentype.js) 1.3.4 (MIT), which
turns the text into outlines in the browser.

## Upgrades

PrestaShop does not run a module's upgrade by itself. After deploying a new version (`$this->version` in
`tagdesigner.php`), upgrade it once in Modules > Module Manager or with
`php bin/console prestashop:module upgrade tagdesigner`. 1.1.0 adds the engraving page and its table
(`upgrade/upgrade-1.1.0.php`). Uninstalling the module deletes the history.

## Translations

`translations/de-DE/ModulesTagdesignerShop.de-DE.xlf` holds the German shop texts. The admin texts are English.
