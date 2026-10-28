<?php
// Pantalla de acceso
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/** @var array|null $flash @var string $csrf @var int $locked @var bool $configured */
$pageTitle = 'Acceso';
require __DIR__ . '/_header.php';
?>
    <section class="card card--narrow">
      <img class="brand" src="<?= url('../assets/img/logo-o-alambique.svg') ?>" alt="O Alambique" width="160" height="110">
      <h1 class="title">Panel de la cafetería</h1>
      <p class="muted">Desde aquí marcas los platos que no quedan hoy y activas o pausas los pedidos online.</p>

      <?php require __DIR__ . '/_flash.php'; ?>

      <?php if (!$configured): ?>
        <p class="notice notice--error" role="alert">El panel todavía no tiene contraseña. Avisa a Javier.</p>
      <?php elseif ($locked > 0): ?>
        <p class="notice notice--error" role="alert">Demasiados intentos. Vuelve a probar dentro de <?= (int) ceil($locked / 60) ?> minutos.</p>
      <?php else: ?>
        <form class="stack" method="post" action="<?= url() ?>">
          <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
          <input type="hidden" name="action" value="login">
          <label class="label" for="password">Contraseña</label>
          <?= password_field('password', 'password', 'current-password', 'autofocus') ?>
          <button class="button button--primary" type="submit">Entrar</button>
        </form>
      <?php endif; ?>
    </section>
<?php require __DIR__ . '/_footer.php';
