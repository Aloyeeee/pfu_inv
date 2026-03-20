<?php
// api/refills.php

// Очікуємо, що $pdo, $action, $data визначені в головному api.php

switch ($action) {
    // ---------- ОТРИМАННЯ ЛОКАЦІЙ ----------
    case 'get_locations':
        try {
            $stmt = $pdo->query("SELECT id, name FROM locations ORDER BY name");
            $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($locations, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ОТРИМАННЯ МОДЕЛЕЙ КАРТРИДЖІВ ----------
    case 'get_cartridge_models':
        try {
            $stmt = $pdo->query("
                SELECT id, name, color, yield, notes,
                       (SELECT COUNT(*) FROM cartridges WHERE cartridge_model_id = cm.id) as total_cartridges
                FROM cartridge_models cm
                ORDER BY name
                LIMIT 200
            ");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;

    // ---------- ДОДАВАННЯ МОДЕЛІ КАРТРИДЖА ----------
    case 'add_cartridge_model':
        try {
            $pdo->beginTransaction();
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `cartridge_models` (
                    `id` int(11) NOT NULL AUTO_INCREMENT,
                    `name` varchar(255) NOT NULL,
                    `color` varchar(50) DEFAULT NULL,
                    `yield` int(11) DEFAULT NULL,
                    `notes` text DEFAULT NULL,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `name` (`name`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            $stmt = $pdo->prepare("INSERT INTO cartridge_models (name) VALUES (?)");
            $stmt->execute([$data['name']]);
            $id = $pdo->lastInsertId();
            $pdo->commit();
            echo json_encode(["success" => true, "id" => $id]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ОТРИМАННЯ КАРТРИДЖІВ (З ФІЛЬТРАМИ) ----------
    case 'get_cartridges':
        try {
            $sql = "
                SELECT 
                    c.id,
                    c.barcode,
                    c.serial_number,
                    c.status,
                    c.is_defective,
                    c.defect_reason,
                    c.refill_count,
                    c.notes,
                    COALESCE(cm.id, 0) as model_id,
                    COALESCE(cm.name, 'Невідома модель') as model_name,
                    cm.color,
                    cm.yield,
                    p.id as printer_id,
                    p.printer_model,
                    p.room_number,
                    p.ip_address,
                    l.id as location_id,
                    l.name as location_name,
                    c.created_at,
                    c.updated_at
                FROM cartridges c
                LEFT JOIN cartridge_models cm ON c.cartridge_model_id = cm.id
                LEFT JOIN printers p ON c.printer_id = p.id
                LEFT JOIN locations l ON COALESCE(c.location_id, p.location_id) = l.id
                WHERE 1=1
            ";
            $params = [];

            if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
                $sql .= " AND c.status = ?";
                $params[] = $_GET['status'];
            }
            if (!empty($_GET['model_id']) && $_GET['model_id'] !== 'all') {
                $sql .= " AND c.cartridge_model_id = ?";
                $params[] = $_GET['model_id'];
            }
            if (!empty($_GET['location_id']) && $_GET['location_id'] !== 'all') {
                $sql .= " AND COALESCE(c.location_id, p.location_id) = ?";
                $params[] = $_GET['location_id'];
            }
            if (!empty($_GET['search'])) {
                $search = '%' . $_GET['search'] . '%';
                $sql .= " AND (c.barcode LIKE ? OR c.serial_number LIKE ? OR cm.name LIKE ?)";
                $params[] = $search;
                $params[] = $search;
                $params[] = $search;
            }

            $sql .= " ORDER BY c.updated_at DESC LIMIT 200";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ОТРИМАННЯ КАРТРИДЖА ЗА ID (ДЛЯ РЕДАГУВАННЯ) ----------
    case 'get_cartridge':
        try {
            $stmt = $pdo->prepare("
                SELECT c.*, cm.name as model_name, cm.id as model_id
                FROM cartridges c
                LEFT JOIN cartridge_models cm ON c.cartridge_model_id = cm.id
                WHERE c.id = ?
            ");
            $stmt->execute([$_GET['id']]);
            $cartridge = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($cartridge) {
                echo json_encode(["success" => true, "cartridge" => $cartridge]);
            } else {
                echo json_encode(["success" => false, "error" => "Картридж не знайдено"]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ДОДАВАННЯ КАРТРИДЖА ----------
    case 'add_cartridge':
        try {
            $pdo->beginTransaction();
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `cartridges` (
                    `id` int(11) NOT NULL AUTO_INCREMENT,
                    `cartridge_model_id` int(11) NOT NULL,
                    `printer_id` int(11) DEFAULT NULL,
                    `barcode` varchar(100) DEFAULT NULL,
                    `serial_number` varchar(100) DEFAULT NULL,
                    `status` enum('in_use','in_stock','for_refill','refilling','broken','write_off') NOT NULL DEFAULT 'in_stock',
                    `location_id` int(11) DEFAULT NULL,
                    `room_number` varchar(20) DEFAULT NULL,
                    `purchase_date` date DEFAULT NULL,
                    `first_use_date` date DEFAULT NULL,
                    `refill_count` int(11) NOT NULL DEFAULT 0,
                    `is_defective` tinyint(1) NOT NULL DEFAULT 0,
                    `defect_reason` text DEFAULT NULL,
                    `notes` text DEFAULT NULL,
                    `created_at` datetime NOT NULL DEFAULT current_timestamp(),
                    `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `barcode` (`barcode`),
                    KEY `cartridge_model_id` (`cartridge_model_id`),
                    KEY `printer_id` (`printer_id`),
                    KEY `location_id` (`location_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $stmt = $pdo->prepare("
                INSERT INTO cartridges 
                (cartridge_model_id, barcode, serial_number, status, location_id, notes, purchase_date, is_defective)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            ");
            $stmt->execute([
                $data['model_id'],
                $data['barcode'] ?? null,
                $data['serial_number'] ?? null,
                $data['status'] ?? 'in_stock',
                $data['location_id'] ?? null,
                $data['notes'] ?? null,
                $data['purchase_date'] ?? null
            ]);
            $cartridge_id = $pdo->lastInsertId();
            $pdo->commit();
            echo json_encode(["success" => true, "id" => $cartridge_id]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- РЕДАГУВАННЯ КАРТРИДЖА ----------
    case 'edit_cartridge':
        try {
            $stmt = $pdo->prepare("
                UPDATE cartridges 
                SET cartridge_model_id = ?, barcode = ?, serial_number = ?, status = ?, location_id = ?, purchase_date = ?, notes = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $data['model_id'],
                $data['barcode'] ?? null,
                $data['serial_number'] ?? null,
                $data['status'] ?? 'in_stock',
                $data['location_id'] ?? null,
                $data['purchase_date'] ?? null,
                $data['notes'] ?? null,
                $data['id']
            ]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ІСТОРІЯ РУХІВ КАРТРИДЖА ----------
    case 'get_cartridge_history':
        try {
            $stmt = $pdo->prepare("
                SELECT 
                    cm.*, 
                    DATE_FORMAT(cm.created_at, '%d.%m.%Y %H:%i') as date,
                    CONCAT(
                        IF(cm.movement_type = 'Видача в кабінет', 'Видано',
                           IF(cm.movement_type = 'Відправка на заправку', 'Відправлено на заправку',
                              IF(cm.movement_type = 'Повернення на склад', 'Повернено', cm.movement_type)))
                    ) as action,
                    cm.notes
                FROM cartridge_movements cm
                WHERE cm.cartridge_id = ?
                ORDER BY cm.created_at DESC
            ");
            $stmt->execute([$_GET['id']]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "history" => $history]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ЗМІНА СТАТУСУ КАРТРИДЖА (ВИДАЧА, ЗАПРАВКА, ПОВЕРНЕННЯ) ----------
    case 'change_cartridge_status':
        $pdo->beginTransaction();
        try {
            $cart_id = $data['id'];
            $new_status = $data['status'];
            $notes = $data['notes'] ?? '';
            $from_refill = !empty($data['from_refill']); // ознака повернення з заправки

            // Отримати поточний статус (для визначення типу руху)
            $stmt = $pdo->prepare("SELECT status, refill_count FROM cartridges WHERE id = ?");
            $stmt->execute([$cart_id]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$current) throw new Exception("Картридж не знайдено");

            // Оновити статус
            $stmt = $pdo->prepare("UPDATE cartridges SET status = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$new_status, $cart_id]);

            // Якщо повернення з заправки (from_refill = true) – збільшити лічильник
            if ($from_refill && $new_status === 'in_stock') {
                $pdo->prepare("UPDATE cartridges SET refill_count = refill_count + 1 WHERE id = ?")->execute([$cart_id]);
            }

            // Визначити тип руху
            $movement_type = '';
            if ($new_status === 'in_use') $movement_type = 'Видача в кабінет';
            else if ($new_status === 'refilling') $movement_type = 'Відправка на заправку';
            else if ($new_status === 'in_stock' && $current['status'] === 'refilling') $movement_type = 'Повернення на склад';
            else $movement_type = 'Зміна статусу';

            // Записати рух
            $stmt = $pdo->prepare("INSERT INTO cartridge_movements (cartridge_id, movement_type, notes) VALUES (?, ?, ?)");
            $stmt->execute([$cart_id, $movement_type, $notes]);

            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => "Помилка зміни статусу: " . $e->getMessage()]);
        }
        break;

    // ---------- ШВИДКЕ ПЕРЕМІЩЕННЯ КАРТРИДЖА ----------
    case 'quick_move_cartridge':
        try {
            $pdo->beginTransaction();
            // Отримати поточні дані
            $stmt = $pdo->prepare("SELECT location_id, printer_id FROM cartridges WHERE id = ?");
            $stmt->execute([$data['cartridge_id']]);
            $current = $stmt->fetch(PDO::FETCH_ASSOC);

            $stmt = $pdo->prepare("UPDATE cartridges SET location_id = ?, printer_id = ? WHERE id = ?");
            $stmt->execute([
                $data['to_location_id'] ?? null,
                $data['to_printer_id'] ?? null,
                $data['cartridge_id']
            ]);

            // Логування
            $stmt = $pdo->prepare("
                INSERT INTO cartridge_movements 
                (cartridge_id, from_location_id, to_location_id, from_printer_id, to_printer_id, movement_type, notes)
                VALUES (?, ?, ?, ?, ?, 'Переміщення', ?)
            ");
            $stmt->execute([
                $data['cartridge_id'],
                $current['location_id'],
                $data['to_location_id'] ?? null,
                $current['printer_id'],
                $data['to_printer_id'] ?? null,
                $data['notes'] ?? null
            ]);

            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ПОЗНАЧИТИ КАРТРИДЖ ДЕФЕКТНИМ ----------
    case 'mark_defective':
        try {
            $stmt = $pdo->prepare("
                UPDATE cartridges 
                SET is_defective = 1,
                    status = 'broken',
                    defect_reason = ?,
                    printer_id = NULL
                WHERE id = ?
            ");
            $stmt->execute([$data['reason'] ?? 'Не вказано', $data['id']]);

            // Лог
            $stmt = $pdo->prepare("INSERT INTO cartridge_movements (cartridge_id, movement_type, notes) VALUES (?, 'Позначено дефектним', ?)");
            $stmt->execute([$data['id'], $data['reason'] ?? '']);

            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ОТРИМАННЯ ПРИНТЕРІВ ----------
    case 'get_printers':
        try {
            $stmt = $pdo->query("
                SELECT 
                    p.*,
                    l.name as location_name,
                    c.id as current_cartridge_id,
                    cm.name as current_cartridge_model,
                    c.barcode as current_cartridge_barcode
                FROM printers p
                LEFT JOIN locations l ON p.location_id = l.id
                LEFT JOIN cartridges c ON p.id = c.printer_id AND c.status = 'in_use'
                LEFT JOIN cartridge_models cm ON c.cartridge_model_id = cm.id
                ORDER BY l.name, p.room_number
                LIMIT 200
            ");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ІСТОРІЯ ПРИНТЕРА ----------
    case 'get_printer_history':
        try {
            $stmt = $pdo->prepare("
                SELECT 
                    cm.*, 
                    DATE_FORMAT(cm.created_at, '%d.%m.%Y %H:%i') as date,
                    CONCAT('Встановлено картридж ', 
                           (SELECT name FROM cartridge_models WHERE id = c.cartridge_model_id),
                           ' (', c.barcode, ')') as action
                FROM cartridge_movements cm
                JOIN cartridges c ON cm.cartridge_id = c.id
                WHERE cm.to_printer_id = ? OR cm.from_printer_id = ?
                ORDER BY cm.created_at DESC
            ");
            $stmt->execute([$_GET['id'], $_GET['id']]);
            $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(["success" => true, "history" => $history]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ДОДАВАННЯ ПРИНТЕРА ----------
    case 'add_printer':
        try {
            $pdo->beginTransaction();
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `printers` (
                    `id` int(11) NOT NULL AUTO_INCREMENT,
                    `location_id` int(11) DEFAULT NULL,
                    `room_number` varchar(20) DEFAULT NULL,
                    `inventory_id` int(11) DEFAULT NULL,
                    `printer_model` varchar(255) NOT NULL,
                    `printer_name` varchar(255) DEFAULT NULL,
                    `ip_address` varchar(45) DEFAULT NULL,
                    `serial_number` varchar(100) DEFAULT NULL,
                    `inv_number` varchar(50) DEFAULT NULL,
                    `status` enum('working','repair','write-off') DEFAULT 'working',
                    `notes` text DEFAULT NULL,
                    `created_at` datetime NOT NULL DEFAULT current_timestamp(),
                    `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
                    PRIMARY KEY (`id`),
                    KEY `location_id` (`location_id`),
                    KEY `inventory_id` (`inventory_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $stmt = $pdo->prepare("
            INSERT INTO printers 
            (location_id, room_number, printer_model, printer_name, ip_address, serial_number, inv_number, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['location_id'] ?? null,  // <-- ВАЖЛИВО: використовуємо location_id
            $data['room_number'] ?? null,
            $data['model'] ?? null,
            $data['printer_name'] ?? null,
            $data['ip_address'] ?? null,
            $data['serial_number'] ?? null,
            $data['inv_number'] ?? null,
            $data['notes'] ?? null
        ]);
        
        $pdo->commit();
        echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["error" => $e->getMessage()]);
    }
    break;

    // ---------- ВСТАНОВЛЕННЯ КАРТРИДЖА В ПРИНТЕР (ЗА ШТРИХКОДОМ) ----------
    case 'install_cartridge':
        try {
            $pdo->beginTransaction();
            // Знайти картридж за штрихкодом
            $stmt = $pdo->prepare("SELECT id, status, printer_id FROM cartridges WHERE barcode = ?");
            $stmt->execute([$data['barcode']]);
            $cart = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$cart) throw new Exception("Картридж з таким штрихкодом не знайдено");
            if ($cart['printer_id']) throw new Exception("Картридж вже встановлений в інший принтер");

            // Оновити картридж
            $stmt = $pdo->prepare("UPDATE cartridges SET printer_id = ?, status = 'in_use' WHERE id = ?");
            $stmt->execute([$data['printer_id'], $cart['id']]);

            // Записати рух
            $stmt = $pdo->prepare("INSERT INTO cartridge_movements (cartridge_id, to_printer_id, movement_type) VALUES (?, ?, 'Встановлення в принтер')");
            $stmt->execute([$cart['id'], $data['printer_id']]);

            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ЗВЕДЕНІ ЗАПАСИ (INVENTORY SUMMARY) ----------
    case 'get_inventory_summary':
        try {
            $stmt = $pdo->query("
                SELECT 
                    COALESCE(l.id, 0) as location_id,
                    COALESCE(l.name, 'Склад') as location_name,
                    COALESCE(cm.id, 0) as model_id,
                    COALESCE(cm.name, 'Невідома модель') as model_name,
                    COUNT(CASE WHEN c.status = 'in_use' AND COALESCE(c.is_defective, 0) = 0 THEN 1 END) as in_use,
                    COUNT(CASE WHEN c.status = 'in_stock' AND COALESCE(c.is_defective, 0) = 0 THEN 1 END) as in_stock,
                    COUNT(CASE WHEN c.status = 'for_refill' AND COALESCE(c.is_defective, 0) = 0 THEN 1 END) as for_refill,
                    COUNT(CASE WHEN c.status = 'refilling' AND COALESCE(c.is_defective, 0) = 0 THEN 1 END) as refilling,
                    COUNT(CASE WHEN COALESCE(c.is_defective, 0) = 1 THEN 1 END) as defective,
                    COUNT(CASE WHEN c.status = 'write_off' THEN 1 END) as write_off,
                    COUNT(*) as total
                FROM cartridges c
                LEFT JOIN cartridge_models cm ON c.cartridge_model_id = cm.id
                LEFT JOIN locations l ON COALESCE(c.location_id, (SELECT location_id FROM printers WHERE id = c.printer_id)) = l.id
                GROUP BY l.id, cm.id
                ORDER BY location_name, model_name
                LIMIT 500
            ");
            $summary = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Групуємо по локаціях
            $buildings = [];
            foreach ($summary as $item) {
                $locId = $item['location_id'] ?: '0';
                if (!isset($buildings[$locId])) {
                    $buildings[$locId] = [
                        'id' => $locId,
                        'name' => $item['location_name'],
                        'models' => [],
                        'totals' => [
                            'in_use' => 0, 'in_stock' => 0, 'for_refill' => 0,
                            'refilling' => 0, 'defective' => 0, 'write_off' => 0, 'total' => 0
                        ]
                    ];
                }
                $buildings[$locId]['models'][] = $item;
                $buildings[$locId]['totals']['in_use'] += intval($item['in_use']);
                $buildings[$locId]['totals']['in_stock'] += intval($item['in_stock']);
                $buildings[$locId]['totals']['for_refill'] += intval($item['for_refill']);
                $buildings[$locId]['totals']['refilling'] += intval($item['refilling']);
                $buildings[$locId]['totals']['defective'] += intval($item['defective']);
                $buildings[$locId]['totals']['write_off'] += intval($item['write_off']);
                $buildings[$locId]['totals']['total'] += intval($item['total']);
            }
            echo json_encode(array_values($buildings), JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- СТВОРЕННЯ ЗАЯВКИ (НА ЗАПРАВКУ / ПОВЕРНЕННЯ) ----------
    case 'create_refill_request':
        try {
            $pdo->beginTransaction();

            // Визначити person_id (спрощено: зберігаємо ПІБ в нотатках, але краще створити запис в employees)
            $personName = $data['person'] ?? '';
            $personId = null;
            if ($personName) {
                $stmt = $pdo->prepare("INSERT INTO employees (full_name) VALUES (?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)");
                $stmt->execute([$personName]);
                $personId = $pdo->lastInsertId();
            }

            // Зберегти заявку
            $stmt = $pdo->prepare("
                INSERT INTO refill_logs 
                (action_type, items_json, location_id, person_id, notes, status, date)
                VALUES (?, ?, ?, ?, ?, 'new', NOW())
            ");
            $stmt->execute([
                $data['action_type'] ?? 'send',
                json_encode($data['items'], JSON_UNESCAPED_UNICODE),
                $data['location_id'] ?? null,
                $personId,
                $data['notes'] ?? null
            ]);
            $logId = $pdo->lastInsertId();

            $pdo->commit();
            echo json_encode(["success" => true, "id" => $logId]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- ОТРИМАННЯ ЗАЯВОК (ДЛЯ ІСТОРІЇ) ----------
    case 'get_refills':
        try {
            $stmt = $pdo->query("
                SELECT 
                    r.id, 
                    DATE_FORMAT(r.date, '%d.%m.%Y %H:%i') as date,
                    r.action_type as action, 
                    r.batch_number,
                    r.status,
                    r.received_date,
                    r.notes,
                    l.name as location, 
                    e.full_name as person,
                    r.items_json,
                    r.cartridge_ids
                FROM refill_logs r
                LEFT JOIN locations l ON r.location_id = l.id
                LEFT JOIN employees e ON r.person_id = e.id
                ORDER BY r.date DESC
                LIMIT 200
            ");
            $refills = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach($refills as &$r) {
                $r['items'] = $r['items_json'] ? json_decode($r['items_json'], true) : [];
            }
            echo json_encode($refills, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    // ---------- СТАТИСТИКА МОДЕЛІ (ЗАПИТ З JS) ----------
    case 'get_model_stats':
        // Заглушка, можна реалізувати пізніше
        echo json_encode(["success" => true, "details" => ["last_refill" => "Немає даних"]]);
        break;

    // ---------- ЕКСПОРТ КАРТРИДЖІВ (ПРИКЛАД) ----------
    case 'export_cartridges':
        // Тут можна реалізувати генерацію Excel-файлу
        // Поки що просто заглушка
        header('Content-Type: application/json');
        echo json_encode(["message" => "Експорт поки не реалізовано"]);
        break;

    default:
        http_response_code(404);
        echo json_encode(["error" => "Unknown action in refills: $action"]);
        break;
}
?>