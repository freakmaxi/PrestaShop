# House of Leo store

Branch `houseofleo` of this fork = PrestaShop tag `9.2.0` + our customizations:

| Path | What |
|---|---|
| `modules/customtextlimit/` | Per-field max length for product text customizations (admin input, server-side check, `$customization_max_lengths` for the theme) |
| `themes/hummingbird_child/` | Child of Hummingbird 2.1.x; only overrides `catalog/_partials/product-customization.tpl` to show the limit |
| `houseofleo/` | Image build: Dockerfile and the scripts it installs |

Deployment manifests: `~/Mega/Projects/HouseOfLeo/infrastructure`.

## Image

```sh
docker build --platform linux/amd64 -f houseofleo/Dockerfile -t docker.hudolini.com/houseofleo/store:v<VERSION> .
docker push docker.hudolini.com/houseofleo/store:v<VERSION>
```

Based on the official `prestashop/prestashop:9.2.0-apache` image, which installs PrestaShop on the first start
of an empty volume. On top of it:

- `post-install.sh`: after that install, renames the admin folder to `SHOP_ADMIN_FOLDER`, installs the module
  and enables the child theme.
- `sync-customizations.sh`: run by the initContainer on every start; copies the module and theme to the volume
  when the image carries a newer version, and clears the cache.
- `apache-env.conf`: passes `PS_TRUSTED_PROXIES` to PHP, without it Symfony ignores the ingress X-Forwarded-* headers.
- `php.ini`: upload size (keep in line with the ingress `proxy-body-size`), memory, `max_input_vars`.

The 9.2.0 installer only works with an admin folder named `admin`/`admin-dev` and with `PS_FOLDER_INSTALL`
other than `install`: the deployment sets `PS_FOLDER_ADMIN=admin-dev`, `PS_FOLDER_INSTALL=install-dev`.

## Upgrading PrestaShop

Rebase this branch on the new tag, bump the `FROM` image, then check:
- `modules/customtextlimit/views/PrestaShop/Admin/Sell/Catalog/Product/FormTheme/customizations.html.twig`
  against the core file of the same path,
- `themes/hummingbird_child/templates/catalog/_partials/product-customization.tpl` against the new Hummingbird.
