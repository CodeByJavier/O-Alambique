import { BUSINESS } from '../config.js';
import { qs } from '../lib/dom.js';

const LOAD_TIMEOUT_MS = 12_000;

// El iframe de Google Maps solo se carga cuando el usuario lo pide: mejor rendimiento y privacidad
export function initMapFacade() {
  const map = qs('[data-map]');
  if (!map) return;

  const button = qs('[data-map-load]', map);
  const errorMessage = qs('[data-map-error]', map);
  let timeoutId;

  const setState = (state) => {
    map.dataset.state = state;
    map.setAttribute('aria-busy', String(state === 'loading'));
  };

  const fail = (iframe) => {
    iframe?.remove();
    setState('error');
    errorMessage.hidden = false;
    button.textContent = 'Reintentar';
  };

  button?.addEventListener('click', () => {
    if (map.dataset.state === 'loading' || map.dataset.state === 'loaded') return;

    if (navigator.onLine === false) {
      fail();
      return;
    }

    errorMessage.hidden = true;
    setState('loading');
    button.textContent = 'Cargando mapa…';

    const iframe = document.createElement('iframe');
    iframe.title = 'Mapa de Google con la ubicación de O Alambique en Verín';
    iframe.src = BUSINESS.mapEmbedUrl;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;

    iframe.addEventListener('load', () => {
      window.clearTimeout(timeoutId);
      setState('loaded');
    }, { once: true });

    timeoutId = window.setTimeout(() => fail(iframe), LOAD_TIMEOUT_MS);
    map.append(iframe);
  });
}
