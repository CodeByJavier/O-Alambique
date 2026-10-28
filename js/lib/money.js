// Los precios se guardan en céntimos (enteros) para evitar errores de redondeo con decimales.
const EURO = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

export const formatPrice = (cents) => EURO.format(cents / 100);

// Para los extras: "+1,50 €"
export const formatExtra = (cents) => `+${formatPrice(cents)}`;
