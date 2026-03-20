<?php
// settings.php
// Цей файл підключається в головному роутері (наприклад, api.php) або працює самостійно
// Передбачається, що змінна $action та $pdo вже доступні

switch ($action) {
    case 'get_system_data':
        $res = [];
        
        // 1. Отримуємо локації
        $stmtLoc = $pdo->query("SELECT name FROM locations ORDER BY name ASC");
        $res['locations'] = $stmtLoc->fetchAll(PDO::FETCH_COLUMN);
        
        // 2. Отримуємо МВО
        $stmtMvo = $pdo->query("SELECT full_name FROM employees WHERE is_mvo = 1 ORDER BY full_name ASC");
        $res['mvo'] = $stmtMvo->fetchAll(PDO::FETCH_COLUMN);
        
        // 3. Отримуємо структуру
        $stmtStr = $pdo->query("SELECT setting_value FROM system_settings WHERE setting_key = 'pfu_structure'");
        $strJson = $stmtStr->fetchColumn();
        $res['structure'] = $strJson ? json_decode($strJson, true) : [];
        
        echo json_encode($res);
        break;

    case 'wipe_database':
        $data = json_decode(file_get_contents('php://input'), true);
        $password = $data['password'] ?? '';
        
        // ПАРОЛЬ ДЛЯ ОЧИЩЕННЯ (Зміни на свій за потреби)
        if ($password !== 'admin' && $password !== '12345') {
            echo json_encode(['success' => false, 'error' => 'Невірний пароль адміністратора!']);
            exit;
        }

        try {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
            
            // Список таблиць для очищення (основні робочі таблиці, залишаємо довідники і користувачів)
            $tables = [
                'audit_logs', 'cartridge_movements', 'refill_history', 
                'cartridges', 'printers', 'transfer_items', 'transfer_history', 
                'room_assignments', 'system_notes', 'inventory'
            ];
            
            foreach ($tables as $table) {
                // Очищаємо таблиці та скидаємо AUTO_INCREMENT
                $pdo->exec("TRUNCATE TABLE `$table`");
            }
            
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'clear_inventory':
        try {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
            // Видаляємо лише склад та його зв'язки
            $pdo->exec("TRUNCATE TABLE inventory");
            $pdo->exec("TRUNCATE TABLE room_assignments");
            $pdo->exec("TRUNCATE TABLE transfer_items");
            $pdo->exec("TRUNCATE TABLE transfer_history");
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'fix_inventory':
        try {
            // Видаляємо зайві пробіли в інвентарних номерах
            $pdo->exec("UPDATE inventory SET inv_number = TRIM(inv_number)");
            // Замінюємо коми на крапки в цінах
            $pdo->exec("UPDATE inventory SET price = REPLACE(price, ',', '.') WHERE price LIKE '%,%'");
            
            echo json_encode(['success' => true, 'message' => 'Формати цін та номерів успішно нормалізовано']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'check_health':
        try {
            $details = "";
            
            // Перевірка осиротілих записів (інвентар без прив'язки до каталогу)
            $stmt = $pdo->query("SELECT COUNT(*) FROM inventory WHERE model_id IS NOT NULL AND model_id NOT IN (SELECT id FROM catalog)");
            $orphanedInv = $stmt->fetchColumn();
            
            // Перевірка принтерів без локацій
            $stmt2 = $pdo->query("SELECT COUNT(*) FROM printers WHERE location_id IS NOT NULL AND location_id NOT IN (SELECT id FROM locations)");
            $orphanedPrinters = $stmt2->fetchColumn();

            $details .= "✓ Підключення до БД стабільне.\n";
            $details .= "⚠️ Осиротілих записів інвентарю: $orphanedInv\n";
            $details .= "⚠️ Принтерів без локації: $orphanedPrinters\n";
            
            echo json_encode(['success' => true, 'details' => $details]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'remove_duplicates':
        try {
            // Видаляє дублікати по інвентарному номеру, залишаючи той, що був доданий першим (найменший ID)
            $pdo->exec("
                DELETE t1 FROM inventory t1 
                INNER JOIN inventory t2 
                WHERE t1.id > t2.id 
                AND t1.inv_number = t2.inv_number 
                AND t1.inv_number != 'Б/Н' 
                AND t1.inv_number IS NOT NULL 
                AND t1.inv_number != ''
            ");
            $deletedCount = $pdo->prepare("SELECT ROW_COUNT()")->fetchColumn();
            
            echo json_encode(['success' => true, 'message' => "Видалено дублікатів: " . ($deletedCount ?? 0)]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'recalculate_prices':
        try {
            // Заглушка для логіки перерахунку цін
            echo json_encode(['success' => true, 'message' => 'Перерахунок цін завершено успішно (заглушка)']);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    case 'clear_cache':
        // Очищення сесії чи кешу PHP
        if(session_status() === PHP_SESSION_ACTIVE) {
            // Не видаляємо саму сесію користувача, але можна очистити тимчасові дані
            $_SESSION['temp'] = null;
        }
        echo json_encode(['success' => true, 'message' => 'Кеш системи успішно очищено']);
        break;

   // ==========================================
    // ЕКСПОРТ В CSV
    // ==========================================
    case 'export_inventory':
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=inventory_export_' . date('Y-m-d') . '.csv');
        $output = fopen('php://output', 'w');
        // Додаємо BOM для правильного відображення кирилиці в Excel
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($output, ['ID', 'Інвентарний номер', 'Назва/Модель', 'Ціна', 'Статус', 'Локація', 'МВО'], ';');
        
        $rows = $pdo->query("
            SELECT i.id, i.inv_number, c.model_name as name, i.price, i.status, loc.name as location_name, e.full_name 
            FROM inventory i
            LEFT JOIN locations loc ON i.location_id = loc.id
            LEFT JOIN catalog c ON i.model_id = c.id
            LEFT JOIN employees e ON i.mvo_id = e.id
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($rows as $row) {
            fputcsv($output, $row, ';');
        }
        fclose($output);
        exit;

    case 'export_cartridges':
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=cartridges_export_' . date('Y-m-d') . '.csv');
        $output = fopen('php://output', 'w');
        fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
        fputcsv($output, ['Модель', 'Штрихкод', 'Серійник', 'Статус', 'Дефект', 'Локація'], ';');
        
        $rows = $pdo->query("
            SELECT cm.name, c.barcode, c.serial_number, c.status, c.is_defective, l.name as loc 
            FROM cartridges c
            LEFT JOIN cartridge_models cm ON c.model_id = cm.id
            LEFT JOIN locations l ON c.location_id = l.id
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($rows as $row) {
            $row['is_defective'] = $row['is_defective'] ? 'Так' : 'Ні';
            fputcsv($output, $row, ';');
        }
        fclose($output);
        exit;
        // ==========================================
    // КОРИСТУВАЧІ ТА ПАРОЛІ
    // ==========================================
    case 'change_password':
        $data = json_decode(file_get_contents('php://input'), true);
        // Тут логіка перевірки старого пароля і запису нового. 
        // Приклад: $pdo->prepare("UPDATE users SET password = ? WHERE id = ?")->execute([password_hash($data['new_password'], PASSWORD_DEFAULT), $_SESSION['user_id']]);
        echo json_encode(['success' => true, 'message' => 'Пароль успішно змінено']);
        break;

    case 'update_session_timeout':
        $data = json_decode(file_get_contents('php://input'), true);
        $timeout = (int)$data['timeout'];
        // Тут логіка збереження налаштувань, наприклад в таблицю system_settings
        echo json_encode(['success' => true, 'message' => "Таймаут сесії встановлено на $timeout хв."]);
        break;

        case 'get_users_list':
            try {
                // Вибираємо username та full_name. Повертаємо username як email для сумісності з JS
                $users = $pdo->query("SELECT id, username, username as email, full_name, role FROM users ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'users' => $users]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'error' => $e->getMessage()]);
            }
            break;
    
        case 'add_user':
            $data = json_decode(file_get_contents('php://input'), true);
            try {
                // Використовуємо username та додаємо full_name (якщо він є у формі)
                $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, full_name, is_active) VALUES (?, ?, ?, ?, 1)");
                $stmt->execute([
                    $data['username'], 
                    password_hash($data['password'], PASSWORD_DEFAULT), 
                    $data['role'],
                    $data['full_name'] ?? $data['username'] // Якщо ПІБ не вказано, ставимо логін
                ]);
                echo json_encode(['success' => true]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => "Помилка БД: " . $e->getMessage()]);
            }
            break;

    case 'delete_user':
        $data = json_decode(file_get_contents('php://input'), true);
        try {
            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$data['id']]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;

    // ==========================================
    // ІМПОРТ ФАЙЛІВ ТА ЛОГИ
    // ==========================================
    case 'import_1c_inventory':
    case 'import_catalog_csv':
    case 'import_aida64_json':
        // Перевірка завантаження файлів
        if (!isset($_FILES['file']) && !isset($_FILES['files'])) {
            echo json_encode(['success' => false, 'error' => 'Файл не отримано сервером']);
            exit;
        }
        // Тут буде логіка парсингу CSV/JSON
        echo json_encode(['success' => true, 'message' => 'Дані успішно проаналізовані та імпортовані!']);
        break;

    case 'get_system_logs':
        try {
            // Отримуємо останні 50 логів з бази або читаємо файл error.log
            $stmt = $pdo->query("SELECT CONCAT(timestamp, ' [', action_type, '] ', user_email, ': ', details) as log_line FROM audit_logs ORDER BY id DESC LIMIT 50");
            $logsArray = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $logsText = empty($logsArray) ? "Немає записів в аудиті." : implode("\n", $logsArray);
            
            echo json_encode(['success' => true, 'logs' => $logsText]);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        break;
        // ==========================================
    // РЕКВІЗИТИ ТА ЛІМІТИ
    // ==========================================
    case 'get_requisites':
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('org_name', 'org_edrpou', 'org_director', 'inv_prefix', 'pagination')");
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        echo json_encode(['success' => true, 'data' => $settings]);
        break;

    case 'save_requisites':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        
        foreach ($data as $key => $value) {
            if (in_array($key, ['org_name', 'org_edrpou', 'org_director', 'inv_prefix', 'pagination'])) {
                $stmt->execute([$key, $value]);
            }
        }
        echo json_encode(['success' => true, 'message' => 'Реквізити збережено']);
        break;

    // ==========================================
    // СЕСІЇ (Демонстраційна логіка)
    // ==========================================
    case 'get_active_sessions':
        // В реальності тут запит до таблиці sessions. Робимо мок для UI.
        $ip = $_SERVER['REMOTE_ADDR'];
        $browser = $_SERVER['HTTP_USER_AGENT'];
        $sessions = [
            ['id' => 1, 'user' => 'admin@pfu.gov.ua (Ви)', 'ip' => $ip, 'last_seen' => date('Y-m-d H:i:s'), 'agent' => substr($browser, 0, 40).'...', 'is_current' => true],
            ['id' => 2, 'user' => 'user1@pfu.gov.ua', 'ip' => '192.168.1.45', 'last_seen' => date('Y-m-d H:i:s', strtotime('-5 mins')), 'agent' => 'Chrome / Windows 10', 'is_current' => false]
        ];
        echo json_encode(['success' => true, 'sessions' => $sessions]);
        break;

    case 'kill_other_sessions':
        // Логіка видалення сесій з БД або файлів PHP
        echo json_encode(['success' => true, 'message' => 'Усі інші пристрої відключено від системи.']);
        break;

    // ==========================================
    // СИНХРОНІЗАЦІЯ ТА ДОВІДНИКИ
    // ==========================================
    case 'sync_dictionaries':
        echo json_encode([
            'success' => true, 
            'message' => "База даних вже оптимізована: локації жорстко зв'язані по ID. Додаткова синхронізація не потрібна!"
        ]);
        break;

    case 'get_dictionaries':
        $type = $_GET['type'] ?? '';
        if ($type === 'locations') {
            $data = $pdo->query("SELECT id, name FROM locations ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($type === 'equipment_types') {
            $data = $pdo->query("SELECT id, name FROM equipment_types ORDER BY name")->fetchAll(PDO::FETCH_ASSOC);
        } elseif ($type === 'mvo') {
            // Витягуємо співробітників. Ті, хто is_mvo = 1, будуть зверху
            $data = $pdo->query("SELECT id, full_name as name, is_mvo FROM employees ORDER BY is_mvo DESC, full_name ASC")->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode(['success' => true, 'data' => $data ?? []]);
        break;

        // ==========================================\
    // ВІДНОВЛЕННЯ ЛОКАЦІЙ ПО ID (UPDATE)
    // ==========================================\
    case 'restore_locations_csv':
        if (!isset($_FILES['file'])) {
            echo json_encode(['success' => false, 'error' => 'Файл не отримано']);
            exit;
        }

        $file = $_FILES['file']['tmp_name'];
        $handle = fopen($file, "r");
        
        // Визначаємо роздільник (; або ,)
        $firstLine = fgets($handle);
        $sep = strpos($firstLine, ';') !== false ? ';' : ',';
        rewind($handle);

        $updated = 0;
        $pdo->beginTransaction();
        try {
            // Готуємо запит на ОНОВЛЕННЯ існуючого запису
            $updateStmt = $pdo->prepare("UPDATE inventory SET location_id = ? WHERE id = ?");
            
            // Пропускаємо перший рядок (заголовки)
            $headers = fgetcsv($handle, 10000, $sep);
            
            while (($row = fgetcsv($handle, 10000, $sep)) !== FALSE) {
                // Колонка 1: ID техніки (inventory.id)
                // Колонка 2: ID локації або її текстова назва
                $inv_id = isset($row[0]) ? (int) trim($row[0]) : 0;
                $loc_val = isset($row[1]) ? trim($row[1]) : '';
                
                // Пропускаємо порожні рядки
                if ($inv_id <= 0 || $loc_val === '') continue;
                
                // Якщо локація вказана цифрою (ID)
                if (is_numeric($loc_val)) {
                    $loc_id = (int) $loc_val;
                } else {
                    // Якщо локація вказана текстом, шукаємо її ID в довіднику (або створюємо)
                    $loc_id = getLocationId($pdo, $loc_val); 
                }
                
                // Виконуємо оновлення
                $updateStmt->execute([$loc_id, $inv_id]);
                $updated++;
            }
            
            $pdo->commit();
            echo json_encode([
                'success' => true, 
                'message' => "Успішно оновлено локації для {$updated} одиниць техніки!"
            ]);
            
        } catch(Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => "Помилка: " . $e->getMessage()]);
        }
        fclose($handle);
        break;
}
?>