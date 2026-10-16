<?php

namespace PrestaShop\Module\CustomTextLimit\Form;

use PrestaShop\Module\CustomTextLimit\LimitRepository;
use PrestaShopBundle\Form\Admin\Sell\Product\Options\CustomizationFieldType;
use Symfony\Component\Form\AbstractTypeExtension;
use Symfony\Component\Form\Extension\Core\Type\IntegerType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints\Range;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Adds a "max characters" input to each customization field row of the product page.
 */
class CustomizationFieldTypeExtension extends AbstractTypeExtension
{
    public function __construct(private readonly TranslatorInterface $translator)
    {
    }

    public static function getExtendedTypes(): iterable
    {
        return [CustomizationFieldType::class];
    }

    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $title = $this->translator->trans('Max characters (text fields only)', [], 'Modules.Customtextlimit.Admin');

        $builder->add('size', IntegerType::class, [
            'label' => false,
            'required' => false,
            'attr' => [
                'min' => 1,
                'max' => LimitRepository::MAX_LENGTH,
                'placeholder' => (string) LimitRepository::DEFAULT_LENGTH,
                'title' => $title,
                'aria-label' => $title,
            ],
            'constraints' => [
                new Range(min: 1, max: LimitRepository::MAX_LENGTH),
            ],
        ]);
    }
}
