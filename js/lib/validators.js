import { RESERVATION } from '../config.js';
import { addDaysToIso, isValidIsoDate } from './time.js';
import { getReservationSlots } from './schedule.js';

const NAME_PATTERN = /^[\p{L}\p{M}' .-]+$/u;
const PHONE_PATTERN = /^(?:\+34|0034)?[6789]\d{8}$/;

// Limpia caracteres de control y espacios repetidos antes de validar o enviar.
export const sanitizeText = (value = '') =>
  String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

export const normalizePhone = (value = '') => String(value).replace(/[\s().-]/g, '');

export const validators = {
  name(value) {
    const name = sanitizeText(value);
    if (!name) return 'Escribe tu nombre.';
    if (name.length < 2) return 'El nombre es demasiado corto.';
    if (name.length > 60) return 'El nombre no puede superar 60 caracteres.';
    if (!NAME_PATTERN.test(name)) return 'Usa solo letras y espacios.';
    return '';
  },

  phone(value) {
    const phone = normalizePhone(value);
    if (!phone) return 'Necesitamos un teléfono para confirmar la reserva.';
    if (!PHONE_PATTERN.test(phone)) return 'Introduce un teléfono español válido (9 cifras).';
    return '';
  },

  guests(value) {
    const guests = Number(value);
    if (value === '' || Number.isNaN(guests)) return 'Indica cuántas personas seréis.';
    if (!Number.isInteger(guests)) return 'El número de personas debe ser un número entero.';
    if (guests < RESERVATION.minGuests) return 'Como mínimo, 1 persona.';
    if (guests > RESERVATION.maxGuests) return `Para más de ${RESERVATION.maxGuests} personas, llámanos por teléfono.`;
    return '';
  },

  date(value, { now }) {
    if (!value) return 'Elige una fecha.';
    if (!isValidIsoDate(value)) return 'La fecha no es válida.';
    if (value < now.isoDate) return 'La fecha no puede ser anterior a hoy.';
    if (value > addDaysToIso(now.isoDate, RESERVATION.maxDaysAhead)) {
      return `Solo aceptamos reservas con un máximo de ${RESERVATION.maxDaysAhead} días de antelación.`;
    }
    const { reason } = getReservationSlots(value, now);
    if (reason === 'closed') return 'Ese día estamos cerrados. Elige otra fecha.';
    if (reason === 'past') return 'Ya no quedan horas disponibles ese día.';
    return '';
  },

  time(value, { now, values }) {
    if (!value) return 'Elige una hora.';
    if (!values.date || !isValidIsoDate(values.date)) return 'Elige primero una fecha válida.';
    const { slots } = getReservationSlots(values.date, now);
    if (!slots.includes(value)) return 'Esa hora no está disponible. Elige otra.';
    return '';
  },

  privacy(value) {
    return value ? '' : 'Debes aceptar la política de privacidad.';
  },
};

export function validateReservation(values, context) {
  return Object.entries(validators).reduce((errors, [field, validate]) => {
    const message = validate(values[field], { ...context, values });
    if (message) errors[field] = message;
    return errors;
  }, {});
}
