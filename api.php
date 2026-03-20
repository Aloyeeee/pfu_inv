<?php
// Збільшуємо ліміт пам'яті для великої бази даних (23 000+ записів)
ini_set('memory_limit', '1024M');
ini_set('max_execution_time', 300);

session_start();

// ВМИКАЄМО ВІДОБРАЖЕННЯ ПОМИЛОК ТІЛЬКИ ДЛЯ НАЛАШТУВАННЯ
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Логування помилок в файл
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

// ВАЖЛИВО: Очищаємо буфер виводу на самому початку
while (ob_get_level()) ob_end_clean();

// Встановлюємо заголовки
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Функція для безпечного виводу JSON
function sendJSON($data, $httpCode = 200) {
    while (ob_get_level()) ob_end_clean();
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Підключаємо базу даних та функції
    require_once 'api/db.php';
    require_once 'api/helpers.php';

    $action = $_GET['action'] ?? '';
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!$action && isset($data['action'])) {
        $action = $data['action'];
    }
    
    // Якщо це POST з файлом (multipart/form-data)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
        $action = $_POST['action'];
    }

    $routes = [
        'auth'      => ['login', 'logout', 'check_session', 'wipe_database'],
        'settings'  => ['get_system_data', 'wipe_database', 'clear_inventory', 'fix_inventory','check_health', 'remove_duplicates', 'recalculate_prices', 'clear_cache', 'export_inventory', 'export_cartridges', 'change_password', 'update_session_timeout', 'get_users_list', 'add_user', 'delete_user', 'import_1c_inventory', 'import_catalog_csv', 'import_aida64_json', 'get_system_logs','get_requisites', 'save_requisites', 'get_active_sessions', 'kill_other_sessions','get_dictionaries', 'save_dictionary_item', 'delete_dictionary_item', 'sync_dictionaries','restore_locations_csv'],
        'catalog' => ['get_catalog', 'add_catalog', 'update_catalog', 'delete_catalog', 'import_catalog_csv', 'clean_catalog', 'get_equipment_types', 'get_pc_software', 'get_models_by_type'],
        'inventory' => ['get_inventory', 'add_inventory', 'update_inventory', 'delete_inventory', 'import_inventory_csv', 'remove_duplicates', 'clear_inventory', 'fix_inventory', 'check_inventory_health'],
        'rooms'     => ['get_rooms', 'get_rooms_by_location', 'add_room_item', 'update_room_item', 'delete_room_item', 'batch_update_specs', 'get_room_by_inventory', 'get_locations'],
        'transfers' => ['get_transfers', 'add_transfer'],
        'laptops'   => ['get_laptops', 'add_laptop', 'return_laptop'],
        'audit'     => ['get_audit_logs', 'add_audit_log'],
        'dashboard' => ['get_dashboard_stats', 'get_dashboard_drilldown'],
        'notes'     => ['get_notes', 'add_note', 'delete_note'],
        'employee'  => ['search_employee', 'search_employees_autocomplete', 'get_employee_stats'],
        'refills' => ['get_locations','get_refills','add_refill','get_cartridges','get_cartridge_models','add_cartridge_model','get_cartridge','edit_cartridge','add_cartridge','quick_move_cartridge','mark_defective','get_printers','get_printer_history','add_printer','install_cartridge','get_inventory_summary','create_refill_request','change_cartridge_status','get_cartridge_history','get_model_stats' ]
    ];

    $moduleFound = false;
    
    foreach ($routes as $module => $actions) {
        if (in_array($action, $actions)) {
            $moduleFound = true;
            require_once "api/{$module}.php";
            break;
        }
    }

    if (!$moduleFound) {
        sendJSON(["error" => "Невідома дія API: $action"], 404);
    }
    
} catch (Exception $e) {
    sendJSON([
        "error" => $e->getMessage(),
        "file" => $e->getFile(),
        "line" => $e->getLine()
    ], 500);
}
?>