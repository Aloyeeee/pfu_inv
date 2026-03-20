<?php
$host = '127.0.0.1:3306'; // Якщо порт 3307
$db   = 'pfu_inventory';
$user = 'root';
$pass = 'secret';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try { 
    $pdo = new PDO($dsn, $user, $pass, $options); 
} catch (\PDOException $e) { 
    // ПОВЕРТАЄМО JSON, А НЕ ТЕКСТ
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["error" => "Помилка БД: " . $e->getMessage()]); 
    exit; 
}
?>