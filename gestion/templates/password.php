<?php
// Cambiar la contraseña del panel
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/** @var array|null $flash @var string $csrf */
$pageTitle = 'Cambiar contraseña';
require __DIR__ . '/_header.php';
?>
    <section class="card card--narrow">
      <a class="back" href="<?= url() ?>">← Volver al panel</a>
      <h1 class="title">Cambiar contraseña</h1>
      <?php require __DIR__ . '/_flash.php'; ?>
      <form class="stack" method="post" action="<?= url() ?>">
        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="password">

        <label class="label" for="current">Contraseña actual</label>
        <?= password_field('current', 'current', 'current-password') ?>

        <label class="label" for="new">Nueva contraseña</label>
        <?= password_field('new', 'new', 'new-password', 'minlength="' . PASSWORD_MIN_LENGTH . '" aria-describedby="new-hint"') ?>
        <p class="hint" id="new-hint">Mínimo <?= PASSWORD_MIN_LENGTH ?> caracteres. Mejor varias palabras fáciles de recordar para ti, por ejemplo «cafe-con-churros-en-verin».</p>

        <label class="label" for="confirm">Repite la nueva contraseña</label>
        <?= password_field('confirm', 'confirm', 'new-password', 'minlength="' . PASSWORD_MIN_LENGTH . '"') ?>

        <button class="button button--primary" type="submit">Guardar contraseña</button>
      </form>
    </section>
<?php require __DIR__ . '/_footer.php';
