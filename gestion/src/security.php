<?php
// Seguridad del panel: sesión, cabeceras, token CSRF, límite de intentos y contraseña.
declare(strict_types=1);

if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
}

function send_security_headers(): void
{
    // Nunca mostrar errores de PHP al visitante (revelarían rutas del servidor); van al registro de errores
    ini_set('display_errors', '0');
    header_remove('X-Powered-By');
    header('Cache-Control: no-store, max-age=0');
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}

function ensure_storage(): void
{
    foreach ([PANEL_STORAGE, PANEL_STORAGE . '/sessions'] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException("No se puede crear $dir");
        }
    }
}

function start_secure_session(): void
{
    ensure_storage();
    // Sesiones en una carpeta propia: el hosting no las borra antes de tiempo
    session_save_path(PANEL_STORAGE . '/sessions');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) SESSION_ABSOLUTE_SECONDS);

    $path = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/gestion/index.php'), '/') . '/';
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => SESSION_ABSOLUTE_SECONDS,
        'path' => $path,
        'secure' => is_https(),
        'httponly' => true,
        // Lax (no Strict): al abrir el enlace del panel desde WhatsApp la sesión se mantiene
        'samesite' => 'Lax',
    ]);
    session_start();
}

/* ---------- Token CSRF: cada formulario lleva un código secreto de la sesión ---------- */

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function verify_csrf(): bool
{
    $sent = $_POST['csrf'] ?? '';
    return is_string($sent) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $sent);
}

/* ---------- Sesión iniciada ---------- */

function is_logged_in(): bool
{
    if (empty($_SESSION['auth'])) {
        return false;
    }
    $now = time();
    $loginAt = (int) ($_SESSION['login_at'] ?? 0);
    $lastSeen = (int) ($_SESSION['last_seen'] ?? 0);
    if ($now - $loginAt > SESSION_ABSOLUTE_SECONDS || $now - $lastSeen > SESSION_IDLE_SECONDS) {
        logout();
        return false;
    }
    // La contraseña cambió después de iniciar esta sesión: hay que volver a entrar
    if (($_SESSION['auth_version'] ?? '') !== auth_version()) {
        logout();
        return false;
    }
    $_SESSION['last_seen'] = $now;
    return true;
}

function login(): void
{
    session_regenerate_id(true);
    $_SESSION['auth'] = true;
    $_SESSION['login_at'] = time();
    $_SESSION['last_seen'] = time();
    $_SESSION['auth_version'] = auth_version();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function logout(): void
{
    $_SESSION = [];
    session_regenerate_id(true);
}

/* ---------- Contraseña (solo se guarda su hash, nunca la contraseña) ---------- */

function auth_file(): string
{
    return PANEL_STORAGE . '/auth.json';
}

function password_hash_stored(): ?string
{
    $data = read_json(auth_file());
    $hash = $data['password_hash'] ?? null;
    return is_string($hash) && $hash !== '' ? $hash : null;
}

function auth_version(): string
{
    $hash = password_hash_stored();
    return $hash ? substr(hash('sha256', $hash), 0, 16) : '';
}

function check_password(string $password): bool
{
    $hash = password_hash_stored();
    if (!$hash) {
        // Mismo coste de tiempo aunque no haya contraseña configurada
        password_verify($password, '$2y$10$CCiAoeq5fiAK6gLJE1TDm.0NjVHNoT18H61I6iQgy2dwGHXeL8Enm');
        return false;
    }
    $ok = password_verify($password, $hash);
    if ($ok && password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        save_password($password);
    }
    return $ok;
}

function save_password(string $password): void
{
    write_json_atomic(auth_file(), [
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'updatedAt' => (new DateTimeImmutable('now', new DateTimeZone(PANEL_TIMEZONE)))->format(DATE_ATOM),
    ]);
}

/* ---------- Límite de intentos de acceso (por IP) ---------- */

function attempts_file(): string
{
    return PANEL_STORAGE . '/login-attempts.json';
}

function client_key(): string
{
    // Se guarda un resumen de la IP, no la IP en claro
    return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|o-alambique'), 0, 24);
}

/** Segundos que faltan para poder volver a intentarlo (0 = puede intentarlo ya). */
function login_lock_remaining(): int
{
    $entry = (read_json(attempts_file()) ?? [])[client_key()] ?? null;
    $lockedUntil = (int) ($entry['lockedUntil'] ?? 0);
    return max(0, $lockedUntil - time());
}

function register_login_failure(): void
{
    $now = time();
    $all = read_json(attempts_file()) ?? [];
    // Limpieza de entradas antiguas
    $all = array_filter($all, static fn ($entry) => is_array($entry)
        && max((int) ($entry['first'] ?? 0) + LOGIN_WINDOW_SECONDS, (int) ($entry['lockedUntil'] ?? 0)) > $now);

    $key = client_key();
    $entry = $all[$key] ?? ['count' => 0, 'first' => $now, 'lockedUntil' => 0];
    if ($now - (int) $entry['first'] > LOGIN_WINDOW_SECONDS) {
        $entry = ['count' => 0, 'first' => $now, 'lockedUntil' => 0];
    }
    $entry['count']++;
    if ($entry['count'] >= LOGIN_MAX_FAILURES) {
        $entry['lockedUntil'] = $now + LOGIN_LOCK_SECONDS;
        $entry['count'] = 0;
        $entry['first'] = $now;
    }
    $all[$key] = $entry;
    write_json_atomic(attempts_file(), $all);
}

function clear_login_failures(): void
{
    $all = read_json(attempts_file()) ?? [];
    unset($all[client_key()]);
    write_json_atomic(attempts_file(), $all);
}
