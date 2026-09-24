import { qs, qsa } from '../lib/dom.js';

export function initDialogs() {
  qsa('[data-dialog-open]').forEach((trigger) => {
    const dialog = qs(`#${trigger.dataset.dialogOpen}`);
    if (!dialog) return;

    // Navegadores sin <dialog>: se abre la imagen de la carta directamente
    if (typeof dialog.showModal !== 'function') {
      trigger.addEventListener('click', () => {
        const image = qs('img', dialog);
        if (image) window.open(image.currentSrc || image.src, '_blank', 'noopener');
      });
      return;
    }

    trigger.addEventListener('click', () => {
      dialog.showModal();
      document.body.classList.add('is-locked');
    });

    dialog.addEventListener('close', () => {
      document.body.classList.remove('is-locked');
      trigger.focus();
    });

    // Cerrar al pulsar fuera del contenido (sobre el backdrop)
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    qsa('[data-dialog-close]', dialog).forEach((button) => {
      button.addEventListener('click', () => dialog.close());
    });
  });
}
