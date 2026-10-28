<?php
// Carta (data/menu.json, solo lectura) y disponibilidad (data/availability.json, la escribe el panel).
declare(strict_types=1);

if (!defined('PANEL')) {
    http_response_code(403);
    exit;
}

const ID_PATTERN = '/^[a-z0-9-]{1,60}$/';

/**
 * Devuelve los grupos que se muestran en el panel: cada sección de la carta y las carnes.
 * @return array<int, array{title: string, items: array<int, array{id: string, name: string, price: int}>}>
 */
function load_panel_groups(): array
{
    $catalog = read_json(PANEL_CATALOG_FILE);
    if (!$catalog || !is_array($catalog['categories'] ?? null)) {
        throw new RuntimeException('No se puede leer data/menu.json');
    }

    $groups = [];
    foreach ($catalog['categories'] as $category) {
        $items = clean_items($category['items'] ?? []);
        if ($items) {
            $groups[] = ['title' => (string) ($category['name'] ?? ''), 'items' => $items];
        }
    }

    foreach ($catalog['optionGroups'] ?? [] as $key => $group) {
        $items = clean_items($group['choices'] ?? []);
        if ($items) {
            $title = $key === 'meat' ? 'Carnes para las hamburguesas' : (string) ($group['name'] ?? 'Opciones');
            $groups[] = ['title' => $title, 'items' => $items, 'isOption' => true];
        }
    }

    return $groups;
}

function clean_items(mixed $items): array
{
    if (!is_array($items)) {
        return [];
    }
    $clean = [];
    foreach ($items as $item) {
        $id = $item['id'] ?? '';
        if (is_string($id) && preg_match(ID_PATTERN, $id) && is_int($item['price'] ?? null)) {
            $clean[] = ['id' => $id, 'name' => (string) ($item['name'] ?? $id), 'price' => $item['price']];
        }
    }
    return $clean;
}

/** @return string[] todos los ids que se pueden ocultar */
function all_ids(array $groups): array
{
    $ids = [];
    foreach ($groups as $group) {
        foreach ($group['items'] as $item) {
            $ids[] = $item['id'];
        }
    }
    return $ids;
}

function load_availability(): array
{
    $data = read_json(PANEL_AVAILABILITY_FILE) ?? [];
    $unavailable = array_values(array_filter(
        is_array($data['unavailable'] ?? null) ? $data['unavailable'] : [],
        static fn ($id) => is_string($id) && preg_match(ID_PATTERN, $id),
    ));
    return [
        'ordersOpen' => ($data['ordersOpen'] ?? true) !== false,
        'unavailable' => $unavailable,
        'updatedAt' => is_string($data['updatedAt'] ?? null) ? $data['updatedAt'] : null,
    ];
}

/**
 * Guarda la disponibilidad. Solo acepta ids que existan en la carta.
 * @param string[] $availableIds platos marcados como disponibles en el formulario
 */
function save_availability(array $groups, array $availableIds, bool $ordersOpen): array
{
    $known = all_ids($groups);
    $available = array_intersect($known, array_filter($availableIds, 'is_string'));
    $unavailable = array_values(array_diff($known, $available));

    $data = [
        'ordersOpen' => $ordersOpen,
        'unavailable' => $unavailable,
        'updatedAt' => (new DateTimeImmutable('now', new DateTimeZone(PANEL_TIMEZONE)))->format(DATE_ATOM),
    ];
    write_json_atomic(PANEL_AVAILABILITY_FILE, $data);
    return $data;
}
