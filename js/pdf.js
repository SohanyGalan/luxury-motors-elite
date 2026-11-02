/* ==========================================================================
   LUXURY MOTORS ELITE CORP. — Motor de documentos PDF
   - El documento se construye como Template String con CSS inline y se pasa
     directamente a html2pdf().from(html) (sin divs ocultos en el DOM).
   - Todas las imágenes salen de window.PDF_THUMBNAILS (Data URI Base64):
     cero CORS, cero lienzo "tainted", cero PDF en blanco.
   - Todo el texto lleva color explícito (#333333 / #111111) con !important
     dentro de .pdf-doc-root: no hereda nada del tema oscuro de la web.
   ========================================================================== */
(function () {
  'use strict';

  const LOGO_PATH = 'assets/logo_pagina.png';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function resolveImage(path) {
    const thumbs = window.PDF_THUMBNAILS || {};
    return thumbs[path] || path;
  }

  /** Tipo de documento según el contenido del carrito. */
  function documentKind(items) {
    const hasSale = items.some((i) => i.tipo === 'venta');
    const hasRent = items.some((i) => i.tipo === 'alquiler');
    if (hasSale && hasRent) {
      return { key: 'mixto', title: 'FACTURA DE VENTA Y CONTRATO DE ALQUILER', file: 'factura_de_venta_y_contrato_de_alquiler', includeClauses: true, includeWarranty: true };
    }
    if (hasRent) {
      return { key: 'alquiler', title: 'CONTRATO DE ALQUILER Y ACUERDO DE RESPONSABILIDAD', file: 'contrato_de_alquiler_y_acuerdo_de_responsabilidad', includeClauses: true, includeWarranty: false };
    }
    return { key: 'venta', title: 'FACTURA DE VENTA', file: 'factura_de_venta', includeClauses: false, includeWarranty: true };
  }

  function itemRow(item, index) {
    const isSale = item.tipo === 'venta';
    const badge = isSale
      ? '<span style="display:inline-block; background:#2e7d32; color:#ffffff !important; font-size:8px; font-weight:bold; padding:2px 7px; border-radius:10px; letter-spacing:0.5px;">VENTA</span>'
      : '<span style="display:inline-block; background:#0277bd; color:#ffffff !important; font-size:8px; font-weight:bold; padding:2px 7px; border-radius:10px; letter-spacing:0.5px;">ALQUILER</span>';
    const detail = isSale
      ? 'Adquisición Vehicular Definitiva'
      : `Alquiler: ${escapeHtml(item.duracion)} ${escapeHtml(item.modalidad)} (Desde ${escapeHtml(item.fechaInicio)})<br><span style="font-size:8.5px; color:#334155 !important;">Tarifa: ${money(item.tarifa)} / ${item.modalidad === 'Día(s)' ? 'día' : 'hora'}</span>`;
    const zebra = index % 2 === 1 ? 'background:#f8fafc;' : 'background:#ffffff;';
    const td = 'padding:6px 5px; border-bottom:1px solid #e5e7eb; vertical-align:middle; color:#333333 !important;';

    return `
      <tr style="${zebra} page-break-inside:avoid;">
        <td style="${td} text-align:center; font-weight:bold; color:#111111 !important;">${index + 1}</td>
        <td style="${td} text-align:center;"><img src="${resolveImage(item.imagen)}" alt="" style="width:55px; height:38px; object-fit:cover; border-radius:3px; border:1px solid #d1d5db; display:block; margin:0 auto;"></td>
        <td style="${td}">
          <strong style="color:#111111 !important; font-size:10px;">${escapeHtml(item.marca)}</strong><br>
          <span style="color:#1e3a8a !important; font-weight:bold;">${escapeHtml(item.modelo)}</span><br>
          <span style="font-size:8.5px; color:#334155 !important;">Código: ${escapeHtml(item.codigo)} · ${escapeHtml(item.tipoVehiculo)}</span>
        </td>
        <td style="${td} text-align:center;">${badge}</td>
        <td style="${td} font-size:9px;">${detail}</td>
        <td style="${td} text-align:right; white-space:nowrap;">${money(item.precioUnit)}</td>
        <td style="${td} text-align:center; font-weight:bold; color:#111111 !important;">${escapeHtml(item.cantidad)}</td>
        <td style="${td} text-align:right; white-space:nowrap; font-weight:bold; color:#111111 !important;">${money(item.subtotal)}</td>
      </tr>`;
  }

  function clausesBlock(clientName, clientId) {
    return `
   <!-- Acuerdo de Responsabilidad y Términos de Alquiler (OBLIGATORIO EN ALQUILER - BLINDADO CON !IMPORTANT) -->
   <div style="margin-top: 15px; padding: 10px 14px; background: #fafafa !important; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 9.5px; color: #333333 !important; line-height: 1.45;">
     <h5 style="margin: 0 0 6px 0; font-size: 10.5px; font-weight: bold; color: #111111 !important; text-transform: uppercase;">
       Acuerdo de Responsabilidad y Términos de Alquiler:
     </h5>
     <p style="margin: 0 0 4px 0; color: #333333 !important;"><strong style="color: #111111 !important;">1. Custodia del Bien:</strong> El arrendatario se compromete a operar la unidad bajo las leyes de tránsito vigentes, no exceder los límites de velocidad y mantener el vehículo en óptimas condiciones mecánicas y estéticas.</p>
     <p style="margin: 0 0 4px 0; color: #333333 !important;"><strong style="color: #111111 !important;">2. Cobertura & Deducible:</strong> La unidad cuenta con póliza de seguro completa con deducible del 10% en caso de colisión comprobada. Daños por negligencia, ingesta de alcohol o sustancias ilícitas son de responsabilidad exclusiva del arrendatario.</p>
     <p style="margin: 0 0 4px 0; color: #333333 !important;"><strong style="color: #111111 !important;">3. Política de Combustible:</strong> La unidad se entrega con tanque lleno y debe ser devuelta en las mismas condiciones. De lo contrario, se aplicará el cargo estándar de reposición.</p>
   </div>

   <!-- Firmas de Responsabilidad (BLINDADAS CONTRA TEXTO INVISIBLE) -->
   <table style="width: 100%; margin-top: 30px; font-size: 10px; text-align: center; page-break-inside: avoid;" cellpadding="0" cellspacing="0">
     <tr>
       <td style="width: 45%; vertical-align: top;">
         <div style="border-top: 1px solid #333; padding-top: 6px; margin: 0 20px;">
           <strong style="color: #111111 !important;">LUXURY MOTORS ELITE CORP.</strong><br>
           <span style="font-size: 9px; color: #555555 !important;">Firma Autorizada / Departamento Comercial</span>
         </div>
       </td>
       <td style="width: 10%;"></td>
       <td style="width: 45%; vertical-align: top;">
         <div style="border-top: 1px solid #333; padding-top: 6px; margin: 0 20px;">
           <strong style="color: #111111 !important;">${escapeHtml(clientName)}</strong><br>
           <span style="font-size: 9px; color: #555555 !important;">Doc ID: ${escapeHtml(clientId)} (Cliente / Arrendatario)</span>
         </div>
       </td>
     </tr>
   </table>`;
  }

  const WARRANTY_BLOCK = `
   <!-- Bloque de Entrega Venta -->
   <div style="margin-top: 20px; padding: 10px; background: #fdfdfd; border-left: 3px solid #2e7d32; font-size: 9.5px; color: #444;">
     <strong style="color:#111111 !important;">Garantía de Satisfacción:</strong> <span style="color:#444444 !important;">Unidad vendida con garantía certificada de 3 años o 60,000 km, traspaso legal garantizado y asistencia vial 24/7 de cortesía durante el primer año.</span>
   </div>`;

  /**
   * Construye el documento completo como String HTML.
   * @param {object} order { docNumber, fechaHora, cliente, metodoPago, items, totals }
   */
  function buildDocumentHtml(order) {
    const kind = documentKind(order.items);
    const c = order.cliente;
    const t = order.totals;
    const label = 'color:#111111 !important; font-weight:bold;';
    const val = 'color:#333333 !important;';
    const th = 'background:#111111; color:#ffffff !important; padding:7px 5px; font-size:9px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;';

    const depositNote = t.fianza > 0
      ? `<p style="margin:6px 0 0; font-size:9px; color:#1e3a8a !important;"><strong style="color:#1e3a8a !important;">Depósito de Fianza:</strong> ${money(t.fianza)} (${money(500)} por unidad alquilada), reembolsable tras la inspección física conforme a la devolución.</p>`
      : '';

    const licenseRow = order.items.some((i) => i.tipo === 'alquiler')
      ? `<tr><td style="${label} padding:1px 0; width:34%;">Licencia:</td><td style="${val}">${escapeHtml(c.licencia)}</td></tr>`
      : '';

    return `
<div class="pdf-doc-root" style="background:#ffffff !important; color:#333333 !important; font-family: Arial, Helvetica, sans-serif; font-size:10px; line-height:1.4; padding:4px 6px; width:100%; box-sizing:border-box;">

  <!-- 1. Encabezado centrado -->
  <div style="text-align:center; margin-bottom:12px;">
    <img src="${resolveImage(LOGO_PATH)}" alt="Luxury Motors Elite Corp." style="width:78px; height:78px; display:block; margin:0 auto 6px;">
    <h2 style="margin:0; font-size:18px; font-weight:bold; color:#111111 !important; letter-spacing:1.5px;">LUXURY MOTORS ELITE CORP.</h2>
    <p style="margin:3px 0 9px; font-size:9px; color:#334155 !important;">Av. Anacaona #105, Torre Empresarial Elite, Piso 14 | Tel: +1 (809) 555-ELITE | info@luxurymotors.com</p>
    <span style="display:inline-block; background:#111111; color:#ffffff !important; font-size:13px; font-weight:bold; padding:4px 18px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px;">${kind.title}</span>
  </div>

  <!-- 2. Metadatos y cliente -->
  <table style="width:100%; background:#f8f9fa; border:1px solid #e9ecef; border-radius:6px; border-collapse:separate; font-size:9.5px;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:52%; vertical-align:top; padding:8px 12px;">
        <p style="margin:0 0 4px; font-size:10px; font-weight:bold; color:#1e3a8a !important;">DATOS DEL CLIENTE:</p>
        <table style="width:100%; font-size:9.5px;" cellpadding="0" cellspacing="0">
          <tr><td style="${label} padding:1px 0; width:34%;">Nombre:</td><td style="${val}">${escapeHtml(c.nombre)}</td></tr>
          <tr><td style="${label} padding:1px 0;">Identificación:</td><td style="${val}">${escapeHtml(c.cedula)}</td></tr>
          ${licenseRow}
          <tr><td style="${label} padding:1px 0;">Teléfono:</td><td style="${val}">${escapeHtml(c.telefono)}</td></tr>
          <tr><td style="${label} padding:1px 0;">Email:</td><td style="${val}">${escapeHtml(c.email)}</td></tr>
          <tr><td style="${label} padding:1px 0; vertical-align:top;">Dirección:</td><td style="${val}">${escapeHtml(c.direccion)}</td></tr>
        </table>
      </td>
      <td style="width:48%; vertical-align:top; padding:8px 12px; border-left:1px solid #e9ecef;">
        <p style="margin:0 0 4px; font-size:10px; font-weight:bold; color:#1e3a8a !important;">DETALLES DE LA TRANSACCIÓN:</p>
        <table style="width:100%; font-size:9.5px;" cellpadding="0" cellspacing="0">
          <tr><td style="${label} padding:1px 0; width:40%;">No. Documento:</td><td style="${val} font-weight:bold;">${escapeHtml(order.docNumber)}</td></tr>
          <tr><td style="${label} padding:1px 0;">Fecha &amp; Hora:</td><td style="${val}">${escapeHtml(order.fechaHora)}</td></tr>
          <tr><td style="${label} padding:1px 0;">Método de Pago:</td><td style="${val}">${escapeHtml(order.metodoPago)}</td></tr>
          <tr><td style="${label} padding:1px 0;">Estado:</td><td style="color:#2e7d32 !important; font-weight:bold;">Procesado &amp; Confirmado</td></tr>
          <tr><td style="${label} padding:1px 0;">Agente Emisor:</td><td style="${val}">Sistema Automatizado JPV Pro</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- 3. Tabla de vehículos -->
  <table style="width:100%; margin-top:12px; border-collapse:collapse; font-size:9.5px;" cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        <th style="${th} width:4%; text-align:center;">#</th>
        <th style="${th} width:12%; text-align:center;">Foto</th>
        <th style="${th} width:28%; text-align:left;">Vehículo / Modelo</th>
        <th style="${th} width:11%; text-align:center;">Tipo</th>
        <th style="${th} width:21%; text-align:left;">Detalle</th>
        <th style="${th} width:10%; text-align:right;">Precio</th>
        <th style="${th} width:4%; text-align:center;">Cant.</th>
        <th style="${th} width:10%; text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${order.items.map(itemRow).join('')}
    </tbody>
  </table>

  <!-- 4. Resumen de totales -->
  <table style="width:100%; margin-top:12px; page-break-inside:avoid;" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:55%; vertical-align:top; padding-right:18px;">
        <p style="margin:0; font-size:9.5px; color:#777777 !important; line-height:1.45;">* Este documento constituye una certificación legal y comercial de los servicios y compras pactadas con Luxury Motors Elite Corp. Todo vehículo cuenta con inspección técnica certificada de 150 puntos.</p>
        ${depositNote}
      </td>
      <td style="width:45%; vertical-align:top;">
        <table style="width:100%; font-size:10px;" cellpadding="0" cellspacing="0">
          <tr><td style="padding:3px 0; color:#333333 !important;">Subtotal Bruto:</td><td style="padding:3px 0; text-align:right; color:#111111 !important;">${money(t.subtotal)}</td></tr>
          <tr><td style="padding:3px 0; color:#333333 !important;">Impuestos &amp; Tasas (ITBIS 18%):</td><td style="padding:3px 0; text-align:right; color:#111111 !important;">${money(t.itbis)}</td></tr>
          ${t.fianza > 0 ? `<tr><td style="padding:3px 0; color:#333333 !important;">Depósito de Fianza (Reembolsable):</td><td style="padding:3px 0; text-align:right; color:#111111 !important;">${money(t.fianza)}</td></tr>` : ''}
          <tr>
            <td style="border-top:2px solid #111111; padding:6px 0 0; font-size:14px; font-weight:800; color:#111111 !important;">TOTAL GENERAL:</td>
            <td style="border-top:2px solid #111111; padding:6px 0 0; font-size:14px; font-weight:800; text-align:right; color:#111111 !important;">${money(t.total)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- 5. Garantía / Cláusulas legales y doble firma -->
  ${kind.includeWarranty ? WARRANTY_BLOCK : ''}
  ${kind.includeClauses ? clausesBlock(c.nombre, c.cedula) : ''}

  <!-- 6. Pie de página -->
  <div style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 8px; text-align: center; font-size: 8.5px; color: #888;">
    Documento generado automáticamente por el Sistema E-Commerce & Alquiler de Vehículos Premium | Desarrollado por Sohany Galán García
  </div>
</div>`;
  }

  /** Cierra modales y elimina backdrops huérfanos para que la página nunca quede bloqueada. */
  function releaseModals() {
    document.querySelectorAll('.modal.show').forEach((modalElement) => {
      const modalInstance = bootstrap.Modal.getInstance(modalElement);
      if (modalInstance) modalInstance.hide();
    });
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
    document.body.style.removeProperty('overflow');
  }

  /**
   * Genera y descarga el PDF. Devuelve una Promise con { filename, kind }.
   */
  function generate(order) {
    const kind = documentKind(order.items);
    const filename = `${kind.file}_${order.docNumber}.pdf`;
    const htmlStringDefinitivo = buildDocumentHtml(order);

    releaseModals();

    const opt = {
      margin: [8, 8, 8, 8],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        scrollY: 0,
        scrollX: 0,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
    };

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        html2pdf().set(opt).from(htmlStringDefinitivo).save()
          .then(() => resolve({ filename, kind }))
          .catch(reject);
      }, 350);
    });
  }

  window.LMEPdf = { buildDocumentHtml, generate, documentKind, escapeHtml, releaseModals };
})();
