<?php
error_reporting(E_ERROR | E_PARSE);

if (empty($data)) {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
}

/**
 * Функція для отримання або створення ID типу обладнання з кешуванням
 */
function getOrCreateEquipmentTypeId($pdo, $typeName) {
    if (empty($typeName)) return null;
    
    static $typeCache = [];
    
    if (isset($typeCache[$typeName])) {
        return $typeCache[$typeName];
    }
    
    $stmt = $pdo->prepare("SELECT id FROM equipment_types WHERE name = ?");
    $stmt->execute([$typeName]);
    $typeId = $stmt->fetchColumn();
    
    if (!$typeId) {
        $stmt = $pdo->prepare("INSERT INTO equipment_types (name) VALUES (?)");
        $stmt->execute([$typeName]);
        $typeId = $pdo->lastInsertId();
    }
    
    $typeCache[$typeName] = $typeId;
    return $typeId;
}

switch ($action) {
    case 'get_catalog':
        try {
            $stmt = $pdo->query("SELECT c.id, e.name as type, c.model_name as model FROM catalog c JOIN equipment_types e ON c.type_id = e.id");
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Помилка запиту: " . $e->getMessage()]);
        }
        break;
        
    case 'add_catalog':
    case 'update_catalog':
        try {
            $type = trim($data['type'] ?? '');
            $model = trim($data['model'] ?? '');
            
            // Отримуємо або створюємо тип
            $type_id = getOrCreateEquipmentTypeId($pdo, $type);
            
            // Шукаємо або створюємо модель
            $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
            $stmt->execute([$type_id, $model]);
            $model_id = $stmt->fetchColumn();
            
            if (!$model_id) {
                $stmt = $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)");
                $stmt->execute([$type_id, $model]);
                $model_id = $pdo->lastInsertId();
            }
            
            echo json_encode(["success" => true, "id" => $model_id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'delete_catalog':
        try {
            $stmt = $pdo->prepare("DELETE FROM catalog WHERE id = ?");
            $stmt->execute([$data['id']]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'clean_catalog':
        try {
            $sql = "DELETE FROM catalog WHERE 
                model_name LIKE '%Експлуатується%' OR 
                model_name LIKE '%Списано%' OR
                model_name LIKE '%Безверхий%' OR
                model_name LIKE '%Тюлєнєва%' OR
                model_name LIKE '%Назарова%' OR
                model_name REGEXP '[0-9]{6,}' OR
                LENGTH(model_name) < 3";
                
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $deleted = $stmt->rowCount();
            
            echo json_encode(["success" => true, "deleted" => $deleted]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'get_equipment_types':
        try {
            $stmt = $pdo->query("SELECT id, name FROM equipment_types ORDER BY name");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;

    case 'get_pc_software':
        try {
            $stmt = $pdo->prepare("
                SELECT sc.name, sc.license_type, sc.is_critical, ins.version
                FROM installed_software ins
                JOIN software_catalog sc ON ins.software_id = sc.id
                JOIN room_assignments ra ON ins.inventory_id = ra.inventory_id
                WHERE ra.id = ?
                ORDER BY sc.name
            ");
            $stmt->execute([$_GET['id']]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;
// api/catalog.php
error_reporting(E_ERROR | E_PARSE);

if (empty($data)) {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
}

/**
 * Функція для отримання або створення ID типу обладнання з кешуванням
 */
function getOrCreateEquipmentTypeId($pdo, $typeName) {
    if (empty($typeName)) return null;
    
    static $typeCache = [];
    
    if (isset($typeCache[$typeName])) {
        return $typeCache[$typeName];
    }
    
    $stmt = $pdo->prepare("SELECT id FROM equipment_types WHERE name = ?");
    $stmt->execute([$typeName]);
    $typeId = $stmt->fetchColumn();
    
    if (!$typeId) {
        $stmt = $pdo->prepare("INSERT INTO equipment_types (name) VALUES (?)");
        $stmt->execute([$typeName]);
        $typeId = $pdo->lastInsertId();
    }
    
    $typeCache[$typeName] = $typeId;
    return $typeId;
}

switch ($action) {
    case 'get_catalog':
        try {
            $stmt = $pdo->query("SELECT c.id, e.name as type, c.model_name as model FROM catalog c JOIN equipment_types e ON c.type_id = e.id");
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Помилка запиту: " . $e->getMessage()]);
        }
        break;
    
    // ==========================================
    // НОВИЙ ЕНДПОІНТ: ОТРИМАННЯ МОДЕЛЕЙ ЗА ТИПОМ
    // ==========================================
    case 'get_models_by_type':
        try {
            $type = $_GET['type'] ?? '';
            if (empty($type)) {
                echo json_encode([]);
                break;
            }
            
            $stmt = $pdo->prepare("
                SELECT c.id, c.model_name 
                FROM catalog c
                JOIN equipment_types e ON c.type_id = e.id
                WHERE e.name = ?
                ORDER BY c.model_name
            ");
            $stmt->execute([$type]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'add_catalog':
    case 'update_catalog':
        try {
            $type = trim($data['type'] ?? '');
            $model = trim($data['model'] ?? '');
            
            $type_id = getOrCreateEquipmentTypeId($pdo, $type);
            
            $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
            $stmt->execute([$type_id, $model]);
            $model_id = $stmt->fetchColumn();
            
            if (!$model_id) {
                $stmt = $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)");
                $stmt->execute([$type_id, $model]);
                $model_id = $pdo->lastInsertId();
            }
            
            echo json_encode(["success" => true, "id" => $model_id]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'delete_catalog':
        try {
            $stmt = $pdo->prepare("DELETE FROM catalog WHERE id = ?");
            $stmt->execute([$data['id']]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'clean_catalog':
        try {
            $sql = "DELETE FROM catalog WHERE 
                model_name LIKE '%Експлуатується%' OR 
                model_name LIKE '%Списано%' OR
                model_name LIKE '%Безверхий%' OR
                model_name LIKE '%Тюлєнєва%' OR
                model_name LIKE '%Назарова%' OR
                model_name REGEXP '[0-9]{6,}' OR
                LENGTH(model_name) < 3";
                
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            $deleted = $stmt->rowCount();
            
            echo json_encode(["success" => true, "deleted" => $deleted]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'get_equipment_types':
        try {
            $stmt = $pdo->query("SELECT id, name FROM equipment_types ORDER BY name");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;

    case 'get_pc_software':
        try {
            $stmt = $pdo->prepare("
                SELECT sc.name, sc.license_type, sc.is_critical, ins.version
                FROM installed_software ins
                JOIN software_catalog sc ON ins.software_id = sc.id
                JOIN room_assignments ra ON ins.inventory_id = ra.inventory_id
                WHERE ra.id = ?
                ORDER BY sc.name
            ");
            $stmt->execute([$_GET['id']]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;
}
}
