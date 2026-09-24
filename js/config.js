// Fuente única de datos del negocio para toda la lógica JS.
// Si cambia el horario, actualiza también la tabla de index.html y el JSON-LD.

export const BUSINESS = Object.freeze({
  name: 'Cafetería O Alambique',
  phone: '+34629255311',
  phoneDisplay: '629 25 53 11',
  whatsapp: '34629255311',
  email: 'alambiqueverin2@gmail.com',
  timeZone: 'Europe/Madrid',
  mapEmbedUrl: 'https://www.google.com/maps?q=R%C3%BAa+da+Constituci%C3%B3n+14,+32600+Ver%C3%ADn,+Ourense&output=embed',
});

// Claves = día de la semana de Date#getDay (0 domingo … 6 sábado). '24:00' = medianoche.
export const OPENING_HOURS = Object.freeze({
  0: [{ open: '09:30', close: '24:00' }],
  1: [{ open: '08:30', close: '24:00' }],
  2: [{ open: '08:30', close: '16:30' }],
  3: [],
  4: [{ open: '08:30', close: '24:00' }],
  5: [{ open: '08:30', close: '24:00' }],
  6: [{ open: '09:30', close: '24:00' }],
});

export const RESERVATION = Object.freeze({
  slotStepMinutes: 30,
  lastSlotBeforeCloseMinutes: 60,
  minNoticeMinutes: 30,
  maxDaysAhead: 60,
  minGuests: 1,
  maxGuests: 20,
});

export const DAILY_MENU = Object.freeze({
  url: '/data/daily-menu.json',
  timeoutMs: 8000,
});

export const CLOSING_SOON_MINUTES = 45;
