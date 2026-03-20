<?php
function getEmployeeId($pdo, $name) {
    if (!$name || trim($name) === '' || $name === 'Не призначено') return null;
    $stmt = $pdo->prepare("SELECT id FROM employees WHERE full_name = ?");
    $stmt->execute([trim($name)]);
    $id = $stmt->fetchColumn();
    if (!$id) {
        $stmt = $pdo->prepare("INSERT INTO employees (full_name, is_mvo) VALUES (?, 1)");
        $stmt->execute([trim($name)]);
        return $pdo->lastInsertId();
    }
    return $id;
}

function getModelId($pdo, $type, $model) {
    $stmt = $pdo->prepare("SELECT id FROM equipment_types WHERE name = ?");
    $stmt->execute([trim($type)]);
    $type_id = $stmt->fetchColumn();
    if (!$type_id) {
        $stmt = $pdo->prepare("INSERT INTO equipment_types (name) VALUES (?)");
        $stmt->execute([trim($type)]);
        $type_id = $pdo->lastInsertId();
    }
    
    $stmt = $pdo->prepare("SELECT id FROM catalog WHERE type_id = ? AND model_name = ?");
    $stmt->execute([$type_id, trim($model)]);
    $model_id = $stmt->fetchColumn();
    if (!$model_id) {
        $stmt = $pdo->prepare("INSERT INTO catalog (type_id, model_name) VALUES (?, ?)");
        $stmt->execute([$type_id, trim($model)]);
        $model_id = $pdo->lastInsertId();
    }
    return $model_id;
}

function getLocationId($pdo, $name) {
   if (!$name || trim($name) === '') return null;
   $stmt = $pdo->prepare("SELECT id FROM locations WHERE name = ?");
   $stmt->execute([trim($name)]);
   $id = $stmt->fetchColumn();
   if (!$id) {
       $stmt = $pdo->prepare("INSERT INTO locations (name) VALUES (?)");
       $stmt->execute([trim($name)]);
       return $pdo->lastInsertId();
   }
   return $id;
}

?>