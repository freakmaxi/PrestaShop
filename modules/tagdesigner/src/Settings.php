<?php
/**
 * Module settings, stored as JSON in one configuration value:
 *
 *   sizeGroup, sizes        attribute group of the tag size, attribute id => diameter in mm
 *   colourGroup, white      attribute group of the tag colour, attribute ids engraved in white (the rest in black)
 *   backFont, hole          font of the back side, ring hole diameter in mm
 *   defaultFont, defaultIcon preselected on the product page
 *   products                product id => role => customization field id
 *   qrProducts              product ids of QR tags: the back is a pet-id QR code, only the front roles are mapped
 */

namespace PrestaShop\Module\TagDesigner;

use AttributeGroup;
use Configuration;
use Db;
use Module;
use PrestaShop\Module\CustomTextLimit\LimitRepository;
use Product;

if (!defined('_PS_VERSION_')) {
    exit;
}

class Settings
{
    public const CONFIG_KEY = 'TAGDESIGNER_SETTINGS';

    // Customization text fields the designer fills, in the order they are mapped by default
    public const ROLES = ['name', 'icon', 'font', 'line1', 'line2', 'phone'];

    // A QR tag has only the front: its back is the pet-id QR code
    public const QR_ROLES = ['name', 'icon', 'font'];

    public const TYPE_ADDRESS = 'address';
    public const TYPE_QR = 'qr';

    // Character limits of the texts when the product has none (customtextlimit sets them per field)
    private const LIMITS = ['name' => 12, 'line1' => 27, 'line2' => 25, 'phone' => 20];

    private const DEFAULTS = [
        'sizeGroup' => 0,
        'sizes' => [],
        'colourGroup' => 0,
        'white' => [],
        'backFont' => 'ST03',
        'hole' => 3,
        'defaultFont' => 'ST10',
        'defaultIcon' => 'C02',
        'products' => [],
        'qrProducts' => [],
    ];

    /** @var string */
    private $moduleDir;

    /** @var string */
    private $moduleUri;

    /** @var array|null */
    private $values;

    public function __construct(string $moduleDir, string $moduleUri)
    {
        $this->moduleDir = $moduleDir;
        $this->moduleUri = $moduleUri;
    }

    public function all(): array
    {
        if ($this->values === null) {
            $stored = json_decode((string) Configuration::getGlobalValue(self::CONFIG_KEY), true);
            $this->values = array_merge(self::DEFAULTS, is_array($stored) ? $stored : []);
        }

        return $this->values;
    }

    /**
     * Role => customization field id for a product with the designer, null otherwise. A QR tag has only the
     * roles of QR_ROLES.
     */
    public function product(int $productId): ?array
    {
        $products = $this->all()['products'];
        $roles = $products[(string) $productId] ?? null;
        if (!is_array($roles)) {
            return null;
        }
        $mapped = [];
        foreach (self::rolesOf($this->type($productId)) as $role) {
            if (empty($roles[$role])) {
                return null;
            }
            $mapped[$role] = (int) $roles[$role];
        }

        return $mapped;
    }

    public function type(int $productId): string
    {
        return in_array($productId, array_map('intval', $this->all()['qrProducts']), true) ? self::TYPE_QR : self::TYPE_ADDRESS;
    }

    /** @return string[] */
    public static function rolesOf(string $type): array
    {
        return $type === self::TYPE_QR ? self::QR_ROLES : self::ROLES;
    }

    /**
     * Character limit of each text: those of the first product with the designer, for the engraving page.
     *
     * @return array<string, int> role => limit
     */
    public function limits(): array
    {
        $limits = self::LIMITS;
        foreach (array_keys($this->all()['products']) as $productId) {
            $roles = $this->product((int) $productId);
            if (!$roles) {
                continue;
            }
            if ($this->type((int) $productId) === self::TYPE_QR) {
                continue;
            }
            if (Module::isEnabled('customtextlimit') && Module::getInstanceByName('customtextlimit') && class_exists(LimitRepository::class)) {
                $byField = (new LimitRepository())->getTextFieldLimits((int) $productId);
                foreach (array_keys($limits) as $role) {
                    if (isset($byField[$roles[$role]])) {
                        $limits[$role] = (int) $byField[$roles[$role]];
                    }
                }
            }
            break;
        }

        return $limits;
    }

