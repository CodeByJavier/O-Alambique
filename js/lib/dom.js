export const qs = (selector, scope = document) => scope.querySelector(selector);

export const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

/**
 * Crea elementos sin innerHTML: todo el texto pasa por textContent (evita inyección de HTML).
 */
export function createElement(tag, { className, text, attrs = {} } = {}, children = []) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
  children.forEach((child) => element.append(child));
  return element;
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
