INSERT INTO locations (name)
SELECT DISTINCT location_name 
FROM inventory 
WHERE location_name IS NOT NULL 
  AND location_name != '' 
  AND location_name NOT IN (SELECT name FROM locations);