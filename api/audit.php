<?php
// api/audit.php

switch ($action) {
    case 'get_audit_logs':
        try {
            $stmt = $pdo->query("SELECT user_email as user, action_type as action, details, timestamp as date 
                                 FROM audit_logs 
                                 ORDER BY timestamp DESC 
                                 LIMIT 500");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        } catch (Exception $e) {
            echo json_encode([]);
        }
        break;
        
    case 'add_audit_log':
        try {
            // Беремо ім'я користувача із сесії
            $user = $_SESSION['username'] ?? 'Система';
            
            $stmt = $pdo->prepare("INSERT INTO audit_logs (user_email, action_type, details) VALUES (?, ?, ?)");
            $stmt->execute([$user, $data['action'], $data['details']]);
            
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            // Логуємо помилку, але не перериваємо роботу
            error_log("Помилка запису в аудит: " . $e->getMessage());
            echo json_encode(["success" => false, "error" => $e->getMessage()]);
        }
        break;
        
    case 'export_audit':
        try {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename=audit_log_' . date('Y-m-d') . '.csv');
            
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM для UTF-8
            
            fputcsv($output, ['Дата та час', 'Користувач', 'Модуль', 'Деталі дії'], ';');
            
            $stmt = $pdo->query("SELECT timestamp, user_email, action_type, details 
                                 FROM audit_logs 
                                 ORDER BY timestamp DESC");
            
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                fputcsv($output, [
                    date('d.m.Y H:i:s', strtotime($row['timestamp'])),
                    $row['user_email'],
                    $row['action_type'],
                    $row['details']
                ], ';');
            }
            
            fclose($output);
            exit;
            
        } catch (Exception $e) {
            echo json_encode(["error" => $e->getMessage()]);
        }
        break;
}
?>