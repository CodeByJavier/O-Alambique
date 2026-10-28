<?php
// Aviso tras guardar (éxito o error)
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/** @var array|null $flash */
if ($flash): ?>
  <p class="notice notice--<?= $flash['type'] === 'success' ? 'success' : 'error' ?>" role="<?= $flash['type'] === 'success' ? 'status' : 'alert' ?>">
    <?= e($flash['message']) ?>
  </p>
<?php endif;
