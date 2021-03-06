<?php

namespace Ids\Andreani\Block;

use Magento\Framework\View\Element\Template;
use Magento\Framework\View\Element\Template\Context;
use Magento\Sales\Model\ResourceModel\Order\Shipment\CollectionFactory as ShipmentCollectionFactory;
use Ids\Andreani\Helper\Data as AndreaniHelper;

class Generarhtmlmasivo extends Template
{
    /**
     * @var Order
     */
    protected $_order;

    /**
     * @var AndreaniHelper
     */
    protected $_andreaniHelper;

    /**
     * @var ShipmentCollectionFactory
     */
    protected $shipmentCollectionFactory;

    /**
     * Generarhtml constructor.
     * @param Context $context
     * @param AndreaniHelper $andreaniHelper
     */
    public function __construct
    (
        Context $context,
        ShipmentCollectionFactory $shipmentCollectionFactory,
        AndreaniHelper $andreaniHelper
    )
    {

        $this->_andreaniHelper  = $andreaniHelper;
        $this->shipmentCollectionFactory    = $shipmentCollectionFactory;
        parent::__construct($context);
    }

   
    public function getAndreaniDataGuiaMasiva($ordersIds)
    {
        //$order      = $this->_andreaniHelper->getLoadShipmentOrder($ordersIds) ;

        //Recorre la colección de envíos, y verifica si hay datos en el campo asignado
        //para guardar los datos que generarán la guía en PDF.
        $andreaniDatosGuia  = '';
        $guiasArray         = [];
        $shipmentCollection = $this->shipmentCollectionFactory->create()
            ->setOrderFilter(['in' => $ordersIds]);
        foreach($shipmentCollection AS $shipments)
        {
            if($shipments->getAndreaniDatosGuia() !='')
            {
                $andreaniDatosGuia                          = $shipments->getAndreaniDatosGuia();
                $guiasArray[$shipments['increment_id']]     = $andreaniDatosGuia;
            }
        }

        return $guiasArray;
    }

    /**
     * @description retorna el path de la ubicación del código de barras para generar la guía.
     * @param $numeroAndreani
     * @return string
     */
    public function getCodigoBarras($numeroAndreani)
    {
        return $this->_andreaniHelper->getCodigoBarras($numeroAndreani);
    }

    /**
     * @description devuelve el logo que el cliente sube por admin
     * @return string
     */
    public function getLogoEmpresaPath()
    {
        return $this->_andreaniHelper->getlogoEmpresaPath();
    }

    public function getClientCredentials($categoria)
    {
        $clientCredentials  = [];
        $categoria          = strtolower($categoria);

        switch($categoria)
        {
            case 'estandar': $clientCredentials['contrato'] = $this->_andreaniHelper->getEstandarContrato();
                break;
            case 'urgente' : $clientCredentials['contrato'] = $this->_andreaniHelper->getUrgenteContrato();
                break;
            default        : $clientCredentials['contrato'] = $this->_andreaniHelper->getSucursalContrato();
                break;
        }

        $clientCredentials['cliente'] = $this->_andreaniHelper->getNroCliente();

        return $clientCredentials;
    }
}