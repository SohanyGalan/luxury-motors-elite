# Luxury Motors Elite Corp. — E-Commerce y Alquiler de Vehículos Premium

SPA en HTML5 + CSS3 + Bootstrap 5.3.3 + JavaScript Vanilla (ES6+), con SweetAlert2, FontAwesome 6.5.1 y html2pdf.js.

## Cómo ejecutar

- **Doble clic en `index.html`**: funciona directamente (modo `file://`, usa el respaldo embebido del catálogo).
- **Con servidor local** (recomendado, carga `vehiculo.json` mediante `fetch`):
  ```bash
  python -m http.server 8000
  # abrir http://localhost:8000
  ```
  También sirve la extensión *Live Server* de VS Code.

## Estructura

```
index.html                 Estructura semántica, modales y footer oficial
css/styles.css             Estilos (todo encapsulado en clases .lme-*)
js/app.js                  Catálogo, filtros, carrito, alquiler, checkout
js/pdf.js                  Motor de Factura / Contrato PDF (html2pdf)
js/pdf_thumbnails.js       Miniaturas Base64 para el PDF   (autogenerado)
js/catalogo_respaldo.js    Copia embebida de vehiculo.json (autogenerado)
vehiculo.json              Catálogo: colecciones "vehiculos" y "motos"
assets/logo_pagina.png     Logotipo corporativo
assets/img/                Fotografías (créditos en assets/img/CREDITOS.md)
assets/logos/              Emblemas de marca (SVG)
assets/fonts/              Playfair Display y Montserrat (alojadas localmente, licencia OFL)
tools/generar_recursos.py  Regenera los dos archivos autogenerados
```

## Agregar o modificar vehículos

1. Edita `vehiculo.json` y coloca la foto en `assets/img/`.
2. Ejecuta `python tools/generar_recursos.py` (requiere `pip install pillow`).
   Esto regenera las miniaturas Base64 del PDF y el respaldo embebido.

## Reglas de negocio

| Concepto | Regla |
|---|---|
| ITBIS | 18 % sobre el subtotal (ventas + alquileres) |
| Fianza | $500 USD por unidad alquilada, reembolsable, no grava ITBIS |
| Alquiler | Tarifa (día u hora) × duración × unidades |
| Stock | Ventas + alquileres de un modelo no pueden superar su existencia |
| Documento | Solo ventas → `factura_de_venta_LME-XXXXXX.pdf` · Solo alquileres → `contrato_de_alquiler_y_acuerdo_de_responsabilidad_LME-XXXXXX.pdf` · Mixto → `factura_de_venta_y_contrato_de_alquiler_LME-XXXXXX.pdf` |
