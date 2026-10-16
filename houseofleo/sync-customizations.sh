#!/bin/sh
# Copies our module and theme from the image into the persistent web root, replacing older versions,
# and clears the Symfony cache when something changed. Runs as root in the initContainer.
set -e

SOURCE=/tmp/data-ps/prestashop
ROOT=/var/www/html
changed=0

for dir in modules/customtextlimit themes/hummingbird_child; do
    # Files only on the volume are what PrestaShop generates at runtime (theme assets/cache,
    # module config*.xml): only new or modified files of the image count as a change
    if [ ! -d "$ROOT/$dir" ] || diff -rq "$SOURCE/$dir" "$ROOT/$dir" 2>&1 | grep -qv "^Only in $ROOT/"; then
        echo "* Updating $dir"
        rm -rf "${ROOT:?}/$dir"
        mkdir -p "$(dirname "$ROOT/$dir")"
        cp -R -p "$SOURCE/$dir" "$ROOT/$dir"
        changed=1
    fi
done

# On a new volume the folders above are created here, before PrestaShop is copied: make them writable
# by Apache (PrestaShop writes .htaccess in the root and installs modules into modules/)
chown www-data:www-data "$ROOT" "$ROOT/modules" "$ROOT/themes"

if [ "$changed" = 1 ] && [ -d "$ROOT/var/cache" ]; then
    echo "* Clearing cache"
    rm -rf "$ROOT/var/cache/prod" "$ROOT/var/cache/dev"
fi

echo "* Customizations are up to date"
