<?php
/**
 * The pet-id tags of QR tags: one per tag made, so an order line of three QR tags has three. A tag is created in
 * pet-id the first time its files are downloaded and kept here, so every later download gives the same QR code
 * and access card.
 *
 * A tag belongs to an order line (id_order_detail) or to a design of the engraving page (id_engraving); unit
 * numbers the tags of one line from 0.
 */

namespace PrestaShop\Module\TagDesigner;

use Db;
use RuntimeException;

if (!defined('_PS_VERSION_')) {
    exit;
}

class PetIds
{
    public const TABLE = 'tagdesigner_petid';

    public const ORDER = 'order';
    public const ENGRAVING = 'engraving';

    public function createTable(): bool
    {
        return Db::getInstance()->execute(
            'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . self::TABLE . '` (
                `id_tagdesigner_petid` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                `id_order_detail` INT(10) UNSIGNED NOT NULL DEFAULT 0,
                `id_engraving` INT(10) UNSIGNED NOT NULL DEFAULT 0,
                `unit` SMALLINT(5) UNSIGNED NOT NULL DEFAULT 0,
                `tag_id` CHAR(36) NOT NULL,
                `access_key` VARCHAR(64) NOT NULL,
                `short_url` VARCHAR(255) NOT NULL DEFAULT \'\',
                `date_add` DATETIME NOT NULL,
                PRIMARY KEY (`id_tagdesigner_petid`),
                UNIQUE KEY `tag` (`id_order_detail`, `id_engraving`, `unit`)
            ) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4'
        );
    }

    public function dropTable(): bool
    {
        return Db::getInstance()->execute('DROP TABLE IF EXISTS `' . _DB_PREFIX_ . self::TABLE . '`');
    }

    /**
     * The tags made so far for these order lines or engraving designs.
     *
     * @param int[] $ids
     *
     * @return array<int, array<int, array>> id => unit => tag (see tag())
     */
    public function forSources(string $source, array $ids): array
    {
        $ids = array_filter(array_map('intval', $ids));
        if (!$ids) {
            return [];
        }

        $column = $this->column($source);
        $rows = Db::getInstance()->executeS(
            'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '`
            WHERE `' . $column . '` IN (' . implode(',', $ids) . ') AND ' . $this->otherIsZero($source) . '
            ORDER BY `unit`'
        ) ?: [];

        $tags = [];
        foreach ($rows as $row) {
            $tags[(int) $row[$column]][(int) $row['unit']] = $this->tag($row);
        }

        return $tags;
    }

    /**
     * The tag of this unit, created in pet-id (and its link in the shortener) when there is none yet.
     *
     * @param array{name: string, font: string, icon: string} $values
     *
     * @throws RuntimeException
     */
    public function ensure(string $source, int $id, int $unit, array $values, PetIdClient $client): array
    {
        $db = Db::getInstance();
        // Two clicks at the same time must not make two tags
        $lock = '\'' . pSQL(_DB_PREFIX_ . self::TABLE . ':' . $source . ':' . $id . ':' . $unit) . '\'';
        if ((int) $db->getValue('SELECT GET_LOCK(' . $lock . ', 15)') !== 1) {
            throw new RuntimeException('This tag is being created, please try again.');
        }

        try {
            $row = $this->find($source, $id, $unit);
            if (!$row) {
                $created = $client->createTag($values['name'], $values['font'], $values['icon']);
                $inserted = $db->insert(self::TABLE, [
                    $this->column($source) => $id,
                    'unit' => $unit,
                    'tag_id' => pSQL($created['id']),
                    'access_key' => pSQL($created['accessKey'], true),
                    'date_add' => date('Y-m-d H:i:s'),
                ]);
                if (!$inserted) {
                    throw new RuntimeException('The new pet-id tag could not be saved: ' . $created['id']);
                }
                $row = $this->find($source, $id, $unit);
            }

            // A tag whose link failed earlier gets it now
            if ($row['short_url'] === '') {
                $link = $client->shortLink($row['tag_id']);
                $db->update(self::TABLE, ['short_url' => pSQL($link)], '`id_tagdesigner_petid` = ' . (int) $row['id_tagdesigner_petid']);
                $row['short_url'] = $link;
            }
        } finally {
            $db->getValue('SELECT RELEASE_LOCK(' . $lock . ')');
        }

        return $this->tag($row);
    }

    public function deleteFor(string $source, int $id): bool
    {
        return Db::getInstance()->delete(self::TABLE, '`' . $this->column($source) . '` = ' . $id . ' AND ' . $this->otherIsZero($source));
    }

    private function find(string $source, int $id, int $unit): ?array
    {
        $row = Db::getInstance()->getRow(
            'SELECT * FROM `' . _DB_PREFIX_ . self::TABLE . '`
            WHERE `' . $this->column($source) . '` = ' . $id . ' AND ' . $this->otherIsZero($source) . ' AND `unit` = ' . $unit
        );

        return $row ?: null;
    }

    /** @return array{unit: int, id: string, accessKey: string, url: string, date: string} */
    private function tag(array $row): array
    {
        return [
            'unit' => (int) $row['unit'],
            'id' => (string) $row['tag_id'],
            'accessKey' => (string) $row['access_key'],
            'url' => (string) $row['short_url'],
            'date' => (string) $row['date_add'],
        ];
    }

    private function column(string $source): string
    {
        return $source === self::ENGRAVING ? 'id_engraving' : 'id_order_detail';
    }

    private function otherIsZero(string $source): string
    {
        return '`' . ($source === self::ENGRAVING ? 'id_order_detail' : 'id_engraving') . '` = 0';
    }
}
