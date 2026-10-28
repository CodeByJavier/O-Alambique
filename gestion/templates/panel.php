<?php
// Panel principal: interruptores de disponibilidad
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/**
 * @var array|null $flash @var string $csrf @var array $groups @var array $unavailable
 * @var bool $ordersOpen @var string|null $updatedAt @var int $hiddenCount
 */
$pageTitle = 'Disponibilidad';
require __DIR__ . '/_header.php';
?>
    <header class="topbar">
      <div>
        <h1 class="title">Disponible hoy</h1>
        <p class="muted">Última actualización: <?= e(format_datetime($updatedAt)) ?></p>
      </div>
      <form method="post" action="<?= url() ?>">
        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
        <input type="hidden" name="action" value="logout">
        <button class="button button--small" type="submit">Salir</button>
      </form>
    </header>

    <?php require __DIR__ . '/_flash.php'; ?>

    <div class="summary">
      <p>
        <?php if ($hiddenCount === 0): ?>
          Ahora mismo <strong>todo está disponible</strong>.
        <?php else: ?>
          <strong><?= $hiddenCount ?></strong> <?= $hiddenCount === 1 ? 'producto marcado' : 'productos marcados' ?> como no disponible.
        <?php endif; ?>
      </p>
      <?php if ($hiddenCount > 0 || !$ordersOpen): ?>
        <form method="post" action="<?= url() ?>">
          <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
          <input type="hidden" name="action" value="reset">
          <button class="button button--small" type="submit">Volver a ponerlo todo disponible</button>
        </form>
      <?php endif; ?>
    </div>

    <form class="availability" method="post" action="<?= url() ?>">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="action" value="save">

      <fieldset class="card group">
        <legend class="group__title">Pedidos online</legend>
        <label class="switch-row">
          <span>
            <span class="switch-row__name">Aceptar pedidos para recoger</span>
            <span class="switch-row__meta">Desactívalo si hoy no podéis atender pedidos (vacaciones, mucho trabajo…).</span>
          </span>
          <input class="switch" type="checkbox" name="orders_open" value="1" <?= $ordersOpen ? 'checked' : '' ?>>
        </label>
      </fieldset>

      <p class="help">Activado = <strong>disponible</strong>. Desactiva lo que no tengáis hoy y pulsa <strong>Guardar cambios</strong>. En la web aparecerá como «No disponible hoy» y no se podrá pedir.</p>

      <?php foreach ($groups as $group): ?>
        <fieldset class="card group">
          <legend class="group__title"><?= e($group['title']) ?></legend>
          <?php foreach ($group['items'] as $item): $id = $item['id']; ?>
            <label class="switch-row">
              <span>
                <span class="switch-row__name"><?= e($item['name']) ?></span>
                <span class="switch-row__meta"><?= !empty($group['isOption']) ? ($item['price'] ? '+' . e(format_price($item['price'])) : 'Incluida') : e(format_price($item['price'])) ?></span>
              </span>
              <input class="switch" type="checkbox" name="available[]" value="<?= e($id) ?>" <?= isset($unavailable[$id]) ? '' : 'checked' ?>>
            </label>
          <?php endforeach; ?>
        </fieldset>
      <?php endforeach; ?>

      <div class="savebar">
        <button class="button button--primary button--block" type="submit">Guardar cambios</button>
      </div>
    </form>

    <p class="footer-links"><a href="<?= url('?view=password') ?>">Cambiar contraseña</a></p>
<?php require __DIR__ . '/_footer.php';
