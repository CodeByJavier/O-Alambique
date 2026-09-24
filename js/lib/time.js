const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const pad = (value) => String(value).padStart(2, '0');

const toIsoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

// Hora actual en la zona del local, para que el estado sea correcto aunque el visitante esté en otro huso.
export function getZonedNow(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type) => parts.find((part) => part.type === type)?.value;
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    const weekday = WEEKDAY_INDEX[get('weekday')];
    const minutes = Number(get('hour')) * 60 + Number(get('minute'));

    if ([year, month, day, weekday, minutes].some((value) => Number.isNaN(value) || value === undefined)) {
      throw new Error('Fecha incompleta');
    }

    return { year, month, day, weekday, minutes, isoDate: toIsoDate(year, month, day) };
  } catch (error) {
    console.warn('[time] Zona horaria no soportada, se usa la hora local.', error);
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: date.getDay(),
      minutes: date.getHours() * 60 + date.getMinutes(),
      isoDate: toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    };
  }
}

export function toMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Hora no válida: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutes(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return hours === 0 ? `00:${pad(minutes)}` : `${hours}:${pad(minutes)}`;
}

export function formatDuration(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/**
 * Permite simular otra fecha/hora con ?at=AAAA-MM-DDTHH:MM (hora de Madrid) para revisar los estados del horario.
 */
export function parseSimulatedNow(search = window.location.search) {
  const value = new URLSearchParams(search).get('at');
  const match = value && /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, isoDate, hours, minutes] = match;
  if (!isValidIsoDate(isoDate) || Number(hours) > 23 || Number(minutes) > 59) return null;

  const [year, month, day] = isoDate.split('-').map(Number);
  return {
    year,
    month,
    day,
    weekday: weekdayOfIso(isoDate),
    minutes: Number(hours) * 60 + Number(minutes),
    isoDate,
  };
}

export function isValidIsoDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const isoToUtcDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export function addDaysToIso(iso, days) {
  const date = isoToUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function weekdayOfIso(iso) {
  return isoToUtcDate(iso).getUTCDay();
}

export function formatLongDate(iso) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(isoToUtcDate(iso));
}
