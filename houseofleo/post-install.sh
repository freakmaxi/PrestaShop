#!/bin/sh
# Finishes the first automatic install: renames the admin folder and enables our module and child theme.
# Never fails: a failing post-install script would leave install.lock behind and block every restart.
cd /var/www/html || exit 0

if [ ! -f app/config/parameters.php ]; then
    echo "warning: PrestaShop is not installed, skipping customizations"
    exit 0
fi

# The 9.2.0 installer only works with an admin folder named admin or admin-dev (PS_FOLDER_ADMIN=admin-dev),
# so the final name is applied afterwards
if [ -n "$SHOP_ADMIN_FOLDER" ] && [ -d admin-dev ] && [ ! -e "$SHOP_ADMIN_FOLDER" ]; then
    mv admin-dev "$SHOP_ADMIN_FOLDER" && rm -rf var/cache/prod var/cache/dev \
        && echo "* Admin folder renamed to $SHOP_ADMIN_FOLDER"
fi

runuser -u www-data -- php bin/console prestashop:module install customtextlimit \
    || echo "warning: could not install customtextlimit, install it from the admin"
runuser -u www-data -- php bin/console prestashop:theme:enable hummingbird_child \
    || echo "warning: could not enable hummingbird_child, enable it from the admin"

exit 0
