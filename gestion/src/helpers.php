<?php
// Utilidades generales: escapar HTML, leer/escribir JSON de forma segura, redirecciones y avisos.
declare(strict_types=1);

if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}

/** Escapa texto para pintarlo en HTML (evita inyección de código). */
function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Lee un JSON y devuelve un array, o null si no existe o está dañado. */
function read_json(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    try {
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }
    return is_array($data) ? $data : null;
}

/**
 * Escribe un JSON de forma atómica: primero en un archivo temporal y luego lo renombra.
 * Así nunca queda un archivo a medio escribir aunque dos personas guarden a la vez.
 */
function write_json_atomic(string $path, array $data): void
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $dir = dirname($path);
    // El archivo de bloqueo vive en storage/ (no accesible desde la web)
    $lock = fopen(PANEL_STORAGE . '/' . basename($path) . '.lock', 'c');
    if ($lock === false) {
        throw new RuntimeException("No se puede crear el bloqueo de $path");
    }

    try {
        flock($lock, LOCK_EX);
        $tmp = tempnam($dir, '.tmp-');
        if ($tmp === false || file_put_contents($tmp, $json . "\n") === false) {
            throw new RuntimeException("No se puede escribir en $dir");
        }
        chmod($tmp, 0644);
        if (!rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException("No se puede reemplazar $path");
        }
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Redirección tras un POST (patrón POST → redirección → GET: recargar no reenvía el formulario). */
function redirect(string $location = PANEL_BASE): never
{
    header('Location: ' . $location, true, 303);
    exit;
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function take_flash(): ?array
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

/** Número de caracteres (no de bytes) sin depender de la extensión mbstring, que no siempre está activada. */
function text_length(string $value): int
{
    $count = preg_match_all('/./su', $value);
    return $count === false ? strlen($value) : $count;
}

function format_price(int $cents): string
{
    return number_format($cents / 100, 2, ',', '.') . ' €';
}

function format_datetime(?string $iso): string
{
    if (!$iso) {
        return 'nunca';
    }
    try {
        $date = new DateTimeImmutable($iso);
    } catch (Exception) {
        return 'desconocida';
    }
    $date = $date->setTimezone(new DateTimeZone(PANEL_TIMEZONE));
    return $date->format('d/m/Y') . ' a las ' . $date->format('H:i');
}

/** Ruta dentro del panel o del sitio, relativa a la carpeta del panel (p. ej. url('panel.css')). */
function url(string $path = ''): string
{
    return e(PANEL_BASE . $path);
}

/**
 * Campo de contraseña con botón «ojo» para ver lo que se escribe.
 * El botón empieza oculto y lo activa panel.js: sin JavaScript, el campo funciona igual.
 */
function password_field(string $id, string $name, string $autocomplete, string $extraAttributes = ''): string
{
    $eyes = '<svg class="eye eye--show" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
        . '<svg class="eye eye--hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/>'
        . '<path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/>'
        . '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

    return sprintf(
        '<div class="password-field">'
        . '<input class="input" id="%1$s" name="%2$s" type="password" autocomplete="%3$s" required maxlength="%4$d" spellcheck="false" autocapitalize="off" %5$s>'
        . '<button class="password-toggle" type="button" data-password-toggle aria-controls="%1$s" aria-pressed="false" aria-label="Mostrar contraseña" hidden>%6$s</button>'
        . '</div>',
        e($id),
        e($name),
        e($autocomplete),
        PASSWORD_MAX_LENGTH,
        $extraAttributes, // atributos fijos escritos en las plantillas, nunca datos del usuario
        $eyes,
    );
}

function render(string $template, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    require __DIR__ . '/../templates/' . $template . '.php';
}
