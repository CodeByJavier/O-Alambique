import { BUSINESS } from '../config.js?v=20261028';

export const buildWhatsappUrl = (lines) =>
  `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;

// Abre primero una pestaña en blanco (mismo origen) para poder cortar window.opener antes de navegar
export function openInNewTab(url) {
  try {
    const popup = window.open('about:blank', '_blank');
    if (!popup) return null;
    popup.opener = null;
    popup.location.replace(url);
    return popup;
  } catch (error) {
    console.warn('[whatsapp] No se pudo abrir la pestaña', error);
    return null;
  }
}
