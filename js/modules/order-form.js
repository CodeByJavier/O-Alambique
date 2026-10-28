import { BUSINESS, ORDER } from '../config.js?v=20261028';
import { createElement, qs, qsa } from '../lib/dom.js?v=20261028';
import { loadAvailability, loadCatalog } from '../lib/catalog.js?v=20261028';
import { formatExtra, formatPrice } from '../lib/money.js?v=20261028';
import { describeWindows, getPickupSlots, getPickupWindows } from '../lib/pickup.js?v=20261028';
import { DAY_NAMES, formatLongDate, formatMinutes, getZonedNow, parseSimulatedNow } from '../lib/time.js?v=20261028';
import { normalizePhone, sanitizeText, validatePhone, validators } from '../lib/validators.js?v=20261028';
import { buildWhatsappUrl, openInNewTab } from '../lib/whatsapp.js?v=20261028';

const FIELD_LABELS = {
  lines: 'Platos',
  name: 'Nombre',
  phone: 'Teléfono',
  time: 'Hora de recogida',
  privacy: 'Política de privacidad',
};
const FIELD_ORDER = Object.keys(FIELD_LABELS);

const getNow = () => parseSimulatedNow() ?? getZonedNow(BUSINESS.timeZone);
const isSimulating = () => parseSimulatedNow() !== null;

const lineKey = (itemId, optionId) => `${itemId}|${optionId ?? ''}`;

const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

// Los iconos del sprite SVG necesitan el espacio de nombres SVG (createElement crearía elementos HTML)
function svgIcon(href) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', href);
  svg.append(use);
  return svg;
}

