<?php
// api/inventory.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('memory_limit', '2048M');
ini_set('max_execution_time', 600);

if (empty($data)) {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
}

// ---------------------------------------------------------
// ДОПОМІЖНІ ФУНКЦІЇ
// ---------------------------------------------------------
if (!function_exists('getSafeLocationId')) {
    function getSafeLocationId($pdo, $name) {
        $name = trim($name);
        if (empty($name)) return null;
        $stmt = $pdo->prepare("SELECT id FROM locations WHERE name = ?");
        $stmt->execute([$name]);
        $id = $stmt->fetchColumn();
        if (!$id) {
            $stmt = $pdo->prepare("INSERT INTO locations (name) VALUES (?)");
            $stmt->execute([$name]);
            return $pdo->lastInsertId();
        }
        return $id;
    }
}

if (!function_exists('getSafeEmployeeId')) {
    function getSafeEmployeeId($pdo, $name) {
        // Видаляємо можливий номер в дужках, наприклад "Безверхий В. М. (225)" -> "Безверхий В. М."
        $name = preg_replace('/\s*\(\d+\)\s*$/', '', $name);
        $name = trim($name);
        if (empty($name)) return null;
        $stmt = $pdo->prepare("SELECT id FROM employees WHERE full_name = ?");
        $stmt->execute([$name]);
        $id = $stmt->fetchColumn();
        if (!$id) {
            $stmt = $pdo->prepare("INSERT INTO employees (full_name) VALUES (?)");
            $stmt->execute([$name]);
            return $pdo->lastInsertId();
        }
        return $id;
    }
}

/**
 * Функція для парсингу дат з різних форматів (ISO 8601, Y-m-d, d.m.Y)
 */
function parseDate($rawDate) {
    if (empty($rawDate)) return null;
    // Формат ISO 8601: 2020-05-19T00:00:00Z
    if (preg_match('/^(\d{4}-\d{2}-\d{2})T/', $rawDate, $matches)) {
        return $matches[1];
    }
    // Формат Y-m-d
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawDate)) {
        return $rawDate;
    }
    return null;
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

/**
 * Функція для інтелектуального визначення типу обладнання за назвою
 */
