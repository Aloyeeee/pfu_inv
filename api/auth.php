<?php
switch ($action) {
    case 'login':
        // Шукаємо користувача за логіном (username)
        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1");
        $stmt->execute([trim($data['username'])]);
        $user = $stmt->fetch();

        // Перевіряємо пароль (ми використовували bcrypt)
        if ($user && password_verify($data['password'], $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            echo json_encode(["success" => true, "user" => ["username" => $user['username'], "role" => $user['role']]]);
        } else {
            http_response_code(401);
            echo json_encode(["error" => "Невірний логін або пароль"]);
        }
        break;

    case 'check_session':
        // Перевіряємо, чи користувач вже авторизований при оновленні сторінки
        if (isset($_SESSION['user_id'])) {
            echo json_encode([
                "logged_in" => true, 
                "user" => ["username" => $_SESSION['username'], "role" => $_SESSION['role']]
            ]);
        } else {
            echo json_encode(["logged_in" => false]);
        }
        break;

    case 'logout':
        session_destroy();
        echo json_encode(["success" => true]);
        break;

   case 'wipe_database':
   $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
   $stmt->execute([$_SESSION['username'] ?? '']);
   $user = $stmt->fetch();
   if ($user && password_verify($data['password'], $user['password_hash'])) {
       $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
       $pdo->exec("TRUNCATE TABLE transfer_items; TRUNCATE TABLE transfer_history;");
       $pdo->exec("TRUNCATE TABLE refill_logs; TRUNCATE TABLE laptop_loans;");
       $pdo->exec("TRUNCATE TABLE room_assignments; TRUNCATE TABLE inventory; TRUNCATE TABLE audit_logs;");
       $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");
       echo json_encode(["success" => true]);
   } else {
       http_response_code(401); echo json_encode(["error" => "Невірний пароль адміністратора"]);
   }
   break;
}
?>