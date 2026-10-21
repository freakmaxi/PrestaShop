#!/bin/sh
# Copies our modules and theme from the image into the persistent web root, replacing older versions,
# clears the Symfony cache when something changed, then installs or upgrades our modules in the database.
# Runs as root in the initContainer, on every start.
set -e

SOURCE=/tmp/data-ps/prestashop
ROOT=/var/www/html
changed=0

for dir in modules/customtextlimit modules/tagdesigner themes/hummingbird_child; do
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

if [ "$changed" = 1 ]; then
    echo "* Clearing cache"
    rm -rf "$ROOT/var/cache/prod" "$ROOT/var/cache/dev"
    # The combined JS/CSS files are named after the file list, not the content: remove them so they are rebuilt
    rm -rf "$ROOT"/themes/*/assets/cache/*
fi

# New module files do not change the database: PrestaShop only runs a module's install or upgrade
# (tables, columns, hooks, menu entries) when asked. Ask here, so a new image needs no click in Module
# Manager: upgrade an installed module, install one that is not installed yet. A module of the image is
# always installed, so to remove one, remove it from the image. Never fails the pod start.
if [ -f "$ROOT/app/config/parameters.php" ]; then
    # The command exits 0 even when the action fails ("Cannot install module ..."): only its
    # "... action on module ... succeeded." says it worked
    console() {
        (cd "$ROOT" && runuser -u www-data -- php bin/console prestashop:module "$1" "$2" >/tmp/module.log 2>&1)
        grep -q "on module $2 succeeded" /tmp/module.log
    }
    # PrestaShop's message, without the PHP notices and the command's usage text
    reason() {
        { sed -n 's/.*Message: "\([^"]*\)".*/\1/p' /tmp/module.log; grep -o 'Cannot [^.]*\.[^.]*\.' /tmp/module.log; } \
            | head -n 1 | sed 's/\.$//'
    }
    for module in customtextlimit tagdesigner; do
        if console upgrade "$module"; then
            echo "* Upgraded $module"
        elif grep -q "must be installed first" /tmp/module.log; then
            if console install "$module"; then
                echo "* Installed $module"
            else
                echo "warning: could not install $module: $(reason). Install it in Modules > Module Manager."
            fi
        else
            echo "warning: could not upgrade $module: $(reason). See Modules > Module Manager."
        fi
    done
fi

echo "* Customizations are up to date"
