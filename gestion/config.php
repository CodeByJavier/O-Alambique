<?php
// Configuración del panel de gestión. No se sirve al navegador (lo bloquea gestion/.htaccess).
declare(strict_types=1);

if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}

const PANEL_NAME = 'Cafetería O Alambique';

// Rutas (relativas a esta carpeta)
define('PANEL_STORAGE', __DIR__ . '/storage');
define('PANEL_CATALOG_FILE', dirname(__DIR__) . '/data/menu.json');
define('PANEL_AVAILABILITY_FILE', dirname(__DIR__) . '/data/availability.json');

// Sesión: cuánto tiempo sigue abierta la sesión en el móvil de la cafetería
const SESSION_NAME = 'alambique_panel';
const SESSION_IDLE_SECONDS = 14 * 24 * 3600;      // sin usar el panel
const SESSION_ABSOLUTE_SECONDS = 30 * 24 * 3600;  // desde que se inició sesión

// Protección contra adivinar la contraseña
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_SECONDS = 15 * 60;

const PASSWORD_MIN_LENGTH = 10;   // caracteres
const PASSWORD_MAX_LENGTH = 200;  // caracteres que acepta el campo al entrar
const PASSWORD_MAX_BYTES = 72;    // bcrypt ignora lo que pase de 72 bytes: no se permiten contraseñas nuevas más largas

const PANEL_TIMEZONE = 'Europe/Madrid';
