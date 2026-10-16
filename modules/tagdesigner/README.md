# Tag designer

Live preview of an engraved round tag on the product page, its engraving files on the order page, and an
engraving page for tags sold on other marketplaces (eBay, Etsy, Amazon). Two kinds of tag: the address tag
(address and phone on the back) and the QR tag (a pet-id QR code on the back, with a metal access card).

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

- **QR tags:** the front is the same; the back is the tag's own pet-id QR code (see below). The product page
  shows a sample code. On the order page each tag ordered (a line of 2 has 2) gets a "QR back SVG" and an
  "Access card SVG" button; on the engraving page they appear in the history once the design is saved.

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

## QR tags (pet-id)

The first download of a QR tag's back or card creates its tag in the pet-id service (`POST /admin/client` with
the pet name, font as `styleCode` and icon as `iconCode`; Basic, without Premium) and its link in the hol.red
shortener (`/c/shorten?r=https://apps.houseofleo.de/petid/ui/tags/<id>`), from the shop's server
(`src/PetIdClient.php`). The tag id, access key and link are kept in `tagdesigner_petid` (`src/PetIds.php`), so
every later download gives the same files. Deleting a design from the engraving history removes its codes from
the shop; the tag stays in pet-id. Changing the name of a design whose tag exists does not change pet-id.

- **Back** (`views/js/tag-qr.js`): the hol.red link as a QR code in the style of
  `~/Mega/Projects/HouseOfLeo/tools/generate-qr.js` (error correction H, rounded dots and finder patterns, the
  logo in the middle), made round like `circle-qr.js`: the circle through the corners of the code with its quiet
  zone, the cells outside the code filled with dots at random, except one module around the finder patterns,
  dots on the edge cut by the circle. The circle is the whole tag (no margin; the hole just stays unengraved).
  The filling is seeded with the tag id, so it is the same on every download. Light tags engrave the code; dark
  tags (engraved in white) engrave the whole circle except the code, so it stays dark and readable. One path,
  even-odd fill rule.
- **Access card** (`views/js/tag-card.js`, two files: front and back): a black aluminium card, 85.6 × 54 mm.
  Engraving shows the silver metal, so the texts, logo and symbols are engraved and the access key's square
  code (36 mm with its quiet zone, logo in the middle) is engraved in negative: black modules on silver.
  Front: logo, "HOUSE OF LEO", "Pet ID · Access card", the pet's icon and name in its font, the three steps
  (scan the tag, tap the person icon, scan this card), "Keep this card safe". Back: whom to contact with the
  order number when the tag or card is lost, and houseofleo.de. Never the tag's hol.red link: finding only the
  card (or only the tag) is not enough to edit the pet's page. Texts in the back font, in English or German:
  the order's language for shop orders, a choice on the engraving page. A replacement card is the same
  download again (the key is kept).

Setup: a product with the same size and colour groups and three text customization fields (pet name 12, icon 3,
font 4), added in the settings with back side "QR code (pet-id)". The server needs the environment variables
of `src/PetIdClient.php`: `PETID_ADMIN_KEY` (required), and `PETID_API_URL`, `PETID_SHORTENER_URL`,
`PETID_TAG_URL` when the cluster defaults do not fit. The settings page shows whether the key is set.

`views/lib/qrcode-1.5.4.min.js` is the core of [node-qrcode](https://github.com/soldair/node-qrcode) 1.5.4 (MIT),
the library `generate-qr.js` uses, bundled for the browser as `window.QRCodeCore`:

```sh
npm i qrcode@1.5.4 esbuild
echo "module.exports = { create: require('qrcode/lib/core/qrcode').create };" > entry.js
npx esbuild entry.js --bundle --minify --format=iife --global-name=QRCodeCore --outfile=qrcode-core.min.js
```

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
- `../tools/hol_logo.svg` → `views/img/qr-logo.svg`: the logo of the QR codes, centred on (0, 0) in the units
  of the reference QR code.
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
(`upgrade/upgrade-1.1.0.php`); 1.2.0 the QR tags (`upgrade/upgrade-1.2.0.php`: the tag type and card language of the
history, the `tagdesigner_petid` table). Uninstalling the module deletes the history and the shop's copy of the pet-id codes.

## Translations

`translations/de-DE/ModulesTagdesignerShop.de-DE.xlf` holds the German shop texts. The admin texts are English.
