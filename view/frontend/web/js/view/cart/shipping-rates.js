/**
 * Copyright © 2016 Magento. All rights reserved.
 * See COPYING.txt for license details.
 */
define(
    [
        'jquery',
        'ko',
        'underscore',
        'uiComponent',
        'Magento_Checkout/js/model/shipping-service',
        'Magento_Catalog/js/price-utils',
        'Magento_Checkout/js/model/quote',
        'Magento_Checkout/js/action/select-shipping-method',
        'Magento_Checkout/js/checkout-data'
    ],
    function (
        $,
        ko,
        _,
        Component,
        shippingService,
        priceUtils,
        quote,
        selectShippingMethodAction,
        checkoutData
    ) {
        'use strict';

        return Component.extend({
            defaults: {
                template: 'Magento_Checkout/cart/shipping-rates'
            },
            isVisible: ko.observable(!quote.isVirtual()),
            isLoading: shippingService.isLoading,
            shippingRates: shippingService.getShippingRates(),
            shippingRateGroups: ko.observableArray([]),
            selectedShippingMethod: ko.computed(function () {
                    return quote.shippingMethod() ?
                        quote.shippingMethod()['carrier_code'] + '_' + quote.shippingMethod()['method_code'] :
                        null;
                }
            ),
            localidadesDisponibles: ko.observableArray([]),
            localidadSeleccionada:ko.observable(''),
            provinciasDisponibles: ko.observableArray(
                window.andreaniConfig.provincias
            ),
            provinciaSeleccionada:ko.observable(''),
            sucursalesAndreaniDisponibles: ko.observableArray([]),
            sucursalAndreaniSeleccionada: ko.observable(''),
            /**
             * @override
             */
            initObservable: function () {
                var self = this;
                this._super();

                this.shippingRates.subscribe(function (rates) {
                    self.shippingRateGroups([]);
                    _.each(rates, function (rate) {
                        var carrierTitle = rate['carrier_title'];

                        if (self.shippingRateGroups.indexOf(carrierTitle) === -1) {
                            self.shippingRateGroups.push(carrierTitle);
                        }
                    });
                });

                return this;
            },

            /**
             * Get shipping rates for specific group based on title.
             * @returns Array
             */
            getRatesForGroup: function (shippingRateGroupTitle) {
                return _.filter(this.shippingRates(), function (rate) {
                    return shippingRateGroupTitle === rate['carrier_title'];
                });
            },

            /**
             * Format shipping price.
             * @returns {String}
             */
            getFormattedPrice: function (price) {
                return priceUtils.formatPrice(price, quote.getPriceFormat());
            },

            /**
             * Set shipping method.
             * @param {String} methodData
             * @returns bool
             */
            selectShippingMethod: function (methodData) {
                selectShippingMethodAction(methodData);
                checkoutData.setSelectedShippingRate(methodData['carrier_code'] + '_' + methodData['method_code']);

                return true;
            },
            getLocalidades: function ()
            {
                var provinciaSeleccionada   = $('#andreanisucursal-provincia').val();
                var andreaniSucursalLocalidad = $('#andreanisucursal-localidad');

                $('.localidad-sin-sucursales').hide();

                if(provinciaSeleccionada)
                {
                    andreaniSucursalLocalidad.empty();
                    $('#andreanisucursal-sucursal').empty();
                    andreaniSucursalLocalidad.hide();
                    $('#andreanisucursal-sucursal').hide();
                    $('#block-shipping').addClass('andreani-loader');

                    $.ajax('/andreani/localidad/index',
                    {
                        type    : 'post',
                        context : this,
                        data    :
                        {
                            provincia_id: provinciaSeleccionada
                        },
                        success : function (response)
                        {
                            $('#s_method_sucursal').attr('checked',false);
                            andreaniSucursalLocalidad.append('<option>Seleccione una localidad</option>');
                            for(var i = 0; i < response.length; i++)
                            {
                                andreaniSucursalLocalidad.append('<option value="'+response[i]["codigo_postal"]+'">'+response[i]["localidad"]+'</option>')
                            }
                            andreaniSucursalLocalidad.show();
                            $('#block-shipping').removeClass('andreani-loader');
                        },
                        error   : function (e, status)
                        {
                            alert("Se produjo un error, por favor intentelo nuevamente");
                            $('#block-shipping').removeClass('andreani-loader');
                        }
                    });
                }
            },
            getSucursales: function ()
            {
                $('.localidad-sin-sucursales').hide();
                $('#andreanisucursal-sucursal').val('').hide();

                var provinciaSeleccionada = $('#andreanisucursal-provincia option:selected').text();
                var localidadSeleccionada = $('#andreanisucursal-localidad option:selected').text();
                var andreaniSucursal      = $('#andreanisucursal-sucursal');

                andreaniSucursal.empty();
                $('#block-shipping').addClass('andreani-loader');

                $.ajax('/andreani/sucursal/index',
                    {
                        type    : 'post',
                        context : this,
                        data    :
                        {
                            provincia: provinciaSeleccionada,
                            localidad: localidadSeleccionada
                        },
                        success : function (response)
                        {
                            if(response.length)
                            {
                                $('#s_method_sucursal').attr('checked',false);
                                andreaniSucursal.show();
                                andreaniSucursal.append('<option>Seleccione una sucursal de retiro</option>');
                                for(var i = 0; i < response.length; i++)
                                {
                                    andreaniSucursal.append('' +
                                        '<option value="'+response[i]["Sucursal"]+'">'+
                                        response[i]["Descripcion"] +
                                        ' ('+response[i]["Direccion"]+')'+
                                        '</option>'
                                    );
                                }
                            }
                            else
                            {
                                $('.localidad-sin-sucursales').show();
                                andreaniSucursal.hide();
                            }
                            $('#block-shipping').removeClass('andreani-loader');
                            //console.log(response);
                        },
                        error   : function (e, status)
                        {
                            alert("Se produjo un error, por favor intentelo nuevamente");
                            $('#block-shipping').removeClass('andreani-loader');
                        }
                    });
                
            },

            cotizacionAndreaniSucursal: function ()
            {
                var sucursalAndreaniSeleccionada = $('#andreanisucursal-sucursal').val();
                $('#block-shipping').addClass('andreani-loader');

                $.ajax('/andreani/webservice/cotizar',
                    {
                        type    : 'post',
                        context : this,
                        data    :
                        {
                            tipo        : 'sucursal',
                            quoteId     : quote.getQuoteId(),
                            sucursalId  : sucursalAndreaniSeleccionada,
                            /**
                             * Temporal: esto se debe cargar directamente cuando se aplica la sucursal en el controller
                             */
                            sucursalTxt : $('#andreanisucursal-sucursal option:selected').text()
                        },
                        success : function (response)
                        {
                            if(typeof response.cotizacion == 'undefined')
                            {
                                $('#block-shipping').removeClass('andreani-loader');
                                alert('No se encontraron cotizaciones para el envío a esta sucursal. Por favor intentelo nuevamente seleccionando otra.')
                            }
                            else
                            {
                                $('#s_method_sucursal').attr('checked',false);
                                //Ver la mejor manera de ponerle el precio
                                $('div#andreanisucursal-price span.price').html(response.cotizacion);
                                $('#block-shipping').removeClass('andreani-loader');
                                $('#andreanisucursal-price').show();

                                this.method_title = response.method_title;
                                this.price_incl_tax = response.cotizacion.slice(1);
                                selectShippingMethodAction(this);
                                checkoutData.setSelectedShippingRate(this.carrier_code + '_' + this.method_code);
                            }
                        },
                        error   : function (e, status)
                        {
                            alert("Se produjo un error, por favor intentelo nuevamente");
                            $('#block-shipping').removeClass('andreani-loader');
                        }
                    });

                return false;
            }
        });
    }
);
