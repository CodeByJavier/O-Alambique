import { BUSINESS, RESERVATION } from '../config.js';
import { createElement, qs } from '../lib/dom.js';
import { addDaysToIso, formatLongDate, getZonedNow, isValidIsoDate } from '../lib/time.js';
import { getReservationSlots } from '../lib/schedule.js';
import { normalizePhone, sanitizeText, validateReservation, validators } from '../lib/validators.js';

const FIELD_LABELS = {
  name: 'Nombre',
  phone: 'Teléfono',
  guests: 'Personas',
  date: 'Fecha',
  time: 'Hora',
  privacy: 'Política de privacidad',
};

const FIELD_ORDER = Object.keys(FIELD_LABELS);

const TIME_HINTS = {
  idle: '',
  closed: 'Los miércoles estamos cerrados.',
  past: 'Ya no quedan horas disponibles ese día.',
};

export function initReservationForm() {
  const form = qs('[data-reservation-form]');
  if (!form) return;

  const elements = {
    form,
    dateInput: form.elements.date,
    timeSelect: form.elements.time,
    notes: form.elements.notes,
    counter: qs('[data-char-counter]', form),
    timeHint: qs('[data-time-hint]', form),
    submit: qs('[data-submit]', form),
    submitLabel: qs('[data-submit-label]', form),
    summary: qs('[data-form-summary]', form),
    summaryText: qs('[data-form-summary-text]', form),
    success: qs('[data-form-success]'),
    whatsappLink: qs('[data-whatsapp-link]'),
    resetButton: qs('[data-form-reset]'),
  };

  const state = {
    status: 'idle', // idle | submitting | success
    touched: new Set(),
  };

  const getNow = () => getZonedNow(BUSINESS.timeZone);

  const readValues = () => ({
    name: form.elements.name.value,
    phone: form.elements.phone.value,
    guests: form.elements.guests.value,
    date: elements.dateInput.value,
    time: elements.timeSelect.value,
    notes: form.elements.notes.value,
    privacy: form.elements.privacy.checked,
    website: form.elements.website.value,
  });

  const setDateLimits = () => {
    const now = getNow();
    elements.dateInput.min = now.isoDate;
    elements.dateInput.max = addDaysToIso(now.isoDate, RESERVATION.maxDaysAhead);
  };

  const renderTimeOptions = () => {
    const { dateInput, timeSelect, timeHint } = elements;
    const date = dateInput.value;
    const previous = timeSelect.value;

    if (!date || !isValidIsoDate(date)) {
      timeSelect.replaceChildren(createElement('option', { text: 'Elige primero la fecha', attrs: { value: '' } }));
      timeSelect.disabled = true;
      timeHint.textContent = TIME_HINTS.idle;
      return;
    }

    const { reason, slots } = getReservationSlots(date, getNow());

    if (reason !== 'ok') {
      timeSelect.replaceChildren(createElement('option', { text: 'Sin horas disponibles', attrs: { value: '' } }));
      timeSelect.disabled = true;
      timeHint.textContent = TIME_HINTS[reason];
      return;
    }

    timeSelect.replaceChildren(
      createElement('option', { text: 'Elige una hora', attrs: { value: '' } }),
      ...slots.map((slot) => createElement('option', { text: slot, attrs: { value: slot } })),
    );
    timeSelect.disabled = false;
    timeSelect.value = slots.includes(previous) ? previous : '';
    timeHint.textContent = `${slots.length} horas disponibles el ${formatLongDate(date)}.`;
  };

  const setFieldError = (field, message) => {
    const input = form.elements[field];
    const errorElement = qs(`[data-error-for="${field}"]`, form);
    if (!input || !errorElement) return;

    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (errorElement.textContent !== message) errorElement.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      errorElement.textContent = '';
    }
  };

  const validateField = (field) => {
    const validate = validators[field];
    if (!validate) return true;
    const values = readValues();
    const message = validate(values[field], { now: getNow(), values });
    setFieldError(field, message);
    return !message;
  };

  const showSummary = (message) => {
    elements.summaryText.textContent = message;
    elements.summary.hidden = false;
  };

  const hideSummary = () => {
    elements.summary.hidden = true;
    elements.summaryText.textContent = '';
  };

  const setSubmitting = (submitting) => {
    state.status = submitting ? 'submitting' : 'idle';
    elements.submit.disabled = submitting;
    elements.submit.classList.toggle('is-loading', submitting);
    elements.submit.setAttribute('aria-busy', String(submitting));
    elements.submitLabel.textContent = submitting ? 'Preparando…' : 'Solicitar por WhatsApp';
  };

  const buildWhatsappUrl = (values) => {
    const notes = sanitizeText(values.notes).slice(0, 300);
    const lines = [
      `Hola, me gustaría reservar mesa en ${BUSINESS.name}:`,
      `• Nombre: ${sanitizeText(values.name)}`,
      `• Teléfono: ${normalizePhone(values.phone)}`,
      `• Fecha: ${formatLongDate(values.date)}`,
      `• Hora: ${values.time}`,
      `• Personas: ${Number(values.guests)}`,
    ];
    if (notes) lines.push(`• Comentarios: ${notes}`);
    lines.push('', '¡Gracias!');

    return `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const showSuccess = (url, popupBlocked) => {
    elements.whatsappLink.href = url;
    elements.whatsappLink.textContent = popupBlocked ? 'Pulsa aquí para abrir WhatsApp' : 'Ábrelo aquí';
    form.hidden = true;
    elements.success.hidden = false;
    elements.success.focus();
    state.status = 'success';
  };

  const resetForm = () => {
    form.reset();
    state.touched.clear();
    FIELD_ORDER.forEach((field) => setFieldError(field, ''));
    hideSummary();
    setDateLimits();
    renderTimeOptions();
    updateCounter();
    setSubmitting(false);
    elements.success.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  };

  const updateCounter = () => {
    const { notes, counter } = elements;
    const length = notes.value.length;
    const max = Number(notes.maxLength) || 300;
    counter.textContent = `${length} / ${max}`;
    counter.classList.toggle('is-near-limit', length >= max * 0.9);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (state.status === 'submitting') return;

    const values = readValues();

    // Honeypot: los bots rellenan el campo oculto; se ignora el envío sin dar pistas
    if (values.website) return;

    if (navigator.onLine === false) {
      showSummary('Parece que no tienes conexión a internet. Conéctate e inténtalo de nuevo, o llámanos.');
      elements.summary.focus();
      return;
    }

    renderTimeOptions();
    const errors = validateReservation(readValues(), { now: getNow() });
    FIELD_ORDER.forEach((field) => {
      state.touched.add(field);
      setFieldError(field, errors[field] ?? '');
    });

    const invalidFields = FIELD_ORDER.filter((field) => errors[field]);
    if (invalidFields.length) {
      const names = invalidFields.map((field) => FIELD_LABELS[field]).join(', ');
      showSummary(
        invalidFields.length === 1
          ? `Revisa este campo: ${names}.`
          : `Revisa estos ${invalidFields.length} campos: ${names}.`,
      );
      form.elements[invalidFields[0]].focus();
      return;
    }

    hideSummary();
    setSubmitting(true);

    try {
      const url = buildWhatsappUrl(values);
      const popup = openInNewTab(url);
      // Pequeña pausa para que el estado de carga sea perceptible y evitar dobles clics
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      showSuccess(url, !popup);
    } catch (error) {
      console.error('[reservation-form]', error);
      showSummary(`No hemos podido preparar tu solicitud. Llámanos al ${BUSINESS.phoneDisplay} y te la gestionamos.`);
      elements.summary.focus();
      setSubmitting(false);
    }
  };

  form.addEventListener('focusout', (event) => {
    const field = event.target.name;
    if (!(field in FIELD_LABELS)) return;
    // No marcar como error un campo que el usuario aún no ha rellenado al pasar por él
    if (event.target.value === '' && !state.touched.has(field)) return;
    state.touched.add(field);
    validateField(field);
  });

  form.addEventListener('input', (event) => {
    const field = event.target.name;
    if (field === 'notes') updateCounter();
    if (state.touched.has(field)) validateField(field);
  });

  elements.dateInput.addEventListener('change', () => {
    renderTimeOptions();
    state.touched.add('date');
    validateField('date');
    if (state.touched.has('time')) validateField('time');
  });

  elements.dateInput.addEventListener('focus', setDateLimits);

  form.addEventListener('submit', handleSubmit);
  elements.resetButton?.addEventListener('click', resetForm);

  setDateLimits();
  renderTimeOptions();
  updateCounter();
}

// Abre primero una pestaña en blanco (mismo origen) para poder cortar window.opener antes de navegar
function openInNewTab(url) {
  try {
    const popup = window.open('about:blank', '_blank');
    if (!popup) return null;
    popup.opener = null;
    popup.location.replace(url);
    return popup;
  } catch (error) {
    console.warn('[reservation-form] No se pudo abrir la pestaña', error);
    return null;
  }
}
