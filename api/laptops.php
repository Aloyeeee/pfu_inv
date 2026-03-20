<?php
switch ($action) {
    case 'get_laptops':
        $laptops = $pdo->query("SELECT * FROM laptop_loans ORDER BY issue_date DESC")->fetchAll(PDO::FETCH_ASSOC);
        $res = [];
        foreach($laptops as $l) {
            $details = $l['details_json'] ? json_decode($l['details_json'], true) : [];
            $res[] = array_merge($details, [
                'id' => $l['id'], 
                'status' => $l['status'], 
                'date' => $l['issue_date'], 
                'returnDate' => $l['return_date']
            ]);
        }
        echo json_encode($res, JSON_UNESCAPED_UNICODE);
        break;
        
    case 'add_laptop':
        try {
            // Конвертуємо ISO дату в MySQL формат
            $issueDate = date('Y-m-d H:i:s', strtotime($data['date']));
            $details_json = json_encode($data, JSON_UNESCAPED_UNICODE);
            
            $stmt = $pdo->prepare("INSERT INTO laptop_loans (issue_date, status, details_json) VALUES (?, 'issued', ?)");
            $stmt->execute([$issueDate, $details_json]);
            
            echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
        
    case 'return_laptop':
        try {
            $stmt = $pdo->prepare("SELECT details_json FROM laptop_loans WHERE id = ?"); 
            $stmt->execute([$data['id']]);
            $details = json_decode($stmt->fetchColumn(), true);
            
            $details['returnLocation'] = $data['returnLocation']; 
            $details['receivedBy'] = $data['receivedBy'];
            $details['receiverTitle'] = $data['receivedByTitle'] ?? ''; 
            $details['receiverDir'] = $data['receivedByDir'] ?? ''; 
            $details['receiverDept'] = $data['receivedByDept'] ?? '';
            
            // Конвертуємо дату повернення
            $returnDate = date('Y-m-d H:i:s', strtotime($data['returnDate']));
            
            $stmt = $pdo->prepare("UPDATE laptop_loans SET status = 'returned', return_date = ?, details_json = ? WHERE id = ?");
            $stmt->execute([$returnDate, json_encode($details, JSON_UNESCAPED_UNICODE), $data['id']]);
            
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
}
?>