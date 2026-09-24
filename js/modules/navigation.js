import { qs, qsa } from '../lib/dom.js';

const DESKTOP_QUERY = '(min-width: 64em)';

export function initNavigation() {
  const header = qs('[data-header]');
  const toggle = qs('[data-nav-toggle]');
  const toggleLabel = qs('[data-nav-toggle-label]');
  const nav = qs('[data-nav]');
  if (!header || !toggle || !nav) return;

  const toggleIcon = qs('use', toggle);
  const outsideRegions = [qs('main'), qs('.site-footer')].filter(Boolean);
  const desktop = window.matchMedia(DESKTOP_QUERY);
  let isOpen = false;

  qsa('.site-nav__list li', nav).forEach((item, index) => item.style.setProperty('--nav-index', index));

  const setOpen = (open, { restoreFocus = true } = {}) => {
    if (open === isOpen) return;
    isOpen = open;

    nav.classList.toggle('is-open', open);
    header.classList.toggle('is-nav-open', open);
    document.body.classList.toggle('is-locked', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    toggleIcon?.setAttribute('href', open ? '#icon-close' : '#icon-menu');
    // inert saca el resto de la página del foco y del lector de pantalla mientras el menú está abierto
    outsideRegions.forEach((region) => region.toggleAttribute('inert', open));

    if (open) {
      qs('a', nav)?.focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  };

  toggle.addEventListener('click', () => setOpen(!isOpen));

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a') && !desktop.matches) setOpen(false, { restoreFocus: false });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) setOpen(false);
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches) setOpen(false, { restoreFocus: false });
  });

  initScrolledState(header);
  initScrollSpy(nav);
}

function initScrolledState(header) {
  let ticking = false;

  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true },
  );

  update();
}

function initScrollSpy(nav) {
  if (!('IntersectionObserver' in window)) return;

  const links = qsa('.site-nav__link', nav);
  const linkById = new Map(
    links.map((link) => [decodeURIComponent(link.hash.slice(1)), link]),
  );

  const setActive = (id) => {
    links.forEach((link) => {
      const active = link === linkById.get(id);
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );

  qsa('main section[id]').forEach((section) => observer.observe(section));
}
