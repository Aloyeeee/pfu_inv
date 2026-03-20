<?php
// api/rooms.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('memory_limit', '1024M');

if (empty($data)) {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
}

// ---------------------------------------------------------
// ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ БЕЗПЕЧНОЇ РОБОТИ З БД
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

if (!function_exists('getModelId')) {
    function getModelId($pdo, $typeName, $modelName) {
        // Отримуємо або створюємо тип
        $stmt = $pdo->prepare("SELECT id FROM equipment_types WHERE name = ?");
        $stmt->execute([$typeName]);
        $typeId = $stmt->fetchColumn();
        if (!$typeId) {
            $pdo->prepare("INSERT INTO equipment_types (name) VALUES (?)")->execute([$typeName]);
            $typeId = $pdo->lastInsertId();
        }
        // Отримуємо або створюємо модель
        $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
        $stmt->execute([$typeId, $modelName]);
        $modelId = $stmt->fetchColumn();
        if (!$modelId) {
            $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)")->execute([$typeId, $modelName]);
            $modelId = $pdo->lastInsertId();
        }
        return $modelId;
    }
}

// ---------------------------------------------------------
// ОБРОБКА API ЗАПИТІВ
// ---------------------------------------------------------
switch ($action) {
    case 'get_rooms':
        try {
            $sql = "SELECT 
                r.id, 
                l.name as loc, 
                r.room_number as room, 
                mvo_emp.full_name as mvo, 
                user_emp.full_name as person,
                i.inv_number as inv, 
                e.name as type, 
                c.model_name as model, 
                i.status, 
                i.serial_number as sn, 
                r.ip_address as ip, 
                r.hostname, 
                i.price, 
                r.tech_specs as specs,
                r.os_name,
                r.anydesk_id,
                r.needs_reboot,
                r.tpm_status,
                r.last_update,
                i.id as inventory_id
            FROM room_assignments r
            JOIN inventory i ON r.inventory_id = i.id
            JOIN catalog c ON i.model_id = c.id
            JOIN equipment_types e ON c.type_id = e.id
            LEFT JOIN locations l ON r.location_id = l.id
            LEFT JOIN employees mvo_emp ON i.mvo_id = mvo_emp.id
            LEFT JOIN employees user_emp ON r.user_id = user_emp.id
            WHERE i.deleted = 0";
            
            $rooms = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($rooms as &$room) { 
                if (!empty($room['specs'])) {
                    $room['specs'] = json_decode($room['specs'], true);
                }
            }
            
            echo json_encode($rooms, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Помилка завантаження кабінетів: " . $e->getMessage()]);
        }
        break;

    case 'get_rooms_by_location':
        try {
            $location = $_GET['location'] ?? '';
            if (empty($location)) {
                echo json_encode([]);
                break;
            }
            
            $sql = "SELECT 
                r.id, 
                l.name as loc, 
                r.room_number as room, 
                mvo_emp.full_name as mvo, 
                user_emp.full_name as person,
                i.inv_number as inv, 
                e.name as type, 
                c.model_name as model, 
                i.status, 
                i.serial_number as sn, 
                r.ip_address as ip, 
                r.hostname, 
                i.price, 
                r.tech_specs as specs,
                r.os_name,
                r.anydesk_id,
                r.needs_reboot,
                r.tpm_status,
                r.last_update,
                i.id as inventory_id
            FROM room_assignments r
            JOIN inventory i ON r.inventory_id = i.id
            JOIN catalog c ON i.model_id = c.id
            JOIN equipment_types e ON c.type_id = e.id
            LEFT JOIN locations l ON r.location_id = l.id
            LEFT JOIN employees mvo_emp ON i.mvo_id = mvo_emp.id
            LEFT JOIN employees user_emp ON r.user_id = user_emp.id
            WHERE i.deleted = 0 AND l.name = ?";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$location]);
            $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($rooms as &$room) { 
                if (!empty($room['specs'])) {
                    $room['specs'] = json_decode($room['specs'], true);
                }
            }
            
            echo json_encode($rooms, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Помилка завантаження кабінетів: " . $e->getMessage()]);
        }
        break;

    case 'add_room_item':
        try {
            $pdo->beginTransaction();
            
            $loc_id = getSafeLocationId($pdo, $data['loc']);
            $user_id = getSafeEmployeeId($pdo, $data['person']);
            $mvo_id = getSafeEmployeeId($pdo, $data['mvo']);
            
            $model_id = getModelId($pdo, $data['type'], $data['model']);

            $inv_val = ($data['inv'] === 'Б/Н' || trim($data['inv']) === '') ? null : trim($data['inv']);
            $inv_id = null;

            if ($inv_val !== null) {
                $stmt = $pdo->prepare("SELECT id FROM inventory WHERE inv_number = ? AND deleted = 0 LIMIT 1");
                $stmt->execute([$inv_val]);
                $inv_id = $stmt->fetchColumn();
            }

            if ($inv_id) {
                $pdo->prepare("UPDATE inventory SET mvo_id = ?, status = ?, location_id = ? WHERE id = ?")
                    ->execute([$mvo_id, $data['status'], $loc_id, $inv_id]);
            } else {
                $pdo->prepare("INSERT INTO inventory (inv_number, serial_number, model_id, mvo_id, price, status, location_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
                    ->execute([$inv_val, $data['sn'], $model_id, $mvo_id, $data['price'] ?? 0, $data['status'], $loc_id]);
                $inv_id = $pdo->lastInsertId();
            }

            $specs_json = !empty($data['specs']) ? json_encode($data['specs'], JSON_UNESCAPED_UNICODE) : null;
            $stmtRoom = $pdo->prepare("SELECT id FROM room_assignments WHERE inventory_id = ? LIMIT 1");
            $stmtRoom->execute([$inv_id]);
            $room_assign_id = $stmtRoom->fetchColumn();

            if ($room_assign_id) {
                $pdo->prepare("UPDATE room_assignments SET location_id=?, room_number=?, user_id=?, ip_address=?, hostname=?, tech_specs=? WHERE id=?")
                    ->execute([$loc_id, $data['room'], $user_id, $data['ip'] ?? null, $data['hostname'] ?? null, $specs_json, $room_assign_id]);
            } else {
                $pdo->prepare("INSERT INTO room_assignments (inventory_id, location_id, room_number, user_id, ip_address, hostname, tech_specs) VALUES (?, ?, ?, ?, ?, ?, ?)")
                    ->execute([$inv_id, $loc_id, $data['room'], $user_id, $data['ip'] ?? null, $data['hostname'] ?? null, $specs_json]);
            }

            $pdo->commit();
            echo json_encode(["success" => true, "id" => $inv_id]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'update_room_item':
        try {
            $pdo->beginTransaction();
            
            $loc_id = getSafeLocationId($pdo, $data['loc']);
            $user_id = getSafeEmployeeId($pdo, $data['person']);
            $mvo_id = getSafeEmployeeId($pdo, $data['mvo']);
            $specs_json = !empty($data['specs']) ? json_encode($data['specs'], JSON_UNESCAPED_UNICODE) : null;
            
            $stmt = $pdo->prepare("UPDATE room_assignments SET 
                location_id = ?, 
                room_number = ?, 
                user_id = ?, 
                ip_address = ?, 
                hostname = ?, 
                tech_specs = ? 
                WHERE id = ?");
                
            $stmt->execute([
                $loc_id, 
                $data['room'], 
                $user_id, 
                $data['ip'] ?? null, 
                $data['hostname'] ?? null, 
                $specs_json, 
                $data['id']
            ]);
            
            $stmt2 = $pdo->prepare("SELECT inventory_id FROM room_assignments WHERE id = ?");
            $stmt2->execute([$data['id']]);
            $inventory_id = $stmt2->fetchColumn();
            
            if ($inventory_id) {
                $model_id = getModelId($pdo, $data['type'], $data['model']);
                
                $stmt3 = $pdo->prepare("UPDATE inventory SET model_id = ?, status = ?, mvo_id = ?, location_id = ? WHERE id = ?");
                $stmt3->execute([$model_id, $data['status'], $mvo_id, $loc_id, $inventory_id]);
            }
            
            $pdo->commit();
            echo json_encode(["success" => true]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    case 'delete_room_item':
        try {
            $pdo->beginTransaction();
            $inv_id = $data['inventory_id'] ?? null;
            $room_assign_id = $data['id'] ?? null;
            
            $loc_id = getSafeLocationId($pdo, 'Головне управління');
            $stmtUpdateInv = $pdo->prepare("UPDATE inventory SET location_id = ?, status = 'На складі' WHERE id = ?");
            $stmtUpdateInv->execute([$loc_id, $inv_id]);

            $pdo->prepare("DELETE FROM room_assignments WHERE id = ?")->execute([$room_assign_id]);
            
            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => "Помилка видалення: " . $e->getMessage()]);
        }
        break;

    case 'batch_update_specs':
        try {
            error_log("batch_update_specs отримано дані: " . print_r($data, true));
            
            $pdo->beginTransaction();
            $updatedCount = 0;
            
            foreach ($data['updates'] as $upd) {
                $room_id = $upd['id'];
                $specs = $upd['specs'];
                
                error_log("Оновлення room_id: " . $room_id);
                
                $stmt = $pdo->prepare("SELECT inventory_id FROM room_assignments WHERE id = ?");
                $stmt->execute([$room_id]);
                $inventory_id = $stmt->fetchColumn();
                
                if (!$inventory_id) {
                    error_log("Не знайдено inventory_id для room_id: " . $room_id);
                    continue;
                }
                
                $hostname = $specs['Hostname'] ?? $specs['hostname'] ?? null;
                $os_name = $specs['OS'] ?? $specs['os'] ?? null;
                
                $anydesk_id = null;
                if (!empty($specs['RemoteAccess'])) {
                    if (strpos($specs['RemoteAccess'], 'AnyDesk ID:') !== false) {
                        $anydesk_id = trim(str_replace(['AnyDesk ID:', 'Не встановлено'], '', $specs['RemoteAccess']));
                        if (empty($anydesk_id)) $anydesk_id = null;
                    }
                }
                
                $needs_reboot = 0;
                if (!empty($specs['OS_Details']) && preg_match('/Без перезавантаження:\s*(\d+)\s+дні/', $specs['OS_Details'], $matches)) {
                    if (intval($matches[1]) > 7) $needs_reboot = 1;
                }
                
                $tpm_status = null;
                if (!empty($specs['Security'])) {
                    if (strpos($specs['Security'], 'TPM:') !== false) {
                        $tpm_status = $specs['Security'];
                    }
                }
                
                $ip_address = null;
                if (!empty($specs['Network'])) {
                    if (strpos($specs['Network'], 'IP:') !== false) {
                        preg_match('/IP:\s*([\d\.]+)/', $specs['Network'], $matches);
                        $ip_address = $matches[1] ?? null;
                    }
                }
                
                $updateStmt = $pdo->prepare("UPDATE room_assignments SET 
                    tech_specs = ?, 
                    ip_address = COALESCE(?, ip_address), 
                    hostname = COALESCE(?, hostname),
                    os_name = COALESCE(?, os_name), 
                    anydesk_id = COALESCE(?, anydesk_id),
                    needs_reboot = COALESCE(?, needs_reboot), 
                    tpm_status = COALESCE(?, tpm_status), 
                    last_update = NOW()
                    WHERE id = ?");
                    
                $result = $updateStmt->execute([
                    json_encode($specs, JSON_UNESCAPED_UNICODE), 
                    $ip_address, 
                    $hostname, 
                    $os_name, 
                    $anydesk_id, 
                    $needs_reboot, 
                    $tpm_status, 
                    $room_id
                ]);
                
                if ($result) {
                    $updatedCount++;
                }
                
                if (!empty($specs['Software']) && is_array($specs['Software'])) {
                    $pdo->prepare("DELETE FROM installed_software WHERE inventory_id = ?")->execute([$inventory_id]);
                    $insertSoftwareStmt = $pdo->prepare("INSERT INTO installed_software (inventory_id, software_id, version) VALUES (?, ?, ?)");
                    
                    foreach ($specs['Software'] as $softwareString) {
                        $version = null;
                        $name = $softwareString;
                        
                        if (preg_match('/\(v\.\s*([^)]+)\)/', $softwareString, $matches) || 
                            preg_match('/\(([^)]+)\)$/', $softwareString, $matches)) {
                            $version = trim($matches[1]);
                            $name = trim(str_replace($matches[0], '', $softwareString));
                        }
                        
                        $name = trim($name, " \t\n\r\0\x0B,");
                        if (empty($name)) continue;
                        
                        $stmt = $pdo->prepare("SELECT id FROM software_catalog WHERE name = ?");
                        $stmt->execute([$name]);
                        $software_id = $stmt->fetchColumn();
                        
                        if (!$software_id) {
                            $is_critical = 0;
                            $critical_keywords = [
                                'antivirus', 'eset', 'firewall', 'vpn', 'bitlocker', 
                                'tpm', 'security', 'endpoint', 'inspect', 'agent',
                                'Кристал', 'Алмаз', 'ІІТ', 'Крипто', 'Cisco', 'Оберіг', 'Check Point'
                            ];
                            foreach ($critical_keywords as $keyword) {
                                if (stripos($name, $keyword) !== false) { 
                                    $is_critical = 1; 
                                    break; 
                                }
                            }
                            $pdo->prepare("INSERT INTO software_catalog (name, license_type, is_critical) VALUES (?, 'Невідомо', ?)")
                                ->execute([$name, $is_critical]);
                            $software_id = $pdo->lastInsertId();
                        }
                        $insertSoftwareStmt->execute([$inventory_id, $software_id, $version]);
                    }
                }
            }
            
            $pdo->commit();
            echo json_encode([
                "success" => true, 
                "message" => "Оновлено $updatedCount записів",
                "updated" => $updatedCount
            ]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log("Помилка в batch_update_specs: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            http_response_code(500);
            echo json_encode([
                "success" => false, 
                "error" => "Помилка оновлення JSON-специфікацій: " . $e->getMessage()
            ]);
        }
        break;

    case 'add_pc_software':
        try {
            $inventory_id = $data['inventory_id'] ?? null;
            $software_list = $data['software'] ?? [];
            
            if (!$inventory_id) {
                echo json_encode(["error" => "Не вказано ID обладнання"]);
                break;
            }
            
            $pdo->beginTransaction();
            $pdo->prepare("DELETE FROM installed_software WHERE inventory_id = ?")->execute([$inventory_id]);
            
            $insertSoftwareStmt = $pdo->prepare("INSERT INTO installed_software (inventory_id, software_id, version) VALUES (?, ?, ?)");
            $critical_keywords = ['Кристал', 'Алмаз', 'ІІТ', 'Крипто', 'Cisco', 'VPN', 'Оберіг', 'Check Point', 'ESET', 'Endpoint'];
            
            if (is_array($software_list)) {
                foreach ($software_list as $sw) {
                    $name = trim($sw['name']);
                    $version = trim($sw['version'] ?? '');
                    if (empty($name)) continue;
                    
                    $stmt = $pdo->prepare("SELECT id FROM software_catalog WHERE name = ?");
                    $stmt->execute([$name]);
                    $software_id = $stmt->fetchColumn();
                    
                    if (!$software_id) {
                        $is_critical = 0;
                        foreach ($critical_keywords as $keyword) {
                            if (stripos($name, $keyword) !== false) {
                                $is_critical = 1; break;
                            }
                        }
                        $pdo->prepare("INSERT INTO software_catalog (name, license_type, is_critical) VALUES (?, 'Невідомо', ?)")->execute([$name, $is_critical]);
                        $software_id = $pdo->lastInsertId();
                    }
                    $insertSoftwareStmt->execute([$inventory_id, $software_id, $version]);
                }
            }
            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'get_room_by_inventory':
        try {
            $inventory_id = $_GET['inventory_id'] ?? null;
            if (!$inventory_id) {
                echo json_encode(["error" => "Не вказано inventory_id"]);
                break;
            }
            
            $stmt = $pdo->prepare("SELECT id FROM room_assignments WHERE inventory_id = ? LIMIT 1");
            $stmt->execute([$inventory_id]);
            $room_id = $stmt->fetch(PDO::FETCH_ASSOC);
            
            echo json_encode($room_id ?: ["id" => null]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'get_locations':
        try {
            $stmt = $pdo->query("SELECT id, name FROM locations ORDER BY name");
            $locations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($locations);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;

    default:
        http_response_code(404);
        echo json_encode(["error" => "Невідома дія: $action"]);
}
?>