import { ORDER } from '../config.js?v=20261028';
import { getIntervals } from './schedule.js?v=20261028';
import { formatMinutes, toMinutes } from './time.js?v=20261028';

/**
 * Franjas de recogida de hoy: las de ORDER.pickupWindows recortadas con el horario del local.
 * Así, si un día cierra antes (o no abre), la franja desaparece sola.
 */
export function getPickupWindows(weekday) {
  const opening = getIntervals(weekday);
  return ORDER.pickupWindows
    .map(({ start, end }) => {
      const from = toMinutes(start);
      const to = toMinutes(end);
      const overlap = opening.find((interval) => interval.open <= to && interval.close >= from);
      if (!overlap) return null;
      // La última recogida tiene que quedar dentro del horario de apertura
      return { start: Math.max(from, overlap.open), end: Math.min(to, overlap.close - 1) };
    })
    .filter((window) => window && window.start <= window.end);
}

/**
 * Horas de recogida disponibles hoy.
 * @returns {{ reason: 'closed' | 'past' | 'ok', slots: string[], windows: {start:number,end:number}[], next?: string }}
 */
export function getPickupSlots(now) {
  const windows = getPickupWindows(now.weekday);
  if (!windows.length) return { reason: 'closed', slots: [], windows };

  const earliest = now.minutes + ORDER.minNoticeMinutes;
  const slots = [];
  windows.forEach(({ start, end }) => {
    for (let minute = start; minute <= end; minute += ORDER.slotStepMinutes) {
      if (minute >= earliest) slots.push(formatMinutes(minute));
    }
  });

  return { reason: slots.length ? 'ok' : 'past', slots, windows };
}

export const formatWindow = ({ start, end }) => `${formatMinutes(start)} a ${formatMinutes(end)}`;

export function describeWindows(windows) {
  const parts = windows.map(formatWindow);
  if (parts.length <= 1) return `de ${parts[0] ?? ''}`;
  return `de ${parts.slice(0, -1).join(', de ')} y de ${parts.at(-1)}`;
}
