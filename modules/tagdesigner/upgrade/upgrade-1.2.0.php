<?php
/**
 * 1.2.0: QR tags: the tag type and card language of the engraving history, and the pet-id tags table.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

function upgrade_module_1_2_0(TagDesigner $module): bool
{
    return $module->installEngravingPage();
}
