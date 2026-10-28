import { initNavigation } from './modules/navigation.js?v=20261028';
import { initOpeningStatus } from './modules/opening-status.js?v=20261028';
import { initMenuTabs } from './modules/menu-tabs.js?v=20261028';
import { initDailyMenu } from './modules/daily-menu.js?v=20261028';
import { initReservationForm } from './modules/reservation-form.js?v=20261028';
import { initMapFacade } from './modules/map-facade.js?v=20261028';
import { initDialogs } from './modules/menu-dialog.js?v=20261028';
import { initReveal } from './modules/reveal.js?v=20261028';
import { initMenuAvailability } from './modules/menu-availability.js?v=20261028';
import { initOrderForm } from './modules/order-form.js?v=20261028';

const modules = {
  navigation: initNavigation,
  openingStatus: initOpeningStatus,
  menuTabs: initMenuTabs,
  dailyMenu: initDailyMenu,
  menuAvailability: initMenuAvailability,
  orderForm: initOrderForm,
  reservationForm: initReservationForm,
  mapFacade: initMapFacade,
  dialogs: initDialogs,
  reveal: initReveal,
};

// Cada módulo se inicia aislado: si uno falla, el resto de la página sigue funcionando
Object.entries(modules).forEach(([name, init]) => {
  try {
    // Algunos módulos son asíncronos: sus errores también se capturan aquí
    Promise.resolve(init()).catch((error) => console.error(`[main] Error en "${name}"`, error));
  } catch (error) {
    console.error(`[main] Error al iniciar "${name}"`, error);
  }
});

document.querySelectorAll('[data-current-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});
