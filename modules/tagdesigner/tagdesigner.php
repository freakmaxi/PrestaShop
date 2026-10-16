<?php
/**
 * Tag designer: live preview of an engraved tag on the product page, and its engraving files on the order page.
 * Orders > Tag engraving designs tags sold elsewhere, keeps them in a history and makes their engraving files.
 * QR tags get their back (a pet-id QR code) and an access card from the pet-id service.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/src/Settings.php';
require_once __DIR__ . '/src/OrderDesigns.php';
require_once __DIR__ . '/src/Engravings.php';
require_once __DIR__ . '/src/PetIdClient.php';
require_once __DIR__ . '/src/PetIds.php';

use PrestaShop\Module\TagDesigner\Engravings;
use PrestaShop\Module\TagDesigner\OrderDesigns;
use PrestaShop\Module\TagDesigner\PetIdClient;
use PrestaShop\Module\TagDesigner\PetIds;
use PrestaShop\Module\TagDesigner\Settings;

class TagDesigner extends Module
{
    private const HOOKS = [
        'displayHeader',
        'actionFrontControllerInitAfter',
        'displayAdminOrderMain',
    ];

    public const OPENTYPE = 'views/lib/opentype-1.3.4.min.js';

    public const QRCODE = 'views/lib/qrcode-1.5.4.min.js';

    // Back office page of the engraving history, under Orders
    public const ADMIN_TAB = 'AdminTagEngraving';

    /** @var Settings */
    private $settings;

    public function __construct()
    {
        $this->name = 'tagdesigner';
        $this->tab = 'front_office_features';
        $this->version = '1.2.0';
        $this->author = 'Jakpark';
        $this->need_instance = 0;
        $this->bootstrap = true;
        $this->ps_versions_compliancy = ['min' => '9.0.0', 'max' => '9.99.99'];

        parent::__construct();

        $this->displayName = $this->trans('Tag designer', [], 'Modules.Tagdesigner.Admin');
        $this->description = $this->trans('Live preview of engraved tags on the product page, engraving files on the order page.', [], 'Modules.Tagdesigner.Admin');

        // getPathUri() is not set yet when the module is loaded from the console
        $this->settings = new Settings(__DIR__, __PS_BASE_URI__ . 'modules/' . $this->name . '/');
    }

    public function isUsingNewTranslationSystem(): bool
    {
        return true;
    }

    public function install(): bool
    {
        return parent::install() && $this->registerHook(self::HOOKS) && $this->installEngravingPage();
    }

    public function uninstall(): bool
    {
        Configuration::deleteByName(Settings::CONFIG_KEY);
        (new Engravings())->dropTable();
        (new PetIds())->dropTable();
        $tabId = (int) Tab::getIdFromClassName(self::ADMIN_TAB);
        if ($tabId) {
            (new Tab($tabId))->delete();
        }

        return parent::uninstall();
    }

    /**
     * The tables and the Orders > Tag engraving menu entry (also run by the upgrades).
     */
    public function installEngravingPage(): bool
    {
        if (!(new Engravings())->createTable() || !(new Engravings())->addColumns() || !(new PetIds())->createTable()) {
            return false;
        }
        if (Tab::getIdFromClassName(self::ADMIN_TAB)) {
            return true;
        }

        $tab = new Tab();
        $tab->class_name = self::ADMIN_TAB;
        $tab->module = $this->name;
        $tab->id_parent = (int) Tab::getIdFromClassName('AdminParentOrders');
        $tab->active = true;
        $tab->wording = 'Tag engraving';
        $tab->wording_domain = 'Modules.Tagdesigner.Admin';
        foreach (Language::getLanguages(false) as $language) {
            $tab->name[(int) $language['id_lang']] = $this->trans('Tag engraving', [], 'Modules.Tagdesigner.Admin', $language['locale']);
        }

        return $tab->add();
    }

    public function getSettings(): Settings
    {
        return $this->settings;
    }

    public function getContent(): string
    {
        $output = '';
        if (Tools::isSubmit('submitTagDesigner')) {
            $errors = $this->settings->saveFromRequest($_POST['tagdesigner'] ?? []);
            $output .= $errors ? $this->displayError($errors) : $this->displayConfirmation($this->trans('Settings updated.', [], 'Admin.Notifications.Success'));
        }

        $petId = new PetIdClient();
        $this->context->smarty->assign([
            'action' => $this->context->link->getAdminLink('AdminModules', true, [], ['configure' => $this->name]),
            'form' => $this->settings->formData((int) $this->context->language->id),
            'petid' => ['configured' => $petId->isConfigured(), 'endpoints' => $petId->endpoints()],
        ]);

        return $output . $this->display(__FILE__, 'views/templates/admin/configure.tpl');
    }

    public function hookDisplayHeader(): void
    {
        $controller = $this->context->controller;
        if (!$controller instanceof ProductController || !$this->settings->product((int) Tools::getValue('id_product'))) {
            return;
        }

        $controller->registerStylesheet('tagdesigner', 'modules/' . $this->name . '/views/css/tag-designer.css');
        $controller->registerJavascript('tagdesigner-opentype', 'modules/' . $this->name . '/' . self::OPENTYPE, ['priority' => 200]);
        $controller->registerJavascript('tagdesigner-renderer', 'modules/' . $this->name . '/views/js/tag-renderer.js', ['priority' => 201]);
        if ($this->settings->type((int) Tools::getValue('id_product')) === Settings::TYPE_QR) {
            $controller->registerJavascript('tagdesigner-qrcode', 'modules/' . $this->name . '/' . self::QRCODE, ['priority' => 201]);
            $controller->registerJavascript('tagdesigner-qr', 'modules/' . $this->name . '/views/js/tag-qr.js', ['priority' => 202]);
        }
        $controller->registerJavascript('tagdesigner-form', 'modules/' . $this->name . '/views/js/tag-designer-core.js', ['priority' => 202]);
        $controller->registerJavascript('tagdesigner', 'modules/' . $this->name . '/views/js/tag-designer.js', ['priority' => 203]);
    }

    /**
     * Product page: gives the theme the designer settings and checks the submitted design.
     * Cart: refuses a designed product added without its design.
     *
     * Runs in init(), so it covers the product page, its ajax refresh and postProcess().
     */
    public function hookActionFrontControllerInitAfter(array $params): void
    {
        $controller = $params['controller'] ?? null;
        if (!$controller instanceof FrontController) {
            return;
        }

        if ($controller->php_self === 'product') {
            $productId = (int) Tools::getValue('id_product');
            $product = $this->settings->product($productId);
            if (!$product) {
                return;
            }
            $this->context->smarty->assign('tag_designer', $this->frontConfig($productId, $product));
            if (Tools::isSubmit('submitCustomizedData')) {
                $this->checkDesign($controller, $product);
            }
        } elseif ($controller->php_self === 'cart' && Tools::getIsset('add')) {
            if ($this->settings->product((int) Tools::getValue('id_product')) && !(int) Tools::getValue('id_customization')) {
                $controller->errors[] = $this->trans('Please design your tag before adding it to the cart.', [], 'Modules.Tagdesigner.Shop');
            }
        }
    }

    public function hookDisplayAdminOrderMain(array $params): string
    {
        $designs = (new OrderDesigns($this->settings))->forOrder((int) ($params['id_order'] ?? 0));
        if (!$designs) {
            return '';
        }

        $order = new Order((int) $params['id_order']);
        $this->context->smarty->assign([
            'designs' => $designs,
            'order_reference' => $order->reference,
            'assets' => $this->getPathUri(),
            'scripts' => [self::OPENTYPE, self::QRCODE, 'views/js/tag-renderer.js', 'views/js/tag-qr.js', 'views/js/tag-card.js', 'views/js/tag-engraving.js'],
            'settings' => $this->settings->rendererSettings(),
            'petid_url' => $this->petIdUrl(),
        ]);

        return $this->display(__FILE__, 'views/templates/admin/order-designs.tpl');
    }

    /**
     * Where the order page and the engraving page create the pet-id tag of a QR tag (AdminTagEngravingController).
     */
    public function petIdUrl(): string
    {
        return $this->context->link->getAdminLink(self::ADMIN_TAB, true, [], ['ajax' => 1, 'action' => 'petId']);
    }

    /**
     * Settings for views/js/tag-designer.js, as JSON in the designer's data-config attribute.
     */
    private function frontConfig(int $productId, array $product): array
    {
        $roles = [];
        foreach ($product as $role => $fieldId) {
            $roles[$role] = 'textField' . (int) $fieldId;
        }

        return array_merge($this->settings->rendererSettings(), [
            'productId' => $productId,
            'type' => $this->settings->type($productId),
            'fields' => $roles,
            'saveUrl' => $this->context->link->getProductLink($productId),
            'texts' => [
                'nameGhost' => $this->trans('Name', [], 'Modules.Tagdesigner.Shop'),
                'line1Ghost' => $this->trans('Street and number', [], 'Modules.Tagdesigner.Shop'),
                'line2Ghost' => $this->trans('Postcode and town', [], 'Modules.Tagdesigner.Shop'),
                'phoneGhost' => $this->trans('Phone number', [], 'Modules.Tagdesigner.Shop'),
                'nameRequired' => $this->trans('Please enter your pet\'s name.', [], 'Modules.Tagdesigner.Shop'),
                'fontMissing' => $this->trans('This font has no %chars%: please choose another font.', [], 'Modules.Tagdesigner.Shop'),
                'backMissing' => $this->trans('These characters cannot be engraved on the back: %chars%', [], 'Modules.Tagdesigner.Shop'),
                'saving' => $this->trans('Saving your design…', [], 'Modules.Tagdesigner.Shop'),
                'saveFailed' => $this->trans('Your design could not be saved, please try again.', [], 'Modules.Tagdesigner.Shop'),
                'loading' => $this->trans('Loading…', [], 'Modules.Tagdesigner.Shop'),
            ],
        ]);
    }

    /**
     * Server side check of a submitted design: the name is set, the icon and font exist. A rejected value is
     * removed from $_POST, so ProductController::textRecord() does not save it.
     */
    private function checkDesign(FrontController $controller, array $product): void
    {
        $name = 'textField' . (int) $product['name'];
        if (trim((string) ($_POST[$name] ?? '')) === '') {
            $controller->errors[] = $this->trans('Please enter your pet\'s name.', [], 'Modules.Tagdesigner.Shop');
        }

        $choices = [
            'icon' => $this->settings->icons(),
            'font' => $this->settings->fonts(),
        ];
        foreach ($choices as $role => $allowed) {
            $key = 'textField' . (int) $product[$role];
            if (!in_array($_POST[$key] ?? '', $allowed, true)) {
                unset($_POST[$key]);
                $controller->errors[] = $role === 'icon'
                    ? $this->trans('Please choose an icon.', [], 'Modules.Tagdesigner.Shop')
                    : $this->trans('Please choose a font.', [], 'Modules.Tagdesigner.Shop');
            }
        }
    }
}
