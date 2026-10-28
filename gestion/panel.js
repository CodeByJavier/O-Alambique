// Botón «ojo» de los campos de contraseña: muestra u oculta lo que se escribe.
// Sin JavaScript los botones siguen ocultos y los campos funcionan igual.
document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!input) return;

  button.hidden = false;
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
    input.focus();
  });
});

// Al enviar, el campo vuelve a ser de tipo contraseña (así el navegador no la guarda como texto normal)
document.querySelectorAll('form').forEach((form) => {
  form.addEventListener('submit', () => {
    form.querySelectorAll('.password-field input').forEach((input) => {
      input.type = 'password';
    });
  });
});
