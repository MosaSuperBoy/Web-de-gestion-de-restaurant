CREATE DATABASE IF NOT EXISTS pluto_restau
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pluto_restau;

CREATE TABLE IF NOT EXISTS shop_maintenance (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_shop_maintenance_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO shop_maintenance (id, enabled)
VALUES (1, 0)
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS shop_maintenance_auth_attempts (
  ip_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shop_maintenance_auth_updated_at (updated_at)
) ENGINE=InnoDB;
