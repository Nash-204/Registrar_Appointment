-- Migration 003: front desk flag. Run once after 002 (safe to run again).
USE civil_registry;

DROP PROCEDURE IF EXISTS add_front_desk_column;
DELIMITER $$
CREATE PROCEDURE add_front_desk_column()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_front_desk') THEN
    ALTER TABLE users ADD COLUMN is_front_desk TINYINT(1) NOT NULL DEFAULT 0;
  END IF;
END$$
DELIMITER ;
CALL add_front_desk_column();
DROP PROCEDURE add_front_desk_column;
