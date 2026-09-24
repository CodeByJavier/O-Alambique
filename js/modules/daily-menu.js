import { BUSINESS, DAILY_MENU, OPENING_HOURS } from '../config.js';
import { createElement, qs, qsa } from '../lib/dom.js';
import { formatLongDate, getZonedNow, isValidIsoDate, parseSimulatedNow } from '../lib/time.js';
import { sanitizeText } from '../lib/validators.js';

const DEFAULT_TITLE = 'Así es nuestro menú';

const TIMEOUT_MESSAGE = 'Los platos de hoy están tardando demasiado en cargar. Revisa tu conexión e inténtalo de nuevo.';

class DailyMenuError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'DailyMenuError';
    this.userMessage = userMessage;
  }
}

const getNow = () => parseSimulatedNow() ?? getZonedNow(BUSINESS.timeZone);

// El menú solo se sirve los días configurados y si el local abre ese día
const isServedToday = (now) =>
  DAILY_MENU.weekdays.includes(now.weekday) && (OPENING_HOURS[now.weekday] ?? []).length > 0;

export function initDailyMenu() {
  const root = qs('[data-daily-menu]');
  if (!root) return;

  const retryButton = qs('[data-daily-retry]', root);
  let controller;
  let latestRequest = 0;

  const setState = (state) => {
    root.dataset.state = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    // En "success" no se muestra ningún aviso: los platos aparecen dentro del esquema
    qsa('[data-state-view]', root).forEach((view) => {
      view.hidden = view.dataset.stateView !== state;
    });
    if (state !== 'success') resetScheme(root);
  };

  const load = async () => {
    const now = getNow();
    if (!isServedToday(now)) {
      setState('unavailable');
      return;
    }

    controller?.abort();
    const current = new AbortController();
    controller = current;
    const requestId = ++latestRequest;
    const isStale = () => requestId !== latestRequest;
    const timeoutId = window.setTimeout(() => current.abort('timeout'), DAILY_MENU.timeoutMs);

    setState('loading');

    try {
      const menu = await fetchDailyMenu(current.signal, now);
      if (isStale()) return;
      if (!menu) {
        setState('empty');
        return;
      }
      setState('success');
      renderMenu(root, menu);
    } catch (error) {
      if (isStale()) return;
      console.error('[daily-menu]', error);
      qs('[data-daily-error]', root).textContent = error.userMessage
        ?? `No hemos podido cargar los platos de hoy. Inténtalo de nuevo o llámanos al ${BUSINESS.phoneDisplay}.`;
      setState('error');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  retryButton?.addEventListener('click', load);
  load();
}

async function fetchDailyMenu(signal, now) {
  let response;

  try {
    response = await fetch(DAILY_MENU.url, {
      signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw new DailyMenuError('Timeout', TIMEOUT_MESSAGE);
    const offline = navigator.onLine === false;
    throw new DailyMenuError(error.message, offline ? 'Parece que no tienes conexión a internet.' : undefined);
  }

  // Si el archivo no existe todavía, no es un fallo: simplemente no hay platos publicados
  if (response.status === 404) return null;
  if (!response.ok) throw new DailyMenuError(`HTTP ${response.status}`);

  let data;
  try {
    data = await response.json();
  } catch {
    if (signal.aborted) throw new DailyMenuError('Timeout', TIMEOUT_MESSAGE);
    throw new DailyMenuError('JSON no válido en daily-menu.json');
  }

  return normalizeMenu(data, now);
}

const COURSE_KEYS = ['starters', 'mains', 'desserts'];

const cleanDishes = (value) =>
  Array.isArray(value) ? value.map((dish) => sanitizeText(dish).slice(0, 120)).filter(Boolean).slice(0, 8) : [];

// Valida la estructura del JSON y descarta datos incompletos o de otro día
function normalizeMenu(data, now) {
  if (!data || typeof data !== 'object' || data.available !== true) return null;

  if (data.date !== undefined && data.date !== null) {
    if (!isValidIsoDate(data.date)) throw new DailyMenuError('Campo "date" no válido');
    if (data.date !== now.isoDate) return null;
  }

  const courses = Object.fromEntries(COURSE_KEYS.map((key) => [key, cleanDishes(data[key])]));
  const hasDishes = COURSE_KEYS.some((key) => courses[key].length);

  return hasDishes ? { date: data.date ?? null, courses } : null;
}

// Vuelve a mostrar el esquema genérico (sin platos concretos)
function resetScheme(root) {
  qs('[data-daily-title]', root).textContent = DEFAULT_TITLE;
  COURSE_KEYS.forEach((key) => {
    const list = qs(`[data-course="${key}"]`, root);
    list.replaceChildren();
    list.hidden = true;
    qs(`[data-course-hint="${key}"]`, root).hidden = false;
  });
}

function renderMenu(root, menu) {
  qs('[data-daily-title]', root).textContent = menu.date
    ? `Platos del ${formatLongDate(menu.date)}`
    : 'Platos de hoy';

  COURSE_KEYS.forEach((key) => {
    const dishes = menu.courses[key];
    const list = qs(`[data-course="${key}"]`, root);
    list.replaceChildren(...dishes.map((dish) => createElement('li', { text: dish })));
    list.hidden = dishes.length === 0;
    qs(`[data-course-hint="${key}"]`, root).hidden = dishes.length > 0;
  });
}
