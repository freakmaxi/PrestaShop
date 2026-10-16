<?php
/**
 * 1.1.0: engraving page (Orders > Tag engraving) with its history table.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_1_0(TagDesigner $module): bool
{
    return $module->installEngravingPage();
}
