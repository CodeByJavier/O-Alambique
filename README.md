# Cafetería O Alambique · Landing page

Landing page estática (HTML5 + CSS + JavaScript sin dependencias) para la Cafetería O Alambique, Verín (Ourense).

## Ver la web en local

Los módulos JS y la carga del menú del día (`fetch`) **no funcionan abriendo el archivo con doble clic** (`file://`). Hay que usar un servidor local:

- VS Code → extensión **Live Server** → "Open with Live Server" sobre `index.html`
- o en la terminal, dentro de esta carpeta: `python -m http.server 8080` y abrir `http://localhost:8080`
- para probar también el panel `/gestion/` hace falta PHP: `php -S localhost:8080` y abrir `http://localhost:8080/gestion/`

## Estructura

```
index.html              Landing (un único H1, SEO, JSON-LD Restaurant + Menu)
404.html                Página de error
aviso-legal.html        Aviso legal (LSSI-CE)
privacidad.html         Privacidad y cookies (RGPD)
robots.txt / sitemap.xml / site.webmanifest
.htaccess               Apache: HTTPS, cabeceras de seguridad, caché, compresión
_headers                Lo mismo para Netlify / Cloudflare Pages
css/
  tokens.css            Variables de diseño y fuentes
  base.css              Reset y estilos base
  layout.css            Cabecera, navegación y pie
  components.css        Botones, pestañas, tarjetas, formulario, diálogo
  sections.css          Estilos de cada sección
  animations.css        Keyframes, scroll reveal, scroll-driven, reduced motion
  legal.css             Páginas legales y 404
js/
  main.js               Punto de entrada: inicia cada módulo aislado (try/catch)
  config.js             Datos del negocio, horario y reglas de reservas
  lib/                  Lógica pura (fechas, horario, validación, DOM)
  modules/              Componentes de la interfaz
data/
  daily-menu.json       Menú del día (lo edita el cliente)
  daily-menu.example.json  Ejemplo de menú relleno
  menu.json             Carta para pedir: ids, nombres y precios en céntimos
  availability.json     Platos no disponibles y pedidos on/off (lo escribe el panel)
gestion/                Panel privado en PHP (https://www.cafeteriaoalambique.es/gestion/)
  index.php             Controlador: acceso, guardar, contraseña, salir
  config.php            Ajustes (rutas, tiempos de sesión, intentos de acceso)
  src/                  Lógica: seguridad, lectura/escritura de JSON, carta
  templates/            Vistas HTML del panel
  storage/              Contraseña (hash), sesiones e intentos. Nunca accesible por web
assets/                 Imágenes (AVIF/WebP/JPG), fuentes woff2 e iconos
```

## Actualizar el menú del día

El precio (13,50 €), los días (lunes a viernes al mediodía) y lo que incluye están fijos en `index.html`.
Los **platos de cada día** se editan en `data/daily-menu.json` (copia la estructura de `daily-menu.example.json`):

| Campo       | Descripción |
|-------------|-------------|
| `available` | `true` para mostrar los platos; `false` deja el esquema genérico e invita a llamar |
| `date`      | `AAAA-MM-DD`. Si no coincide con hoy, no se muestran (evita enseñar platos de otro día). `null` si valen varios días |
| `starters`  | Primeros platos, p. ej. `["Caldo gallego", "Ensalada mixta"]` |
| `mains`     | Segundos platos |
| `desserts`  | Postres |

Sábados, domingos y días cerrados la web muestra «Hoy no hay menú del día» sin cargar el JSON (`DAILY_MENU.weekdays` en `js/config.js`).

## Pedidos para recoger

Sección `#pedidos` de la web (`js/modules/order-form.js`): el cliente elige platos, hora de recogida de hoy y se abre WhatsApp con el pedido. Se paga al recoger.

- **Franjas de recogida**: `ORDER.pickupWindows` en `js/config.js` (13:30–15:30 y 20:30–22:30), cada 15 min, con 30 min de antelación. Se recortan con `OPENING_HOURS`: los miércoles no hay pedidos y los martes solo a mediodía.
- **Solo para el mismo día.** Si ya no quedan horas, la web indica cuándo se puede volver a pedir.
- Prueba cualquier día/hora con `?at=AAAA-MM-DDTHH:MM`.

### Panel privado `/gestion/`

Mónica entra con contraseña desde el móvil y:
- marca platos (y carnes de las hamburguesas) como **no disponibles**: en la carta salen con «No disponible hoy» y no se pueden pedir;
- **pausa los pedidos online** (vacaciones, mucho trabajo…);
- cambia su contraseña.

Seguridad: contraseña guardada solo como hash (`password_hash`), sesión con cookie `HttpOnly`/`Secure`/`SameSite=Lax`, token CSRF en todos los formularios, bloqueo de 15 min tras 5 intentos fallidos, HTTPS obligatorio, `storage/`, `src/`, `templates/` y `config.php` bloqueados por `.htaccess`.

