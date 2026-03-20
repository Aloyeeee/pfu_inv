<?php
switch ($action) {
    case 'search_employee':
        $search = $data['name'] ?? '';
        if (empty($search)) {
            echo json_encode(['error' => 'Порожній запит']);
            break;
        }
        
        $results = [];
        $searchParam = '%' . $search . '%';
        $searchParamLower = '%' . mb_strtolower($search) . '%';
        
        // 1. Пошук в кабінетах (за ПІБ користувача або МВО)
        $stmt = $pdo->prepare("
            SELECT 
                ra.id,
                'Кабінет' as source,
                loc.name as loc,
                ra.room_number as room,
                i.inv_number as inv,
                i.serial_number as sn,
                e.name as type,
                c.model_name as model,
                i.price,
                i.status,
                emp_mvo.full_name as mvo,
                emp_user.full_name as person,
                ra.hostname,
                ra.ip_address,
                i.purchase_date as startDate
            FROM room_assignments ra
            JOIN inventory i ON ra.inventory_id = i.id
            JOIN catalog c ON i.model_id = c.id
            JOIN equipment_types e ON c.type_id = e.id
            LEFT JOIN locations loc ON ra.location_id = loc.id
            LEFT JOIN employees emp_mvo ON i.mvo_id = emp_mvo.id
            LEFT JOIN employees emp_user ON ra.user_id = emp_user.id
            WHERE (LOWER(emp_user.full_name) LIKE LOWER(?) OR LOWER(emp_mvo.full_name) LIKE LOWER(?))
              AND i.deleted = 0
        ");
        $stmt->execute([$searchParam, $searchParam]);
        $results = array_merge($results, $stmt->fetchAll(PDO::FETCH_ASSOC));

        // 2. Пошук на складі (за МВО)
        $stmt = $pdo->prepare("
            SELECT 
                i.id,
                'Склад' as source,
                loc.name as loc,
                '' as room,
                i.inv_number as inv,
                i.serial_number as sn,
                e.name as type,
                c.model_name as model,
                i.price,
                i.status,
                emp_mvo.full_name as mvo,
                '' as person,
                '' as hostname,
                '' as ip_address,
                i.purchase_date as startDate
            FROM inventory i
            JOIN catalog c ON i.model_id = c.id
            JOIN equipment_types e ON c.type_id = e.id
            LEFT JOIN employees emp_mvo ON i.mvo_id = emp_mvo.id
            LEFT JOIN locations loc ON i.location_id = loc.id
            WHERE LOWER(emp_mvo.full_name) LIKE LOWER(?)
              AND i.deleted = 0
              AND i.id NOT IN (SELECT inventory_id FROM room_assignments)
        ");
        $stmt->execute([$searchParam]);
        $results = array_merge($results, $stmt->fetchAll(PDO::FETCH_ASSOC));
        
        // 3. Пошук в виданих ноутбуках (laptop_loans)
        $stmt = $pdo->prepare("
            SELECT 
                ll.id,
                'Акт (Видано)' as source,
                NULL as loc,
                NULL as room,
                JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.inv')) as inv,
                JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.sn')) as sn,
                'Ноутбук' as type,
                JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.model')) as model,
                0 as price,
                ll.status,
                JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.encryptedFor')) as mvo,
                NULL as person,
                NULL as hostname,
                NULL as ip_address,
                ll.issue_date as startDate,
                details_json
            FROM laptop_loans ll
            WHERE 
                LOWER(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.encryptedFor'))) LIKE LOWER(?)
                AND ll.status = 'issued'
        ");
        $stmt->execute([$searchParam]);
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $results[] = $row;
            
            // Додаємо токен як окремий запис, якщо він є
            $details = json_decode($row['details_json'] ?? '{}', true);
            if (!empty($details['tokenSn']) && $details['tokenSn'] !== 'Б/Н') {
                $results[] = [
                    'id' => $row['id'] . '_token',
                    'source' => 'Акт (Видано)',
                    'loc' => null,
                    'room' => null,
                    'inv' => $details['tokenInv'] ?? 'Б/Н',
                    'sn' => $details['tokenSn'] ?? '',
                    'type' => 'Захищений носій',
                    'model' => $details['tokenModel'] ?? 'Токен',
                    'price' => 0,
                    'status' => $row['status'],
                    'mvo' => $row['mvo'],
                    'person' => null,
                    'hostname' => null,
                    'ip_address' => null,
                    'startDate' => $row['startDate']
                ];
            }
        }
        
        // Обчислюємо загальну вартість
        $totalPrice = 0;
        foreach ($results as $item) {
            $totalPrice += floatval($item['price'] ?? 0);
        }
        
        echo json_encode([
            'success' => true,
            'data' => $results,
            'total' => count($results),
            'totalPrice' => $totalPrice,
            'searchName' => $search
        ], JSON_UNESCAPED_UNICODE);
        break;
        
    case 'search_employees_autocomplete':
        $term = $_GET['term'] ?? '';
        if (strlen($term) < 2) {
            echo json_encode([]);
            break;
        }
        
        $searchParam = '%' . $term . '%';
        
        // Отримуємо унікальні імена з employees
        $stmt = $pdo->prepare("
            SELECT DISTINCT full_name 
            FROM employees 
            WHERE full_name LIKE ? 
            ORDER BY full_name 
            LIMIT 20
        ");
        $stmt->execute([$searchParam]);
        $employees = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Також додаємо імена з laptop_loans
        $stmt = $pdo->prepare("
            SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.encryptedFor')) as name
            FROM laptop_loans 
            WHERE JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.encryptedFor')) LIKE ?
            LIMIT 10
        ");
        $stmt->execute([$searchParam]);
        $laptopNames = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Об'єднуємо та унікалізуємо
        $allNames = array_unique(array_merge($employees, $laptopNames));
        sort($allNames);
        
        echo json_encode(array_slice($allNames, 0, 20));
        break;
        
    case 'get_employee_stats':
        $search = $_GET['name'] ?? '';
        if (empty($search)) {
            echo json_encode(['error' => 'Порожній запит']);
            break;
        }
        
        $searchParam = '%' . $search . '%';
        
        // Отримуємо статистику по працівнику
        $stmt = $pdo->prepare("
            SELECT 
                COUNT(DISTINCT i.id) as total_items,
                COALESCE(SUM(i.price), 0) as total_price
            FROM (
                SELECT i.id, i.price 
                FROM inventory i
                LEFT JOIN employees e ON i.mvo_id = e.id
                WHERE e.full_name LIKE ?
                UNION
                SELECT i.id, i.price 
                FROM room_assignments ra
                JOIN inventory i ON ra.inventory_id = i.id
                LEFT JOIN employees e ON ra.user_id = e.id
                WHERE e.full_name LIKE ?
            ) as i
        ");
        
        $stmt->execute([$searchParam, $searchParam]);
        $stats = $stmt->fetch();
        
        echo json_encode([
            'success' => true,
            'totalItems' => intval($stats['total_items'] ?? 0),
            'totalPrice' => floatval($stats['total_price'] ?? 0)
        ]);
        break;
}
?>