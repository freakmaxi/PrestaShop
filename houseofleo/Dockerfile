# House of Leo store image: official PrestaShop 9.2.0 + our modules and child theme.
# Build (linux/amd64 for the nodes), from any directory:
#   houseofleo/build.sh --push   (tags v<prestashop>-<next build number>; see houseofleo/README.md)
# Deployed by infrastructure/65-houseofleo/hudolini-eu-01-production/store (Mega/Projects/HouseOfLeo).

# The module's autoloader is generated here instead of being committed
FROM composer:2.8 AS module-autoload
WORKDIR /module
COPY modules/customtextlimit/ ./
RUN composer dump-autoload --optimize --no-dev --no-interaction

FROM prestashop/prestashop:9.2.0-apache

# Files under /tmp/data-ps/prestashop are copied to the web root on the first start (empty volume)
COPY --from=module-autoload --chown=www-data:www-data /module /tmp/data-ps/prestashop/modules/customtextlimit
COPY --chown=www-data:www-data modules/tagdesigner /tmp/data-ps/prestashop/modules/tagdesigner
COPY --chown=www-data:www-data themes/hummingbird_child /tmp/data-ps/prestashop/themes/hummingbird_child

# Run by the image entrypoint right after the automatic install
COPY --chmod=755 houseofleo/post-install.sh /tmp/post-install-scripts/10-customizations.sh
# Run by the initContainer on every start, to bring module/theme updates to the existing volume
COPY --chmod=755 houseofleo/sync-customizations.sh /usr/local/bin/sync-customizations

COPY houseofleo/php.ini /usr/local/etc/php/conf.d/zz-shop.ini
COPY houseofleo/apache-env.conf /etc/apache2/conf-enabled/zz-shop-env.conf
