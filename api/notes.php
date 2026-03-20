<?php
// api/notes.php
switch ($action) {
   case 'get_notes':
      try {
          $sql = "SELECT n.*, u.username as creator_name, u.role as creator_role
                  FROM system_notes n
                  LEFT JOIN users u ON n.created_by = u.username
                  WHERE 1=1 ";
          $params = [];

          // Фільтри за типом об'єкта
          if (isset($_GET['inventory_id']) && $_GET['inventory_id']) {
              $sql .= " AND n.inventory_id = ?";
              $params[] = $_GET['inventory_id'];
          }
          if (isset($_GET['room_id']) && $_GET['room_id']) {
              $sql .= " AND n.room_assignment_id = ?";
              $params[] = $_GET['room_id'];
          }
          if (isset($_GET['transfer_id']) && $_GET['transfer_id']) {
              $sql .= " AND n.transfer_id = ?";
              $params[] = $_GET['transfer_id'];
          }
          if (isset($_GET['laptop_id']) && $_GET['laptop_id']) {
              $sql .= " AND n.laptop_loan_id = ?";
              $params[] = $_GET['laptop_id'];
          }
          
          if (empty($params)) {
              $sql .= " ORDER BY n.created_at DESC LIMIT 500";
              $stmt = $pdo->query($sql);
          } else {
              $sql .= " ORDER BY n.created_at DESC";
              $stmt = $pdo->prepare($sql);
              $stmt->execute($params);
          }
          
          $notes = $stmt->fetchAll(PDO::FETCH_ASSOC);
          
          // Додаємо детальну інформацію про кожен об'єкт
          foreach ($notes as &$note) {
              if ($note['inventory_id']) {
                  $stmt2 = $pdo->prepare("
                      SELECT i.id, i.inv_number, i.serial_number, c.model_name, e.name as type, 
                             i.location_name, i.status, i.price,
                             CONCAT('inventory-', i.id) as unique_id
                      FROM inventory i 
                      JOIN catalog c ON i.model_id = c.id 
                      JOIN equipment_types e ON c.type_id = e.id
                      WHERE i.id = ?
                  ");
                  $stmt2->execute([$note['inventory_id']]);
                  $note['object_details'] = $stmt2->fetch(PDO::FETCH_ASSOC);
                  $note['object_type'] = 'inventory';
                  $note['object_name'] = $note['object_details']['model_name'] ?? 'Техніка';
                  $note['object_location'] = $note['object_details']['location_name'] ?? '';
                  
              } elseif ($note['room_assignment_id']) {
                  $stmt2 = $pdo->prepare("
                      SELECT ra.id, ra.room_number, ra.hostname, ra.ip_address, 
                             l.name as location_name, i.inv_number, c.model_name,
                             CONCAT('room-', ra.id) as unique_id
                      FROM room_assignments ra
                      LEFT JOIN locations l ON ra.location_id = l.id
                      LEFT JOIN inventory i ON ra.inventory_id = i.id
                      LEFT JOIN catalog c ON i.model_id = c.id
                      WHERE ra.id = ?
                  ");
                  $stmt2->execute([$note['room_assignment_id']]);
                  $note['object_details'] = $stmt2->fetch(PDO::FETCH_ASSOC);
                  $note['object_type'] = 'room';
                  $note['object_name'] = 'Каб. ' . ($note['object_details']['room_number'] ?? '?');
                  $note['object_location'] = $note['object_details']['location_name'] ?? '';
                  
              } elseif ($note['transfer_id']) {
                  $stmt2 = $pdo->prepare("
                      SELECT th.id, th.date, l1.name as from_location, l2.name as to_location,
                             e1.full_name as sender, e2.full_name as receiver,
                             CONCAT('transfer-', th.id) as unique_id
                      FROM transfer_history th
                      LEFT JOIN locations l1 ON th.from_location_id = l1.id
                      LEFT JOIN locations l2 ON th.to_location_id = l2.id
                      LEFT JOIN employees e1 ON th.sender_id = e1.id
                      LEFT JOIN employees e2 ON th.receiver_id = e2.id
                      WHERE th.id = ?
                  ");
                  $stmt2->execute([$note['transfer_id']]);
                  $note['object_details'] = $stmt2->fetch(PDO::FETCH_ASSOC);
                  $note['object_type'] = 'transfer';
                  $note['object_name'] = 'Переміщення';
                  $note['object_location'] = ($note['object_details']['from_location'] ?? '?') . ' → ' . ($note['object_details']['to_location'] ?? '?');
                  
              } elseif ($note['laptop_loan_id']) {
                  $stmt2 = $pdo->prepare("
                      SELECT ll.id, ll.issue_date, ll.status, ll.details_json,
                             JSON_UNQUOTE(JSON_EXTRACT(ll.details_json, '$.model')) as model,
                             JSON_UNQUOTE(JSON_EXTRACT(ll.details_json, '$.inv')) as inv_number,
                             JSON_UNQUOTE(JSON_EXTRACT(ll.details_json, '$.encryptedFor')) as user_name,
                             CONCAT('laptop-', ll.id) as unique_id
                      FROM laptop_loans ll
                      WHERE ll.id = ?
                  ");
                  $stmt2->execute([$note['laptop_loan_id']]);
                  $note['object_details'] = $stmt2->fetch(PDO::FETCH_ASSOC);
                  $note['object_type'] = 'laptop';
                  $note['object_name'] = $note['object_details']['model'] ?? 'Ноутбук';
                  $note['object_location'] = $note['object_details']['user_name'] ?? '';
              }
          }
          
          echo json_encode($notes);
          
      } catch (Exception $e) {
          http_response_code(500);
          echo json_encode(["error" => $e->getMessage()]);
      }
      break;

    case 'add_note':
        try {
            // Перевірка авторизації
            if (!isset($_SESSION['user_id'])) {
                http_response_code(401);
                echo json_encode(["error" => "Не авторизований"]);
                break;
            }
            
            // Валідація
            if (empty($data['note_text'])) {
                http_response_code(400);
                echo json_encode(["error" => "Текст примітки обов'язковий"]);
                break;
            }
            
            // Перевірка прав для приватних приміток
            $isPrivate = isset($data['is_private']) ? (int)$data['is_private'] : 0;
            if ($isPrivate && $_SESSION['role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(["error" => "Тільки адміністратори можуть створювати приватні примітки"]);
                break;
            }
            
            // Підготовка запиту - БЕЗ refill_id
            $sql = "INSERT INTO system_notes 
                    (note_text, created_by, is_private, 
                     inventory_id, room_assignment_id, transfer_id, laptop_loan_id,
                     context_status, context_location) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $pdo->prepare($sql);
            
            $success = $stmt->execute([
                $data['note_text'],
                $_SESSION['username'] ?? 'Система',
                $isPrivate,
                $data['inventory_id'] ?? null,
                $data['room_id'] ?? null,
                $data['transfer_id'] ?? null,
                $data['laptop_id'] ?? null,
                $data['context_status'] ?? null,
                $data['context_location'] ?? null
            ]);
            
            if ($success) {
                // Логуємо в аудит
                $auditStmt = $pdo->prepare("INSERT INTO audit_logs (user_email, action_type, details) VALUES (?, ?, ?)");
                $auditStmt->execute([
                    $_SESSION['username'],
                    'Додавання примітки',
                    'Додано примітку: ' . mb_substr($data['note_text'], 0, 50) . '...'
                ]);
                
                echo json_encode([
                    "success" => true, 
                    "id" => $pdo->lastInsertId(),
                    "message" => "Примітку успішно додано"
                ]);
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Не вдалося додати примітку"]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'delete_note':
        try {
            // Тільки адмін може видаляти
            if ($_SESSION['role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(["error" => "Недостатньо прав"]);
                break;
            }
            
            $stmt = $pdo->prepare("DELETE FROM system_notes WHERE id = ?");
            $stmt->execute([$data['id']]);
            
            echo json_encode(["success" => true]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
}
?>