import { createElement, qsa } from '../lib/dom.js?v=20261028';
import { loadAvailability } from '../lib/catalog.js?v=20261028';

const BADGE_TEXT = 'No disponible hoy';

/**
 * Marca en la carta los platos que el local ha ocultado desde el panel /gestion/.
 * El plato sigue visible (la gente sabe que existe), pero con la etiqueta «No disponible hoy».
 */
export async function initMenuAvailability() {
  const dishes = qsa('[data-dish]');
  if (!dishes.length) return;

  const { unavailable } = await loadAvailability();

  dishes.forEach((dish) => {
    const isUnavailable = unavailable.has(dish.dataset.dish);
    dish.classList.toggle('is-unavailable', isUnavailable);
    dish.querySelector('.availability-badge')?.remove();
    if (!isUnavailable) return;

    // En las listas de precios (dl) el contenido de cada fila tiene que ser dt/dd
    const tag = dish.matches('.price-list__row') ? 'dd' : 'p';
    const badge = createElement(tag, { className: 'availability-badge', text: BADGE_TEXT });
    const target = dish.querySelector('.dish-card__body') ?? dish;
    target.append(badge);
  });
}
