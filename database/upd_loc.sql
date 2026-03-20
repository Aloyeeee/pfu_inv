-- Знайти дублікати локацій
SELECT name, COUNT(*) as count 
FROM locations 
GROUP BY name 
HAVING count > 1;

-- Об'єднати дублікати (потрібно оновити всі посилання)
-- Спочатку знайдіть ID оригінальної локації та ID дублікатів
-- Потім оновіть всі таблиці, які посилаються на дублікати

-- Наприклад, для локації "ГУ ПФУ в Сумській області м.Суми, вул. С.Бандери,43"
-- ID 1 та ID 41 - це дублікати

-- Оновлюємо всі записи, що посилаються на ID 41, щоб вони посилалися на ID 1
UPDATE inventory SET location_id = 1 WHERE location_id = 41;
UPDATE room_assignments SET location_id = 1 WHERE location_id = 41;
UPDATE printers SET location_id = 1 WHERE location_id = 41;

-- Після оновлення всіх посилань видаляємо дублікат
DELETE FROM locations WHERE id = 41;