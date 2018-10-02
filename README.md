# Módulo de envíos ANDREANI 2

## Requisitos

Para el correcto funcionamiento del módulo es necesario contar con:

```
Magento version >= 2.1.2 
```

## Instalación

Para concretar la instalacion del módulo es necesario realizar los siguientes pasos. Primeramente, parados en la carpeta root del proyecto añadimos el modulo a nuestro composer.json ejecutando:

```
composer require gento/magento-andreani
```

Nos instalará la última versión del modulo.

Una vez actualizado nuestro repositorio composer, procedemos a activar el modulo en magento:

```
1. php bin/magento module:enable Ids_Andreani --clear-static-content
2. php bin/magento setup:upgrade
3. rm -rf var/di var/view_preprocessed
4. php bin/magento setup:static-content:deploy
```	

## Autores

* IDS Soluciones eCommerce
* GENTo
