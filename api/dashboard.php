<?php
// dashboard.php
error_log("=== dashboard.php викликано з action: $action ===");

switch ($action) {
    case 'get_dashboard_stats':
        try {
            error_log("Початок отримання статистики дашборда");
            
            // Перевіряємо підключення до БД
            if (!$pdo) {
                throw new Exception("Немає підключення до БД");
            }
            
            // Перевіряємо чи існують таблиці
            $tables = [
                'inventory' => 0,
                'room_assignments' => 0,
                'equipment_types' => 0,
                'catalog' => 0,
                'locations' => 0,
                'employees' => 0
            ];
            
            foreach ($tables as $table => &$exists) {
                try {
                    $result = $pdo->query("SHOW TABLES LIKE '$table'");
                    $exists = $result->rowCount() > 0 ? 1 : 0;
                    error_log("Таблиця $table: " . ($exists ? 'існує' : 'не існує'));
                } catch (Exception $e) {
                    error_log("Помилка перевірки таблиці $table: " . $e->getMessage());
                    $exists = 0;
                }
            }
            
            // Статистика з інвентарю
            $stock_price = 0;
            $written_off_price = 0;
            if ($tables['inventory']) {
                try {
                    $stmt = $pdo->query("
                        SELECT 
                            COALESCE(SUM(CASE WHEN status IN ('На складі', 'В роботі') AND (deleted = 0 OR deleted IS NULL) THEN price ELSE 0 END), 0) as stock_price,
                            COALESCE(SUM(CASE WHEN status IN ('В ремонті', 'Для списання') AND (deleted = 0 OR deleted IS NULL) THEN price ELSE 0 END), 0) as written_off_price
                        FROM inventory
                    ");
                    $inventoryStats = $stmt->fetch();
                    $stock_price = floatval($inventoryStats['stock_price'] ?? 0);
                    $written_off_price = floatval($inventoryStats['written_off_price'] ?? 0);
                    error_log("Інвентар - stock_price: $stock_price, written_off_price: $written_off_price");
                } catch (Exception $e) {
                    error_log("Помилка запиту inventory: " . $e->getMessage());
                }
            }
            
            // Статистика з кабінетів
            $rooms_price = 0;
            if ($tables['room_assignments'] && $tables['inventory']) {
                try {
                    $stmt = $pdo->query("
                        SELECT COALESCE(SUM(i.price), 0) as rooms_price
                        FROM room_assignments ra
                        JOIN inventory i ON ra.inventory_id = i.id
                        WHERE (i.deleted = 0 OR i.deleted IS NULL) AND i.status != 'Для списання'
                    ");
                    $roomsStats = $stmt->fetch();
                    $rooms_price = floatval($roomsStats['rooms_price'] ?? 0);
                    error_log("Кабінети - rooms_price: $rooms_price");
                } catch (Exception $e) {
                    error_log("Помилка запиту room_assignments: " . $e->getMessage());
                }
            }
            
            // Розподіл по типах
            $typeGroups = [];
            if ($tables['inventory'] && $tables['catalog'] && $tables['equipment_types']) {
                try {
                    $stmt = $pdo->query("
                        SELECT e.name as type, COUNT(*) as count
                        FROM inventory i
                        JOIN catalog c ON i.model_id = c.id
                        JOIN equipment_types e ON c.type_id = e.id
                        WHERE (i.deleted = 0 OR i.deleted IS NULL) AND i.status != 'Для списання'
                        GROUP BY e.name
                        ORDER BY count DESC
                        LIMIT 20
                    ");
                    $typeGroups = $stmt->fetchAll();
                    error_log("Знайдено типів: " . count($typeGroups));
                } catch (Exception $e) {
                    error_log("Помилка запиту типів: " . $e->getMessage());
                }
            }
            
            // Розподіл по локаціях
            $locGroups = [];
            if ($tables['inventory'] && $tables['locations']) {
                try {
                    $stmt = $pdo->query("
                        SELECT COALESCE(loc.name, 'Не вказано') as loc, COUNT(i.id) as count
                        FROM inventory i
                        LEFT JOIN locations loc ON i.location_id = loc.id
                        WHERE (i.deleted = 0 OR i.deleted IS NULL) AND i.status != 'Для списання'
                        GROUP BY i.location_id
                        ORDER BY count DESC
                        LIMIT 20
                    ");
                    $locGroups = $stmt->fetchAll();
                    error_log("Знайдено локацій: " . count($locGroups));
                } catch (Exception $e) {
                    error_log("Помилка запиту локацій: " . $e->getMessage());
                }
            }
            
            // ВІК ТЕХНІКИ - ВИПРАВЛЕНО
            $ageGroups = [
                'До 1 року' => 0,
                '1-3 роки' => 0,
                '3-5 років' => 0,
                '5-7 років' => 0,
                'Більше 7 років' => 0
            ];
            
            if ($tables['inventory']) {
                try {
                    // Отримуємо всі дати з інвентарю
                    $stmt = $pdo->query("
                        SELECT purchase_date, COUNT(*) as count
                        FROM inventory
                        WHERE (deleted = 0 OR deleted IS NULL) 
                          AND status != 'Для списання' 
                          AND purchase_date IS NOT NULL
                        GROUP BY purchase_date
                        ORDER BY purchase_date
                    ");
                    
                    $currentDate = time();
                    
                    while ($row = $stmt->fetch()) {
                        $purchaseDate = $row['purchase_date'];
                        $count = intval($row['count']);
                        
                        if ($purchaseDate) {
                            // Конвертуємо дату в timestamp
                            $timestamp = strtotime($purchaseDate);
                            if ($timestamp === false) {
                                error_log("Не вдалося розпарсити дату: $purchaseDate");
                                continue;
                            }
                            
                            // Розраховуємо вік в роках
                            $ageSeconds = $currentDate - $timestamp;
                            $ageYears = $ageSeconds / (365.25 * 24 * 60 * 60);
                            
                            // Визначаємо категорію
                            if ($ageYears < 1) {
                                $ageGroups['До 1 року'] += $count;
                            } elseif ($ageYears < 3) {
                                $ageGroups['1-3 роки'] += $count;
                            } elseif ($ageYears < 5) {
                                $ageGroups['3-5 років'] += $count;
                            } elseif ($ageYears < 7) {
                                $ageGroups['5-7 років'] += $count;
                            } else {
                                $ageGroups['Більше 7 років'] += $count;
                            }
                        }
                    }
                    
                    error_log("Вік техніки: " . json_encode($ageGroups, JSON_UNESCAPED_UNICODE));
                    
                } catch (Exception $e) {
                    error_log("Помилка запиту віку: " . $e->getMessage());
                }
            }
            
            // Дані з JSON (specs) - для характеристик ПК
            $ramGroups = [];
            $osGroups = [];
            $avGroups = [];
            $diskGroups = [];
            $officeGroups = [];
            $warnings = [];
            
            if ($tables['room_assignments'] && $tables['inventory'] && $tables['catalog'] && $tables['equipment_types']) {
                try {
                    $stmt = $pdo->query("
                        SELECT 
                            ra.id,
                            ra.room_number,
                            ra.hostname,
                            i.inv_number,
                            i.price,
                            i.purchase_date,
                            c.model_name as model,
                            e.name as type,
                            ra.tech_specs
                        FROM room_assignments ra
                        JOIN inventory i ON ra.inventory_id = i.id
                        JOIN catalog c ON i.model_id = c.id
                        JOIN equipment_types e ON c.type_id = e.id
                        WHERE ra.tech_specs IS NOT NULL
                        LIMIT 1000
                    ");
                    
                    $rowCount = 0;
                    while ($row = $stmt->fetch()) {
                        $rowCount++;
                        $specs = json_decode($row['tech_specs'], true);
                        if (!$specs) {
                            continue;
                        }
                        
                        // RAM
                        $ramStr = '';
                        if (isset($specs['RAM'])) {
                            $ramStr = is_array($specs['RAM']) ? implode(' ', $specs['RAM']) : (string)$specs['RAM'];
                        }
                        
                        if (preg_match('/(\d+)\s*GB/i', $ramStr, $matches)) {
                            $ramSize = $matches[1] . ' GB';
                            $ramGroups[$ramSize] = ($ramGroups[$ramSize] ?? 0) + 1;
                        } else {
                            $ramGroups['Невідомо'] = ($ramGroups['Невідомо'] ?? 0) + 1;
                        }
                        
                        // OS
                        $osStr = '';
                        if (isset($specs['OS'])) {
                            $osStr = is_array($specs['OS']) ? implode(' ', $specs['OS']) : (string)$specs['OS'];
                        }
                        
                        if (empty($osStr)) $osStr = 'Невідомо';
                        $osStr = preg_replace('/\s*\([^)]*\)/', '', $osStr);
                        $osStr = trim(str_replace('Microsoft', '', $osStr));
                        if (!empty($osStr) && $osStr !== 'Невідомо') {
                            $osGroups[$osStr] = ($osGroups[$osStr] ?? 0) + 1;
                        }
                        
                        // Antivirus
                        $avStr = '';
                        if (isset($specs['Antivirus'])) {
                            $avStr = is_array($specs['Antivirus']) ? implode(' ', $specs['Antivirus']) : (string)$specs['Antivirus'];
                        }
                        if (empty($avStr)) $avStr = 'Не знайдено';
                        
                        if (strpos($avStr, 'ESET') !== false) {
                            $avGroups['ESET'] = ($avGroups['ESET'] ?? 0) + 1;
                        } elseif ($avStr !== 'Не знайдено' && !empty($avStr)) {
                            $avGroups['Інший'] = ($avGroups['Інший'] ?? 0) + 1;
                        } else {
                            $avGroups['Не знайдено'] = ($avGroups['Не знайдено'] ?? 0) + 1;
                        }
                        
                        // Disks
                        $diskStr = '';
                        if (isset($specs['Disks'])) {
                            if (is_array($specs['Disks'])) {
                                $diskStr = implode(' ', $specs['Disks']);
                            } else {
                                $diskStr = (string)$specs['Disks'];
                            }
                        }
                        
                        if (!empty($diskStr)) {
                            if (stripos($diskStr, 'SSD') !== false) {
                                $diskGroups['Є SSD'] = ($diskGroups['Є SSD'] ?? 0) + 1;
                            } elseif (stripos($diskStr, 'HDD') !== false) {
                                $diskGroups['Тільки HDD'] = ($diskGroups['Тільки HDD'] ?? 0) + 1;
                            } else {
                                $diskGroups['Інший тип'] = ($diskGroups['Інший тип'] ?? 0) + 1;
                            }
                        } else {
                            $diskGroups['Невідомо'] = ($diskGroups['Невідомо'] ?? 0) + 1;
                        }
                        
                        // Office
                        $officeStr = '';
                        if (isset($specs['Office'])) {
                            $officeStr = is_array($specs['Office']) ? implode(' ', $specs['Office']) : (string)$specs['Office'];
                        }
                        if (empty($officeStr)) $officeStr = 'Не знайдено';
                        
                        if ($officeStr === 'Не знайдено' || empty($officeStr)) {
                            $officeGroups['Не встановлено'] = ($officeGroups['Не встановлено'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '2010') !== false) {
                            $officeGroups['Office 2010'] = ($officeGroups['Office 2010'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '2013') !== false) {
                            $officeGroups['Office 2013'] = ($officeGroups['Office 2013'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '2016') !== false) {
                            $officeGroups['Office 2016'] = ($officeGroups['Office 2016'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '2019') !== false) {
                            $officeGroups['Office 2019'] = ($officeGroups['Office 2019'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '2021') !== false) {
                            $officeGroups['Office 2021'] = ($officeGroups['Office 2021'] ?? 0) + 1;
                        } elseif (strpos($officeStr, '365') !== false) {
                            $officeGroups['Office 365'] = ($officeGroups['Office 365'] ?? 0) + 1;
                        } elseif (strpos($officeStr, 'LibreOffice') !== false) {
                            $officeGroups['LibreOffice'] = ($officeGroups['LibreOffice'] ?? 0) + 1;
                        } else {
                            $officeGroups['Інше'] = ($officeGroups['Інше'] ?? 0) + 1;
                        }
                    }
                    
                    error_log("Оброблено записів з JSON: $rowCount");
                    
                } catch (Exception $e) {
                    error_log("Помилка запиту JSON даних: " . $e->getMessage());
                }
            }
            
            $result = [
                'success' => true,
                'stats' => [
                    'stock_price' => $stock_price,
                    'rooms_price' => $rooms_price,
                    'written_off_price' => $written_off_price
                ],
                'charts' => [
                    'types' => $typeGroups,
                    'locations' => $locGroups,
                    'age' => $ageGroups,
                    'ram' => $ramGroups,
                    'os' => $osGroups,
                    'av' => $avGroups,
                    'disk' => $diskGroups,
                    'office' => $officeGroups
                ],
                'warnings' => $warnings
            ];
            
            error_log("Успішно сформовано відповідь дашборда");
            
            // Очищаємо буфер перед виведенням JSON
            while (ob_get_level()) ob_end_clean();
            
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
            
        } catch (Exception $e) {
            error_log("КРИТИЧНА ПОМИЛКА в get_dashboard_stats: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            while (ob_get_level()) ob_end_clean();
            
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage(),
                'stats' => [
                    'stock_price' => 0,
                    'rooms_price' => 0,
                    'written_off_price' => 0
                ],
                'charts' => [
                    'types' => [],
                    'locations' => [],
                    'age' => [
                        'До 1 року' => 0,
                        '1-3 роки' => 0,
                        '3-5 років' => 0,
                        '5-7 років' => 0,
                        'Більше 7 років' => 0
                    ],
                    'ram' => [],
                    'os' => [],
                    'av' => [],
                    'disk' => [],
                    'office' => []
                ],
                'warnings' => []
            ], JSON_UNESCAPED_UNICODE);
        }
        break;
        
        case 'get_dashboard_drilldown':
            try {
                $filterType = $_GET['filter_type'] ?? '';
                $filterValue = $_GET['filter_value'] ?? '';
                
                error_log("Drilldown запит: filterType=$filterType, filterValue=$filterValue");
                
                $sql = "";
                $params = [];
                
                // Базова умова: рахуємо техніку, яка не видалена і не списана
                $baseWhere = "WHERE (i.deleted = 0 OR i.deleted IS NULL) AND i.status != 'Для списання'";
                
                switch ($filterType) {
                    case 'Type':
                        $sql = "
                            SELECT 
                                'inventory' as source,
                                loc.name as loc,
                                NULL as room,
                                c.model_name as model,
                                i.inv_number as inv,
                                NULL as hostname,
                                e.name as type,
                                i.price,
                                i.purchase_date,
                                i.status,
                                emp.full_name as person,
                                NULL as tech_specs
                            FROM inventory i
                            LEFT JOIN catalog c ON i.model_id = c.id
                            LEFT JOIN equipment_types e ON c.type_id = e.id
                            LEFT JOIN employees emp ON i.mvo_id = emp.id
                            LEFT JOIN locations loc ON i.location_id = loc.id
                            $baseWhere 
                            AND (e.name = ? OR (? = 'Не вказано' AND e.name IS NULL))
                            
                            UNION ALL
                            
                            SELECT 
                                'room' as source,
                                l.name as loc,
                                ra.room_number as room,
                                c.model_name as model,
                                i.inv_number as inv,
                                ra.hostname,
                                e.name as type,
                                i.price,
                                i.purchase_date,
                                i.status,
                                emp_user.full_name as person,
                                ra.tech_specs
                            FROM room_assignments ra
                            JOIN inventory i ON ra.inventory_id = i.id
                            LEFT JOIN catalog c ON i.model_id = c.id
                            LEFT JOIN equipment_types e ON c.type_id = e.id
                            LEFT JOIN locations l ON ra.location_id = l.id
                            LEFT JOIN employees emp_user ON ra.user_id = emp_user.id
                            $baseWhere 
                            AND (e.name = ? OR (? = 'Не вказано' AND e.name IS NULL))
                            
                            ORDER BY loc, room, model
                        ";
                        $params = [$filterValue, $filterValue, $filterValue, $filterValue];
                        break;
                        
                    case 'Location':
                        $sql = "
                            SELECT 
                                'inventory' as source,
                                COALESCE(loc.name, 'Не вказано') as loc,
                                NULL as room,
                                c.model_name as model,
                                i.inv_number as inv,
                                NULL as hostname,
                                e.name as type,
                                i.price,
                                i.purchase_date,
                                i.status,
                                emp.full_name as person,
                                NULL as tech_specs
                            FROM inventory i
                            LEFT JOIN catalog c ON i.model_id = c.id
                            LEFT JOIN equipment_types e ON c.type_id = e.id
                            LEFT JOIN employees emp ON i.mvo_id = emp.id
                            LEFT JOIN locations loc ON i.location_id = loc.id
                            $baseWhere 
                            AND (loc.name = ? OR (? = 'Не вказано' AND loc.name IS NULL))
                            
                            UNION ALL
                            
                            SELECT 
                                'room' as source,
                                COALESCE(l.name, 'Не вказано') as loc,
                                ra.room_number as room,
                                c.model_name as model,
                                i.inv_number as inv,
                                ra.hostname,
                                e.name as type,
                                i.price,
                                i.purchase_date,
                                i.status,
                                emp_user.full_name as person,
                                ra.tech_specs
                            FROM room_assignments ra
                            JOIN inventory i ON ra.inventory_id = i.id
                            LEFT JOIN catalog c ON i.model_id = c.id
                            LEFT JOIN equipment_types e ON c.type_id = e.id
                            LEFT JOIN locations l ON ra.location_id = l.id
                            LEFT JOIN employees emp_user ON ra.user_id = emp_user.id
                            $baseWhere 
                            AND (l.name = ? OR (? = 'Не вказано' AND l.name IS NULL))
                            
                            ORDER BY source, room, model
                        ";
                        $params = [$filterValue, $filterValue, $filterValue, $filterValue];
                        break;
                        
                    case 'Age':
                        $ageRanges = [
                            'До 1 року' => [0, 1],
                            '1-3 роки' => [1, 3],
                            '3-5 років' => [3, 5],
                            '5-7 років' => [5, 7],
                            'Більше 7 років' => [7, 100]
                        ];
                        
                        if (isset($ageRanges[$filterValue])) {
                            $min = $ageRanges[$filterValue][0];
                            $max = $ageRanges[$filterValue][1];
                            
                            $sql = "
                                SELECT 
                                    'inventory' as source,
                                    loc.name as loc,
                                    NULL as room,
                                    c.model_name as model,
                                    i.inv_number as inv,
                                    NULL as hostname,
                                    e.name as type,
                                    i.price,
                                    i.purchase_date,
                                    i.status,
                                    emp.full_name as person,
                                    NULL as tech_specs,
                                    TIMESTAMPDIFF(YEAR, i.purchase_date, CURDATE()) as age_years
                                FROM inventory i
                                LEFT JOIN catalog c ON i.model_id = c.id
                                LEFT JOIN equipment_types e ON c.type_id = e.id
                                LEFT JOIN employees emp ON i.mvo_id = emp.id
                                LEFT JOIN locations loc ON i.location_id = loc.id
                                $baseWhere 
                                  AND i.purchase_date IS NOT NULL
                                HAVING age_years >= $min AND age_years < $max
                                
                                UNION ALL
                                
                                SELECT 
                                    'room' as source,
                                    l.name as loc,
                                    ra.room_number as room,
                                    c.model_name as model,
                                    i.inv_number as inv,
                                    ra.hostname,
                                    e.name as type,
                                    i.price,
                                    i.purchase_date,
                                    i.status,
                                    emp_user.full_name as person,
                                    ra.tech_specs,
                                    TIMESTAMPDIFF(YEAR, i.purchase_date, CURDATE()) as age_years
                                FROM room_assignments ra
                                JOIN inventory i ON ra.inventory_id = i.id
                                LEFT JOIN catalog c ON i.model_id = c.id
                                LEFT JOIN equipment_types e ON c.type_id = e.id
                                LEFT JOIN locations l ON ra.location_id = l.id
                                LEFT JOIN employees emp_user ON ra.user_id = emp_user.id
                                $baseWhere 
                                  AND i.purchase_date IS NOT NULL
                                HAVING age_years >= $min AND age_years < $max
                                
                                ORDER BY age_years DESC, loc, room
                            ";
                            $params = [];
                        }
                        break;
                        
                    case 'RAM':
                    case 'OS':
                    case 'AV':
                    case 'Disk':
                    case 'Office':
                        $fieldMap = [
                            'RAM' => 'RAM',
                            'OS' => 'OS',
                            'AV' => 'Antivirus',
                            'Disk' => 'Disks',
                            'Office' => 'Office'
                        ];
                        
                        $jsonField = $fieldMap[$filterType];
                        
                        // БЕЗПЕЧНЕ ФОРМУВАННЯ ШЛЯХУ JSON (щоб не було Syntax Error)
                        $jsonPath = "'$.\"" . $jsonField . "\"'";
                        
                        $sql = "
                            SELECT 
                                'room' as source,
                                l.name as loc,
                                ra.room_number as room,
                                c.model_name as model,
                                i.inv_number as inv,
                                ra.hostname,
                                e.name as type,
                                i.price,
                                i.purchase_date,
                                i.status,
                                emp_user.full_name as person,
                                JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) as detail,
                                ra.tech_specs
                            FROM room_assignments ra
                            JOIN inventory i ON ra.inventory_id = i.id
                            LEFT JOIN catalog c ON i.model_id = c.id
                            LEFT JOIN equipment_types e ON c.type_id = e.id
                            LEFT JOIN locations l ON ra.location_id = l.id
                            LEFT JOIN employees emp_user ON ra.user_id = emp_user.id
                            $baseWhere 
                            AND ra.tech_specs IS NOT NULL
                        ";
                        
                        if (in_array($filterValue, ['Невідомо', 'Не встановлено', 'Не знайдено'])) {
                            $sql .= " AND (JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) IS NULL 
                                      OR JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) = '' 
                                      OR JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) = 'Не знайдено'
                                      OR JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) = 'Невідомо')";
                        } elseif ($filterType === 'AV') {
                            if ($filterValue === 'ESET') {
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Antivirus')) LIKE '%ESET%'";
                            } elseif ($filterValue === 'Інший') {
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Antivirus')) NOT LIKE '%ESET%' 
                                          AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Antivirus')) NOT IN ('', 'Не знайдено')";
                            }
                        } elseif ($filterType === 'Disk') {
                            if ($filterValue === 'Є SSD') {
                                $sql .= " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Disks'))) LIKE '%ssd%'";
                            } elseif ($filterValue === 'Тільки HDD') {
                                $sql .= " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Disks'))) LIKE '%hdd%' 
                                          AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Disks'))) NOT LIKE '%ssd%'";
                            } elseif ($filterValue === 'Інший тип') {
                                $sql .= " AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Disks'))) NOT LIKE '%ssd%' 
                                          AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Disks'))) NOT LIKE '%hdd%'";
                            }
                        } elseif ($filterType === 'Office') {
                            $v = trim(str_replace('Office', '', $filterValue));
                            if ($v !== 'Інше') {
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Office')) LIKE ?";
                                $params = ["%$v%"];
                            } else {
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.Office')) NOT REGEXP '2010|2013|2016|2019|2021|365|LibreOffice'";
                            }
                        } elseif ($filterType === 'RAM') {
                            $v = intval($filterValue);
                            if ($v > 0) {
                                // Безпечна конкатенація щоб уникнути конфлікту дужок []
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.RAM')) REGEXP '(^|[^0-9])" . $v . "[ ]*GB'";
                            } else {
                                $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, '$.RAM')) LIKE ?";
                                $params = ["%$filterValue%"];
                            }
                        } else {
                            $sql .= " AND JSON_UNQUOTE(JSON_EXTRACT(ra.tech_specs, $jsonPath)) LIKE ?";
                            $params = ["%$filterValue%"];
                        }
                        
                        $sql .= " ORDER BY loc, room LIMIT 500";
                        break;
                        
                    default:
                        error_log("Невідомий тип фільтра: $filterType");
                        echo json_encode([
                            'success' => true,
                            'data' => [],
                            'total' => 0,
                            'filter_type' => $filterType,
                            'filter_value' => $filterValue
                        ]);
                        return;
                }
                
                if ($sql) {
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $results = $stmt->fetchAll();
                    
                    echo json_encode([
                        'success' => true,
                        'data' => $results,
                        'total' => count($results),
                        'filter_type' => $filterType,
                        'filter_value' => $filterValue
                    ], JSON_UNESCAPED_UNICODE);
                }
            } catch (Exception $e) {
                error_log("Помилка в get_dashboard_drilldown: " . $e->getMessage());
                echo json_encode([
                    'success' => false,
                    'data' => [],
                    'error' => $e->getMessage()
                ]);
            }
            break;
        
    default:
        error_log("Невідома дія в dashboard.php: $action");
        echo json_encode([
            'success' => false,
            'error' => "Невідома дія: $action"
        ]);
}
?>