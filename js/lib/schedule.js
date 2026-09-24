import { OPENING_HOURS, RESERVATION, CLOSING_SOON_MINUTES } from '../config.js';
import { DAY_NAMES, formatDuration, formatMinutes, toMinutes, weekdayOfIso } from './time.js';

export function getIntervals(weekday) {
  return (OPENING_HOURS[weekday] ?? []).map(({ open, close }) => ({
    open: toMinutes(open),
    close: toMinutes(close),
  }));
}

function findNextOpening(now) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const weekday = (now.weekday + offset) % 7;
    const next = getIntervals(weekday).find((interval) => offset > 0 || interval.open > now.minutes);
    if (next) {
      return {
        offset,
        weekday,
        opensAt: next.open,
        minutesUntil: offset * 1440 + next.open - now.minutes,
      };
    }
  }
  return null;
}

/**
 * Estado del local en un instante concreto, calculado solo a partir de OPENING_HOURS.
 * @returns {{ state: 'open' | 'closing' | 'closed', closesAt?: number, minutesToClose?: number, next?: object | null }}
 */
export function getOpeningStatus(now) {
  const current = getIntervals(now.weekday).find(
    (interval) => now.minutes >= interval.open && now.minutes < interval.close,
  );

  if (current) {
    const minutesToClose = current.close - now.minutes;
    return {
      state: minutesToClose <= CLOSING_SOON_MINUTES ? 'closing' : 'open',
      closesAt: current.close,
      minutesToClose,
    };
  }

  return { state: 'closed', next: findNextOpening(now) };
}

const RELATIVE_OPENING_LIMIT = 180;

export function describeStatus(status) {
  if (status.state === 'open') return `Abierto · cierra en ${formatDuration(status.minutesToClose)}`;
  if (status.state === 'closing') return `Cierra pronto · en ${formatDuration(status.minutesToClose)}`;
  if (!status.next) return 'Cerrado temporalmente';

  const { offset, weekday, opensAt, minutesUntil } = status.next;
  if (minutesUntil <= RELATIVE_OPENING_LIMIT) return `Cerrado · abre en ${formatDuration(minutesUntil)}`;

  const time = formatMinutes(opensAt);
  if (offset === 0) return `Cerrado · abre hoy a las ${time}`;
  if (offset === 1) return `Cerrado · abre mañana a las ${time}`;
  return `Cerrado · abre el ${DAY_NAMES[weekday]} a las ${time}`;
}

/**
 * Progreso de la jornada de hoy (0 → apertura, 1 → cierre).
 * @returns {{ phase: 'closed-today' | 'before' | 'during' | 'after', progress: number, open?: number, close?: number, label: string }}
 */
export function getDayProgress(now) {
  const intervals = getIntervals(now.weekday);
  if (!intervals.length) {
    return { phase: 'closed-today', progress: 0, label: `Hoy ${DAY_NAMES[now.weekday]} descansamos` };
  }

  const interval = intervals.find(({ close }) => close > now.minutes) ?? intervals[intervals.length - 1];
  const { open, close } = interval;

  if (now.minutes < open) {
    return { phase: 'before', progress: 0, open, close, label: `Abrimos en ${formatDuration(open - now.minutes)}` };
  }

  if (now.minutes >= close) {
    return { phase: 'after', progress: 1, open, close, label: 'Hemos cerrado por hoy' };
  }

  return {
    phase: 'during',
    progress: (now.minutes - open) / (close - open),
    open,
    close,
    label: `${close - now.minutes === 1 ? 'Queda' : 'Quedan'} ${formatDuration(close - now.minutes)} para el cierre`,
  };
}

/**
 * Horas disponibles para reservar en una fecha concreta.
 * @returns {{ reason: 'closed' | 'past' | 'ok', slots: string[] }}
 */
export function getReservationSlots(isoDate, now) {
  const intervals = getIntervals(weekdayOfIso(isoDate));
  if (intervals.length === 0) return { reason: 'closed', slots: [] };

  const earliest = isoDate === now.isoDate ? now.minutes + RESERVATION.minNoticeMinutes : -1;
  const slots = [];

  intervals.forEach(({ open, close }) => {
    const last = close - RESERVATION.lastSlotBeforeCloseMinutes;
    for (let minute = open; minute <= last; minute += RESERVATION.slotStepMinutes) {
      if (minute >= earliest) slots.push(formatMinutes(minute));
    }
  });

  return { reason: slots.length ? 'ok' : 'past', slots };
}
