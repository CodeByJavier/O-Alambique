import { ORDER } from '../config.js?v=20261028';
import { sanitizeText } from './validators.js?v=20261028';

const ID_PATTERN = /^[a-z0-9-]{1,60}$/;

export class CatalogError extends Error {
  constructor(message, userMessage) {
    super(message);
    this.name = 'CatalogError';
    this.userMessage = userMessage;
  }
}

async function fetchJson(url, { timeoutMs = ORDER.timeoutMs, signal } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort('timeout'), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort(signal.reason), { once: true });

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new CatalogError(`HTTP ${response.status} en ${url}`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new CatalogError('Timeout', 'La carta está tardando demasiado en cargar. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (navigator.onLine === false) {
      throw new CatalogError(error.message, 'Parece que no tienes conexión a internet.');
    }
    throw error instanceof CatalogError ? error : new CatalogError(error.message);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const isPrice = (value) => Number.isInteger(value) && value >= 0 && value <= 100000;

const cleanName = (value) => sanitizeText(value).slice(0, 120);

// Valida data/menu.json y descarta lo que no tenga la forma esperada
function normalizeCatalog(data) {
  if (!data || !Array.isArray(data.categories)) throw new CatalogError('menu.json sin categorías');

  const optionGroups = {};
  Object.entries(data.optionGroups ?? {}).forEach(([key, group]) => {
    const choices = (group?.choices ?? [])
      .filter((choice) => ID_PATTERN.test(choice?.id) && isPrice(choice?.price))
      .map((choice) => ({ id: choice.id, name: cleanName(choice.name), price: choice.price }));
    if (choices.length) optionGroups[key] = { name: cleanName(group.name), choices };
  });

  const items = new Map();
  const categories = data.categories
    .filter((category) => ID_PATTERN.test(category?.id) && Array.isArray(category.items))
    .map((category) => ({
      id: category.id,
      name: cleanName(category.name),
      note: category.note ? cleanName(category.note) : '',
      items: category.items
        .filter((item) => ID_PATTERN.test(item?.id) && isPrice(item?.price) && !items.has(item.id))
        .map((item) => {
          const normalized = {
            id: item.id,
            name: cleanName(item.name),
            description: item.description ? sanitizeText(item.description).slice(0, 240) : '',
            tip: item.tip ? sanitizeText(item.tip).slice(0, 120) : '',
            price: item.price,
            categoryId: category.id,
            options: item.options && optionGroups[item.options] ? item.options : null,
          };
          items.set(item.id, normalized);
          return normalized;
        }),
    }))
    .filter((category) => category.items.length);

  if (!categories.length) throw new CatalogError('menu.json sin platos');
  return { categories, items, optionGroups };
}

const EMPTY_AVAILABILITY = Object.freeze({ ordersOpen: true, unavailable: new Set(), known: false });

function normalizeAvailability(data) {
  if (!data || typeof data !== 'object') return EMPTY_AVAILABILITY;
  const unavailable = Array.isArray(data.unavailable)
    ? data.unavailable.filter((id) => typeof id === 'string' && ID_PATTERN.test(id))
    : [];
  return { ordersOpen: data.ordersOpen !== false, unavailable: new Set(unavailable), known: true };
}

export async function loadCatalog(options) {
  return normalizeCatalog(await fetchJson(ORDER.catalogUrl, options));
}

let availabilityPromise;

/**
 * Disponibilidad compartida entre la carta y el formulario de pedidos (una sola petición).
 * Si falla, no bloquea nada: se asume que todo está disponible y el local lo confirma por WhatsApp.
 */
export function loadAvailability({ force = false } = {}) {
  if (!availabilityPromise || force) {
    availabilityPromise = fetchJson(ORDER.availabilityUrl)
      .then(normalizeAvailability)
      .catch((error) => {
        console.warn('[catalog] No se pudo leer la disponibilidad, se muestra todo como disponible.', error);
        return EMPTY_AVAILABILITY;
      });
  }
  return availabilityPromise;
}
