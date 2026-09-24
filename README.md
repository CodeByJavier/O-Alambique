# Cafetería O Alambique · Landing page

Landing page estática (HTML5 + CSS + JavaScript sin dependencias) para la Cafetería O Alambique, Verín (Ourense).

## Ver la web en local

Los módulos JS y la carga del menú del día (`fetch`) **no funcionan abriendo el archivo con doble clic** (`file://`). Hay que usar un servidor local:

- VS Code → extensión **Live Server** → "Open with Live Server" sobre `index.html`
- o en la terminal, dentro de esta carpeta: `python -m http.server 8080` y abrir `http://localhost:8080`

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
assets/                 Imágenes (AVIF/WebP/JPG), fuentes woff2 e iconos
```

## Actualizar el menú del día

Edita `data/daily-menu.json` (copia la estructura de `daily-menu.example.json`):

| Campo       | Descripción |
|-------------|-------------|
| `available` | `true` para mostrarlo, `false` muestra "Muy pronto" |
| `date`      | Opcional. `AAAA-MM-DD`. Si no coincide con hoy, se oculta (evita mostrar un menú viejo). Déjalo en `null` si el menú vale varios días |
| `price`     | Número, p. ej. `12.5` |
| `days`      | Texto libre, p. ej. "De lunes a viernes, al mediodía" |
| `courses`   | Lista de `{ "name": "Primeros", "dishes": ["...", "..."] }` |
| `includes`  | Lista, p. ej. `["Pan", "Bebida", "Postre o café"]` |

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
- GitHub Pages ignora `.htaccess` y `_headers`: las cabeceras de seguridad solo se aplican en Apache, Netlify o Cloudflare. En GitHub Pages queda la CSP de la etiqueta `<meta>`.
- GitHub Pages distingue mayúsculas y minúsculas en los nombres de archivo (Windows no).

## Pendiente antes de publicar

- [ ] **Dominio**: sustituir `https://www.cafeteriaoalambique.es` por el dominio real en `index.html`, `aviso-legal.html`, `privacidad.html`, `robots.txt` y `sitemap.xml`.
- [ ] **Datos legales**: rellenar razón social y NIF/CIF en `aviso-legal.html` y `privacidad.html` (marcados en rojo como "Pendiente").
- [ ] Confirmar que el **629 25 53 11** tiene WhatsApp (el formulario de reservas lo usa).
- [ ] Unificar el nombre en **Google Business Profile** (ahora aparece como "Restaurante Alambique") con "Cafetería O Alambique".
- [ ] Sustituir la foto del comedor y las imágenes de las hamburguesas por **fotos reales** cuando estén (mismos nombres de archivo y tamaños).
- [ ] Rellenar `data/daily-menu.json` cuando arranque el menú del día.
- [ ] Tras publicar: dar de alta el sitio en **Google Search Console** y enviar `sitemap.xml`.
