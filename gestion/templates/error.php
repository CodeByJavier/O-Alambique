<?php
// Error que impide usar el panel
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/** @var string $message */
$pageTitle = 'Error';
require __DIR__ . '/_header.php';
?>
    <section class="card card--narrow">
      <h1 class="title">Algo no va bien</h1>
      <p class="notice notice--error" role="alert"><?= e($message) ?></p>
      <a class="button" href="<?= url() ?>">Volver a intentarlo</a>
    </section>
<?php require __DIR__ . '/_footer.php';
