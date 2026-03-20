<?php
require_once 'api/db.php';
require_once 'api/helpers.php';

header('Content-Type: application/json');

try {
    // Тимчасово вимикаємо перевірку ключів
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    
    // Очищаємо всі таблиці
    $tables = [
        'room_assignments',
        'transfer_items',
        'transfer_history',
        'refill_logs',
        'laptop_loans',
        'inventory',
        'catalog',
        'equipment_types'
    ];
    
    foreach ($tables as $table) {
        $pdo->exec("TRUNCATE TABLE $table");
    }
    
    // Вмикаємо перевірку ключів
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
    
    echo json_encode([
        "success" => true,
        "message" => "Всі таблиці успішно очищено"
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>