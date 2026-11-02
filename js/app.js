/* ==========================================================================
   LUXURY MOTORS ELITE CORP. — Lógica principal de la SPA
   Catálogo · Filtros · Carrito · Alquiler · Checkout · Disparo de PDF
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------- Configuración ---------------------------- */
  const TAX_RATE = 0.18;               // ITBIS
  const DEPOSIT_PER_UNIT = 500;        // Fianza reembolsable por unidad alquilada
  const DEFAULT_DURATION = 3;
  const DEFAULT_START_DATE = '2026-10-27';
  const MAX_DURATION = { dia: 30, hora: 48 };
  const CART_KEY = 'lme_cart_v1';

  const DEMO_DATA = {
    cliNombre: 'Sohany Galán García',
    cliCedula: '001-1234567-8',
    cliLicencia: 'DO-8874125-VIP (Vigente)',
    cliTelefono: '+1 (809) 555-0199',
    cliEmail: 'sohany.galan@luxurymotors.com',
    cliDireccion: 'Av. Anacaona #105, Torre Bella Vista, Santo Domingo, D.N.',
    cardNumber: '4532 8901 2345 8899',
    cardExpiry: '12/28',
    cardCvv: '789'
  };

  const HEADINGS = { todos: 'Colección completa', vehiculos: 'Vehículos de lujo', motos: 'Motocicletas de alta gama' };

  /* ------------------------------- Estado -------------------------------- */
  const state = {
    catalog: [],          // vehículos + motos
    byCode: new Map(),
    filter: 'todos',
    search: '',
    cart: [],             // { id, tipo: 'venta'|'alquiler', codigo, cantidad, modo?, duracion?, fechaInicio? }
    rentalTarget: null
  };

  /* ------------------------------ Utilidades ----------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escapeHtml = (v) => window.LMEPdf.escapeHtml(v);
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const modeLabel = (modo) => (modo === 'hora' ? 'Hora(s)' : 'Día(s)');

  const swal = Swal.mixin({
    customClass: { popup: 'lme-swal', confirmButton: 'btn lme-swal-confirm px-4', cancelButton: 'btn lme-swal-cancel px-4 ms-2' },
    buttonsStyling: false,
    background: '#0d121c',
    color: '#f8f9fa'
  });
  const toast = Swal.mixin({
    toast: true, position: 'top-end', timer: 2300, timerProgressBar: true, showConfirmButton: false,
    customClass: { popup: 'lme-swal' }, background: '#0d121c', color: '#f8f9fa'
  });

  const modals = {};
  const modal = (id) => (modals[id] ||= bootstrap.Modal.getOrCreateInstance(document.getElementById(id)));

  /* ------------------------------ Datos ---------------------------------- */
  function isValidCatalog(data) {
    return data && Array.isArray(data.vehiculos) && Array.isArray(data.motos);
  }

  async function loadCatalog() {
    let data = null;
    let source = '';
    try {
      const res = await fetch('vehiculo.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      if (!isValidCatalog(data)) throw new Error('Estructura inválida');
      source = '<i class="fa-solid fa-cloud-arrow-down lme-cyan"></i> Fuente: vehiculo.json (fetch)';
    } catch (err) {
      console.warn('[LME] fetch(vehiculo.json) no disponible, usando respaldo embebido:', err.message);
      data = window.CATALOGO_RESPALDO;
      source = '<i class="fa-solid fa-database lme-gold"></i> Fuente: respaldo embebido (modo file://)';
    }
    if (!isValidCatalog(data)) throw new Error('No hay datos de catálogo disponibles.');

    state.catalog = [...data.vehiculos, ...data.motos].map((item) => ({ ...item, codigo: Number(item.codigo) }));
    state.byCode = new Map(state.catalog.map((item) => [item.codigo, item]));
    $('#dataSource').innerHTML = source;
  }

  /* ------------------------------ Catálogo ------------------------------- */
  function fuelIcon(fuel) {
    const f = String(fuel).toLowerCase();
    if (f.includes('eléctr') || f.includes('electr')) return 'fa-bolt';
    if (f.includes('híbrid') || f.includes('hibrid')) return 'fa-leaf';
    return 'fa-gas-pump';
  }

  function cardTemplate(v) {
    const stock = Number(v.existencia) || 0;
    const stockClass = stock === 0 ? 'is-out' : stock <= 2 ? 'is-low' : '';
    const stockText = stock === 0 ? 'Agotado' : stock <= 2 ? `Últimas ${stock}` : `${stock} disponibles`;
    const doors = Number(v.numeroPuertas) > 0 ? `${escapeHtml(v.numeroPuertas)} puertas` : 'Motocicleta';
    const disabled = stock === 0 ? 'disabled' : '';

    return `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="lme-card" aria-label="${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}">
          <div class="lme-card-media">
            <img src="${escapeHtml(v.imagen)}" alt="${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}" loading="lazy">
            <span class="lme-offer-badge">${escapeHtml(v.oferta_alquiler)}</span>
            <span class="lme-stock-badge ${stockClass}">${stockText}</span>
            <span class="lme-type-chip">${escapeHtml(v.tipo)}</span>
          </div>
          <div class="lme-card-body">
            <header class="lme-card-head">
              <img src="${escapeHtml(v.logo)}" alt="Logo ${escapeHtml(v.marca)}" class="lme-brand-logo">
              <div class="flex-grow-1 min-w-0">
                <p class="lme-card-brand">${escapeHtml(v.marca)}</p>
                <h3 class="lme-card-model">${escapeHtml(v.modelo)}</h3>
              </div>
              <span class="lme-card-code">Ref. ${escapeHtml(v.codigo)}</span>
            </header>
            <p class="lme-card-desc">${escapeHtml(v.caracteristicas)}</p>
            <ul class="lme-specs">
              <li><span class="lme-spec-label">Carrocería</span><span class="lme-spec-text">${doors}</span></li>
              <li><span class="lme-spec-label">Energía</span><span class="lme-spec-text"><i class="fa-solid ${fuelIcon(v.combustible)}"></i> ${escapeHtml(v.combustible)}</span></li>
              <li><span class="lme-spec-label">Stock</span><span class="lme-spec-text">${stock} ${stock === 1 ? 'unidad' : 'unidades'}</span></li>
              <li class="lme-spec-wide"><span class="lme-spec-label">Motor</span><span class="lme-spec-text" title="${escapeHtml(v.motor)}">${escapeHtml(v.motor)}</span></li>
            </ul>
            <div class="lme-prices">
              <div class="lme-price-main">
                <span class="lme-price-label">Precio de venta</span>
                <span class="lme-price-sale">${money(v.precio_venta)}</span>
              </div>
              <div class="lme-price-rent">
                <div><span class="lme-price-label">Alquiler / día</span><span class="lme-price-day">${money(v.precio_alquiler_dia)}</span></div>
                <div><span class="lme-price-label">Alquiler / hora</span><span class="lme-price-hour">${money(v.precio_alquiler_hora)}</span></div>
              </div>
            </div>
            <div class="lme-card-actions">
              <button type="button" class="btn lme-btn-rent" data-action="rent" data-codigo="${v.codigo}" ${disabled}>🔑 Alquilar</button>
              <button type="button" class="btn lme-btn-buy" data-action="buy" data-codigo="${v.codigo}" ${disabled}>🛒 Comprar</button>
            </div>
          </div>
        </article>
      </div>`;
  }

  function filteredCatalog() {
    const q = state.search.trim().toLowerCase();
    return state.catalog.filter((v) => {
      if (state.filter !== 'todos' && v.categoria !== state.filter) return false;
      if (!q) return true;
      return [v.marca, v.modelo, v.tipo, v.motor, v.combustible, v.caracteristicas, v.codigo]
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }

  function renderCatalog() {
    const list = filteredCatalog();
    $('#catalogGrid').innerHTML = list.map(cardTemplate).join('');
    $('#emptyState').classList.toggle('d-none', list.length > 0);
    $('#catalogHeading').textContent = HEADINGS[state.filter];
    const total = state.catalog.filter((v) => state.filter === 'todos' || v.categoria === state.filter).length;
    $('#resultsInfo').textContent = state.search
      ? `${list.length} de ${total} unidades coinciden con “${state.search}”`
      : `${total} unidades disponibles para compra inmediata o alquiler`;
  }

  function renderStats() {
    $('#statUnits').textContent = state.catalog.length;
    $('#statBrands').textContent = new Set(state.catalog.map((v) => v.marca.split(' ')[0])).size;
  }

  function renderSkeleton() {
    $('#catalogGrid').innerHTML = Array.from({ length: 6 }, () => '<div class="col-12 col-md-6 col-xl-4"><div class="lme-skeleton"></div></div>').join('');
  }

  /* ------------------------------- Carrito ------------------------------- */
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (_) { /* almacenamiento no disponible */ }
  }

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      state.cart = Array.isArray(raw)
        ? raw.filter((l) => state.byCode.has(Number(l.codigo)) && Number(l.cantidad) > 0)
        : [];
    } catch (_) {
      state.cart = [];
    }
  }

  /** Unidades de un código ya comprometidas en el carrito (venta + alquiler). */
  function reservedUnits(codigo, excludeId) {
    return state.cart
      .filter((l) => l.codigo === codigo && l.id !== excludeId)
      .reduce((sum, l) => sum + l.cantidad, 0);
  }

  function availableUnits(codigo, excludeId) {
    const v = state.byCode.get(codigo);
    return Math.max(0, (Number(v?.existencia) || 0) - reservedUnits(codigo, excludeId));
  }

  /** Enriquecer una línea del carrito con precios vigentes del catálogo. */
  function lineDetail(line) {
    const v = state.byCode.get(line.codigo);
    if (line.tipo === 'venta') {
      const precioUnit = v.precio_venta;
      return { v, precioUnit, tarifa: null, subtotal: round2(precioUnit * line.cantidad) };
    }
    const tarifa = line.modo === 'hora' ? v.precio_alquiler_hora : v.precio_alquiler_dia;
    const precioUnit = round2(tarifa * line.duracion);
    return { v, precioUnit, tarifa, subtotal: round2(precioUnit * line.cantidad) };
  }

  function computeTotals() {
    const subtotal = round2(state.cart.reduce((sum, l) => sum + lineDetail(l).subtotal, 0));
    const rentalUnits = state.cart.filter((l) => l.tipo === 'alquiler').reduce((s, l) => s + l.cantidad, 0);
    const itbis = round2(subtotal * TAX_RATE);
    const fianza = round2(rentalUnits * DEPOSIT_PER_UNIT);
    return { subtotal, itbis, fianza, rentalUnits, total: round2(subtotal + itbis + fianza) };
  }

  const cartCount = () => state.cart.reduce((sum, l) => sum + l.cantidad, 0);

  function updateBadges(bump = false) {
    const count = cartCount();
    $$('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      if (bump) {
        el.classList.remove('lme-bump');
        void el.offsetWidth; // reinicia la animación
        el.classList.add('lme-bump');
      }
    });
  }

  function addSale(codigo) {
    const v = state.byCode.get(codigo);
    if (availableUnits(codigo) <= 0) {
      swal.fire({ icon: 'warning', title: 'Stock insuficiente', html: `Ya tienes en el carrito todas las unidades disponibles de <strong class="lme-swal-cyan">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</strong>.` });
      return;
    }
    const id = `V-${codigo}`;
    const line = state.cart.find((l) => l.id === id);
    if (line) line.cantidad += 1;
    else state.cart.push({ id, tipo: 'venta', codigo, cantidad: 1 });
    commitCart(true);
    toast.fire({ icon: 'success', title: `🛒 ${v.marca} ${v.modelo} agregado a compras` });
  }

  function commitCart(bump = false) {
    saveCart();
    updateBadges(bump);
    renderCart();
  }

  function cartLineTemplate(line) {
    const { v, precioUnit, tarifa, subtotal } = lineDetail(line);
    const canAdd = availableUnits(line.codigo, line.id) > line.cantidad;
    const meta = line.tipo === 'venta'
      ? 'Adquisición Vehicular Definitiva'
      : `Alquiler: ${line.duracion} ${modeLabel(line.modo)} · Desde ${escapeHtml(line.fechaInicio)}`;
    const unit = line.tipo === 'venta'
      ? `Precio unitario: <span class="is-sale">${money(precioUnit)}</span>`
      : `Tarifa: <span class="is-rent">${money(tarifa)}/${line.modo === 'hora' ? 'hora' : 'día'}</span> × ${line.duracion} = <span class="is-rent">${money(precioUnit)}</span> por unidad`;

    return `
      <div class="lme-cart-item">
        <img src="${escapeHtml(v.imagen)}" alt="${escapeHtml(v.modelo)}">
        <div>
          <p class="lme-cart-name">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</p>
          <p class="lme-cart-meta">Código #${v.codigo} · ${meta}</p>
          <p class="lme-cart-unit">${unit}</p>
        </div>
        <div class="lme-cart-controls">
          <div class="lme-qty" role="group" aria-label="Cantidad">
            <button type="button" data-cart="dec" data-id="${line.id}" aria-label="Disminuir">−</button>
            <span>${line.cantidad}</span>
            <button type="button" data-cart="inc" data-id="${line.id}" aria-label="Aumentar" ${canAdd ? '' : 'disabled title="Sin más unidades en stock"'}>+</button>
          </div>
          <span class="lme-cart-subtotal">${money(subtotal)}</span>
          <button type="button" class="lme-remove" data-cart="remove" data-id="${line.id}"><i class="fa-solid fa-xmark"></i> Eliminar</button>
        </div>
      </div>`;
  }

  function renderCart() {
    const container = $('#cartContent');
    const hasItems = state.cart.length > 0;
    $('#clearCartBtn').disabled = !hasItems;
    $('#goCheckoutBtn').disabled = !hasItems;

    if (!hasItems) {
      container.innerHTML = `
        <div class="lme-cart-empty">
          <i class="fa-solid fa-cart-arrow-down"></i>
          <h4>Tu carrito está vacío</h4>
          <p>Explora el catálogo y pulsa “🛒 Comprar” o “🔑 Alquilar” en cualquier unidad.</p>
        </div>`;
      return;
    }

    const sales = state.cart.filter((l) => l.tipo === 'venta');
    const rentals = state.cart.filter((l) => l.tipo === 'alquiler');
    const t = computeTotals();

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-lg-8">
          ${sales.length ? `
            <section class="lme-cart-group">
              <h6 class="lme-cart-group-title is-sale"><i class="fa-solid fa-bag-shopping"></i> Compras definitivas (${sales.reduce((s, l) => s + l.cantidad, 0)})</h6>
              ${sales.map(cartLineTemplate).join('')}
            </section>` : ''}
          ${rentals.length ? `
            <section class="lme-cart-group">
              <h6 class="lme-cart-group-title is-rent"><i class="fa-solid fa-key"></i> Contratos de alquiler (${t.rentalUnits})</h6>
              ${rentals.map(cartLineTemplate).join('')}
            </section>` : ''}
        </div>
        <div class="col-lg-4">
          <div class="lme-summary-box">
            <h6 class="lme-calc-title"><i class="fa-solid fa-receipt"></i> Resumen financiero</h6>
            <div class="lme-summary-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>
            <div class="lme-summary-row"><span>Impuestos (ITBIS 18%)</span><strong>${money(t.itbis)}</strong></div>
            ${t.fianza > 0 ? `<div class="lme-summary-row is-deposit"><span><i class="fa-solid fa-shield-halved"></i> Fianza (${t.rentalUnits} × $500)</span><strong>${money(t.fianza)}</strong></div>` : ''}
            <div class="lme-summary-row lme-summary-total"><span>Total a pagar</span><strong>${money(t.total)}</strong></div>
            <p class="lme-summary-note">${t.fianza > 0 ? 'La fianza es reembolsable tras la inspección física de devolución y no genera ITBIS.' : 'Incluye garantía certificada de 3 años o 60,000 km en cada unidad vendida.'}</p>
          </div>
        </div>
      </div>`;
  }

  function handleCartAction(action, id) {
    const line = state.cart.find((l) => l.id === id);
    if (!line) return;
    if (action === 'inc') {
      if (availableUnits(line.codigo, line.id) > line.cantidad) line.cantidad += 1;
    } else if (action === 'dec') {
      line.cantidad -= 1;
      if (line.cantidad <= 0) state.cart = state.cart.filter((l) => l.id !== id);
    } else if (action === 'remove') {
      state.cart = state.cart.filter((l) => l.id !== id);
    }
    commitCart();
  }

  async function clearCart() {
    const res = await swal.fire({
      icon: 'question', title: '¿Vaciar el carrito?', text: 'Se eliminarán todas las compras y alquileres seleccionados.',
      showCancelButton: true, confirmButtonText: 'Sí, vaciar', cancelButtonText: 'Cancelar'
    });
    if (!res.isConfirmed) return;
    state.cart = [];
    commitCart();
    toast.fire({ icon: 'info', title: 'Carrito vaciado' });
  }

  /* ------------------------------- Alquiler ------------------------------ */
  const rentalMode = () => ($('input[name="rentalMode"]:checked')?.value === 'hora' ? 'hora' : 'dia');

  function openRental(codigo) {
    const v = state.byCode.get(codigo);
    if (!v) return;
    if (availableUnits(codigo) <= 0) {
      swal.fire({ icon: 'warning', title: 'Sin unidades libres', html: `Todas las unidades de <strong class="lme-swal-cyan">${escapeHtml(v.modelo)}</strong> ya están en tu carrito.` });
      return;
    }
    state.rentalTarget = v;
    $('#rentalImage').src = v.imagen;
    $('#rentalImage').alt = `${v.marca} ${v.modelo}`;
    $('#rentalBrandLogo').src = v.logo;
    $('#rentalBrandLogo').alt = `Logo ${v.marca}`;
    $('#rentalBrand').textContent = v.marca;
    $('#rentalModel').textContent = v.modelo;
    $('#rentalCode').textContent = `Código #${v.codigo} · ${v.tipo} · ${v.existencia} en stock`;
    $('#rentalOffer').textContent = v.oferta_alquiler;
    $('#rentalRateDay').textContent = `${money(v.precio_alquiler_dia)} /día`;
    $('#rentalRateHour').textContent = `${money(v.precio_alquiler_hora)} /hora`;

    $('#modeDay').checked = true;
    $('#rentalDurationInput').value = DEFAULT_DURATION;
    $('#rentalStartDate').value = DEFAULT_START_DATE;
    syncRentalMode();
    modal('rentalModal').show();
  }

  function syncRentalMode() {
    const modo = rentalMode();
    const input = $('#rentalDurationInput');
    input.max = MAX_DURATION[modo];
    $('#durationLabel').textContent = modo === 'hora' ? 'Cantidad de horas' : 'Cantidad de días';
    $('#durationHint').textContent = `Mínimo 1 · máximo ${MAX_DURATION[modo]} ${modo === 'hora' ? 'horas' : 'días'}`;
    if (Number(input.value) > MAX_DURATION[modo]) input.value = MAX_DURATION[modo];
    updateRentalCalc();
  }

  function readDuration() {
    const n = Number($('#rentalDurationInput').value);
    return Number.isInteger(n) && n >= 1 && n <= MAX_DURATION[rentalMode()] ? n : null;
  }

  function updateRentalCalc() {
    const v = state.rentalTarget;
    if (!v) return;
    const modo = rentalMode();
    const tarifa = modo === 'hora' ? v.precio_alquiler_hora : v.precio_alquiler_dia;
    const duracion = readDuration();
    $('#rentalDurationInput').classList.toggle('is-invalid', duracion === null);
    $('#calcRate').textContent = `${money(tarifa)} / ${modo === 'hora' ? 'hora' : 'día'}`;
    $('#calcDuration').textContent = duracion ? `${duracion} ${modeLabel(modo)}` : 'Valor inválido';
    $('#calcSubtotal').textContent = duracion ? money(round2(tarifa * duracion)) : '—';
    $('#addRentalBtn').disabled = duracion === null;
  }

  function stepDuration(delta) {
    const input = $('#rentalDurationInput');
    const max = MAX_DURATION[rentalMode()];
    const next = Math.min(max, Math.max(1, (parseInt(input.value, 10) || 0) + delta));
    input.value = next;
    updateRentalCalc();
  }

  function addRental() {
    const v = state.rentalTarget;
    const duracion = readDuration();
    const fechaInicio = $('#rentalStartDate').value;
    $('#rentalStartDate').classList.toggle('is-invalid', !fechaInicio);
    if (!v || !duracion || !fechaInicio) {
      swal.fire({ icon: 'error', title: 'Datos incompletos', text: 'Indica una duración válida y la fecha de inicio del alquiler.' });
      return;
    }
    if (availableUnits(v.codigo) <= 0) {
      swal.fire({ icon: 'warning', title: 'Stock insuficiente', text: 'No quedan unidades libres de este modelo.' });
      return;
    }
    const modo = rentalMode();
    const id = `R-${v.codigo}-${modo}-${duracion}-${fechaInicio}`;
    const line = state.cart.find((l) => l.id === id);
    if (line) line.cantidad += 1;
    else state.cart.push({ id, tipo: 'alquiler', codigo: v.codigo, cantidad: 1, modo, duracion, fechaInicio });
    commitCart(true);
    modal('rentalModal').hide();
    toast.fire({ icon: 'success', title: `🔑 Alquiler de ${v.modelo} agregado (${duracion} ${modeLabel(modo)})` });
  }

  /* ------------------------------- Checkout ------------------------------ */
  function fillDemoData(notify) {
    Object.entries(DEMO_DATA).forEach(([id, value]) => {
      const el = document.getElementById(id);
      el.value = value;
      el.classList.remove('is-invalid');
    });
    if (notify) toast.fire({ icon: 'success', title: '⚡ Datos Demo VIP cargados' });
  }

  function renderCheckoutSummary() {
    const t = computeTotals();
    const kind = window.LMEPdf.documentKind(state.cart);
    const lines = state.cart.map((line) => {
      const { v, subtotal } = lineDetail(line);
      const tag = line.tipo === 'venta'
        ? '<span class="is-sale">Compra</span>'
        : `<span class="is-rent">Alquiler ${line.duracion} ${modeLabel(line.modo)}</span>`;
      return `<div class="lme-secure-line"><span>${line.cantidad} × ${escapeHtml(v.marca)} ${escapeHtml(v.modelo)} · ${tag}</span><strong>${money(subtotal)}</strong></div>`;
    }).join('');

    $('#checkoutSummary').innerHTML = `
      ${lines}
      <div class="lme-secure-divider"></div>
      <div class="lme-secure-line"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>
      <div class="lme-secure-line"><span>ITBIS (18%)</span><strong>${money(t.itbis)}</strong></div>
      ${t.fianza > 0 ? `<div class="lme-secure-line"><span>Fianza reembolsable</span><strong class="lme-cyan">${money(t.fianza)}</strong></div>` : ''}`;
    $('#checkoutTotal').textContent = money(t.total);
    $('#checkoutDocType').innerHTML = `<i class="fa-solid fa-file-pdf lme-orange"></i> Se emitirá: <strong>${kind.title}</strong>`;
    $('#licenseRequired').classList.toggle('d-none', t.rentalUnits === 0);
  }

  function goCheckout() {
    if (!state.cart.length) return;
    renderCheckoutSummary();
    const cartEl = document.getElementById('cartModal');
    cartEl.addEventListener('hidden.bs.modal', () => modal('checkoutModal').show(), { once: true });
    modal('cartModal').hide();
  }

  function backToCart() {
    const checkoutEl = document.getElementById('checkoutModal');
    checkoutEl.addEventListener('hidden.bs.modal', () => modal('cartModal').show(), { once: true });
    modal('checkoutModal').hide();
  }

  function formatCardNumber(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiry(e) {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }

  function validateCheckout() {
    const errors = [];
    const val = (id) => document.getElementById(id).value.trim();
    const mark = (id, ok, msg) => {
      document.getElementById(id).classList.toggle('is-invalid', !ok);
      if (!ok) errors.push(msg);
    };
    const needsLicense = state.cart.some((l) => l.tipo === 'alquiler');

    mark('cliNombre', val('cliNombre').length >= 3, 'Nombre y apellidos');
    mark('cliCedula', val('cliCedula').length >= 5, 'Documento / Cédula');
    mark('cliLicencia', !needsLicense || val('cliLicencia').length >= 5, 'Licencia de conducir (obligatoria para alquileres)');
    mark('cliTelefono', val('cliTelefono').replace(/\D/g, '').length >= 7, 'Teléfono');
    mark('cliEmail', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('cliEmail')), 'Correo electrónico válido');
    mark('cliDireccion', val('cliDireccion').length >= 8, 'Dirección de entrega');
    mark('cardNumber', /^\d{16}$/.test(val('cardNumber').replace(/\s/g, '')), 'Número de tarjeta (16 dígitos)');

    const exp = val('cardExpiry').match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    let expOk = false;
    if (exp) {
      const now = new Date();
      const expEnd = new Date(2000 + Number(exp[2]), Number(exp[1]), 1); // primer día del mes siguiente
      expOk = expEnd > now;
    }
    mark('cardExpiry', expOk, 'Fecha de vencimiento (MM/AA, no vencida)');
    mark('cardCvv', /^\d{3,4}$/.test(val('cardCvv')), 'CVV (3 o 4 dígitos)');
    return errors;
  }

  function cardBrand(number) {
    const first = number.charAt(0);
    if (first === '4') return 'VISA';
    if (first === '5' || first === '2') return 'Mastercard';
    if (first === '3') return 'American Express';
    return 'Crédito';
  }

  function buildOrder() {
    const val = (id) => document.getElementById(id).value.trim();
    const digits = val('cardNumber').replace(/\s/g, '');
    const ordered = [...state.cart.filter((l) => l.tipo === 'venta'), ...state.cart.filter((l) => l.tipo === 'alquiler')];

    const items = ordered.map((line) => {
      const { v, precioUnit, tarifa, subtotal } = lineDetail(line);
      return {
        tipo: line.tipo,
        codigo: v.codigo,
        marca: v.marca,
        modelo: v.modelo,
        imagen: v.imagen,
        tipoVehiculo: v.tipo,
        modalidad: line.tipo === 'alquiler' ? modeLabel(line.modo) : null,
        duracion: line.duracion ?? null,
        fechaInicio: line.fechaInicio ?? null,
        tarifa,
        precioUnit,
        cantidad: line.cantidad,
        subtotal
      };
    });

    return {
      docNumber: 'LME-' + String(Math.floor(100000 + Math.random() * 900000)),
      fechaHora: new Date().toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short' }),
      metodoPago: `Tarjeta ${cardBrand(digits)} •••• ${digits.slice(-4)}`,
      cliente: {
        nombre: val('cliNombre'),
        cedula: val('cliCedula'),
        licencia: val('cliLicencia'),
        telefono: val('cliTelefono'),
        email: val('cliEmail'),
        direccion: val('cliDireccion')
      },
      items,
      totals: computeTotals()
    };
  }

  async function processPayment() {
    if (!state.cart.length) return;
    const errors = validateCheckout();
    if (errors.length) {
      swal.fire({
        icon: 'error',
        title: 'Revisa los datos',
        html: `Corrige los siguientes campos:<br><br>${errors.map((e) => `• <span class="lme-swal-strong">${escapeHtml(e)}</span>`).join('<br>')}<br><br>O pulsa <strong>⚡ Rellenar Datos Ficticios</strong> para restablecerlos.`
      });
      return;
    }

    const order = buildOrder();
    const payBtn = $('#payBtn');
    payBtn.disabled = true;

    swal.fire({
      title: 'Procesando pago seguro…',
      html: `Autorizando <strong class="lme-swal-strong">${money(order.totals.total)}</strong> con ${escapeHtml(order.metodoPago)}`,
      allowOutsideClick: false, allowEscapeKey: false, showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });
    await new Promise((r) => setTimeout(r, 1400));

    swal.update({ title: 'Generando documento oficial…', html: `Documento <strong class="lme-swal-cyan">${order.docNumber}</strong> · Formato A4 PDF` });
    Swal.showLoading();

    try {
      const { filename, kind } = await window.LMEPdf.generate(order);

      // Descontar del inventario las unidades vendidas
      order.items.filter((i) => i.tipo === 'venta').forEach((i) => {
        const v = state.byCode.get(i.codigo);
        if (v) v.existencia = Math.max(0, v.existencia - i.cantidad);
      });

      state.cart = [];
      commitCart(true);
      renderCatalog();
      window.LMEPdf.releaseModals();

      await swal.fire({
        icon: 'success',
        title: '¡Transacción aprobada!',
        html: `
          <p style="margin:0 0 .6rem;">Pago confirmado por <strong class="lme-swal-strong">${money(order.totals.total)}</strong>.</p>
          <p style="margin:0 0 .6rem;">Documento: <strong class="lme-swal-cyan">${escapeHtml(kind.title)}</strong></p>
          <p style="margin:0;">Archivo descargado:<br><strong class="lme-swal-strong" style="word-break:break-all;">${escapeHtml(filename)}</strong></p>`,
        confirmButtonText: 'Excelente'
      });
    } catch (err) {
      console.error('[LME] Error generando PDF:', err);
      window.LMEPdf.releaseModals();
      swal.fire({ icon: 'error', title: 'No se pudo generar el PDF', text: 'Tu carrito se conserva intacto. Inténtalo nuevamente.' });
    } finally {
      payBtn.disabled = false;
    }
  }

  /* -------------------------------- Eventos ------------------------------ */
  function openCart() {
    renderCart();
    modal('cartModal').show();
  }

  function bindEvents() {
    // Evita que el focus-trap de los modales Bootstrap robe el foco a SweetAlert2
    document.addEventListener('focusin', (e) => {
      if (e.target.closest && e.target.closest('.swal2-container')) e.stopImmediatePropagation();
    }, true);

    // Tarjetas (delegación)
    $('#catalogGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const codigo = Number(btn.dataset.codigo);
      if (btn.dataset.action === 'buy') addSale(codigo);
      if (btn.dataset.action === 'rent') openRental(codigo);
    });

    // Botones que abren el carrito (navbar, hero, flotante)
    $$('[data-action="open-cart"]').forEach((btn) => btn.addEventListener('click', openCart));

    // Pestañas
    $$('#categoryTabs .lme-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $$('#categoryTabs .lme-tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        state.filter = tab.dataset.filter;
        renderCatalog();
        scrollToCatalogIfNeeded();
      });
    });

    // Búsqueda en tiempo real
    $('#searchInput').addEventListener('input', (e) => {
      state.search = e.target.value;
      renderCatalog();
      scrollToCatalogIfNeeded();
    });

    // Modal de alquiler
    $$('input[name="rentalMode"]').forEach((r) => r.addEventListener('change', syncRentalMode));
    $('#rentalDurationInput').addEventListener('input', updateRentalCalc);
    $$('#rentalForm [data-step]').forEach((b) => b.addEventListener('click', () => stepDuration(Number(b.dataset.step))));
    $('#rentalStartDate').addEventListener('change', (e) => e.target.classList.toggle('is-invalid', !e.target.value));
    $('#addRentalBtn').addEventListener('click', addRental);
    $('#rentalForm').addEventListener('submit', (e) => { e.preventDefault(); addRental(); });

    // Carrito
    $('#cartContent').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart]');
      if (btn) handleCartAction(btn.dataset.cart, btn.dataset.id);
    });
    $('#clearCartBtn').addEventListener('click', clearCart);
    $('#goCheckoutBtn').addEventListener('click', goCheckout);

    // Checkout
    $('#fillDemoBtn').addEventListener('click', () => fillDemoData(true));
    $('#backToCartBtn').addEventListener('click', backToCart);
    $('#payBtn').addEventListener('click', processPayment);
    $('#checkoutForm').addEventListener('submit', (e) => { e.preventDefault(); processPayment(); });
    $('#cardNumber').addEventListener('input', formatCardNumber);
    $('#cardExpiry').addEventListener('input', formatExpiry);
    $('#cardCvv').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
    $$('#checkoutForm .lme-input').forEach((el) => el.addEventListener('input', () => el.classList.remove('is-invalid')));
  }

  function bindHeaderScroll() {
    const header = $('#siteHeader');
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function scrollToCatalogIfNeeded() {
    const top = $('#catalogo').getBoundingClientRect().top;
    if (top > window.innerHeight * 0.5) $('#catalogo').scrollIntoView({ behavior: 'smooth' });
  }

  /* ------------------------------- Arranque ------------------------------ */
  async function init() {
    renderSkeleton();
    bindEvents();
    bindHeaderScroll();
    try {
      await loadCatalog();
    } catch (err) {
      console.error(err);
      $('#catalogGrid').innerHTML = '';
      $('#resultsInfo').textContent = 'No fue posible cargar el inventario.';
      swal.fire({ icon: 'error', title: 'Catálogo no disponible', text: err.message });
      return;
    }
    loadCart();
    renderStats();
    renderCatalog();
    updateBadges();
    renderCart();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
