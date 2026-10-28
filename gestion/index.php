<?php
// Panel privado de O Alambique: marcar platos como no disponibles y activar o pausar los pedidos online.
declare(strict_types=1);

const PANEL = true;

require __DIR__ . '/config.php';
require __DIR__ . '/src/helpers.php';
require __DIR__ . '/src/security.php';
require __DIR__ . '/src/catalog.php';

date_default_timezone_set(PANEL_TIMEZONE);
send_security_headers();

// Dirección base del panel (p. ej. "/gestion/"). Todas las rutas se construyen a partir de ella,
// así funciona aunque se abra como "/gestion" sin la barra final
define('PANEL_BASE', rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/gestion/index.php')), '/') . '/');

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Rutas raras como /gestion/index.php/loquesea: se manda siempre a la dirección limpia del panel
if (($_SERVER['PATH_INFO'] ?? '') !== '') {
    redirect(PANEL_BASE);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && $requestPath . '/' === PANEL_BASE) {
    $query = $_SERVER['QUERY_STRING'] ?? '';
    redirect(PANEL_BASE . ($query !== '' ? '?' . $query : ''));
}

try {
    start_secure_session();
} catch (Throwable $error) {
    error_log('[gestion] ' . $error->getMessage());
    http_response_code(500);
    render('error', ['message' => 'El panel no puede guardar datos en el servidor. Revisa los permisos de la carpeta gestion/storage.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = is_string($_POST['action'] ?? null) ? $_POST['action'] : '';
$view = is_string($_GET['view'] ?? null) ? $_GET['view'] : '';

/* ---------- Peticiones POST (todas llevan token CSRF) ---------- */

if ($method === 'POST') {
    if (!verify_csrf()) {
        flash('error', 'La página había caducado. Vuelve a intentarlo.');
        redirect(PANEL_BASE);
    }

    if ($action === 'login') {
        $remaining = login_lock_remaining();
        if ($remaining > 0) {
            flash('error', 'Demasiados intentos. Espera ' . (int) ceil($remaining / 60) . ' minutos y vuelve a probar.');
            redirect(PANEL_BASE);
        }

        $password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
        if ($password !== '' && strlen($password) <= PASSWORD_MAX_LENGTH && check_password($password)) {
            clear_login_failures();
            login();
            redirect(PANEL_BASE);
        }

        register_login_failure();
        usleep(400000); // frena los intentos automáticos
        flash('error', 'Contraseña incorrecta.');
        redirect(PANEL_BASE);
    }

    if (!is_logged_in()) {
        redirect(PANEL_BASE);
    }

    try {
        switch ($action) {
            case 'save':
                $groups = load_panel_groups();
                $available = is_array($_POST['available'] ?? null) ? $_POST['available'] : [];
                $data = save_availability($groups, $available, isset($_POST['orders_open']));
                $count = count($data['unavailable']);
                flash('success', $count === 0
                    ? 'Guardado. Todo está disponible.'
                    : "Guardado. $count " . ($count === 1 ? 'producto no disponible.' : 'productos no disponibles.'));
                redirect(PANEL_BASE);

            case 'reset':
                $groups = load_panel_groups();
                save_availability($groups, all_ids($groups), true);
                flash('success', 'Listo: todo vuelve a estar disponible y los pedidos online están activados.');
                redirect(PANEL_BASE);

            case 'password':
                $current = is_string($_POST['current'] ?? null) ? $_POST['current'] : '';
                $new = is_string($_POST['new'] ?? null) ? $_POST['new'] : '';
                $confirm = is_string($_POST['confirm'] ?? null) ? $_POST['confirm'] : '';
                $back = PANEL_BASE . '?view=password';

                if (login_lock_remaining() > 0) {
                    flash('error', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
                    redirect($back);
                }
                if (!check_password($current)) {
                    // También cuenta como intento fallido: así no se puede adivinar la contraseña desde aquí
                    register_login_failure();
                    flash('error', 'La contraseña actual no es correcta.');
                    redirect($back);
                }
                if (text_length($new) < PASSWORD_MIN_LENGTH) {
                    flash('error', 'La nueva contraseña debe tener al menos ' . PASSWORD_MIN_LENGTH . ' caracteres.');
                    redirect($back);
                }
                if (strlen($new) > PASSWORD_MAX_BYTES) {
                    flash('error', 'La nueva contraseña es demasiado larga (máximo unos 70 caracteres).');
                    redirect($back);
                }
                if (!hash_equals($new, $confirm)) {
                    flash('error', 'Las dos contraseñas nuevas no coinciden.');
                    redirect($back);
                }
                if (hash_equals($current, $new)) {
                    flash('error', 'La nueva contraseña tiene que ser distinta de la actual.');
                    redirect($back);
                }

                try {
                    save_password($new);
                } catch (Throwable $error) {
                    error_log('[gestion] ' . $error->getMessage());
                    flash('error', 'No se ha podido guardar la contraseña nueva: la anterior sigue siendo válida. Avisa a Javier.');
                    redirect($back);
                }
                login(); // renueva la sesión; las demás sesiones abiertas se cierran solas
                flash('success', 'Contraseña cambiada. Úsala la próxima vez que entres.');
                redirect(PANEL_BASE);

            case 'logout':
                logout();
                flash('success', 'Has cerrado la sesión.');
                redirect(PANEL_BASE);

            default:
                redirect(PANEL_BASE);
        }
    } catch (Throwable $error) {
        error_log('[gestion] ' . $error->getMessage());
        flash('error', 'No se ha podido guardar. Inténtalo de nuevo y, si sigue fallando, avisa a Javier.');
        redirect(PANEL_BASE);
    }
}

/* ---------- Peticiones GET ---------- */

$flash = take_flash();
$csrf = csrf_token();

if (!is_logged_in()) {
    render('login', [
        'flash' => $flash,
        'csrf' => $csrf,
        'locked' => login_lock_remaining(),
        'configured' => password_hash_stored() !== null,
    ]);
    exit;
}

if ($view === 'password') {
    render('password', ['flash' => $flash, 'csrf' => $csrf]);
    exit;
}

try {
    $groups = load_panel_groups();
    $availability = load_availability();
} catch (Throwable $error) {
    error_log('[gestion] ' . $error->getMessage());
    render('error', ['message' => 'No se puede leer la carta (data/menu.json). Avisa a Javier.']);
    exit;
}

render('panel', [
    'flash' => $flash,
    'csrf' => $csrf,
    'groups' => $groups,
    'unavailable' => array_flip($availability['unavailable']),
    'ordersOpen' => $availability['ordersOpen'],
    'updatedAt' => $availability['updatedAt'],
    'hiddenCount' => count(array_intersect($availability['unavailable'], all_ids($groups))),
]);
