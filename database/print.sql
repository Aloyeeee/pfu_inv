-- =============================================
-- Таблиця: printers - принтери/БФП/МФУ
-- =============================================
CREATE TABLE IF NOT EXISTS `printers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) DEFAULT NULL COMMENT 'Посилання на локацію/будівлю',
  `room_number` varchar(20) DEFAULT NULL COMMENT 'Номер кабінету',
  `inventory_id` int(11) DEFAULT NULL COMMENT 'Посилання на інвентар (якщо принтер є в inventory)',
  `printer_model` varchar(255) NOT NULL COMMENT 'Модель принтера',
  `printer_name` varchar(255) DEFAULT NULL COMMENT 'Назва/ім\'я принтера в мережі',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'IP-адреса принтера',
  `serial_number` varchar(100) DEFAULT NULL COMMENT 'Серійний номер',
  `inv_number` varchar(50) DEFAULT NULL COMMENT 'Інвентарний номер',
  `status` enum('working','repair','write-off') DEFAULT 'working' COMMENT 'Стан принтера',
  `notes` text DEFAULT NULL COMMENT 'Примітки до принтера',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `location_id` (`location_id`),
  KEY `inventory_id` (`inventory_id`),
  CONSTRAINT `printers_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `printers_ibfk_2` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Принтери та МФУ';

-- =============================================
-- Таблиця: cartridge_models - моделі картриджів
-- =============================================
CREATE TABLE IF NOT EXISTS `cartridge_models` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'Назва моделі картриджа',
  `compatible_printers` text DEFAULT NULL COMMENT 'Сумісні моделі принтерів (JSON або текст)',
  `color` varchar(50) DEFAULT NULL COMMENT 'Колір (чорний/кольоровий)',
  `yield` int(11) DEFAULT NULL COMMENT 'Ресурс сторінок',
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Моделі картриджів';

-- =============================================
-- Таблиця: cartridges - облік окремих картриджів
-- =============================================
CREATE TABLE IF NOT EXISTS `cartridges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cartridge_model_id` int(11) NOT NULL COMMENT 'Модель картриджа',
  `printer_id` int(11) DEFAULT NULL COMMENT 'Поточний принтер (де встановлено)',
  `barcode` varchar(100) DEFAULT NULL COMMENT 'Штрихкод/номер картриджа',
  `serial_number` varchar(100) DEFAULT NULL COMMENT 'Серійний номер',
  `status` enum('in_use','in_stock','for_refill','refilling','write_off') NOT NULL DEFAULT 'in_stock' COMMENT 'Стан картриджа',
  `location_id` int(11) DEFAULT NULL COMMENT 'Поточна локація (склад/будівля)',
  `room_number` varchar(20) DEFAULT NULL COMMENT 'Номер кабінету (якщо не в принтері)',
  `purchase_date` date DEFAULT NULL COMMENT 'Дата придбання',
  `first_use_date` date DEFAULT NULL COMMENT 'Дата першого використання',
  `refill_count` int(11) NOT NULL DEFAULT 0 COMMENT 'Кількість заправок',
  `notes` text DEFAULT NULL COMMENT 'Примітки',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `barcode` (`barcode`),
  KEY `cartridge_model_id` (`cartridge_model_id`),
  KEY `printer_id` (`printer_id`),
  KEY `location_id` (`location_id`),
  CONSTRAINT `cartridges_ibfk_1` FOREIGN KEY (`cartridge_model_id`) REFERENCES `cartridge_models` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cartridges_ibfk_2` FOREIGN KEY (`printer_id`) REFERENCES `printers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridges_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Окремі картриджі';

