<?php

namespace Ids\Andreani\Plugin\Customer;

use Magento\Customer\Api\CustomerMetadataInterface;
use Magento\Framework\Api\DataObjectHelper;
use Magento\Framework\Api\ImageProcessorInterface;

/**
 * Class CustomerRepositoryPlugin
 *
 * @description Plugin para sobre-escribir el comportamiento del guardado de clientes cuando el usuario es invitado
 * y se va a registrar luego de una compra exitosa, debido a un problema de magento al usar atributos custom.
 *
 * @author Mauro Maximiliano Martinez <mmartinez@ids.net.ar>
 * @package Ids\Andreani\Plugin\Customer
 */
class CustomerRepositoryPlugin
{
    /**
     * @var \Magento\Customer\Model\CustomerRegistry
     */
    protected $customerRegistry;

    /**
     * @var ImageProcessorInterface
     */
    protected $imageProcessor;

    /**
     * @var \Magento\Framework\Api\ExtensibleDataObjectConverter
     */
    protected $extensibleDataObjectConverter;

    /**
     * @var \Magento\Customer\Model\CustomerFactory
     */
    protected $customerFactory;

    /**
     * @var \Magento\Store\Model\StoreManagerInterface
     */
    protected $storeManager;

    /**
     * @var \Magento\Customer\Model\ResourceModel\AddressRepository
     */
    protected $addressRepository;

    /**
     * @var \Magento\Framework\Event\ManagerInterface
     */
    protected $eventManager;
    
    /**
     * CustomerRepositoryPlugin constructor.
     * @param \Magento\Customer\Model\CustomerFactory $customerFactory
     * @param \Magento\Customer\Model\Data\CustomerSecureFactory $customerSecureFactory
     * @param \Magento\Customer\Model\CustomerRegistry $customerRegistry
     * @param \Magento\Customer\Model\ResourceModel\AddressRepository $addressRepository
     * @param CustomerMetadataInterface $customerMetadata
     * @param \Magento\Framework\Event\ManagerInterface $eventManager
     * @param \Magento\Store\Model\StoreManagerInterface $storeManager
     * @param \Magento\Framework\Api\ExtensibleDataObjectConverter $extensibleDataObjectConverter
     * @param DataObjectHelper $dataObjectHelper
     * @param ImageProcessorInterface $imageProcessor
     */
    public function __construct(
        \Magento\Customer\Model\CustomerFactory $customerFactory,
        \Magento\Customer\Model\Data\CustomerSecureFactory $customerSecureFactory,
        \Magento\Customer\Model\CustomerRegistry $customerRegistry,
        \Magento\Customer\Model\ResourceModel\AddressRepository $addressRepository,
        \Magento\Customer\Api\CustomerMetadataInterface $customerMetadata,
        \Magento\Framework\Event\ManagerInterface $eventManager,
        \Magento\Store\Model\StoreManagerInterface $storeManager,
        \Magento\Framework\Api\ExtensibleDataObjectConverter $extensibleDataObjectConverter,
        DataObjectHelper $dataObjectHelper,
        ImageProcessorInterface $imageProcessor
    ) {
        $this->customerFactory = $customerFactory;
        $this->customerSecureFactory = $customerSecureFactory;
        $this->customerRegistry = $customerRegistry;
        $this->addressRepository = $addressRepository;
        $this->eventManager = $eventManager;
        $this->storeManager = $storeManager;
        $this->extensibleDataObjectConverter = $extensibleDataObjectConverter;
        $this->imageProcessor = $imageProcessor;
    }

    /**
     * @param $customerRepository
     * @param \Closure $proceed
     * @param $customer
     * @param null $passwordHash
     * @return mixed
     * @throws \Magento\Framework\Exception\InputException
     */
    public function aroundSave(
        $customerRepository,
        \Closure $proceed,
        $customer,
        $passwordHash = null
    )
    {
        $prevCustomerData = null;
        if ($customer->getId()) {
            $prevCustomerData = $customerRepository->getById($customer->getId());
        }
        $customer = $this->imageProcessor->save(
            $customer,
            CustomerMetadataInterface::ENTITY_TYPE_CUSTOMER,
            $prevCustomerData
        );

        $origAddresses = $customer->getAddresses();
        $customer->setAddresses([]);
        $customerData = $this->extensibleDataObjectConverter->toNestedArray(
            $customer,
            [],
            '\Magento\Customer\Api\Data\CustomerInterface'
        );

        $customerArray = $customer->__toArray();

        /**
         * Fix para registracion de clientes cuando ingresan por una compra exitosa
         */
        if(isset($customerArray['dni']))
        {
            $customerData['dni'] = $customerArray['dni'];
        }

        $customer->setAddresses($origAddresses);
        $customerModel = $this->customerFactory->create(['data' => $customerData]);
        $storeId = $customerModel->getStoreId();
        if ($storeId === null) {
            $customerModel->setStoreId($this->storeManager->getStore()->getId());
        }
        $customerModel->setId($customer->getId());

        // Need to use attribute set or future updates can cause data loss
        if (!$customerModel->getAttributeSetId()) {
            $customerModel->setAttributeSetId(
                \Magento\Customer\Api\CustomerMetadataInterface::ATTRIBUTE_SET_ID_CUSTOMER
            );
        }
        // Populate model with secure data
        if ($customer->getId()) {
            $customerSecure = $this->customerRegistry->retrieveSecureData($customer->getId());
            $customerModel->setRpToken($customerSecure->getRpToken());
            $customerModel->setRpTokenCreatedAt($customerSecure->getRpTokenCreatedAt());
            $customerModel->setPasswordHash($customerSecure->getPasswordHash());
            $customerModel->setFailuresNum($customerSecure->getFailuresNum());
            $customerModel->setFirstFailure($customerSecure->getFirstFailure());
            $customerModel->setLockExpires($customerSecure->getLockExpires());
        } else {
            if ($passwordHash) {
                $customerModel->setPasswordHash($passwordHash);
            }
        }

        // If customer email was changed, reset RpToken info
        if ($prevCustomerData
            && $prevCustomerData->getEmail() !== $customerModel->getEmail()
        ) {
            $customerModel->setRpToken(null);
            $customerModel->setRpTokenCreatedAt(null);
        }
        $customerModel->save();
        $this->customerRegistry->push($customerModel);
        $customerId = $customerModel->getId();

        if ($customer->getAddresses() !== null) {
            if ($customer->getId()) {
                $existingAddresses = $customerRepository->getById($customer->getId())->getAddresses();
                $getIdFunc = function ($address) {
                    return $address->getId();
                };
                $existingAddressIds = array_map($getIdFunc, $existingAddresses);
            } else {
                $existingAddressIds = [];
            }

            $savedAddressIds = [];
            foreach ($customer->getAddresses() as $address) {
                $address->setCustomerId($customerId)
                    ->setRegion($address->getRegion());
                $this->addressRepository->save($address);
                if ($address->getId()) {
                    $savedAddressIds[] = $address->getId();
                }
            }

            $addressIdsToDelete = array_diff($existingAddressIds, $savedAddressIds);
            foreach ($addressIdsToDelete as $addressId) {
                $this->addressRepository->deleteById($addressId);
            }
        }

        $savedCustomer = $customerRepository->get($customer->getEmail(), $customer->getWebsiteId());
        $this->eventManager->dispatch(
            'customer_save_after_data_object',
            ['customer_data_object' => $savedCustomer, 'orig_customer_data_object' => $customer]
        );
        return $savedCustomer;
    }

}
