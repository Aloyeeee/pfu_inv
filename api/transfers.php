<?php
error_reporting(E_ERROR | E_PARSE);

if (empty($data)) {
    $data = json_decode(file_get_contents('php://input'), true) ?: [];
}

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

switch ($action) {
    case 'get_transfers':
        try {
            $stmt = $pdo->query("SELECT t.id, t.date, l1.name as `from`, l2.name as `to`, e1.full_name as sender, e2.full_name as receiver
                                 FROM transfer_history t
                                 LEFT JOIN locations l1 ON t.from_location_id = l1.id
                                 LEFT JOIN locations l2 ON t.to_location_id = l2.id
                                 LEFT JOIN employees e1 ON t.sender_id = e1.id
                                 LEFT JOIN employees e2 ON t.receiver_id = e2.id
                                 ORDER BY t.date DESC");
            $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach($transfers as &$t) {
                $stmtItems = $pdo->prepare("SELECT i.inv_number as inv, c.model_name as model FROM transfer_items ti JOIN inventory i ON ti.inventory_id = i.id JOIN catalog c ON i.model_id = c.id WHERE ti.transfer_id = ?");
                $stmtItems->execute([$t['id']]);
                $t['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode($transfers, JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;

    case 'add_transfer':
        try {
            $pdo->beginTransaction();
            
            $from_loc = getSafeLocationId($pdo, $data['from']); 
            $to_loc = getSafeLocationId($pdo, $data['to']);
            $sender_id = getSafeEmployeeId($pdo, $data['sender']);
            $receiver_id = getSafeEmployeeId($pdo, $data['receiver']);
            
            $stmt = $pdo->prepare("INSERT INTO transfer_history (from_location_id, to_location_id, sender_id, receiver_id) VALUES (?, ?, ?, ?)");
            $stmt->execute([$from_loc, $to_loc, $sender_id, $receiver_id]);
            $transfer_id = $pdo->lastInsertId();
            
            $stmtUpdate = $pdo->prepare("UPDATE inventory SET location_id = ?, mvo_id = ? WHERE id = ?");
            $stmtItem = $pdo->prepare("INSERT INTO transfer_items (transfer_id, inventory_id) VALUES (?, ?)");
            
            foreach ($data['items'] as $item) {
                $stmtUpdate->execute([$to_loc, $receiver_id, $item['id']]);
                $stmtItem->execute([$transfer_id, $item['id']]);
            }
            
            $pdo->commit();
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
}
?>