-- =============================================
-- Таблиця: cartridge_refills - історія заправок
-- =============================================
CREATE TABLE IF NOT EXISTS `cartridge_refills` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cartridge_id` int(11) NOT NULL COMMENT 'ID картриджа',
  `refill_log_id` int(11) DEFAULT NULL COMMENT 'Посилання на запис в refill_logs',
  `action` enum('sent_to_refill','received_from_refill','installed','removed','write_off') NOT NULL COMMENT 'Дія',
  `from_location_id` int(11) DEFAULT NULL COMMENT 'Звідки',
  `to_location_id` int(11) DEFAULT NULL COMMENT 'Куди',
  `from_printer_id` int(11) DEFAULT NULL COMMENT 'З якого принтера',
  `to_printer_id` int(11) DEFAULT NULL COMMENT 'На який принтер',
  `performed_by` int(11) DEFAULT NULL COMMENT 'Хто виконав (employees.id)',
  `notes` text DEFAULT NULL COMMENT 'Примітки до операції',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `cartridge_id` (`cartridge_id`),
  KEY `refill_log_id` (`refill_log_id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `to_location_id` (`to_location_id`),
  KEY `from_printer_id` (`from_printer_id`),
  KEY `to_printer_id` (`to_printer_id`),
  KEY `performed_by` (`performed_by`),
  CONSTRAINT `cartridge_refills_ibfk_1` FOREIGN KEY (`cartridge_id`) REFERENCES `cartridges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cartridge_refills_ibfk_2` FOREIGN KEY (`refill_log_id`) REFERENCES `refill_logs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_refills_ibfk_3` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_refills_ibfk_4` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_refills_ibfk_5` FOREIGN KEY (`from_printer_id`) REFERENCES `printers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_refills_ibfk_6` FOREIGN KEY (`to_printer_id`) REFERENCES `printers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_refills_ibfk_7` FOREIGN KEY (`performed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Історія руху картриджів';

-- =============================================
-- Таблиця: cartridge_inventory - поточні залишки по локаціях
-- =============================================
CREATE TABLE IF NOT EXISTS `cartridge_inventory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `location_id` int(11) NOT NULL COMMENT 'Локація',
  `cartridge_model_id` int(11) NOT NULL COMMENT 'Модель картриджа',
  `in_use` int(11) NOT NULL DEFAULT 0 COMMENT 'Використовується (в принтерах)',
  `in_stock` int(11) NOT NULL DEFAULT 0 COMMENT 'В запасі (на складі/в кабінеті)',
  `for_refill` int(11) NOT NULL DEFAULT 0 COMMENT 'Очікують заправки',
  `refilling` int(11) NOT NULL DEFAULT 0 COMMENT 'На заправці',
  `total` int(11) GENERATED ALWAYS AS (`in_use` + `in_stock` + `for_refill` + `refilling`) STORED COMMENT 'Загальна кількість',
  `last_updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `location_model` (`location_id`, `cartridge_model_id`),
  KEY `cartridge_model_id` (`cartridge_model_id`),
  CONSTRAINT `cartridge_inventory_ibfk_1` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cartridge_inventory_ibfk_2` FOREIGN KEY (`cartridge_model_id`) REFERENCES `cartridge_models` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Залишки картриджів по локаціях';

-- Додаємо нові колонки в існуючу таблицю refill_logs
ALTER TABLE `refill_logs` 
ADD COLUMN IF NOT EXISTS `batch_number` varchar(50) DEFAULT NULL COMMENT 'Номер партії/заявки',
ADD COLUMN IF NOT EXISTS `status` enum('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'completed' COMMENT 'Статус заявки',
ADD COLUMN IF NOT EXISTS `cartridge_ids` text DEFAULT NULL COMMENT 'JSON з ID картриджів',
ADD COLUMN IF NOT EXISTS `received_date` datetime DEFAULT NULL COMMENT 'Дата отримання з заправки',
ADD COLUMN IF NOT EXISTS `received_by` int(11) DEFAULT NULL COMMENT 'Хто прийняв',
ADD COLUMN IF NOT EXISTS `notes` text DEFAULT NULL COMMENT 'Примітки до заявки',
ADD INDEX `idx_batch` (`batch_number`),
ADD INDEX `idx_status` (`status`),
ADD FOREIGN KEY (`received_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

-- Індекси для швидкого пошуку
CREATE INDEX idx_cartridges_status ON cartridges(status);
CREATE INDEX idx_cartridges_barcode ON cartridges(barcode);
CREATE INDEX idx_cartridge_refills_date ON cartridge_refills(created_at);
CREATE INDEX idx_cartridge_refills_action ON cartridge_refills(action);
CREATE INDEX idx_printers_location ON printers(location_id, room_number);

-- Додаємо нові статуси для картриджів
ALTER TABLE `cartridges` MODIFY COLUMN `status` enum(
    'in_use',           -- В роботі (в принтері)
    'in_stock',         -- В запасі (на складі)
    'for_refill',       -- Очікує заправки
    'refilling',        -- На заправці
    'broken',           -- Поломаний (не підлягає ремонту)
    'write_off'         -- Списано
) NOT NULL DEFAULT 'in_stock';

-- Додаємо поле для позначення проблемних картриджів
ALTER TABLE `cartridges` ADD COLUMN IF NOT EXISTS `is_defective` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 - робочий, 1 - дефектний/поломаний';
ALTER TABLE `cartridges` ADD COLUMN IF NOT EXISTS `defect_reason` text DEFAULT NULL COMMENT 'Причина дефекту/поломки';

-- Таблиця для швидкого переміщення картриджів
CREATE TABLE IF NOT EXISTS `cartridge_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cartridge_id` int(11) NOT NULL,
  `from_location_id` int(11) DEFAULT NULL,
  `to_location_id` int(11) DEFAULT NULL,
  `from_printer_id` int(11) DEFAULT NULL,
  `to_printer_id` int(11) DEFAULT NULL,
  `movement_type` enum('transfer','install','remove','refill_send','refill_receive','write_off') NOT NULL,
  `performed_by` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `cartridge_id` (`cartridge_id`),
  KEY `from_location_id` (`from_location_id`),
  KEY `to_location_id` (`to_location_id`),
  KEY `from_printer_id` (`from_printer_id`),
  KEY `to_printer_id` (`to_printer_id`),
  KEY `performed_by` (`performed_by`),
  CONSTRAINT `cartridge_movements_ibfk_1` FOREIGN KEY (`cartridge_id`) REFERENCES `cartridges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cartridge_movements_ibfk_2` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_movements_ibfk_3` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_movements_ibfk_4` FOREIGN KEY (`from_printer_id`) REFERENCES `printers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_movements_ibfk_5` FOREIGN KEY (`to_printer_id`) REFERENCES `printers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartridge_movements_ibfk_6` FOREIGN KEY (`performed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Швидкі переміщення картриджів';