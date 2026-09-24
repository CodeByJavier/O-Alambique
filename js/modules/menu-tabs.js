import { qs, qsa, prefersReducedMotion } from '../lib/dom.js';

export function initMenuTabs() {
  qsa('[data-tabs]').forEach(setupTabs);
}

function setupTabs(root) {
  const tabs = qsa('[role="tab"]', root);
  if (!tabs.length) return;

  const panelOf = (tab) => qs(`#${tab.getAttribute('aria-controls')}`, root);

  const applySelection = (selectedTab) => {
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panelOf(tab);
      if (panel) panel.hidden = !selected;
    });
  };

  const select = (tab, { focus = false } = {}) => {
    if (tab.getAttribute('aria-selected') === 'true') return;
    if (focus) tab.focus();

    // View Transitions API como mejora progresiva
    if (document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(() => applySelection(tab));
    } else {
      applySelection(tab);
    }
  };

  root.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab && tabs.includes(tab)) select(tab);
  });

  root.addEventListener('keydown', (event) => {
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    const keyMap = {
      ArrowRight: (currentIndex + 1) % tabs.length,
      ArrowLeft: (currentIndex - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };

    if (!(event.key in keyMap)) return;
    event.preventDefault();
    select(tabs[keyMap[event.key]], { focus: true });
  });
}