    /** @return string[] font codes (STnn) */
    public function fonts(): array
    {
        return $this->codes('views/fonts/ST[0-9][0-9].woff');
    }

    /** @return string[] icon codes (Cnn) */
    public function icons(): array
    {
        return $this->codes('views/icons/C[0-9][0-9].svg');
    }

    private function codes(string $pattern): array
    {
        $codes = array_map(static fn ($file) => pathinfo($file, PATHINFO_FILENAME), glob($this->moduleDir . '/' . $pattern) ?: []);
        sort($codes);

        return $codes;
    }

    /**
     * What the renderer needs on the product page and the order page.
     */
    public function rendererSettings(): array
    {
        $values = $this->all();
        $white = array_map('intval', $values['white']);

        $colours = [];
        foreach ($this->groupAttributes((int) $values['colourGroup']) as $attribute) {
            $colours[$attribute['id']] = [
                'name' => $attribute['name'],
                'hex' => $attribute['color'] ?: '#b0b4ba',
                'white' => in_array($attribute['id'], $white, true),
            ];
        }

        $sizes = [];
        foreach ($values['sizes'] as $attributeId => $diameter) {
            if ((float) $diameter > 0) {
                $sizes[(int) $attributeId] = (float) $diameter;
            }
        }

        return [
            'assets' => $this->moduleUri,
            'fonts' => $this->fonts(),
            'icons' => $this->icons(),
            'backFont' => $values['backFont'],
            'hole' => (float) $values['hole'],
            'defaults' => ['font' => $values['defaultFont'], 'icon' => $values['defaultIcon']],
            'sizeGroup' => (int) $values['sizeGroup'],
            'sizes' => (object) $sizes,
            'colourGroup' => (int) $values['colourGroup'],
            'colours' => (object) $colours,
        ];
    }

    /**
     * @return array<int, array{id: int, name: string, color: string}>
     */
    public function groupAttributes(int $groupId, ?int $langId = null): array
    {
        if (!$groupId) {
            return [];
        }
        $langId = $langId ?: (int) Configuration::get('PS_LANG_DEFAULT');
        $rows = AttributeGroup::getAttributes($langId, $groupId) ?: [];

        return array_map(static fn ($row) => [
            'id' => (int) $row['id_attribute'],
            'name' => (string) $row['name'],
            'color' => (string) $row['color'],
        ], $rows);
    }

    /**
     * Everything the configuration page shows.
     */
    public function formData(int $langId): array
    {
        $values = $this->all();

        $groups = array_map(static fn ($group) => [
            'id' => (int) $group['id_attribute_group'],
            'name' => (string) $group['name'],
        ], AttributeGroup::getAttributesGroups($langId) ?: []);

        $products = [];
        foreach ($values['products'] as $productId => $roles) {
            $product = new Product((int) $productId, false, $langId);
            $products[] = [
                'id' => (int) $productId,
                'name' => $product->id ? $product->name : '?',
                'roles' => $roles,
                'type' => $this->type((int) $productId),
                'typeRoles' => self::rolesOf($this->type((int) $productId)),
                'fields' => $this->textFields((int) $productId, $langId),
                'complete' => $this->product((int) $productId) !== null,
            ];
        }

        return [
            'values' => $values,
            'roles' => self::ROLES,
            'groups' => $groups,
            'sizeAttributes' => $this->groupAttributes((int) $values['sizeGroup'], $langId),
            'colourAttributes' => $this->groupAttributes((int) $values['colourGroup'], $langId),
            'products' => $products,
            'fonts' => $this->fonts(),
            'icons' => $this->icons(),
        ];
    }

