<?php
require_once 'api/db.php';
require_once 'api/helpers.php';

header('Content-Type: application/json');

try {
    // Отримуємо всі записи з inventory
    $stmt = $pdo->query("SELECT i.id, i.model_id, c.model_name, c.type_id, e.name as type_name 
                         FROM inventory i 
                         LEFT JOIN catalog c ON i.model_id = c.id 
                         LEFT JOIN equipment_types e ON c.type_id = e.id");
    $items = $stmt->fetchAll();
    
    $fixed = 0;
    $errors = [];
    
    foreach ($items as $item) {
        if (empty($item['model_name']) || empty($item['type_name'])) {
            // Якщо немає моделі або типу, спробуємо відновити
            // Для простоти встановлюємо тип "Обладнання" і модель "Невідомо"
            $type = 'Обладнання';
            $model = 'Невідомо';
            
            // Отримуємо новий model_id
            $model_id = getModelId($pdo, $type, $model);
            
            // Оновлюємо запис
            $update = $pdo->prepare("UPDATE inventory SET model_id = ? WHERE id = ?");
            $update->execute([$model_id, $item['id']]);
            $fixed++;
        }
    }
    
    echo json_encode([
        'success' => true,
        'fixed' => $fixed,
        'message' => "Виправлено $fixed записів"
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}