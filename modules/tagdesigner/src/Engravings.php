<?php
/**
 * History of the engraving page: tag designs for orders from other shops (eBay, Etsy, Amazon), stored as their
 * values, like an order's customization. The engraving files are made from them when downloaded.
 */

namespace PrestaShop\Module\TagDesigner;

use Db;

if (!defined('_PS_VERSION_')) {
    exit;
}

class Engravings
{
    public const TABLE = 'tagdesigner_engraving';

    // Longest values the table holds; the designer's own limits are shorter
    public const LENGTHS = ['reference' => 64, 'name' => 64, 'line1' => 128, 'line2' => 128, 'phone' => 64];

    public function createTable(): bool
    {
        return Db::getInstance()->execute(
            'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . self::TABLE . '` (
                `id_tagdesigner_engraving` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `reference` VARCHAR(64) NOT NULL,
                `id_size` INT(10) UNSIGNED NOT NULL,
                `id_colour` INT(10) UNSIGNED NOT NULL,
                `name` VARCHAR(64) NOT NULL,
                `font` VARCHAR(8) NOT NULL,
                `icon` VARCHAR(8) NOT NULL,
                `line1` VARCHAR(128) NOT NULL DEFAULT \'\',
                `line2` VARCHAR(128) NOT NULL DEFAULT \'\',
                `phone` VARCHAR(64) NOT NULL DEFAULT \'\',
                `id_employee` INT(10) UNSIGNED NOT NULL DEFAULT 0,
                `date_add` DATETIME NOT NULL,
                `date_upd` DATETIME NOT NULL,
                PRIMARY KEY (`id_tagdesigner_engraving`),
                KEY `date_add` (`date_add`)
            ) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4'
        );
    }

    public function dropTable(): bool
    {
        return Db::getInstance()->execute('DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::TABLE . '`');
    }

    public function find(int $id): ?array
    {
        $row = Db::getInstance()->getRow(
            'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '` WHERE `id_tagdesigner_engraving` = ' . $id
        );

        return $row ?: null;
    }

    /**
     * Newest first, optionally only those whose reference or pet name contains $search.
     *
     * @return array{rows: array, total: int}
     */
    public function page(string $search, int $page, int $perPage): array
    {
        $where = '';
        if ($search !== '') {
            $like = '\'%' . pSQL(addcslashes($search, '%_\\'), true) . '%\'';
            $where = ' WHERE `reference` LIKE ' . $like . ' OR `name` LIKE ' . $like;
        }

        $db = Db::getInstance();
        $total = (int) $db->getValue('SELECT COUNT(*) FROM `' . _DB_PREFIX_ . self::TABLE . '`' . $where);
        $rows = $db->executeS(
            'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '`' . $where . '
            ORDER BY `date_add` DESC, `id_tagdesigner_engraving` DESC
            LIMIT ' . max(0, ($page - 1) * $perPage) . ', ' . $perPage
        ) ?: [];

        return ['rows' => $rows, 'total' => $total];
    }

    /**
     * Inserts the design, or updates it when $id is set. Returns its id, 0 on failure.
     */
    public function save(array $values, int $id, int $employeeId): int
    {
        $now = date('Y-m-d H:i:s');
        $data = [
            'reference' => pSQL($values['reference'], true),
            'id_size' => (int) $values['size'],
            'id_colour' => (int) $values['colour'],
            'name' => pSQL($values['name'], true),
            'font' => pSQL($values['font'], true),
            'icon' => pSQL($values['icon'], true),
            'line1' => pSQL($values['line1'], true),
            'line2' => pSQL($values['line2'], true),
            'phone' => pSQL($values['phone'], true),
            'id_employee' => $employeeId,
            'date_upd' => $now,
        ];

        $db = Db::getInstance();
        if ($id) {
            return $db->update(self::TABLE, $data, '`id_tagdesigner_engraving` = ' . $id) ? $id : 0;
        }

        $data['date_add'] = $now;

        return $db->insert(self::TABLE, $data) ? (int) $db->Insert_ID() : 0;
    }

    public function delete(int $id): bool
    {
        return Db::getInstance()->delete(self::TABLE, '`id_tagdesigner_engraving` = ' . $id);
    }

    /**
     * A stored design as views/js/tag-engraving.js draws it (the same shape as an order's design).
     */
    public function design(array $row, array $renderer): array
    {
        $sizes = (array) $renderer['sizes'];
        $colours = (array) $renderer['colours'];

        return [
            'id' => (int) $row['id_tagdesigner_engraving'],
            'file' => (string) $row['reference'],
            'date' => (string) $row['date_add'],
            'diameter' => $sizes[(int) $row['id_size']] ?? null,
            'colour' => $colours[(int) $row['id_colour']] ?? null,
            'values' => [
                'name' => (string) $row['name'],
                'icon' => (string) $row['icon'],
                'font' => (string) $row['font'],
                'line1' => (string) $row['line1'],
                'line2' => (string) $row['line2'],
                'phone' => (string) $row['phone'],
            ],
        ];
    }
}
