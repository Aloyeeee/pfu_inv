DROP TABLE IF EXISTS `system_notes`;
CREATE TABLE `system_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `note_text` text NOT NULL COMMENT 'Текст примітки',
  `created_at` datetime NOT NULL DEFAULT current_timestamp() COMMENT 'Дата створення',
  `created_by` varchar(255) DEFAULT NULL COMMENT 'Email користувача, який створив',
  `is_private` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 - публічна, 1 - приватна',
  
  -- Зв'язки
  `inventory_id` int(11) DEFAULT NULL,
  `room_assignment_id` int(11) DEFAULT NULL,
  `transfer_id` int(11) DEFAULT NULL,
  `laptop_loan_id` int(11) DEFAULT NULL,
  
  -- Контекст
  `context_status` varchar(50) DEFAULT NULL,
  `context_location` varchar(255) DEFAULT NULL,
  
  PRIMARY KEY (`id`),
  KEY `inventory_id` (`inventory_id`),
  KEY `room_assignment_id` (`room_assignment_id`),
  KEY `transfer_id` (`transfer_id`),
  KEY `laptop_loan_id` (`laptop_loan_id`),
  CONSTRAINT `notes_ibfk_1` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notes_ibfk_2` FOREIGN KEY (`room_assignment_id`) REFERENCES `room_assignments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notes_ibfk_3` FOREIGN KEY (`transfer_id`) REFERENCES `transfer_history` (`id`) ON DELETE SET NULL,
  CONSTRAINT `notes_ibfk_4` FOREIGN KEY (`laptop_loan_id`) REFERENCES `laptop_loans` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;