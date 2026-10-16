<?php
/**
 * Orders > Tag engraving: tags sold elsewhere (eBay, Etsy, Amazon) are designed with the shop's designer, kept in a
 * history and downloaded as engraving files, without an order in the shop.
 *
 * Its ajax action petId also creates the pet-id tag of a QR tag, for this page and for the order page.
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

use PrestaShop\Module\TagDesigner\Engravings;
use PrestaShop\Module\TagDesigner\OrderDesigns;
use PrestaShop\Module\TagDesigner\PetIdClient;
use PrestaShop\Module\TagDesigner\PetIds;
use PrestaShop\Module\TagDesigner\Settings;

class AdminTagEngravingController extends ModuleAdminController
{
    private const PER_PAGE = 25;

    private const TEXTS = ['reference', 'name', 'line1', 'line2', 'phone'];

    /** @var TagDesigner */
    public $module;

    /** @var Engravings */
    private $engravings;

    /** @var array|null a design sent with errors, shown again */
    private $posted;

    public function __construct()
    {
        $this->bootstrap = true;
        parent::__construct();
        $this->engravings = new Engravings();
    }

    public function setMedia($isNewTheme = false)
    {
        parent::setMedia($isNewTheme);

        $uri = $this->module->getPathUri();
        $this->addCSS([$uri . 'views/css/tag-designer.css', $uri . 'views/css/tag-engraving.css']);
        $this->addJS([
            $uri . TagDesigner::OPENTYPE,
            $uri . TagDesigner::QRCODE,
            $uri . 'views/js/tag-renderer.js',
            $uri . 'views/js/tag-qr.js',
            $uri . 'views/js/tag-designer-core.js',
            $uri . 'views/js/tag-engraving.js',
            $uri . 'views/js/tag-engraving-tool.js',
        ]);
    }

    public function postProcess()
    {
        if ($this->ajax) {
            if (Tools::getValue('action') === 'petId') {
                header('Content-Type: application/json');
                $this->ajaxRender(json_encode($this->petIdResponse()));
                exit;
            }

            return;
        }

        if (Tools::isSubmit('submitTagEngraving')) {
            $this->saveDesign();
        } elseif (Tools::isSubmit('deleteTagEngraving')) {
            if (!$this->access('delete')) {
                $this->errors[] = $this->trans('You do not have permission to delete this.', [], 'Admin.Notifications.Error');
            } elseif ($this->engravings->delete((int) Tools::getValue('id_engraving'))) {
                (new PetIds())->deleteFor(PetIds::ENGRAVING, (int) Tools::getValue('id_engraving'));
                $this->redirect_after = $this->pageLink(['conf' => 1]);
            } else {
                $this->errors[] = $this->trans('An error occurred during deletion.', [], 'Admin.Notifications.Error');
            }
        }
    }

    public function initContent()
    {
        if (!$this->viewAccess()) {
            parent::initContent();

            return;
        }

        $this->content .= $this->renderPage();
        $this->context->smarty->assign('content', $this->content);
    }

    private function saveDesign(): void
    {
        $id = (int) Tools::getValue('id_engraving');
        if (!$this->access($id ? 'edit' : 'add')) {
            $this->errors[] = $this->trans('You do not have permission to edit this.', [], 'Admin.Notifications.Error');

            return;
        }

        $values = $this->readForm();
        $errors = $this->check($values);
        if ($id && !$this->engravings->find($id)) {
            $errors[] = $this->trans('This engraving no longer exists.', [], 'Modules.Tagdesigner.Admin');
        }
        if ($errors) {
            $this->errors = array_merge($this->errors, $errors);
            $this->posted = $values;

            return;
        }

        $savedId = $this->engravings->save($values, $id, (int) $this->context->employee->id);
        if (!$savedId) {
            $this->errors[] = $this->trans('An error occurred while saving.', [], 'Modules.Tagdesigner.Admin');
            $this->posted = $values;

            return;
        }

        $this->redirect_after = $this->pageLink(['conf' => $id ? 4 : 3, 'saved' => $savedId]);
    }

    /**
     * Creates (once) the pet-id tag of one QR tag: source "order" with an order line id and the tag's number in
     * the line, or "engraving" with a saved design of this page. The values sent to pet-id are read here, not
     * taken from the browser.
     */
    private function petIdResponse(): array
    {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            return ['ok' => false, 'error' => 'POST only.'];
        }
        if (!$this->access('edit')) {
            return ['ok' => false, 'error' => $this->trans('You do not have permission to edit this.', [], 'Admin.Notifications.Error')];
        }

        $source = Tools::getValue('source') === PetIds::ENGRAVING ? PetIds::ENGRAVING : PetIds::ORDER;
        $id = (int) Tools::getValue('id');
        $unit = (int) Tools::getValue('unit');
        $values = null;
        if ($source === PetIds::ORDER) {
            $design = (new OrderDesigns($this->module->getSettings()))->forLine($id);
            if ($design && $design['type'] === Settings::TYPE_QR && $unit >= 0 && $unit < $design['quantity']) {
                $values = $design['values'];
            }
        } else {
            $row = $this->engravings->find($id);
            if ($row && $row['type'] === Settings::TYPE_QR && $unit === 0) {
                $values = ['name' => $row['name'], 'font' => $row['font'], 'icon' => $row['icon']];
            }
        }
        if ($values === null) {
            return ['ok' => false, 'error' => 'There is no such QR tag.'];
        }

        try {
            $tag = (new PetIds())->ensure($source, $id, $unit, $values, new PetIdClient());
        } catch (RuntimeException $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }

        return ['ok' => true, 'tag' => $tag];
    }

    private function readForm(): array
    {
        $values = ['type' => Tools::getValue('type') === Settings::TYPE_QR ? Settings::TYPE_QR : Settings::TYPE_ADDRESS];
        foreach (self::TEXTS as $key) {
            $values[$key] = trim(str_replace(["\r", "\n"], ' ', (string) Tools::getValue($key)));
        }
        // A QR tag has no address: its back is the QR code
        if ($values['type'] === Settings::TYPE_QR) {
            $values['line1'] = $values['line2'] = $values['phone'] = '';
        }
        $values['size'] = (int) Tools::getValue('size');
        $values['colour'] = (int) Tools::getValue('colour');
        $values['font'] = (string) Tools::getValue('font');
        $values['icon'] = (string) Tools::getValue('icon');

        return $values;
    }

    /**
     * The same checks as the product page: the browser has already checked the characters of the fonts.
     *
     * @return string[] errors
     */
    private function check(array $values): array
    {
        $settings = $this->module->getSettings();
        $renderer = $settings->rendererSettings();
        $errors = [];

        if ($values['reference'] === '') {
            $errors[] = $this->trans('Please enter the order reference (for example "Etsy 1234567").', [], 'Modules.Tagdesigner.Admin');
        }
        if (!isset(((array) $renderer['sizes'])[$values['size']])) {
            $errors[] = $this->trans('Please choose a size.', [], 'Modules.Tagdesigner.Admin');
        }
        if (!isset(((array) $renderer['colours'])[$values['colour']])) {
            $errors[] = $this->trans('Please choose a colour.', [], 'Modules.Tagdesigner.Admin');
        }
        if ($values['name'] === '') {
            $errors[] = $this->trans('Please enter the pet name.', [], 'Modules.Tagdesigner.Admin');
        }
        if (!in_array($values['font'], $settings->fonts(), true)) {
            $errors[] = $this->trans('Please choose a font.', [], 'Modules.Tagdesigner.Admin');
        }
        if (!in_array($values['icon'], $settings->icons(), true)) {
            $errors[] = $this->trans('Please choose an icon.', [], 'Modules.Tagdesigner.Admin');
        }

        $labels = $this->labels();
        foreach ($this->limits() as $key => $max) {
            if (mb_strlen($values[$key]) > $max) {
                $errors[] = $this->trans('%field% is too long (%max% characters max).', ['%field%' => $labels[$key], '%max%' => $max], 'Modules.Tagdesigner.Admin');
            }
        }

        return $errors;
    }

    /** @return array<string, int> text => character limit */
    private function limits(): array
    {
        $limits = ['reference' => Engravings::LENGTHS['reference']];
        foreach ($this->module->getSettings()->limits() as $role => $max) {
            $limits[$role] = min($max, Engravings::LENGTHS[$role]);
        }

        return $limits;
    }

    private function labels(): array
    {
        return [
            'reference' => $this->trans('Order reference', [], 'Modules.Tagdesigner.Admin'),
            'name' => $this->trans('Pet name', [], 'Modules.Tagdesigner.Admin'),
            'line1' => $this->trans('Address line 1', [], 'Modules.Tagdesigner.Admin'),
            'line2' => $this->trans('Address line 2', [], 'Modules.Tagdesigner.Admin'),
            'phone' => $this->trans('Phone number', [], 'Modules.Tagdesigner.Admin'),
        ];
    }

    private function pageLink(array $params = []): string
    {
        return $this->context->link->getAdminLink(TagDesigner::ADMIN_TAB, true, [], $params);
    }

    private function renderPage(): string
    {
        $settings = $this->module->getSettings();
        $renderer = $settings->rendererSettings();
        $sizes = (array) $renderer['sizes'];
        $colours = (array) $renderer['colours'];

        $editId = $this->posted !== null ? (int) Tools::getValue('id_engraving') : (int) Tools::getValue('edit');
        $editing = $editId ? $this->engravings->find($editId) : null;
        if ($this->posted !== null) {
            $values = $this->posted;
        } elseif ($editing) {
            $values = [
                'type' => $editing['type'],
                'reference' => $editing['reference'],
                'size' => (int) $editing['id_size'],
                'colour' => (int) $editing['id_colour'],
                'name' => $editing['name'],
                'font' => $editing['font'],
                'icon' => $editing['icon'],
                'line1' => $editing['line1'],
                'line2' => $editing['line2'],
                'phone' => $editing['phone'],
            ];
        } else {
            $values = array_fill_keys(self::TEXTS, '') + [
                'type' => Tools::getValue('type') === Settings::TYPE_QR ? Settings::TYPE_QR : Settings::TYPE_ADDRESS,
                'size' => (int) array_key_first($sizes),
                'colour' => (int) array_key_first($colours),
                'font' => '',
                'icon' => '',
            ];
        }

        $search = trim((string) Tools::getValue('q'));
        $page = max(1, (int) Tools::getValue('page'));
        $history = $this->engravings->page($search, $page, self::PER_PAGE);
        $designs = array_map(fn ($row) => $this->engravings->design($row, $renderer), $history['rows']);
        $qrIds = array_column(array_filter($designs, static fn ($d) => $d['type'] === Settings::TYPE_QR), 'id');
        $tags = (new PetIds())->forSources(PetIds::ENGRAVING, $qrIds);
        foreach ($designs as &$design) {
            $design['quantity'] = 1;
            $design['tags'] = array_values($tags[$design['id']] ?? []);
        }
        unset($design);
        $editingTags = $editing ? array_values($tags[$editId] ?? (new PetIds())->forSources(PetIds::ENGRAVING, [$editId])[$editId] ?? []) : [];

        // The search is a GET form: the page's link parameters (controller, token) go in hidden fields
        $link = $this->pageLink();
        parse_str((string) parse_url($link, PHP_URL_QUERY), $searchParams);

        $limits = $this->limits();
        $this->context->smarty->assign([
            'ready' => $sizes && $colours,
            'configure_link' => $this->context->link->getAdminLink('AdminModules', true, [], ['configure' => $this->module->name]),
            'action' => $this->pageLink(),
            'new_link' => $this->pageLink(),
            'edit_id' => $editing ? $editId : 0,
            'values' => $values,
            'limits' => $limits,
            'sizes' => $sizes,
            'colours' => $colours,
            'editing_tags' => $editingTags,
            'petid_configured' => (new PetIdClient())->isConfigured(),
            'config' => array_merge($renderer, [
                'type' => $values['type'],
                'qrTag' => $editingTags ? ['id' => $editingTags[0]['id'], 'url' => $editingTags[0]['url']] : null,
                'values' => $values,
                'max' => $limits,
                'texts' => [
                    'nameGhost' => $this->trans('Name', [], 'Modules.Tagdesigner.Admin'),
                    'line1Ghost' => $this->trans('Street and number', [], 'Modules.Tagdesigner.Admin'),
                    'line2Ghost' => $this->trans('Postcode and town', [], 'Modules.Tagdesigner.Admin'),
                    'phoneGhost' => $this->trans('Phone number', [], 'Modules.Tagdesigner.Admin'),
                    'nameRequired' => $this->trans('Please enter the pet name.', [], 'Modules.Tagdesigner.Admin'),
                    'fontMissing' => $this->trans('This font has no %chars%: please choose another font.', [], 'Modules.Tagdesigner.Admin'),
                    'backMissing' => $this->trans('These characters cannot be engraved on the back: %chars%', [], 'Modules.Tagdesigner.Admin'),
                    'saveFailed' => $this->trans('The preview could not be drawn.', [], 'Modules.Tagdesigner.Admin'),
                ],
            ]),
            'history' => [
                'settings' => $renderer,
                'designs' => $designs,
                'petIdUrl' => $this->module->petIdUrl(),
                'total' => $history['total'],
                'page' => $page,
                'pages' => max(1, (int) ceil($history['total'] / self::PER_PAGE)),
                'search' => $search,
                'search_action' => (string) parse_url($link, PHP_URL_PATH),
                'search_params' => $searchParams,
                'saved' => (int) Tools::getValue('saved'),
            ],
            'page_link' => $this->pageLink($search !== '' ? ['q' => $search] : []),
        ]);

        return $this->context->smarty->fetch($this->module->getLocalPath() . 'views/templates/admin/engraving.tpl');
    }
}
