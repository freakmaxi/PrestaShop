<?php
/**
 * Customization text limit: per-field maximum length for product text customizations.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

require_once __DIR__ . '/vendor/autoload.php';

use PrestaShop\Module\CustomTextLimit\LimitRepository;

class CustomTextLimit extends Module
{
    private const HOOKS = [
        'actionProductFormDataProviderData',
        'actionAfterUpdateProductFormHandler',
        'actionFrontControllerInitAfter',
    ];

    /** @var LimitRepository */
    private $limitRepository;

    public function __construct()
    {
        $this->name = 'customtextlimit';
        $this->tab = 'front_office_features';
        $this->version = '1.0.0';
        $this->author = 'Jakpark';
        $this->need_instance = 0;
        $this->bootstrap = true;
        $this->ps_versions_compliancy = ['min' => '9.0.0', 'max' => '9.99.99'];

        parent::__construct();

        $this->displayName = $this->trans('Customization text limit', [], 'Modules.Customtextlimit.Admin');
        $this->description = $this->trans('Set a maximum number of characters for each text customization field of a product.', [], 'Modules.Customtextlimit.Admin');

        $this->limitRepository = new LimitRepository();
    }

    public function isUsingNewTranslationSystem(): bool
    {
        return true;
    }

    public function install(): bool
    {
        return parent::install()
            && $this->limitRepository->createTable()
            && $this->limitRepository->importLegacySizeColumn()
            && $this->registerHook(self::HOOKS);
    }

    public function uninstall(): bool
    {
        return $this->limitRepository->dropTable() && parent::uninstall();
    }

    /**
     * Adds the stored limit to each customization field row of the product form.
     */
    public function hookActionProductFormDataProviderData(array $params): void
    {
        if (empty($params['data']['details']['customizations']['customization_fields'])) {
            return;
        }

        $limits = $this->limitRepository->getStoredLimits((int) $params['id']);
        foreach ($params['data']['details']['customizations']['customization_fields'] as &$field) {
            $field['size'] = $limits[(int) $field['id']] ?? null;
        }
        unset($field);
    }

    /**
     * Saves the submitted limits once core has created/updated the customization fields.
     */
    public function hookActionAfterUpdateProductFormHandler(array $params): void
    {
        if (!isset($params['form_data']['details']['customizations'])) {
            return;
        }

        $productId = (int) $params['id'];
        $submittedFields = $params['form_data']['details']['customizations']['customization_fields'] ?? [];

        // Rows added in the form have no id yet: core inserts them in submission order,
        // so they map to the product's remaining field ids in ascending order.
        $submittedIds = array_filter(array_map(static fn ($field) => (int) ($field['id'] ?? 0), $submittedFields));
        $newIds = array_values(array_diff($this->limitRepository->getActiveFieldIds($productId), $submittedIds));

        $limits = [];
        foreach ($submittedFields as $field) {
            $fieldId = (int) ($field['id'] ?? 0) ?: (int) array_shift($newIds);
            if (!$fieldId) {
                continue;
            }
            $size = $field['size'] ?? null;
            $limits[$fieldId] = ($size === null || $size === '') ? null : (int) $size;
        }

        $this->limitRepository->saveLimits($limits);
        $this->limitRepository->deleteOrphans();
    }

    /**
     * Exposes the limits to the theme and rejects texts that are too long.
     *
     * Runs in init(), so it covers the product page, its ajax refresh and postProcess().
     */
    public function hookActionFrontControllerInitAfter(array $params): void
    {
        $controller = $params['controller'] ?? null;
        if (!$controller instanceof FrontController || $controller->php_self !== 'product') {
            return;
        }

        $limits = $this->limitRepository->getTextFieldLimits((int) Tools::getValue('id_product'));
        $this->context->smarty->assign('customization_max_lengths', $limits);

        if (!Tools::isSubmit('submitCustomizedData')) {
            return;
        }

        foreach ($limits as $fieldId => $maxLength) {
            $key = 'textField' . $fieldId;
            if (!isset($_POST[$key]) || !is_string($_POST[$key])) {
                continue;
            }
            // Browsers count a line break as one character but submit it as \r\n
            if (mb_strlen(str_replace("\r\n", "\n", $_POST[$key])) > $maxLength) {
                // Removing the value makes ProductController::textRecord() skip this field
                unset($_POST[$key]);
                $controller->errors[] = $this->trans(
                    'Your text is too long (%max% characters max).',
                    ['%max%' => $maxLength],
                    'Modules.Customtextlimit.Shop'
                );
            }
        }
    }
}
