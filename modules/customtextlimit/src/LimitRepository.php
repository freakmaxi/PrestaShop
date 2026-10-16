<?php

namespace PrestaShop\Module\CustomTextLimit;

use Db;
use Product;

/**
 * Stores the max length of text customization fields in its own table,
 * so core's customization_field table stays untouched.
 */
class LimitRepository
{
    /** Length used when no limit is set (same as core's textarea maxlength) */
    public const DEFAULT_LENGTH = 250;

    /** Size of customized_data.value, where core stores the text */
    public const MAX_LENGTH = 1024;

    private const TABLE = 'customtextlimit';

    public function createTable(): bool
    {
        return Db::getInstance()->execute(
            'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . self::TABLE . '` (
                `id_customization_field` INT(10) UNSIGNED NOT NULL,
                `max_length` SMALLINT(5) UNSIGNED NOT NULL,
                PRIMARY KEY (`id_customization_field`)
            ) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4'
        );
    }

    public function dropTable(): bool
    {
        return Db::getInstance()->execute('DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::TABLE . '`');
    }

    /**
     * Copies limits from the `size` column that was previously added to core's customization_field table.
     */
    public function importLegacySizeColumn(): bool
    {
        $db = Db::getInstance();
        if (!$db->executeS('SHOW COLUMNS FROM `' . _DB_PREFIX_ . 'customization_field` LIKE \'size\'')) {
            return true;
        }

        return $db->execute(
            'INSERT IGNORE INTO `' . _DB_PREFIX_ . self::TABLE . '` (`id_customization_field`, `max_length`)
            SELECT `id_customization_field`, LEAST(GREATEST(`size`, 1), ' . self::MAX_LENGTH . ')
            FROM `' . _DB_PREFIX_ . 'customization_field`
            WHERE `type` = ' . Product::CUSTOMIZE_TEXTFIELD . '
            AND `size` IS NOT NULL AND `size` <> ' . self::DEFAULT_LENGTH
        );
    }

    /**
     * @return array<int, int> limits explicitly set for the product's fields, by field id
     */
    public function getStoredLimits(int $productId): array
    {
        $rows = Db::getInstance()->executeS(
            'SELECT l.`id_customization_field`, l.`max_length`
            FROM `' . _DB_PREFIX_ . self::TABLE . '` l
            INNER JOIN `' . _DB_PREFIX_ . 'customization_field` cf ON cf.`id_customization_field` = l.`id_customization_field`
            WHERE cf.`id_product` = ' . $productId
        );

        return array_column($rows ?: [], 'max_length', 'id_customization_field');
    }

    /**
     * @return array<int, int> effective limit of every active text field of the product, by field id
     */
    public function getTextFieldLimits(int $productId): array
    {
        if (!$productId) {
            return [];
        }

        $rows = Db::getInstance()->executeS(
            'SELECT cf.`id_customization_field`, l.`max_length`
            FROM `' . _DB_PREFIX_ . 'customization_field` cf
            LEFT JOIN `' . _DB_PREFIX_ . self::TABLE . '` l ON l.`id_customization_field` = cf.`id_customization_field`
            WHERE cf.`id_product` = ' . $productId . '
            AND cf.`type` = ' . Product::CUSTOMIZE_TEXTFIELD . '
            AND cf.`is_deleted` = 0'
        );

        $limits = [];
        foreach ($rows ?: [] as $row) {
            $limits[(int) $row['id_customization_field']] = (int) ($row['max_length'] ?: self::DEFAULT_LENGTH);
        }

        return $limits;
    }

    /**
     * @return int[] ids of the product's non deleted customization fields, ascending
     */
    public function getActiveFieldIds(int $productId): array
    {
        $rows = Db::getInstance()->executeS(
            'SELECT `id_customization_field`
            FROM `' . _DB_PREFIX_ . 'customization_field`
            WHERE `id_product` = ' . $productId . ' AND `is_deleted` = 0
            ORDER BY `id_customization_field` ASC'
        );

        return array_map('intval', array_column($rows ?: [], 'id_customization_field'));
    }

    /**
     * @param array<int, int|null> $limits limit by field id, null removes the limit
     */
    public function saveLimits(array $limits): void
    {
        $db = Db::getInstance();
        foreach ($limits as $fieldId => $maxLength) {
            if ($maxLength === null) {
                $db->delete(self::TABLE, '`id_customization_field` = ' . (int) $fieldId);
                continue;
            }
            $maxLength = max(1, min(self::MAX_LENGTH, $maxLength));
            $db->execute(
                'INSERT INTO `' . _DB_PREFIX_ . self::TABLE . '` (`id_customization_field`, `max_length`)
                VALUES (' . (int) $fieldId . ', ' . $maxLength . ')
                ON DUPLICATE KEY UPDATE `max_length` = VALUES(`max_length`)'
            );
        }
    }

    /**
     * Removes limits of customization fields that no longer exist.
     */
    public function deleteOrphans(): void
    {
        Db::getInstance()->execute(
            'DELETE l FROM `' . _DB_PREFIX_ . self::TABLE . '` l
            LEFT JOIN `' . _DB_PREFIX_ . 'customization_field` cf ON cf.`id_customization_field` = l.`id_customization_field`
            WHERE cf.`id_customization_field` IS NULL'
        );
    }
}
