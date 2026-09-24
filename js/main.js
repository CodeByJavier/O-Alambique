import { initNavigation } from './modules/navigation.js';
import { initOpeningStatus } from './modules/opening-status.js';
import { initMenuTabs } from './modules/menu-tabs.js';
import { initDailyMenu } from './modules/daily-menu.js';
import { initReservationForm } from './modules/reservation-form.js';
import { initMapFacade } from './modules/map-facade.js';
import { initDialogs } from './modules/menu-dialog.js';
import { initReveal } from './modules/reveal.js';

const modules = {
  navigation: initNavigation,
  openingStatus: initOpeningStatus,
  menuTabs: initMenuTabs,
  dailyMenu: initDailyMenu,
  reservationForm: initReservationForm,
  mapFacade: initMapFacade,
  dialogs: initDialogs,
  reveal: initReveal,
};

// Cada módulo se inicia aislado: si uno falla, el resto de la página sigue funcionando
Object.entries(modules).forEach(([name, init]) => {
  try {
    init();
  } catch (error) {
    console.error(`[main] Error al iniciar "${name}"`, error);
  }
});

document.querySelectorAll('[data-current-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
