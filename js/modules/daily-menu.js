import { BUSINESS, DAILY_MENU } from '../config.js';
import { createElement, qs, qsa } from '../lib/dom.js';
import { formatLongDate, getZonedNow, isValidIsoDate } from '../lib/time.js';
import { sanitizeText } from '../lib/validators.js';

const TIMEOUT_MESSAGE = 'El menú está tardando demasiado en cargar. Revisa tu conexión e inténtalo de nuevo.';

const priceFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

class DailyMenuError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'DailyMenuError';
    this.userMessage = userMessage;
  }
}

export function initDailyMenu() {
  const root = qs('[data-daily-menu]');
  if (!root) return;

  const retryButton = qs('[data-daily-retry]', root);
  let controller;
  let latestRequest = 0;

  const setState = (state) => {
    root.dataset.state = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    qsa('[data-state-view]', root).forEach((view) => {
      view.hidden = view.dataset.stateView !== state;
    });
  };

  const load = async () => {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    const requestId = ++latestRequest;
    const isStale = () => requestId !== latestRequest;
    const timeoutId = window.setTimeout(() => current.abort('timeout'), DAILY_MENU.timeoutMs);

    setState('loading');

    try {
      const menu = await fetchDailyMenu(current.signal);
      if (isStale()) return;
      if (!menu) {
        setState('empty');
        return;
      }
      renderMenu(root, menu);
      setState('success');
    } catch (error) {
      if (isStale()) return;
      console.error('[daily-menu]', error);
      qs('[data-daily-error]', root).textContent = error.userMessage
        ?? `No hemos podido cargar el menú. Inténtalo de nuevo o llámanos al ${BUSINESS.phoneDisplay}.`;
      setState('error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  retryButton?.addEventListener('click', load);
  load();
}

async function fetchDailyMenu(signal) {
  let response;

  try {
    response = await fetch(DAILY_MENU.url, {
      signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) {
      throw new DailyMenuError('Timeout', TIMEOUT_MESSAGE);
    }
    const offline = navigator.onLine === false;
    throw new DailyMenuError(
      error.message,
      offline ? 'Parece que no tienes conexión a internet.' : undefined,
    );
  }

  // Si el archivo no existe todavía, no es un fallo: simplemente no hay menú publicado
  if (response.status === 404) return null;
  if (!response.ok) throw new DailyMenuError(`HTTP ${response.status}`);

  let data;
  try {
    data = await response.json();
  } catch {
    if (signal.aborted) throw new DailyMenuError('Timeout', TIMEOUT_MESSAGE);
    throw new DailyMenuError('JSON no válido en daily-menu.json');
  }

  return normalizeMenu(data);
}

// Valida la estructura del JSON y descarta datos incompletos o de otro día
function normalizeMenu(data) {
  if (!data || typeof data !== 'object' || data.available !== true) return null;

  if (data.date !== undefined) {
    if (!isValidIsoDate(data.date)) throw new DailyMenuError('Campo "date" no válido');
    if (data.date !== getZonedNow(BUSINESS.timeZone).isoDate) return null;
  }

  const courses = Array.isArray(data.courses)
    ? data.courses
        .map((course) => ({
          name: sanitizeText(course?.name).slice(0, 60),
          dishes: Array.isArray(course?.dishes)
            ? course.dishes.map((dish) => sanitizeText(dish).slice(0, 120)).filter(Boolean)
            : [],
        }))
        .filter((course) => course.name && course.dishes.length)
    : [];

  if (!courses.length) return null;

  const price = Number(data.price);

  return {
    date: data.date,
    price: Number.isFinite(price) && price > 0 ? price : null,
    days: sanitizeText(data.days).slice(0, 120),
    courses,
    includes: Array.isArray(data.includes)
      ? data.includes.map((item) => sanitizeText(item).slice(0, 60)).filter(Boolean)
      : [],
  };
}

function renderMenu(root, menu) {
  qs('[data-daily-title]', root).textContent = menu.date
    ? `Menú del ${formatLongDate(menu.date)}`
    : 'Menú del día';

  qs('[data-daily-price]', root).textContent = menu.price ? priceFormatter.format(menu.price) : '';
  qs('[data-daily-meta]', root).textContent = menu.days;

  const coursesContainer = qs('[data-daily-courses]', root);
  coursesContainer.replaceChildren(
    ...menu.courses.map((course) =>
      createElement('section', { className: 'daily-course' }, [
        createElement('h4', { className: 'daily-course__title', text: course.name }),
        createElement(
          'ul',
          { className: 'daily-course__list' },
          course.dishes.map((dish) => createElement('li', { text: dish })),
        ),
      ]),
    ),
  );

  qs('[data-daily-includes]', root).textContent = menu.includes.length
    ? `Incluye: ${menu.includes.join(' · ')}`
    : '';
}
