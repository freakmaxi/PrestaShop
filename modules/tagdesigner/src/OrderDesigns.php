<?php
/**
 * Reads the tag designs of an order: one entry per ordered line with the designer. A QR tag line also has its
 * pet-id tags made so far, one per tag ordered.
 */

namespace PrestaShop\Module\TagDesigner;

use Db;
use Product;

if (!defined('_PS_VERSION_')) {
    exit;
}

class OrderDesigns
{
    /** @var Settings */
    private $settings;

    public function __construct(Settings $settings)
    {
        $this->settings = $settings;
    }

    public function forOrder(int $orderId): array
    {
        if (!$orderId) {
            return [];
        }

        $db = Db::getInstance();
        $lines = $db->executeS(
            'SELECT `id_order_detail`, `product_id`, `product_attribute_id`, `id_customization`, `product_name`,
                `product_quantity`
            FROM `' . _DB_PREFIX_ . 'order_detail`
            WHERE `id_order` = ' . $orderId . ' AND `id_customization` > 0
            ORDER BY `id_order_detail`'
        ) ?: [];

        $renderer = $this->settings->rendererSettings();
        $sizes = (array) $renderer['sizes'];
        $colours = (array) $renderer['colours'];

        $designs = [];
        foreach ($lines as $line) {
            $roles = $this->settings->product((int) $line['product_id']);
            if (!$roles) {
                continue;
            }

            $texts = [];
            foreach ($db->executeS(
                'SELECT `index`, `value` FROM `' . _DB_PREFIX_ . 'customized_data`
                WHERE `id_customization` = ' . (int) $line['id_customization'] . ' AND `type` = ' . Product::CUSTOMIZE_TEXTFIELD
            ) ?: [] as $row) {
                $texts[(int) $row['index']] = (string) $row['value'];
            }
            $values = array_fill_keys(Settings::ROLES, '');
            foreach ($roles as $role => $fieldId) {
                $values[$role] = $texts[$fieldId] ?? '';
            }

            $diameter = null;
            $colour = null;
            foreach ($this->combinationAttributes((int) $line['product_attribute_id']) as $attributeId) {
                $diameter = $diameter ?? ($sizes[$attributeId] ?? null);
                $colour = $colour ?? ($colours[$attributeId] ?? null);
            }

            $designs[] = [
                'line' => (int) $line['id_order_detail'],
                'type' => $this->settings->type((int) $line['product_id']),
                'name' => (string) $line['product_name'],
                'quantity' => (int) $line['product_quantity'],
                'diameter' => $diameter,
                'colour' => $colour,
                'values' => $values,
            ];
        }

        $qrLines = array_column(array_filter($designs, static fn ($d) => $d['type'] === Settings::TYPE_QR), 'line');
        $tags = (new PetIds())->forSources(PetIds::ORDER, $qrLines);
        foreach ($designs as &$design) {
            $design['tags'] = $design['type'] === Settings::TYPE_QR ? array_values($tags[$design['line']] ?? []) : [];
        }
        unset($design);

        return $designs;
    }

    /**
     * The design of one ordered line with the designer, or null.
     */
    public function forLine(int $orderDetailId): ?array
    {
        $orderId = (int) Db::getInstance()->getValue(
            'SELECT `id_order` FROM `' . _DB_PREFIX_ . 'order_detail` WHERE `id_order_detail` = ' . $orderDetailId
        );
        foreach ($this->forOrder($orderId) as $design) {
            if ($design['line'] === $orderDetailId) {
                return $design;
            }
        }

        return null;
    }

    /** @return int[] */
    private function combinationAttributes(int $combinationId): array
    {
        if (!$combinationId) {
            return [];
        }

        return array_map('intval', array_column(Db::getInstance()->executeS(
            'SELECT `id_attribute` FROM `' . _DB_PREFIX_ . 'product_attribute_combination`
            WHERE `id_product_attribute` = ' . $combinationId
        ) ?: [], 'id_attribute'));
    }
}
