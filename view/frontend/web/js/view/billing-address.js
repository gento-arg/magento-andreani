/**
 * Copyright © 2016 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */
/*jshint browser:true*/
/*global define*/
define(
    [
        'ko',
        'Magento_Ui/js/form/form',
        'Magento_Customer/js/model/customer',
        'Magento_Customer/js/model/address-list',
        'Magento_Checkout/js/model/quote',
        'Magento_Checkout/js/action/create-billing-address',
        'Magento_Checkout/js/action/select-billing-address',
        'Magento_Checkout/js/checkout-data',
        'Magento_Checkout/js/model/checkout-data-resolver',
        'Magento_Customer/js/customer-data',
        'Magento_Checkout/js/action/set-billing-address',
        'Magento_Ui/js/model/messageList',
        'mage/translate'
    ],
    function (
        ko,
        Component,
        customer,
        addressList,
        quote,
        createBillingAddress,
        selectBillingAddress,
        checkoutData,
        checkoutDataResolver,
        customerData,
        setBillingAddressAction,
        globalMessageList,
        $t
    ) {
        'use strict';

        var lastSelectedBillingAddress = null,
            newAddressOption = {
                getAddressInline: function () {
                    return $t('New Address');
                },
                customerAddressId: null
            },
            countryData = customerData.get('directory-data'),
            addressOptions = addressList().filter(function (address) {
                return address.getType() == 'customer-address';
            });

        addressOptions.push(newAddressOption);

        return Component.extend({
            defaults: {
                template: 'Magento_Checkout/billing-address'
            },
            currentBillingAddress: quote.billingAddress,
            currentBillingAddressCustomAttributes: quote.billingAddress.customAttributes,
            addressOptions: addressOptions,
            customerHasAddresses: addressOptions.length > 1,
            /**
             * Init component
             */
            initialize: function () {
                this._super();
                quote.paymentMethod.subscribe(function () {
                    checkoutDataResolver.resolveBillingAddress();
                }, this);
            },

            /**
             * @return {exports.initObservable}
             */
            initObservable: function () {
                this._super()
                    .observe({
                        selectedAddress: null,
                        isAddressDetailsVisible: quote.billingAddress() != null,
                        isAddressFormVisible: !customer.isLoggedIn() || addressOptions.length == 1,
                        isAddressSameAsShipping: false,
                        saveInAddressBook: 1
                    });

                quote.billingAddress.subscribe(function (newAddress) {
                    if (quote.isVirtual()) {
                        this.isAddressSameAsShipping(false);
                    } else {
                        this.isAddressSameAsShipping(
                            newAddress != null &&
                            newAddress.getCacheKey() == quote.shippingAddress().getCacheKey()
                        );
                    }

                    if (newAddress != null && newAddress.saveInAddressBook !== undefined) {
                        this.saveInAddressBook(newAddress.saveInAddressBook);
                    } else {
                        this.saveInAddressBook(1);
                    }
                    this.isAddressDetailsVisible(true);
                }, this);

                return this;
            },

            canUseShippingAddress: ko.computed(function () {
                return !quote.isVirtual() && quote.shippingAddress() && quote.shippingAddress().canUseForBilling();
            }),

            /**
             * @param {Object} address
             * @return {*}
             */
            addressOptionsText: function (address) {
                return address.getAddressInline();
            },

            /**
             * @return {Boolean}
             */
            useShippingAddress: function () {
                if (this.isAddressSameAsShipping()) {
                    selectBillingAddress(quote.shippingAddress());
                    if (window.checkoutConfig.reloadOnBillingAddress) {
                        setBillingAddressAction(globalMessageList);
                    }
                    this.isAddressDetailsVisible(true);
                } else {
                    lastSelectedBillingAddress = quote.billingAddress();
                    quote.billingAddress(null);
                    this.isAddressDetailsVisible(false);
                }
                checkoutData.setSelectedBillingAddress(null);

                return true;
            },

            /**
             * Update address action
             */
            updateAddress: function () {
                if (this.selectedAddress() && this.selectedAddress() != newAddressOption) {
                    selectBillingAddress(this.selectedAddress());
                    checkoutData.setSelectedBillingAddress(this.selectedAddress().getKey());
                    if (window.checkoutConfig.reloadOnBillingAddress) {
                        setBillingAddressAction(globalMessageList);
                    }
                } else {
                    this.source.set('params.invalid', false);
                    this.source.trigger(this.dataScopePrefix + '.data.validate');
                    if (this.source.get(this.dataScopePrefix + '.custom_attributes')) {
                        this.source.trigger(this.dataScopePrefix + '.custom_attributes.data.validate');
                    };

                    if (!this.source.get('params.invalid')) {
                        var addressData = this.source.get(this.dataScopePrefix),
                            newBillingAddress;

                        if (customer.isLoggedIn() && !this.customerHasAddresses) {
                            this.saveInAddressBook(1);
                        }
                        addressData.save_in_address_book = this.saveInAddressBook() ? 1 : 0;
                        newBillingAddress = createBillingAddress(addressData);

                        // New address must be selected as a billing address
                        selectBillingAddress(newBillingAddress);
                        checkoutData.setSelectedBillingAddress(newBillingAddress.getKey());
                        checkoutData.setNewCustomerBillingAddress(addressData);

                        if (window.checkoutConfig.reloadOnBillingAddress) {
                            setBillingAddressAction(globalMessageList);
                        }
                    }
                }
            },

            /**
             * Edit address action
             */
            editAddress: function () {
                lastSelectedBillingAddress = quote.billingAddress();
                quote.billingAddress(null);
                this.isAddressDetailsVisible(false);
            },

            /**
             * Cancel address edit action
             */
            cancelAddressEdit: function () {
                this.restoreBillingAddress();

                if (quote.billingAddress()) {
                    // restore 'Same As Shipping' checkbox state
                    this.isAddressSameAsShipping(
                        quote.billingAddress() != null &&
                        quote.billingAddress().getCacheKey() == quote.shippingAddress().getCacheKey() &&
                        !quote.isVirtual()
                    );
                    this.isAddressDetailsVisible(true);
                }
            },

            /**
             * Restore billing address
             */
            restoreBillingAddress: function () {
                if (lastSelectedBillingAddress != null) {
                    selectBillingAddress(lastSelectedBillingAddress);
                }
            },

            /**
             * @param {Object} address
             */
            onAddressChange: function (address) {
                this.isAddressFormVisible(address == newAddressOption);
            },

            /**
             * @param {int} countryId
             * @return {*}
             */
            getCountryName: function (countryId) {
                return countryData()[countryId] != undefined ? countryData()[countryId].name : '';
            },
            getAltura: function ()
            {
                if(!customer.isLoggedIn() && this.isAddressSameAsShipping() && jQuery('#shipping-new-address-form input[name="altura"]').val())
                {
                    return jQuery('#shipping-new-address-form input[name="altura"]').val();
                }

                if(typeof this.currentBillingAddress() != "undefined" && typeof this.currentBillingAddress().customAttributes != "undefined" )
                {
                    if(typeof this.currentBillingAddress().customAttributes.altura != "undefined" &&
                        typeof this.currentBillingAddress().customAttributes.altura.value != "undefined")
                        return this.currentBillingAddress().customAttributes.altura.value;
                    if(typeof this.currentBillingAddress().customAttributes.altura != "undefined")
                        return this.currentBillingAddress().customAttributes.altura;

                    return '';
                }
                else
                    return '';
            },
            getPiso: function ()
            {
                if(!customer.isLoggedIn() && this.isAddressSameAsShipping() && jQuery('#shipping-new-address-form input[name="piso"]').val())
                {
                    return ', Piso: '+ jQuery('#shipping-new-address-form input[name="piso"]').val();
                }

                if(typeof this.currentBillingAddress() != "undefined" && typeof this.currentBillingAddress().customAttributes != "undefined")
                {
                    if(typeof this.currentBillingAddress().customAttributes.piso != "undefined" &&
                        typeof this.currentBillingAddress().customAttributes.piso.value != "undefined")
                        return ', Piso: '+ this.currentBillingAddress().customAttributes.piso.value;
                    if(typeof this.currentBillingAddress().customAttributes.piso != "undefined")
                        return ', Piso: '+ this.currentBillingAddress().customAttributes.piso;

                    return '';
                }
                else
                    return '';
            },
            getDepartamento: function ()
            {
                if(!customer.isLoggedIn() && this.isAddressSameAsShipping() && jQuery('#shipping-new-address-form input[name="departamento"]').val())
                {
                    return ', Departamento: '+ jQuery('#shipping-new-address-form input[name="departamento"]').val();
                }

                if(typeof this.currentBillingAddress() != "undefined" && typeof this.currentBillingAddress().customAttributes != "undefined")
                {
                    if(typeof this.currentBillingAddress().customAttributes.departamento != "undefined" &&
                        typeof this.currentBillingAddress().customAttributes.departamento.value != "undefined")
                        return ', Departamento: '+ this.currentBillingAddress().customAttributes.departamento.value;
                    if(typeof this.currentBillingAddress().customAttributes.departamento != "undefined")
                        return ', Departamento: '+ this.currentBillingAddress().customAttributes.departamento;

                    return '';
                }
                else
                    return '';
            }
        });
    }
);
