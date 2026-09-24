import { BUSINESS } from '../config.js';
import { qs, qsa } from '../lib/dom.js';
import { formatMinutes, getZonedNow, parseSimulatedNow } from '../lib/time.js';
import { describeStatus, getDayProgress, getOpeningStatus } from '../lib/schedule.js';

const FALLBACK_TEXT = 'Consulta nuestro horario';

const SHORT_LABELS = {
  open: 'Abierto',
  closing: 'Cierra pronto',
  closed: 'Cerrado',
};

export function initOpeningStatus() {
  const pills = qsa('[data-opening-status]');
  const table = qs('[data-schedule-table]');
  const dayProgress = qs('[data-day-progress]');
  if (!pills.length && !table && !dayProgress) return;

  const simulatedNow = parseSimulatedNow();
  if (simulatedNow) console.info('[opening-status] Simulando', simulatedNow.isoDate, formatMinutes(simulatedNow.minutes));

  const getNow = () => simulatedNow ?? getZonedNow(BUSINESS.timeZone);

  const setText = (element, text) => {
    if (element && element.textContent !== text) element.textContent = text;
  };

  const renderPills = (status) => {
    const text = describeStatus(status);
    pills.forEach((pill) => {
      pill.dataset.status = status.state;
      setText(qs('.status-pill__text', pill), text);
      setText(qs('.status-pill__short', pill), SHORT_LABELS[status.state]);
    });
  };

  const renderTable = (now) => {
    qsa('tr[data-day]', table ?? document).forEach((row) => {
      const isToday = Number(row.dataset.day) === now.weekday;
      row.classList.toggle('is-today', isToday);
      if (isToday) row.setAttribute('aria-current', 'date');
      else row.removeAttribute('aria-current');
    });
  };

  const renderDayProgress = (now) => {
    if (!dayProgress) return;
    const { phase, progress, open, close, label } = getDayProgress(now);

    dayProgress.dataset.phase = phase;
    dayProgress.style.setProperty('--progress', progress.toFixed(4));
    setText(qs('[data-progress-label]', dayProgress), label);
    setText(qs('[data-progress-open]', dayProgress), open === undefined ? '' : formatMinutes(open));
    setText(qs('[data-progress-close]', dayProgress), close === undefined ? '' : formatMinutes(close));
    dayProgress.hidden = false;
  };

  const render = () => {
    try {
      const now = getNow();
      renderPills(getOpeningStatus(now));
      renderTable(now);
      renderDayProgress(now);
    } catch (error) {
      console.error('[opening-status]', error);
      pills.forEach((pill) => {
        pill.dataset.status = 'unknown';
        setText(qs('.status-pill__text', pill), FALLBACK_TEXT);
        setText(qs('.status-pill__short', pill), 'Horario');
      });
      if (dayProgress) dayProgress.hidden = true;
    }
  };

  render();
  if (simulatedNow) return;

  // Se sincroniza con el cambio de minuto y se refresca al volver a la pestaña
  let intervalId;
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  const timeoutId = window.setTimeout(() => {
    render();
    intervalId = window.setInterval(render, 60_000);
  }, msToNextMinute);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  window.addEventListener('pagehide', () => {
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
  });
}
