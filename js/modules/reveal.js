import { qsa, prefersReducedMotion } from '../lib/dom.js';

export function initReveal() {
  const targets = qsa('[data-reveal]');
  if (!targets.length) return;

  const showAll = () => targets.forEach((target) => target.classList.add('is-visible'));

  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    showAll();
    return;
  }

  // Retardo escalonado para los elementos de un mismo grupo
  qsa('[data-reveal-group]').forEach((group) => {
    qsa(':scope > [data-reveal]', group).forEach((item, index) => {
      item.style.setProperty('--reveal-index', index);
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  document.documentElement.classList.add('js-reveal');
  targets.forEach((target) => observer.observe(target));
}