function detectEquipmentType($fullName) {
    $fullName = mb_strtolower($fullName, 'UTF-8');
    
    $typePatterns = [
        'Ноутбук' => [
            'ноутбук', 'notebook', 'laptop', 'nb-', 'nb ', 'ideapad', 
            'thinkpad', 'latitude', 'inspiron', 'satellite', 'dynabook', 
            'probook', 'elitebook', 'zenbook', 'vivobook', 'macbook', 'нетбук'
        ],
        'Монітор' => [
            'монітор', 'monitor', 'lcd', 'led', 'дисплей', 'display', 
            'e2420h', 'e2421hn', 'p2217h', 'p2417h', 'flatron', 'syncmaster', 
            'tft', 'інтерактивна дошка'
        ],
        'Багатофункціональний пристрій' => [
            'багатофункціональний', 'багатофункційний', 'багатофунк', 'мфу', 'mfp', 
            'multifunction', 'копір', 'ксерокс', 'пристрій canon i-sensys'
        ],
        'Принтер' => [
            'принтер', 'printer', 'прінтер', 'canon lbp', 'canon i-sensys', 'hp laserjet',
            'epson lx', 'epson fx', 'brother', 'laserjet', 'mf264dw',
            'hp laser jet', 'hp lj', 'принтер canon'
        ],
        'Персональний комп\'ютер' => [
            'перс.комп', 'комп\'ютер', 'pc', 'computer', 'робоча станція', 
            'системний блок', 'моноблок', 'неттоп', 'desktop', 'optiplex',
            'elitebook', 'prodesk', 'compag', 'thinkcentre', 'system unit', 
            'chpset', 'chipset', 'motherboard', 'сист.блок', 'aio', 'all in one', 
            'thinkcentre neo 50a', 'optiplex 3070 mff', 'hp 200 g3', 'ideacentre', 'ai-о', 'ai-o'
        ],
        'Вогнегасники' => [
            'вогнегасник', 'пожежний', 'fire extinguisher', 'fire', 'вп-5', 'вп-5(а)',
            'пожежна сигналізація', 'пожежне', 'протипожежний'
        ],
        'ДБЖ (Джерело безперебійного живлення)' => [
            'джерело', 'ups', 'ibp', 'безперебійний', 'безперервний', 'беспереб',
            'powerwalker', 'apc', 'back ups', 'smart ups', 'powercom',
            'дбж', 'джерело безперебійного', 'генератор'
        ],
        'Мережеве обладнання' => [
            'комутатор', 'switch', 'роутер', 'router', 'маршрутизатор',
            'мережевий екран', 'firewall', 'check point', 'cisco',
            'd-link', 'tp-link', 'zyxel', 'hub', 'концентратор',
            'мережевий накопичувач', 'nas', 'synology', 'qnap',
            'мережеве сховище', 'network storage', 'керований комутатор',
            'світч', 'хаб', 'патч', 'телекомунікаційна'
        ],
        'Відеонагляд' => [
            'камера', 'camera', 'ip камера', 'відеокамера', 'videocamera',
            'відеоспостереження', 'cctv', 'камер', 'аver cam520', 'ycamera',
            'система відеоспостереження', 'hikvision', 'відеонагляд', 'реєстратор'
        ],
        'Клавіатура' => ['клавіатур', 'keyboard', 'клав'],
        'Миша' => ['миша', 'mouse', 'миш'],
        'Телефон' => [
            'телефон', 'phone', 'panasonic', 'gigaset', 'факс', 'fax',
            'радіотелефон', 'ip телефон', 'ip-телефон', 'cisco phone', 'апарат факс',
            'міні атс', 'ats', 'телефонний апарат', 'факс panasonic'
        ],
        'Планшет' => ['планшет', 'tablet', 'ipad', 'lenovo tablet', 'samsung tablet'],
        'Кондиціонер' => [
            'кондиціонер', 'conditioner', 'спліт', 'daikin', 'mitsubishi',
            'grunhelm', 'osaka', 'olmo', 'samsung aq', 'кондиціонер повітря',
            'кондіціонер', 'внутрішній блок', 'зовнішній блок', 'кондиціонер midea'
        ],
        'Холодильник' => [
            'холодильник', 'refrigerator', 'nord', 'atlant', 'liebherr',
            'indesit', 'snajge', 'холодильник днепр', 'холодильник норд'
        ],
        'Котел' => [
            'котел', 'boiler', 'водогрійний', 'газовий', 'biasi', 'bosch',
            'рівнотерм', 'котел опалювальний', 'котли', 'рівнетерм'
        ],
        'Лічильники' => [
            'лічильник', 'meter', 'електролічильник', 'лічільник тепла',
            'газовий лічильник', 'лічільник', 'електричний лічильник'
        ],
        'Генератори' => [
            'генератор', 'бензиновий генератор', 'дизель-генератор',
            'gucbir', 'supergen', 'clarke', 'magnetta'
        ],
        'Сервер' => [
            'сервер', 'server', 'poweredge', 'proliant', 'ibm system',
            'сервер двопроцесорний', 'сервер поштового', 'серверне обладнання',
            'hp proliant', 'dell poweredge', 'сервер aser', 'сервер acer'
        ],
        'Сканер' => [
            'сканер', 'scaner', 'scanner', 'czur', 'avision', 'hp scanjet',
            'сканер потоковий', 'двосторонній сканер', 'qr-code', 'qr-код', 'штрих'
        ],
        'Термінал' => [
            'термінал', 'terminal', 'термінал електронної черги',
            'інформаційний кіоск', 'кіоск'
        ],
        'Телевізор' => [
            'телевізор', 'tv', 'television', 'toshiba', 'xiaomi mi tv',
            'телевізор з кронштейном', 'плазма', 'екран', 'панель'
        ],
        'АТС' => [
            'атс', 'pbx', 'panasonic kx-t', 'телефонна станція',
            'міні атс', 'міні-атс', 'panasonic kx-tda'
        ],
        'Стіл' => ['стіл', 'стол ', 'столи', 'приставний'],
        'Крісло / Стілець' => ['стілець', 'стул', 'крісло', 'кресло', 'банкетка', 'табурет'],
        'Шафа' => ['шафа', 'шкаф', 'гардероб'],
        'Тумба' => ['тумба', 'тумбочка'],
        'Стелаж' => ['стелаж', 'стеллаж', 'полка', 'полиця'],
        'Жалюзі / Ролети' => ['жалюзі', 'ролет', 'штора', 'тканина ролета'],
        'Лампи, світильники' => ['лампа', 'світильник', 'прожектор', 'опромінювач'],
        'Сейф' => ['сейф'],
        'Штампи, печатки' => ['печатка', 'штамп', 'датер'],
        'Інші меблі та інвентар' => ['підставка', 'кронштейн', 'вішалка', 'прапор', 'флаг'],
        'Інше приладдя' => [
            'бак', 'піч', 'мікрохвильова', 'свч піч', 'електрочайник', 'пилосос'
        ],
        'Відеотехніка' => [
            'проектор', 'ecran', 'відео', 'фотоапарат', 'фотоаппарат', 'цифрова камера', 'відеодомофон'
        ]
    ];
    
    foreach ($typePatterns as $type => $patterns) {
        foreach ($patterns as $pattern) {
            if (mb_strpos($fullName, $pattern, 0, 'UTF-8') !== false) {
                return $type;
            }
        }
    }
    
    return 'Інше обладнання';
}
// ---------------------------------------------------------
// ОБРОБКА ЗАПИТІВ
// ---------------------------------------------------------
switch ($action) {
    case 'get_inventory':
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

        $sql = "SELECT 
            i.id, 
            i.inv_number as inv, 
            i.serial_number as sn,
            e.name as type, 
            c.model_name as name,
            loc.name as location,
            emp.full_name as person, 
            i.price, 
            i.purchase_date as startDate,
            i.status, 
            i.is_auto_indexed as isAutoIndexed, 
            i.location_id
        FROM inventory i
        LEFT JOIN catalog c ON i.model_id = c.id
        LEFT JOIN equipment_types e ON c.type_id = e.id
        LEFT JOIN employees emp ON i.mvo_id = emp.id
        LEFT JOIN locations loc ON i.location_id = loc.id
        WHERE i.deleted = 0
        ORDER BY i.id DESC";
        
        if ($limit > 0) $sql .= " LIMIT $limit OFFSET $offset";

        try {
            $stmt = $pdo->query($sql);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($results as &$row) {
                $row['type'] = $row['type'] ?? 'Обладнання';
                $row['name'] = $row['name'] ?? 'Без назви';
                $row['model'] = $row['name'];
                $row['model_name'] = $row['name'];
                $row['inv_number'] = $row['inv'];
                $row['mvo'] = $row['person'];
            }
            echo json_encode($results, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500); 
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

        case 'import_inventory_csv':
            // 1. Очищаємо буфер, щоб будь-які PHP Warnings не ламали JSON відповідь
            while (ob_get_level()) ob_end_clean();
            ob_start();
    
            // 2. Перевірка, чи файл взагалі дійшов до сервера
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                ob_end_clean();
                $errCode = isset($_FILES['file']['error']) ? $_FILES['file']['error'] : 'Невідомо';
                echo json_encode(["error" => "Помилка завантаження файлу (Код: $errCode). Можливо, файл занадто великий для сервера."]);
                break;
            }
    
            $tmpName = $_FILES['file']['tmp_name'];
            if (empty($tmpName) || !file_exists($tmpName)) {
                ob_end_clean();
                echo json_encode(["error" => "Тимчасовий файл не знайдено на сервері."]);
                break;
            }
    
            $content = @file_get_contents($tmpName);
            if ($content === false) {
                ob_end_clean();
                echo json_encode(["error" => "Не вдалося прочитати вміст файлу."]);
                break;
            }
    
            // Виправляємо кодування (якщо файл з 1С у Windows-1251)
            $encoding = mb_detect_encoding($content, ['UTF-8', 'Windows-1251', 'KOI8-R'], true);
            if ($encoding && $encoding !== 'UTF-8') {
                $content = mb_convert_encoding($content, 'UTF-8', $encoding);
            }
    
            // Безпечно видаляємо BOM
            $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
    
            // Створюємо віртуальний потік у пам'яті
            $stream = fopen('php://memory', 'r+');
            fwrite($stream, $content);
            rewind($stream);
    
            // Визначаємо роздільник
            $firstLine = fgets($stream);
            $delimiter = "\t";
            if (substr_count($firstLine, ';') > substr_count($firstLine, "\t")) $delimiter = ';';
            if (substr_count($firstLine, ',') > substr_count($firstLine, ';')) $delimiter = ',';
            rewind($stream);
    
            $headers = fgetcsv($stream, 10000, $delimiter);
            
            // Перевіряємо, чи є заголовки
            if (!$headers || !is_array($headers)) {
                ob_end_clean();
                echo json_encode(["error" => "Не вдалося розпізнати структуру CSV файлу."]);
                break;
            }
            
            $headers = array_map('trim', $headers);
    
            $added = 0;
            $updated = 0;
            $processedRows = 0;
            $skippedRows = 0;
    
            $typeCache = [];
            $modelCache = [];
            $mvoCache = [];
            $locCache = [];
    
            $existingInvMap = [];
            $stmt = $pdo->query("SELECT inv_number, id FROM inventory WHERE deleted = 0 AND inv_number != 'Б/Н'");
            while ($row = $stmt->fetch()) {
                $existingInvMap[$row['inv_number']] = $row['id'];
            }
    
            $pdo->beginTransaction();
    
            try {
                while (($row = fgetcsv($stream, 10000, $delimiter)) !== FALSE) {
                    if (count($row) < 2) continue;
                    
                    $item = [];
                    foreach ($headers as $index => $header) {
                        $item[$header] = isset($row[$index]) ? trim($row[$index]) : '';
                    }
    
                    // ШУКАЄМО НАЗВУ
                    $fullName = '';
                    foreach (['Коротка назва', 'Найменування', 'Назва'] as $col) {
                        if (isset($item[$col]) && $item[$col] !== '') {
                            $fullName = $item[$col];
                            break;
                        }
                    }
    
                    if (empty($fullName)) {
                        $skippedRows++;
                        continue;
                    }
    
                    // Очищення назви від "ціна:..." та переносів
                    $fullName = preg_replace('/ціна:\s*[\d\.,]+/ui', '', $fullName);
                    $fullName = str_replace(["\r", "\n", '"""', '""', '"'], ' ', $fullName);
                    $fullName = preg_replace('/\s+/', ' ', trim($fullName));
    
                    // ІНВЕНТАРНИЙ НОМЕР
                    $invNum = 'Б/Н';
                    foreach (['Інвентарний №', 'Інвентарний номер'] as $col) {
                        if (!empty($item[$col])) {
                            $invNum = trim($item[$col]);
                            break;
                        }
                    }
    
                    // МВО (відкидаємо дужки з цифрами)
                    $mvoRaw = $item['МВО'] ?? 'Не закріплено';
                    $mvoName = trim(preg_replace('/\s*\(\d+\)\s*$/', '', $mvoRaw));
                    if (empty($mvoName)) $mvoName = 'Не закріплено';
    
                    // ЛОКАЦІЯ (МЗ)
                    $locName = $item['МЗ'] ?? 'Головне управління';
                    $locName = preg_replace('/\s+/', ' ', trim($locName));
                    if (empty($locName)) $locName = 'Головне управління';
    
                    // КІЛЬКІСТЬ
                    $qty = isset($item['Кількість']) && is_numeric($item['Кількість']) ? intval($item['Кількість']) : 1;
                    if ($qty < 1) $qty = 1;
    
                    // ЦІНА
                    $priceRaw = $item['Первісна вартість'] ?? '0';
                    $priceRaw = str_replace(',', '.', $priceRaw);
                    $priceRaw = preg_replace('/[^0-9\.\-]/', '', $priceRaw);
                    $totalPrice = floatval($priceRaw);
                    $unitPrice = $qty > 0 ? round($totalPrice / $qty, 2) : 0;
    
                    // СТАТУСИ
                    $statusRaw = trim($item['Статус'] ?? '');
                    $isUnfit = strtoupper(trim($item['Непридатний'] ?? '')) === 'TRUE';
                    $writeOffDate = trim($item['Дата списання'] ?? '');
                    
                    $status = 'В роботі';
                    if ($statusRaw === 'Списано' || !empty($writeOffDate)) {
                        $status = 'Списано';
                    } elseif ($statusRaw === 'Готується на списання') {
                        $status = 'Готується на списання';
                    } elseif ($isUnfit || $statusRaw === 'Для списання') {
                        $status = 'Для списання';
                    } elseif ($statusRaw === 'В ремонті') {
                        $status = 'В ремонті';
                    }
    
                    // ДАТА
                    $purchaseDate = null;
                    $dateRaw = $item['Дата введення в експлуатацію'] ?? ($item['Дата придбання'] ?? '');
                    if (!empty($dateRaw)) {
                        $purchaseDate = parseDate($dateRaw);
                    }
    
                    // ТИП - інтелектуальне визначення
                    $type = trim($item['Типовий актив'] ?? '');
                    
                    if (empty($type) || $type === '104 Інше обладнання' || $type === '113 Інше обладнання') {
                        $type = detectEquipmentType($fullName);
                    } else {
                        if (preg_match('/^\d+\s+(.+)$/', $type, $matches)) {
                            $type = trim($matches[1]);
                        }
                        $detectedType = detectEquipmentType($fullName);
                        if (strpos($type, 'Інше') !== false && $detectedType !== 'Інше обладнання') {
                            $type = $detectedType;
                        }
                    }
    
                    // --- ЗБЕРЕЖЕННЯ ---
                    $typeId = getOrCreateEquipmentTypeId($pdo, $type);
    
                    // Модель
                    $modelKey = $typeId . '||' . $fullName;
                    if (!isset($modelCache[$modelKey])) {
                        $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
                        $stmt->execute([$typeId, $fullName]);
                        $modelId = $stmt->fetchColumn();
                        if (!$modelId) {
                            $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)")->execute([$typeId, $fullName]);
                            $modelId = $pdo->lastInsertId();
                        }
                        $modelCache[$modelKey] = $modelId;
                    }
                    $modelId = $modelCache[$modelKey];
    
                    // МВО
                    if (!isset($mvoCache[$mvoName])) {
                        $mvoId = getSafeEmployeeId($pdo, $mvoName);
                        $mvoCache[$mvoName] = $mvoId;
                    }
                    $mvoId = $mvoCache[$mvoName];
    
                    // Локація
                    if (!isset($locCache[$locName])) {
                        $locId = getSafeLocationId($pdo, $locName);
                        $locCache[$locName] = $locId;
                    }
                    $locId = $locCache[$locName];
    
                    $processedRows++;
    
                    // РОЗБИТТЯ ПО КІЛЬКОСТІ
                    for ($i = 1; $i <= $qty; $i++) {
                        $currentInv = $invNum;
                        $isAutoIndexed = ($qty > 1) ? 1 : 0;
                        
                        if ($qty > 1) {
                            if ($invNum === 'Б/Н' || $invNum === '') {
                                $currentInv = 'Б/Н(' . $i . ')';
                            } else {
                                $baseInv = preg_replace('/[_\-\/\\\\\.].*$/', '', $invNum);
                                $currentInv = $baseInv . '_' . $i;
                            }
                        }
    
                        $existingId = ($currentInv !== 'Б/Н' && isset($existingInvMap[$currentInv])) ? $existingInvMap[$currentInv] : null;
    
                        if ($existingId) {
                            $stmt = $pdo->prepare("UPDATE inventory SET model_id=?, location_id=?, mvo_id=?, price=?, purchase_date=?, status=?, is_auto_indexed=? WHERE id=?");
                            $stmt->execute([$modelId, $locId, $mvoId, $unitPrice, $purchaseDate, $status, $isAutoIndexed, $existingId]);
                            $updated++;
                        } else {
                            $stmt = $pdo->prepare("INSERT INTO inventory (inv_number, serial_number, model_id, location_id, mvo_id, price, purchase_date, status, is_auto_indexed) VALUES (?, '', ?, ?, ?, ?, ?, ?, ?)");
                            $stmt->execute([$currentInv, $modelId, $locId, $mvoId, $unitPrice, $purchaseDate, $status, $isAutoIndexed]);
                            $added++;
                            if ($currentInv !== 'Б/Н') {
                                $existingInvMap[$currentInv] = $pdo->lastInsertId();
                            }
                        }
                    }
                }
    
                fclose($stream);
                $pdo->commit();
                
                // 3. Зкидаємо все зайве з буфера і відправляємо ТІЛЬКИ чистий JSON
                ob_end_clean();
                echo json_encode([
                    "success" => true,
                    "added" => $added,
                    "updated" => $updated,
                    "processed" => $processedRows,
                    "skipped" => $skippedRows,
                    "message" => "Імпорт завершено!"
                ]);
    
            } catch (Exception $e) {
                $pdo->rollBack();
                if (isset($stream)) fclose($stream);
                ob_end_clean();
                http_response_code(500);
                echo json_encode(["error" => "Помилка бази даних: " . $e->getMessage()]);
            }
            break;

    case 'add_inventory':
        try {
            $type = trim($data['type'] ?? 'Обладнання');
            $model = trim($data['name'] ?? 'Без назви');
            
            $typeId = getOrCreateEquipmentTypeId($pdo, $type);

            $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
            $stmt->execute([$typeId, $model]);
            $model_id = $stmt->fetchColumn();
            if (!$model_id) {
                $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)")->execute([$typeId, $model]);
                $model_id = $pdo->lastInsertId();
            }

            $mvo_id = getSafeEmployeeId($pdo, $data['person']);
            $location_id = getSafeLocationId($pdo, $data['location']);
            
            $sql = "INSERT INTO inventory (inv_number, serial_number, model_id, location_id, mvo_id, price, purchase_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([ 
                $data['inv'] === 'Б/Н' ? null : $data['inv'], 
                $data['sn'], 
                $model_id, 
                $location_id, 
                $mvo_id, 
                $data['price'], 
                $data['startDate'], 
                $data['status'] 
            ]);
            echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'update_inventory':
        try {
            $type = trim($data['type'] ?? 'Обладнання');
            $model = trim($data['name'] ?? 'Без назви');
            
            $typeId = getOrCreateEquipmentTypeId($pdo, $type);

            $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
            $stmt->execute([$typeId, $model]);
            $model_id = $stmt->fetchColumn();
            if (!$model_id) {
                $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)")->execute([$typeId, $model]);
                $model_id = $pdo->lastInsertId();
            }

            $mvo_id = getSafeEmployeeId($pdo, $data['person']);
            $location_id = getSafeLocationId($pdo, $data['location']);
            
            $sql = "UPDATE inventory SET inv_number=?, serial_number=?, model_id=?, location_id=?, mvo_id=?, price=?, purchase_date=?, status=? WHERE id=?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([ 
                $data['inv'] === 'Б/Н' ? null : $data['inv'], 
                $data['sn'], 
                $model_id, 
                $location_id, 
                $mvo_id, 
                $data['price'], 
                $data['startDate'], 
                $data['status'], 
                $data['id'] 
            ]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'delete_inventory':
        try {
            $stmt = $pdo->prepare("UPDATE inventory SET deleted = 1 WHERE id = ?");
            $stmt->execute([$data['id']]);
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'remove_duplicates':
        try {
            $sql = "DELETE t1 FROM inventory t1
                    INNER JOIN inventory t2 
                    WHERE t1.id > t2.id 
                    AND t1.inv_number = t2.inv_number 
                    AND t1.inv_number IS NOT NULL 
                    AND t1.inv_number != 'Б/Н' 
                    AND t1.inv_number != ''
                    AND t1.deleted = 0 AND t2.deleted = 0";
            $stmt = $pdo->prepare($sql);
            $stmt->execute();
            echo json_encode(["success" => true, "deleted" => $stmt->rowCount()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'clear_inventory':
        try {
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
            $pdo->exec("TRUNCATE TABLE inventory;");
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Помилка очищення: " . $e->getMessage()]);
        }
        break;

    case 'fix_inventory':
        try {
            $pdo->beginTransaction();
            $fixed = 0; $priceFixed = 0; $invFixed = 0; $bnFixed = 0;
            
            $stmt = $pdo->query("SELECT id, inv_number, price FROM inventory WHERE (inv_number = 'Б/Н' OR inv_number IS NULL OR inv_number = '') AND deleted = 0");
            $bnItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $bnGroups = [];
            foreach ($bnItems as $item) {
                $stmt2 = $pdo->prepare("SELECT model_id, location_id, mvo_id FROM inventory WHERE id = ?");
                $stmt2->execute([$item['id']]);
                $details = $stmt2->fetch(PDO::FETCH_ASSOC);
                $key = $details['model_id'] . '|' . ($details['location_id'] ?? '') . '|' . ($details['mvo_id'] ?? '');
                $bnGroups[$key][] = $item;
            }
            
            foreach ($bnGroups as $key => $group) {
                if (count($group) <= 1) continue;
                usort($group, function($a, $b) { return $a['id'] - $b['id']; });
                $totalPrice = 0;
                foreach ($group as $item) { $totalPrice += floatval($item['price'] ?? 0); }
                $avgPrice = round($totalPrice / count($group), 2);
                
                foreach ($group as $index => $item) {
                    $newInv = 'Б/Н(' . ($index + 1) . ')';
                    $oldPrice = floatval($item['price'] ?? 0);
                    $updateStmt = $pdo->prepare("UPDATE inventory SET inv_number=?, price=?, is_auto_indexed=1 WHERE id=?");
                    $updateStmt->execute([$newInv, $avgPrice, $item['id']]);
                    $bnFixed++;
                    if (abs($oldPrice - $avgPrice) > 0.01) $priceFixed++;
                }
                $fixed++;
            }
            
            $stmt = $pdo->query("SELECT id, inv_number, price FROM inventory WHERE is_auto_indexed = 1 AND deleted = 0");
            $autoItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $groups = [];
            foreach ($autoItems as $item) {
                $inv = preg_replace('/[\\\\\-_\.]/', '/', $item['inv_number']);
                $baseInv = preg_match('/^(.+?)[\/\d]+$/', $inv, $matches) ? $matches[1] : $inv;
                $groups[$baseInv][] = $item;
            }
            
            foreach ($groups as $baseInv => $items) {
                if (count($items) <= 1) continue;
                $totalPrice = 0;
                foreach ($items as $item) { $totalPrice += floatval($item['price'] ?? 0); }
                $avgPrice = round($totalPrice / count($items), 2);
                
                foreach ($items as $item) {
                    $oldPrice = floatval($item['price'] ?? 0);
                    if (abs($oldPrice - $avgPrice) > 0.01) {
                        $updateStmt = $pdo->prepare("UPDATE inventory SET price=? WHERE id=?");
                        $updateStmt->execute([$avgPrice, $item['id']]);
                        $priceFixed++;
                    }
                    $newInv = preg_replace('/[\\\\\-_\.]/', '/', $item['inv_number']);
                    if ($newInv !== $item['inv_number']) {
                        $updateStmt = $pdo->prepare("UPDATE inventory SET inv_number=? WHERE id=?");
                        $updateStmt->execute([$newInv, $item['id']]);
                        $invFixed++;
                    }
                }
                $fixed++;
            }
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => "Виправлено: $fixed груп, $priceFixed цін, $invFixed номерів, $bnFixed Б/Н"]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;

    case 'check_inventory_health':
    case 'get_inventory_stats':
        try {
            $total = $pdo->query("SELECT COUNT(*) FROM inventory WHERE deleted = 0")->fetchColumn();
            $autoIndexed = $pdo->query("SELECT COUNT(*) FROM inventory WHERE is_auto_indexed = 1 AND deleted = 0")->fetchColumn();
            $noInv = $pdo->query("SELECT COUNT(*) FROM inventory WHERE (inv_number IS NULL OR inv_number = '' OR inv_number = 'Б/Н') AND deleted = 0")->fetchColumn();
            $writeOff = $pdo->query("SELECT COUNT(*) FROM inventory WHERE status = 'Списано' AND deleted = 0")->fetchColumn();
            $forWriteOff = $pdo->query("SELECT COUNT(*) FROM inventory WHERE status = 'Для списання' AND deleted = 0")->fetchColumn();
            
            $duplicates = $pdo->query("SELECT SUM(cnt - 1) FROM (SELECT inv_number, COUNT(*) as cnt FROM inventory WHERE inv_number IS NOT NULL AND inv_number != '' AND inv_number != 'Б/Н' AND deleted = 0 GROUP BY inv_number HAVING cnt > 1) as dup")->fetchColumn() ?: 0;
            
            $groups = $pdo->query("SELECT COUNT(DISTINCT CASE WHEN inv_number LIKE '%/%' THEN SUBSTRING_INDEX(inv_number, '/', 1) WHEN inv_number LIKE '%\\\\%' THEN SUBSTRING_INDEX(inv_number, '\\\\', 1) WHEN inv_number LIKE '%-%' THEN SUBSTRING_INDEX(inv_number, '-', 1) ELSE inv_number END) FROM inventory WHERE inv_number IS NOT NULL AND inv_number != '' AND inv_number != 'Б/Н' AND deleted = 0")->fetchColumn();
            
            echo json_encode([
                'success' => true, 
                'total' => $total, 
                'autoIndexed' => $autoIndexed, 
                'noInv' => $noInv, 
                'writeOff' => $writeOff,
                'forWriteOff' => $forWriteOff,
                'duplicates' => $duplicates, 
                'groups' => $groups
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;
}
?>