# House of Leo store

Branch `houseofleo` of this fork = PrestaShop tag `9.2.0` + our customizations:

| Path | What |
|---|---|
| `modules/customtextlimit/` | Per-field max length for product text customizations (admin input, server-side check, `$customization_max_lengths` for the theme) |
| `modules/tagdesigner/` | Live engraved-tag preview on the product page, engraving SVGs on the order page, Orders > Tag engraving for marketplace orders, QR tags with pet-id codes (needs `PETID_ADMIN_KEY`; see its README) |
| `themes/hummingbird_child/` | Child of Hummingbird 2.1.x; only overrides `catalog/_partials/product-customization.tpl` (shows the limit, includes the tag designer) |
| `houseofleo/` | Image build: Dockerfile and the scripts it installs |

Deployment manifests: `~/Mega/Projects/HouseOfLeo/infrastructure`.

## Image

```sh
houseofleo/build.sh --push    # docker.hudolini.com/houseofleo/store:v9.2.0-<next>; without --push it only builds
```

The tag is the base image's PrestaShop version and the next build number in the registry (`v9.2.0-2` after
`v9.2.0-1`), so nothing is typed by hand and the deploy script picks it up as the newest. Needs
`docker login docker.hudolini.com` (the registry is read to find the number), `jq` and `curl`.

Based on the official `prestashop/prestashop:9.2.0-apache` image, which installs PrestaShop on the first start
of an empty volume. On top of it:

- `post-install.sh`: after that install, renames the admin folder to `SHOP_ADMIN_FOLDER`, installs the modules
  and enables the child theme.
- `sync-customizations.sh`: run by the initContainer on every start; copies the modules and theme to the volume
  when the image carries a newer version, clears the cache and the combined theme JS/CSS (their file name
  does not change with the content), and on every start upgrades our modules, or installs one that is not
  installed yet. The files come with the image, but a module's database part (its tables, columns, hooks, menu
  entries, version) only changes when it is installed or upgraded: this makes a new image enough, without a
  click in Module Manager. A module of the image is always installed again, so remove a module from the image
  to remove it. A failure is logged (`kc logs -n hol-store deploy/store -c sync-customizations`) and does not
  stop the start.
- `apache-env.conf`: passes `PS_TRUSTED_PROXIES` to PHP, without it Symfony ignores the ingress X-Forwarded-* headers.
- `php.ini`: upload size (keep in line with the ingress `proxy-body-size`), memory, `max_input_vars`.

The 9.2.0 installer only works with an admin folder named `admin`/`admin-dev` and with `PS_FOLDER_INSTALL`
other than `install`: the deployment sets `PS_FOLDER_ADMIN=admin-dev`, `PS_FOLDER_INSTALL=install-dev`.

## Upgrading PrestaShop

Rebase this branch on the new tag, bump the `FROM` image, then check:
- `modules/customtextlimit/views/PrestaShop/Admin/Sell/Catalog/Product/FormTheme/customizations.html.twig`
  against the core file of the same path,
- `themes/hummingbird_child/templates/catalog/_partials/product-customization.tpl` against the new Hummingbird,
- the tag designer on the product page: it moves itself below `.js-product-variants` in `#add-to-cart-or-refresh`
  and relies on the theme replacing only that element on a combination change.

## Branding

PrestaShop keeps logos in the store's `img/` folder and their names in the configuration (`PS_LOGO`, `PS_LOGO_MAIL`,
`PS_LOGO_INVOICE`, `PS_FAVICON`), so they are uploaded once in the back office, not shipped in the image:
**Design → Theme & Logo**, then save after each file. The files are in `~/Mega/Projects/HouseOfLeo/design/branding/`.

| Field | File | Why this format |
|---|---|---|
| Header logo | `logo-header.svg` | Sharp at any zoom. PrestaShop cannot measure an SVG (`getimagesize`), so the file itself carries its size (223×44) |
| Mail logo | `logo-mail.png` | Mail and invoice logos must be raster; 400 px wide, on white |
| Invoice logo | `logo-invoice.png` | 800 px wide so it stays sharp in the PDF |
| Favicon | `favicon.ico` | Only `.ico` is accepted; lion head at 16, 32 and 48 px |

Source artwork: `~/Projects/HouseOfLeo/corporate/web/src/assets/brand/` (also used by the corporate site). Brand
colours: purple `#330066`, light blue `#7093ff`.