    /**
     * @return array<int, string> text customization field id => label
     */
    private function textFields(int $productId, int $langId): array
    {
        $rows = Db::getInstance()->executeS(
            'SELECT cf.`id_customization_field`, cfl.`name`
            FROM `' . _DB_PREFIX_ . 'customization_field` cf
            LEFT JOIN `' . _DB_PREFIX_ . 'customization_field_lang` cfl
                ON cfl.`id_customization_field` = cf.`id_customization_field` AND cfl.`id_lang` = ' . $langId . '
                AND cfl.`id_shop` = ' . (int) Configuration::get('PS_SHOP_DEFAULT') . '
            WHERE cf.`id_product` = ' . $productId . ' AND cf.`type` = ' . Product::CUSTOMIZE_TEXTFIELD . '
                AND cf.`is_deleted` = 0
            ORDER BY cf.`id_customization_field`'
        ) ?: [];

        $fields = [];
        foreach ($rows as $row) {
            $fields[(int) $row['id_customization_field']] = (string) $row['name'];
        }

        return $fields;
    }

    /**
     * Saves the posted configuration form.
     *
     * @return string[] errors
     */
    public function saveFromRequest(array $input): array
    {
        $values = $this->all();
        $errors = [];

        $values['sizeGroup'] = (int) ($input['sizeGroup'] ?? 0);
        $values['colourGroup'] = (int) ($input['colourGroup'] ?? 0);

        $values['sizes'] = [];
        foreach ((array) ($input['sizes'] ?? []) as $attributeId => $diameter) {
            $diameter = (float) str_replace(',', '.', (string) $diameter);
            if ($diameter > 0) {
                $values['sizes'][(string) (int) $attributeId] = $diameter;
            }
        }
        $values['white'] = array_values(array_map('intval', array_keys(array_filter((array) ($input['white'] ?? [])))));

        $fonts = $this->fonts();
        foreach (['backFont', 'defaultFont'] as $key) {
            if (isset($input[$key]) && in_array($input[$key], $fonts, true)) {
                $values[$key] = $input[$key];
            }
        }
        if (isset($input['defaultIcon']) && in_array($input['defaultIcon'], $this->icons(), true)) {
            $values['defaultIcon'] = $input['defaultIcon'];
        }
        $hole = (float) str_replace(',', '.', (string) ($input['hole'] ?? $values['hole']));
        if ($hole > 0 && $hole < 10) {
            $values['hole'] = $hole;
        } else {
            $errors[] = 'The hole diameter must be between 0 and 10 mm.';
        }

        $products = [];
        $qrProducts = [];
        foreach ((array) ($input['products'] ?? []) as $productId => $roles) {
            if (!empty($roles['remove'])) {
                continue;
            }
            $productId = (int) $productId;
            $type = ($roles['type'] ?? '') === self::TYPE_QR ? self::TYPE_QR : self::TYPE_ADDRESS;
            $products[(string) $productId] = array_combine(
                self::rolesOf($type),
                array_map(static fn ($role) => (int) ($roles[$role] ?? 0), self::rolesOf($type))
            );
            if ($type === self::TYPE_QR) {
                $qrProducts[] = $productId;
            }
        }

        $newId = (int) ($input['addProduct'] ?? 0);
        if ($newId && !isset($products[(string) $newId])) {
            $type = ($input['addType'] ?? '') === self::TYPE_QR ? self::TYPE_QR : self::TYPE_ADDRESS;
            $roles = self::rolesOf($type);
            $fields = array_keys($this->textFields($newId, (int) Configuration::get('PS_LANG_DEFAULT')));
            if (!(new Product($newId))->id) {
                $errors[] = sprintf('Product %d does not exist.', $newId);
            } else {
                // Default mapping: the product's text fields in creation order
                $products[(string) $newId] = array_combine(
                    $roles,
                    array_map(static fn ($i) => (int) ($fields[$i] ?? 0), array_keys($roles))
                );
                if ($type === self::TYPE_QR) {
                    $qrProducts[] = $newId;
                }
                if (count($fields) < count($roles)) {
                    $errors[] = sprintf('Product %d needs %d text customization fields, it has %d.', $newId, count($roles), count($fields));
                }
            }
        }
        $values['products'] = $products;
        $values['qrProducts'] = $qrProducts;

        Configuration::updateGlobalValue(self::CONFIG_KEY, json_encode($values));
        $this->values = $values;

        return $errors;
    }
}
