<?php
// Cabecera común de las páginas del panel
declare(strict_types=1);
if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}
/** @var string $pageTitle */
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#141110">
  <title><?= e($pageTitle) ?> · <?= e(PANEL_NAME) ?></title>
  <link rel="icon" href="<?= url('../favicon.svg') ?>" type="image/svg+xml">
  <link rel="stylesheet" href="<?= url('panel.css') ?>">
  <script src="<?= url('panel.js') ?>" defer></script>
</head>
<body>
  <main class="panel">
