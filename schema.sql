-- ========================================================
-- Life Free Pro - Daily Reporting & Management System
-- MySQL / MariaDB Database Schema (CloudPanel VPS)
-- ========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table (Admin & Employees)
CREATE TABLE IF NOT EXISTS `lfp_users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(150) DEFAULT '',
  `password` VARCHAR(100) NOT NULL,
  `role` VARCHAR(30) NOT NULL DEFAULT 'employee',
  `designation` VARCHAR(150) DEFAULT 'সেলস অ্যান্ড কাস্টমার সাপোর্ট',
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Reports Table (Daily Work Reports & Drafts)
CREATE TABLE IF NOT EXISTS `lfp_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(20) NOT NULL,
  `day` VARCHAR(50) DEFAULT '',
  `employee_id` VARCHAR(50) NOT NULL,
  `employee_name` VARCHAR(150) NOT NULL,
  `arrival_time` VARCHAR(20) DEFAULT '',
  `departure_time` VARCHAR(20) DEFAULT '',
  `work_steps_json` LONGTEXT,
  `total_confirmed_orders` INT DEFAULT 0,
  `cancelled_orders` INT DEFAULT 0,
  `total_discounts` DECIMAL(12,2) DEFAULT 0.00,
  `followups_count` INT DEFAULT 0,
  `repeat_orders_count` INT DEFAULT 0,
  `fb_posts_count` INT DEFAULT 0,
  `packaging_pcs` INT DEFAULT 0,
  `commission_pcs` INT DEFAULT 0,
  `commission_total_amount` DECIMAL(12,2) DEFAULT 0.00,
  `advance_count` INT DEFAULT 0,
  `advance_total_amount` DECIMAL(12,2) DEFAULT 0.00,
  `eod_status` VARCHAR(50) DEFAULT '',
  `eod_arrival` VARCHAR(20) DEFAULT '',
  `eod_departure` VARCHAR(20) DEFAULT '',
  `eod_tasks_summary` TEXT,
  `eod_challenges` TEXT,
  `eod_tomorrow_plan` TEXT,
  `signature_data` LONGTEXT,
  `status` VARCHAR(30) NOT NULL DEFAULT 'Draft',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_report_date_emp` (`date`, `employee_id`),
  INDEX `idx_reports_date` (`date`),
  INDEX `idx_reports_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Attendance Table
CREATE TABLE IF NOT EXISTS `lfp_attendance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(20) NOT NULL,
  `employee_id` VARCHAR(50) NOT NULL,
  `employee_name` VARCHAR(150) NOT NULL,
  `arrival_time` VARCHAR(20) DEFAULT '',
  `departure_time` VARCHAR(20) DEFAULT '',
  `status` VARCHAR(30) DEFAULT 'Present',
  `late_minutes` INT DEFAULT 0,
  `overtime_hours` DECIMAL(6,2) DEFAULT 0.00,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_att_date_emp` (`date`, `employee_id`),
  INDEX `idx_attendance_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Commissions Table (Upsell & Cross-Sell Tracker)
CREATE TABLE IF NOT EXISTS `lfp_commissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `commission_id` VARCHAR(100) NOT NULL UNIQUE,
  `date` VARCHAR(20) NOT NULL,
  `employee_id` VARCHAR(50) NOT NULL,
  `employee_name` VARCHAR(150) NOT NULL,
  `sl` INT DEFAULT 1,
  `customer_phone` VARCHAR(50) DEFAULT '',
  `product_details` TEXT,
  `pieces` INT DEFAULT 1,
  `commission_amount` DECIMAL(12,2) DEFAULT 0.00,
  `delivery_status` VARCHAR(50) NOT NULL DEFAULT 'Processing',
  `partial_amount` DECIMAL(12,2) DEFAULT 0.00,
  `payout_status` VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
  `payout_date` VARCHAR(50) DEFAULT '',
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_comm_date` (`date`),
  INDEX `idx_comm_emp` (`employee_id`),
  INDEX `idx_comm_delivery` (`delivery_status`),
  INDEX `idx_comm_payout` (`payout_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Advances Table
CREATE TABLE IF NOT EXISTS `lfp_advances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `advance_id` VARCHAR(100) NOT NULL UNIQUE,
  `date` VARCHAR(20) NOT NULL,
  `employee_id` VARCHAR(50) NOT NULL,
  `employee_name` VARCHAR(150) NOT NULL,
  `sl` INT DEFAULT 1,
  `account_name` VARCHAR(100) DEFAULT '',
  `customer_phone` VARCHAR(50) DEFAULT '',
  `amount` DECIMAL(12,2) DEFAULT 0.00,
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_adv_date` (`date`),
  INDEX `idx_adv_emp` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Custom Employee Schedules Table
CREATE TABLE IF NOT EXISTS `lfp_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` VARCHAR(50) NOT NULL UNIQUE,
  `schedule_json` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. System Settings Table
CREATE TABLE IF NOT EXISTS `lfp_settings` (
  `key_name` VARCHAR(100) PRIMARY KEY,
  `value_data` LONGTEXT,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Background Sync Queue Table (Dual-Sync Bridge)
CREATE TABLE IF NOT EXISTS `lfp_sync_queue` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `action_name` VARCHAR(100) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
  `attempts` INT DEFAULT 0,
  `error_message` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_sync_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default initial admin user if not exists
INSERT INTO `lfp_users` (`employee_id`, `name`, `phone`, `password`, `role`, `designation`, `status`)
VALUES ('ADM-001', 'সুপার অ্যাডমিন', '01700000000', '123456', 'admin', 'ব্যবস্থাপনা পরিচালক (MD)', 'active')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;

-- Seed default initial company settings
INSERT INTO `lfp_settings` (`key_name`, `value_data`)
VALUES ('general_settings', '{"company_name":"লাইফ ফ্রি প্রো (Life Free Pro)","company_tagline":"দৈনিক কাজের অগ্রগতি ও জবাবদিহিতা রিপোর্ট","office_hours":"সকাল ১০:০০ – রাত ৮:০০","primary_color":"#007A3D","secondary_color":"#2e7d32","company_logo":"images/logo.svg"}')
ON DUPLICATE KEY UPDATE `updated_at` = CURRENT_TIMESTAMP;

SET FOREIGN_KEY_CHECKS = 1;