Revisión de seguridad (28/10/2026), probada contra un Apache local con la misma configuración:
- Archivos privados (`storage/`, `src/`, `templates/`, `config.php`, `.htaccess`, `.git`, `README.md`) → 403, también con trucos de ruta (`%2e%2e`, mayúsculas, `index.php/…`).
- Formularios sin token CSRF → rechazados. Fijación de sesión → el id se renueva al entrar.
- Fuerza bruta: 5 fallos → bloqueo de 15 min (también en «Cambiar contraseña»). Contraseñas nuevas de 10 a ~70 caracteres.
- Ids falsos al guardar → ignorados; parámetros con `<script>` → no se reflejan; PHP no muestra errores ni su versión.
- `/.well-known/` queda accesible para que Hostinger renueve el certificado SSL.

Requisitos del servidor: PHP 8.1+ y permiso de escritura en `data/` y `gestion/storage/` (en Hostinger funciona tal cual).

El panel no necesita la extensión `mbstring` (en PHP de Windows suele venir desactivada).

**Si se olvida la contraseña:** genera un hash nuevo (`php -r "echo password_hash('NUEVA', PASSWORD_DEFAULT);"`) y sustitúyelo en `gestion/storage/auth.json` desde el Administrador de archivos.

### Si cambia la carta

La carta está en **3 sitios** más el JSON de pedidos:
1. `index.html` → pestañas de la carta. Cada plato lleva `data-dish="id"` (el mismo id que en `menu.json`).
2. `index.html` → JSON-LD (`hasMenuSection`).
3. `data/menu.json` → nombre y precio **en céntimos** (7,50 € = `750`). Los ids no se cambian: el panel los usa.

### Caché del navegador

Los CSS, JS e imágenes llevan `?v=AAAAMMDD` en su dirección (por ejemplo `js/main.js?v=20261028`, también en los `import` de los módulos). El `.htaccess` hace que el navegador pregunte siempre por CSS y JS nuevos, así que normalmente no hace falta tocar ese número. Si algún día un cambio no aparece a los visitantes, súbelo (fecha del día) en todos los archivos a la vez.

### Al subir actualizaciones a Hostinger

No sobrescribas estos archivos del servidor, o se perderán los cambios hechos desde el panel:
- `gestion/storage/` (contraseña, sesiones)
- `data/availability.json` (platos ocultos)

## Cambiar el horario

El horario está en **3 sitios** (hay que tocarlos a la vez):
1. `js/config.js` → `OPENING_HOURS` (estado abierto/cerrado y horas de reserva)
2. `index.html` → tabla de la sección `#horario`
3. `index.html` → `openingHoursSpecification` del JSON-LD

## Probar el estado abierto/cerrado

El estado (píldoras, «Hoy» en la tabla y la barra de progreso de la jornada) se calcula cada minuto con la hora de Madrid a partir de `OPENING_HOURS`.
Para ver cómo se comporta a otra hora, añade `?at=AAAA-MM-DDTHH:MM` a la URL, por ejemplo:

- `index.html?at=2026-09-30T12:00` → miércoles (cerrado)
- `index.html?at=2026-09-29T16:10` → martes, «Cierra pronto»
- `index.html?at=2026-09-26T08:50` → sábado antes de abrir

## Publicar en GitHub Pages

Todas las rutas son **relativas** (`css/…`, `assets/…`, `../assets/fonts/…` en CSS y `new URL(…, import.meta.url)` en JS), así que la web funciona tanto en la raíz de un dominio como en una subcarpeta como `https://codebyjavier.github.io/O-Alambique/`. **No uses rutas que empiecen por `/`**: en GitHub Pages apuntarían a `codebyjavier.github.io/` y no a la carpeta del repositorio.

- `.nojekyll` desactiva el procesado de Jekyll (sirve los archivos tal cual).
- En GitHub Pages el panel `/gestion/` no funciona (no hay PHP): los pedidos se ven, pero los platos no se pueden ocultar.
- GitHub Pages ignora `.htaccess` y `_headers`: las cabeceras de seguridad solo se aplican en Apache, Netlify o Cloudflare. En GitHub Pages queda la CSP de la etiqueta `<meta>`.
- GitHub Pages distingue mayúsculas y minúsculas en los nombres de archivo (Windows no).

## Pendiente antes de publicar

- [ ] **Dominio**: sustituir `https://www.cafeteriaoalambique.es` por el dominio real en `index.html`, `aviso-legal.html`, `privacidad.html`, `robots.txt` y `sitemap.xml`.
- [ ] Confirmar que el **629 25 53 11** tiene WhatsApp (el formulario de reservas lo usa).
- [ ] Unificar el nombre en **Google Business Profile** (ahora aparece como "Restaurante Alambique") con "Cafetería O Alambique".
- [ ] Sustituir la foto del comedor y las imágenes de las hamburguesas por **fotos reales** cuando estén (mismos nombres de archivo y tamaños).
- [ ] Rellenar `data/daily-menu.json` cuando arranque el menú del día.
- [ ] Entregar a Mónica la dirección del panel y la contraseña inicial, y que la cambie.
- [ ] Tras publicar: dar de alta el sitio en **Google Search Console** y enviar `sitemap.xml`.
