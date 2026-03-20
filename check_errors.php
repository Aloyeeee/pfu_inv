<?php
// Перевіряємо чи є помилки в PHP
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Перевірка системи</h1>";

// Перевіряємо підключення до БД
try {
    require_once 'api/db.php';
    echo "<p style='color:green'>✅ Підключення до БД успішне</p>";
    
    // Перевіряємо наявність таблиць
    $tables = $pdo->query("SHOW TABLES")->fetchAll();
    echo "<p>Таблиці в БД: " . count($tables) . "</p>";
    
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Помилка БД: " . $e->getMessage() . "</p>";
}

// Перевіряємо API
echo "<h2>Перевірка API</h2>";

$api_url = 'api.php?action=get_catalog';
echo "<p>Запит до: $api_url</p>";

$ch = curl_init($api_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "<p>HTTP код: $httpCode</p>";

if ($httpCode == 200) {
    $data = json_decode($response, true);
    if ($data === null) {
        echo "<p style='color:red'>❌ Відповідь не є JSON:</p>";
        echo "<pre>" . htmlspecialchars($response) . "</pre>";
    } else {
        echo "<p style='color:green'>✅ JSON валідний</p>";
        echo "<pre>" . print_r($data, true) . "</pre>";
    }
} else {
    echo "<p style='color:red'>❌ Помилка HTTP: $httpCode</p>";
    echo "<pre>" . htmlspecialchars($response) . "</pre>";
}
?>