export function initOrderForm() {
  const root = qs('[data-order]');
  if (!root) return;

  const form = qs('[data-order-form]', root);
  const el = {
    root,
    form,
    statusBox: qs('[data-order-status]'),
    statusText: qs('[data-order-status-text]'),
    filters: qs('[data-order-filters]', root),
    items: qs('[data-order-items]', root),
    error: qs('[data-order-error]', root),
    retry: qs('[data-order-retry]', root),
    cartCount: qs('[data-cart-count]', root),
    cartEmpty: qs('[data-cart-empty]', root),
    cartLines: qs('[data-cart-lines]', root),
    cartTotalRow: qs('[data-cart-total-row]', root),
    cartTotal: qs('[data-cart-total]', root),
    cartClear: qs('[data-cart-clear]', root),
    cartError: qs('[data-error-for="lines"]', root),
    timeSelect: form.elements.time,
    timeHint: qs('[data-pickup-hint]', form),
    notes: form.elements.notes,
    counter: qs('[data-order-counter]', form),
    summary: qs('[data-order-summary]', form),
    summaryText: qs('[data-order-summary-text]', form),
    submit: qs('[data-order-submit]', form),
    submitLabel: qs('[data-order-submit-label]', form),
    success: qs('[data-order-success]', root),
    successTime: qs('[data-order-success-time]', root),
    whatsappLink: qs('[data-order-whatsapp-link]', root),
    reset: qs('[data-order-reset]', root),
    live: qs('[data-order-live]', root),
    bar: qs('[data-order-bar]'),
    barCount: qs('[data-order-bar-count]'),
    barTotal: qs('[data-order-bar-total]'),
    cart: qs('[data-order-cart]', root),
  };

  const state = {
    view: 'loading', // loading | ready | error
    status: 'idle', // idle | submitting | success
    catalog: null,
    availability: { ordersOpen: true, unavailable: new Set() },
    activeCategory: null,
    lines: new Map(), // clave → { itemId, optionId, qty }
    selectedOptions: new Map(), // plato → opción elegida en su selector (se conserva al redibujar)
    touched: new Set(),
    pickup: { reason: 'closed', slots: [], windows: [] },
  };

  /* ---------- Disponibilidad ---------- */

  const isChoiceAvailable = (choice) => !state.availability.unavailable.has(choice.id);

  const availableChoices = (item) =>
    item.options ? state.catalog.optionGroups[item.options].choices.filter(isChoiceAvailable) : [];

  const isItemAvailable = (item) =>
    !state.availability.unavailable.has(item.id) && (!item.options || availableChoices(item).length > 0);

  const canOrderNow = () => state.availability.ordersOpen && state.pickup.reason === 'ok';

  /* ---------- Precios ---------- */

  const findChoice = (item, optionId) =>
    item.options ? state.catalog.optionGroups[item.options].choices.find((choice) => choice.id === optionId) : null;

  const unitPrice = (line) => {
    const item = state.catalog.items.get(line.itemId);
    return item.price + (findChoice(item, line.optionId)?.price ?? 0);
  };

  const totals = () => {
    let count = 0;
    let amount = 0;
    state.lines.forEach((line) => {
      count += line.qty;
      amount += unitPrice(line) * line.qty;
    });
    return { count, amount };
  };

  /* ---------- Persistencia (por pestaña; si falla, el pedido sigue funcionando en memoria) ---------- */

  const saveLines = () => {
    try {
      const data = [...state.lines.values()].map(({ itemId, optionId, qty }) => [itemId, optionId, qty]);
      sessionStorage.setItem(ORDER.storageKey, JSON.stringify({ day: getNow().isoDate, lines: data }));
    } catch {
      /* almacenamiento no disponible (modo privado, bloqueado…) */
    }
  };

  const restoreLines = () => {
    let removed = 0;
    try {
      const saved = JSON.parse(sessionStorage.getItem(ORDER.storageKey) ?? 'null');
      if (!saved || saved.day !== getNow().isoDate || !Array.isArray(saved.lines)) return 0;

      saved.lines.slice(0, ORDER.maxLines).forEach(([itemId, optionId, qty]) => {
        const item = state.catalog.items.get(itemId);
        const choice = item ? findChoice(item, optionId) : null;
        const validOption = item && (item.options ? choice : optionId === null);
        const validQty = Number.isInteger(qty) && qty > 0 && qty <= ORDER.maxQuantityPerLine;
        if (!item || !validOption || !validQty) return;
        if (!isItemAvailable(item) || (choice && !isChoiceAvailable(choice))) {
          removed += 1;
          return;
        }
        state.lines.set(lineKey(itemId, optionId), { itemId, optionId: optionId ?? null, qty });
      });
    } catch {
      /* datos guardados corruptos: se empieza de cero */
    }
    return removed;
  };

  /* ---------- Aviso del estado de pedidos ---------- */

  const nextPickupDay = (now) => {
    for (let offset = 1; offset <= 7; offset += 1) {
      const weekday = (now.weekday + offset) % 7;
      const [first] = getPickupWindows(weekday);
      if (first) return `${offset === 1 ? 'mañana' : `el ${DAY_NAMES[weekday]}`} a partir de las ${formatMinutes(first.start)}`;
    }
    return '';
  };

  const renderStatus = () => {
    const now = getNow();
    state.pickup = getPickupSlots(now);
    const { reason, windows } = state.pickup;
    let tone = 'ok';
    let text;

    if (!state.availability.ordersOpen) {
      tone = 'paused';
      text = `Ahora mismo no aceptamos pedidos online. Llámanos al ${BUSINESS.phoneDisplay} y te atendemos.`;
    } else if (reason === 'ok') {
      text = `Hoy puedes recoger tu pedido ${describeWindows(windows)}. Pide con ${ORDER.minNoticeMinutes} minutos de antelación como mínimo.`;
    } else {
      tone = 'closed';
      const next = nextPickupDay(now);
      const today = reason === 'closed' ? `Hoy ${DAY_NAMES[now.weekday]} no hay recogida de pedidos.` : 'Por hoy ya no quedan horas de recogida.';
      text = next ? `${today} Puedes volver a pedir ${next}.` : today;
    }

    el.statusBox.dataset.state = tone;
    // Solo si cambia: así los lectores de pantalla no repiten el aviso cada minuto
    if (el.statusText.textContent !== text) el.statusText.textContent = text;
    renderTimeOptions();
    renderSubmitState();
  };

  const renderTimeOptions = () => {
    const previous = el.timeSelect.value;
    const { slots } = state.pickup;

    if (!canOrderNow()) {
      el.timeSelect.replaceChildren(createElement('option', { text: 'Sin horas disponibles', attrs: { value: '' } }));
      el.timeSelect.disabled = true;
      el.timeHint.textContent = '';
      return;
    }

    el.timeSelect.replaceChildren(
      createElement('option', { text: 'Elige una hora', attrs: { value: '' } }),
      ...slots.map((slot) => createElement('option', { text: slot, attrs: { value: slot } })),
    );
    el.timeSelect.disabled = false;
    el.timeSelect.value = slots.includes(previous) ? previous : '';
    el.timeHint.textContent = `Hoy, ${formatLongDate(getNow().isoDate)}.`;
  };

  /* ---------- Carta para pedir ---------- */

  const renderFilters = () => {
    el.filters.replaceChildren(
      ...state.catalog.categories.map((category) =>
        createElement('button', {
          className: 'order-filter',
          text: category.name,
          attrs: {
            type: 'button',
            'data-category': category.id,
            'aria-pressed': String(category.id === state.activeCategory),
            'aria-controls': 'order-items',
          },
        }),
      ),
    );
  };

  const renderOptionSelect = (item, available) => {
    const group = state.catalog.optionGroups[item.options];
    // Sin etiqueta visible: las opciones ya se explican solas («Ternera (incluida)»), pero el lector de pantalla sí la anuncia
    const select = createElement('select', {
      className: 'field__input field__select order-item__select',
      attrs: { 'data-option-for': item.id, 'aria-label': `${group.name} de ${item.name}` },
    });

    group.choices.forEach((choice) => {
      const label = choice.price ? `${choice.name} (${formatExtra(choice.price)})` : `${choice.name} (incluida)`;
      const option = createElement('option', {
        text: isChoiceAvailable(choice) ? label : `${choice.name} · no disponible`,
        attrs: { value: choice.id },
      });
      option.disabled = !isChoiceAvailable(choice);
      select.append(option);
    });

    const remembered = state.selectedOptions.get(item.id);
    const choices = availableChoices(item);
    const selected = choices.find((choice) => choice.id === remembered) ?? choices[0];
    if (selected) select.value = selected.id;
    select.disabled = !available;

    return createElement('div', { className: 'order-item__option' }, [select]);
  };

  const quantityInCart = (itemId) =>
    [...state.lines.values()].filter((line) => line.itemId === itemId).reduce((sum, line) => sum + line.qty, 0);

  const renderItems = () => {
    const category = state.catalog.categories.find(({ id }) => id === state.activeCategory);
    const children = [];

    if (category.note) {
      children.push(createElement('li', { className: 'order-items__note', text: category.note }));
    }

    category.items.forEach((item) => {
      const available = isItemAvailable(item);
      const inCart = quantityInCart(item.id);
      // Igual que en la carta: nombre, ingredientes, sugerencia (si la hay) y precio
      const info = createElement('div', { className: 'order-item__info' }, [
        createElement('h3', { className: 'order-item__name', text: item.name }),
      ]);
      if (item.description) info.append(createElement('p', { className: 'order-item__desc', text: item.description }));
      if (item.tip) info.append(createElement('p', { className: 'order-item__tip', text: item.tip }));
      info.append(createElement('p', { className: 'order-item__price', text: formatPrice(item.price) }));
      if (!available) info.append(createElement('p', { className: 'availability-badge', text: 'No disponible hoy' }));
      if (inCart) info.append(createElement('p', { className: 'order-item__in-cart', text: `En tu pedido: ${inCart}` }));

      const button = createElement(
        'button',
        {
          className: 'order-item__add',
          attrs: { type: 'button', 'data-add': item.id, 'aria-label': `Añadir ${item.name} al pedido` },
        },
        [svgIcon('#icon-plus'), createElement('span', { text: 'Añadir', attrs: { 'aria-hidden': 'true' } })],
      );
      button.disabled = !available;

      const classes = ['order-item', item.options && 'has-option', !available && 'is-unavailable'].filter(Boolean);
      const row = createElement('li', { className: classes.join(' ') }, [info]);
      if (item.options) row.append(renderOptionSelect(item, available));
      row.append(button);
      children.push(row);
    });

    el.items.replaceChildren(...children);
  };

  /* ---------- Pedido (carrito) ---------- */

  const iconButton = (icon, label, dataset) =>
    createElement('button', { className: 'cart-line__button', attrs: { type: 'button', 'aria-label': label, ...dataset } }, [
      svgIcon(icon),
    ]);

  const describeLine = (line) => {
    const item = state.catalog.items.get(line.itemId);
    const choice = findChoice(item, line.optionId);
    return { item, choice };
  };

  const renderCart = () => {
    const { count, amount } = totals();
    const hasLines = state.lines.size > 0;

    el.cartLines.replaceChildren(
      ...[...state.lines.entries()].map(([key, line]) => {
        const { item, choice } = describeLine(line);
        const info = createElement('div', { className: 'cart-line__info' }, [
          createElement('p', { className: 'cart-line__name', text: item.name }),
        ]);
        if (choice) {
          const extra = choice.price ? ` (${formatExtra(choice.price)})` : '';
          info.append(createElement('p', { className: 'cart-line__meta', text: `Carne: ${choice.name}${extra}` }));
        }

        const qty = createElement('div', { className: 'cart-line__qty' }, [
          iconButton('#icon-minus', `Quitar una unidad de ${item.name}`, { 'data-decrease': key }),
          createElement('span', { className: 'cart-line__count', text: String(line.qty), attrs: { 'aria-label': `${line.qty} unidades` } }),
          iconButton('#icon-plus', `Añadir una unidad de ${item.name}`, { 'data-increase': key }),
        ]);
        qty.lastChild.disabled = line.qty >= ORDER.maxQuantityPerLine;

        return createElement('li', { className: 'cart-line' }, [
          info,
          qty,
          createElement('p', { className: 'cart-line__total', text: formatPrice(unitPrice(line) * line.qty) }),
        ]);
      }),
    );

    el.cartEmpty.hidden = hasLines;
    el.cartLines.hidden = !hasLines;
    el.cartTotalRow.hidden = !hasLines;
    el.cartClear.hidden = !hasLines;
    el.cartTotal.textContent = formatPrice(amount);
    el.cartCount.textContent = pluralize(count, 'plato', 'platos');

    if (el.bar) {
      el.barCount.textContent = pluralize(count, 'plato', 'platos');
      el.barTotal.textContent = formatPrice(amount);
      el.root.classList.toggle('has-lines', hasLines);
      updateBar();
    }

    if (hasLines && state.touched.has('lines')) setFieldError('lines', '');
    renderSubmitState();
  };

  const announce = (message) => {
    el.live.textContent = '';
    // Pequeño retardo para que los lectores de pantalla lean el mismo texto dos veces seguidas
    window.setTimeout(() => {
      el.live.textContent = message;
    }, 50);
  };

  const addLine = (itemId, optionId) => {
    const item = state.catalog.items.get(itemId);
    if (!item || !isItemAvailable(item)) return;
    const key = lineKey(itemId, optionId);
    const current = state.lines.get(key);

    if (!current && state.lines.size >= ORDER.maxLines) {
      announce('Has llegado al máximo de líneas del pedido. Para pedidos grandes, llámanos.');
      return;
    }
    if (current && current.qty >= ORDER.maxQuantityPerLine) {
      announce(`Máximo ${ORDER.maxQuantityPerLine} unidades por plato. Para más, llámanos.`);
      return;
    }

    state.lines.set(key, { itemId, optionId, qty: (current?.qty ?? 0) + 1 });
    saveLines();
    renderCart();
    renderItems();
    const choice = findChoice(item, optionId);
    announce(`Añadido: ${item.name}${choice ? ` con ${choice.name.toLowerCase()}` : ''}. Total: ${formatPrice(totals().amount)}.`);
  };

  const changeQuantity = (key, delta) => {
    const line = state.lines.get(key);
    if (!line) return;
    const qty = Math.min(line.qty + delta, ORDER.maxQuantityPerLine);
    const { item } = describeLine(line);

    if (qty <= 0) {
      state.lines.delete(key);
      announce(`${item.name} eliminado del pedido.`);
    } else {
      state.lines.set(key, { ...line, qty });
      announce(`${item.name}: ${qty}.`);
    }
    saveLines();
    renderCart();
    renderItems();

    // Si el botón pulsado desaparece, el foco no se pierde: va a la lista o al título del pedido
    if (!el.cart.contains(document.activeElement) || document.activeElement === document.body) {
      qs(`[data-decrease="${CSS.escape(key)}"]`, el.cartLines)?.focus() ?? qs('#cart-title')?.focus();
    }
  };

  /* ---------- Formulario ---------- */

  const readValues = () => ({
    name: form.elements.name.value,
    phone: form.elements.phone.value,
    time: el.timeSelect.value,
    notes: el.notes.value,
    privacy: form.elements.privacy.checked,
    website: form.elements.website.value,
  });

  const fieldValidators = {
    lines: () => (state.lines.size ? '' : 'Añade al menos un plato a tu pedido.'),
    name: (values) => validators.name(values.name),
    phone: (values) => validatePhone(values.phone, 'Necesitamos un teléfono por si hay que avisarte.'),
    time: (values) => {
      if (!canOrderNow()) return 'Ahora mismo no hay horas de recogida disponibles.';
      if (!values.time) return 'Elige a qué hora pasas a recogerlo.';
      if (!state.pickup.slots.includes(values.time)) return 'Esa hora ya no está disponible. Elige otra.';
      return '';
    },
    privacy: (values) => validators.privacy(values.privacy),
  };

  const setFieldError = (field, message) => {
    const errorElement = qs(`[data-error-for="${field}"]`, root);
    const input = form.elements[field];
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    if (errorElement && errorElement.textContent !== message) errorElement.textContent = message;
  };

  const validateField = (field) => {
    const message = fieldValidators[field](readValues());
    setFieldError(field, message);
    return !message;
  };

  const showSummary = (message) => {
    el.summaryText.textContent = message;
    el.summary.hidden = false;
    el.summary.focus();
  };

  const hideSummary = () => {
    el.summary.hidden = true;
    el.summaryText.textContent = '';
  };

  const renderSubmitState = () => {
    if (state.status === 'submitting') return;
    const blocked = state.view !== 'ready' || !canOrderNow();
    el.submit.disabled = blocked;
    el.submitLabel.textContent = blocked && state.view === 'ready' ? 'Pedidos no disponibles ahora' : 'Enviar pedido por WhatsApp';
  };

  const setSubmitting = (submitting) => {
    state.status = submitting ? 'submitting' : 'idle';
    el.submit.disabled = submitting;
    el.submit.classList.toggle('is-loading', submitting);
    el.submit.setAttribute('aria-busy', String(submitting));
    el.submitLabel.textContent = submitting ? 'Preparando…' : 'Enviar pedido por WhatsApp';
    if (!submitting) renderSubmitState();
  };

  const updateCounter = () => {
    const length = el.notes.value.length;
    const max = Number(el.notes.maxLength) || 300;
    el.counter.textContent = `${length} / ${max}`;
    el.counter.classList.toggle('is-near-limit', length >= max * 0.9);
  };

  const buildMessage = (values) => {
    const lines = [`Hola, quiero hacer un pedido para recoger en ${BUSINESS.name}:`, ''];
    state.lines.forEach((line) => {
      const { item, choice } = describeLine(line);
      const extra = choice ? ` · carne: ${choice.name}${choice.price ? ` (${formatExtra(choice.price)})` : ''}` : '';
      lines.push(`• ${line.qty} × ${item.name}${extra} — ${formatPrice(unitPrice(line) * line.qty)}`);
    });
    const notes = sanitizeText(values.notes).slice(0, 300);
    lines.push(
      '',
      `Total: ${formatPrice(totals().amount)}`,
      `Recogida: hoy, ${formatLongDate(getNow().isoDate)}, a las ${values.time}`,
      `Nombre: ${sanitizeText(values.name)}`,
      `Teléfono: ${normalizePhone(values.phone)}`,
    );
    if (notes) lines.push(`Comentarios: ${notes}`);
    lines.push('', 'Pago al recoger. ¡Gracias!');
    return lines;
  };

  // Justo antes de enviar se vuelve a consultar qué platos quedan (pueden haberse agotado mientras tanto)
  const dropSoldOutLines = async () => {
    state.availability = await loadAvailability({ force: true });
    const removed = [];
    state.lines.forEach((line, key) => {
      const { item, choice } = describeLine(line);
      if (!isItemAvailable(item) || (choice && !isChoiceAvailable(choice))) {
        removed.push(item.name);
        state.lines.delete(key);
      }
    });
    if (removed.length) {
      saveLines();
      renderCart();
      renderItems();
    }
    renderStatus();
    return removed;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (state.status === 'submitting' || state.view !== 'ready') return;

    // Honeypot: los bots rellenan el campo oculto; se ignora el envío sin dar pistas
    if (readValues().website) return;

    if (navigator.onLine === false) {
      showSummary('Parece que no tienes conexión a internet. Conéctate e inténtalo de nuevo, o llámanos.');
      return;
    }

    setSubmitting(true);

    try {
      const removed = await dropSoldOutLines();
      if (removed.length) {
        setSubmitting(false);
        showSummary(`Lo sentimos, se acaba de agotar: ${removed.join(', ')}. Lo hemos quitado de tu pedido; revísalo antes de enviarlo.`);
        return;
      }

      const values = readValues();
      const errors = Object.fromEntries(
        FIELD_ORDER.map((field) => [field, fieldValidators[field](values)]).filter(([, message]) => message),
      );
      FIELD_ORDER.forEach((field) => {
        state.touched.add(field);
        setFieldError(field, errors[field] ?? '');
      });

      const invalid = FIELD_ORDER.filter((field) => errors[field]);
      if (invalid.length) {
        setSubmitting(false);
        const names = invalid.map((field) => FIELD_LABELS[field]).join(', ');
        showSummary(invalid.length === 1 ? `Revisa esto: ${names}.` : `Revisa estos ${invalid.length} apartados: ${names}.`);
        return;
      }

      hideSummary();
      const url = buildWhatsappUrl(buildMessage(values));
      const popup = openInNewTab(url);
      // Pequeña pausa para que el estado de carga sea perceptible y evitar dobles clics
      await new Promise((resolve) => window.setTimeout(resolve, 450));

      el.whatsappLink.href = url;
      el.whatsappLink.textContent = popup ? 'Ábrelo aquí' : 'Pulsa aquí para abrir WhatsApp';
      el.successTime.textContent = values.time;
      form.hidden = true;
      el.success.hidden = false;
      el.success.focus();
      state.status = 'success';
    } catch (error) {
      console.error('[order-form]', error);
      setSubmitting(false);
      showSummary(`No hemos podido preparar tu pedido. Llámanos al ${BUSINESS.phoneDisplay} y te lo apuntamos.`);
    }
  };

  const resetOrder = () => {
    state.lines.clear();
    saveLines();
    form.reset();
    state.touched.clear();
    FIELD_ORDER.forEach((field) => setFieldError(field, ''));
    hideSummary();
    updateCounter();
    el.success.hidden = true;
    form.hidden = false;
    state.status = 'idle';
    setSubmitting(false);
    renderStatus();
    renderCart();
    renderItems();
    qs('#order-title')?.scrollIntoView({ block: 'start' });
    el.filters.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  };

  /* ---------- Barra flotante en móvil ---------- */

  let sectionVisible = false;
  let cartVisible = false;

  function updateBar() {
    if (!el.bar) return;
    el.bar.hidden = !(state.lines.size > 0 && sectionVisible && !cartVisible && state.status !== 'success');
  }

  if (el.bar && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === root) sectionVisible = entry.isIntersecting;
        if (entry.target === el.cart) cartVisible = entry.isIntersecting;
      });
      updateBar();
    }, { rootMargin: '0px 0px -15% 0px' });
    observer.observe(root);
    observer.observe(el.cart);
  }

  /* ---------- Carga ---------- */

  const setView = (view) => {
    state.view = view;
    root.dataset.state = view;
    root.setAttribute('aria-busy', String(view === 'loading'));
    qsa('[data-order-view]', root).forEach((node) => {
      node.hidden = node.dataset.orderView !== view;
    });
    renderSubmitState();
  };

  const load = async () => {
    setView('loading');
    try {
      const [catalog, availability] = await Promise.all([loadCatalog(), loadAvailability({ force: true })]);
      state.catalog = catalog;
      state.availability = availability;
      state.activeCategory ??= catalog.categories[0].id;

      const removed = restoreLines();
      renderFilters();
      renderItems();
      renderCart();
      setView('ready');
      renderStatus();
      if (removed) announce('Algunos platos de tu pedido ya no están disponibles y los hemos quitado.');
    } catch (error) {
      console.error('[order-form]', error);
      el.error.textContent = error.userMessage
        ?? `No hemos podido cargar la carta para pedir. Inténtalo de nuevo o llámanos al ${BUSINESS.phoneDisplay}.`;
      setView('error');
      renderStatus();
    }
  };

  /* ---------- Eventos ---------- */

  el.filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button || button.dataset.category === state.activeCategory) return;
    state.activeCategory = button.dataset.category;
    qsa('[data-category]', el.filters).forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip === button));
    });
    renderItems();
  });

  el.items.addEventListener('change', (event) => {
    const select = event.target.closest('[data-option-for]');
    if (select) state.selectedOptions.set(select.dataset.optionFor, select.value);
  });

  el.items.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]');
    if (!button || button.disabled) return;
    const item = state.catalog.items.get(button.dataset.add);
    const select = item?.options ? qs(`[data-option-for="${CSS.escape(item.id)}"]`, el.items) : null;
    addLine(button.dataset.add, select ? select.value : null);
    qs(`[data-add="${CSS.escape(button.dataset.add)}"]`, el.items)?.focus();
  });

  el.cartLines.addEventListener('click', (event) => {
    const decrease = event.target.closest('[data-decrease]');
    const increase = event.target.closest('[data-increase]');
    if (decrease) changeQuantity(decrease.dataset.decrease, -1);
    if (increase) {
      changeQuantity(increase.dataset.increase, 1);
      qs(`[data-increase="${CSS.escape(increase.dataset.increase)}"]`, el.cartLines)?.focus();
    }
  });

  el.cartClear.addEventListener('click', () => {
    state.lines.clear();
    saveLines();
    renderCart();
    renderItems();
    announce('Pedido vaciado.');
    qs('#cart-title')?.focus();
  });

  form.addEventListener('focusout', (event) => {
    const field = event.target.name;
    if (!(field in fieldValidators)) return;
    if (event.target.value === '' && !state.touched.has(field)) return;
    state.touched.add(field);
    validateField(field);
  });

  form.addEventListener('input', (event) => {
    const field = event.target.name;
    if (field === 'notes') updateCounter();
    if (state.touched.has(field)) validateField(field);
  });

  form.addEventListener('change', (event) => {
    if (event.target.name === 'time' || event.target.name === 'privacy') {
      state.touched.add(event.target.name);
      validateField(event.target.name);
    }
  });

  form.addEventListener('submit', handleSubmit);
  el.retry.addEventListener('click', load);
  el.reset.addEventListener('click', resetOrder);

  // Las horas disponibles cambian con el reloj: se recalculan al empezar cada minuto
  if (!isSimulating()) {
    const tick = () => {
      if (state.status !== 'submitting') renderStatus();
      window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    };
    window.setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  }

  updateCounter();
  renderStatus();
  load();
}
