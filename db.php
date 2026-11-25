<?php
/**
 * Life Free Pro - Database Connection & Abstraction Layer
 * Supports MySQL / MariaDB (CloudPanel) and SQLite with automatic fallback.
 */

class LfpDatabase {
    private static ?PDO $pdo = null;
    private static string $driver = 'none';
    private static array $config = [];

    public static function init(): ?PDO {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $configPath = __DIR__ . '/config.json';
        if (file_exists($configPath)) {
            $raw = file_get_contents($configPath);
            self::$config = json_decode($raw, true) ?: [];
        }

        $dbConfig = self::$config['db'] ?? [];
        $dbType = strtolower($dbConfig['type'] ?? 'mysql');

        // 1. Try MySQL / MariaDB first if configured
        if ($dbType === 'mysql' || (!empty($dbConfig['host']) && !empty($dbConfig['dbname']))) {
            try {
                $host = $dbConfig['host'] ?? '127.0.0.1';
                $port = $dbConfig['port'] ?? 3306;
                $dbname = $dbConfig['dbname'] ?? '';
                $user = $dbConfig['user'] ?? '';
                $pass = $dbConfig['pass'] ?? '';

                if (!empty($dbname) && !empty($user)) {
                    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
                    $options = [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
                    ];
                    self::$pdo = new PDO($dsn, $user, $pass, $options);
                    self::$driver = 'mysql';
                    self::ensureTables();
                    return self::$pdo;
                }
            } catch (Exception $e) {
                error_log("LFP MySQL Connection failed: " . $e->getMessage() . " - Falling back to SQLite.");
            }
        }

        // 2. Fallback to SQLite (1-Click, zero external dependencies)
        try {
            $dataDir = __DIR__ . '/data';
            if (!is_dir($dataDir)) {
                @mkdir($dataDir, 0755, true);
            }
            $sqliteFile = $dataDir . '/lfp_database.sqlite';
            $dsn = "sqlite:" . $sqliteFile;
            self::$pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]);
            self::$driver = 'sqlite';
            self::ensureTables();
            return self::$pdo;
        } catch (Exception $e) {
            error_log("LFP SQLite Connection failed: " . $e->getMessage());
            return null;
        }
    }

    public static function getDriver(): string {
        return self::$driver;
    }

    public static function isConnected(): bool {
        return self::$pdo !== null;
    }

    /**
     * Auto-ensure database tables exist for both MySQL and SQLite
     */
    public static function ensureTables(): void {
        if (!self::$pdo) return;

        if (self::$driver === 'mysql') {
            try {
                self::$pdo->exec("
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
                      INDEX `idx_reports_date` (`date`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
                      INDEX `idx_comm_emp` (`employee_id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

                    CREATE TABLE IF NOT EXISTS `lfp_schedules` (
                      `id` INT AUTO_INCREMENT PRIMARY KEY,
                      `employee_id` VARCHAR(50) NOT NULL UNIQUE,
                      `schedule_json` LONGTEXT NOT NULL,
                      `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

                    CREATE TABLE IF NOT EXISTS `lfp_settings` (
                      `key_name` VARCHAR(100) PRIMARY KEY,
                      `value_data` LONGTEXT,
                      `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
                ");

                // Seed default admin if empty
                $adminCheck = self::$pdo->query("SELECT COUNT(*) FROM lfp_users WHERE role='admin'")->fetchColumn();
                if (!$adminCheck) {
                    self::$pdo->exec("
                        INSERT INTO lfp_users (employee_id, name, phone, password, role, designation, status)
                        VALUES ('ADM-001', 'সুপার অ্যাডমিন', '01700000000', '123456', 'admin', 'ব্যবস্থাপনা পরিচালক (MD)', 'active')
                        ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
                    ");
                }
            } catch (Exception $e) {
                error_log("LFP MySQL ensureTables error: " . $e->getMessage());
            }
        } elseif (self::$driver === 'sqlite') {
            try {
                self::$pdo->exec("
                    CREATE TABLE IF NOT EXISTS lfp_users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        employee_id TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        phone TEXT NOT NULL,
                        email TEXT DEFAULT '',
                        password TEXT NOT NULL,
                        role TEXT DEFAULT 'employee',
                        designation TEXT DEFAULT '',
                        status TEXT DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS lfp_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT NOT NULL,
                        day TEXT DEFAULT '',
                        employee_id TEXT NOT NULL,
                        employee_name TEXT NOT NULL,
                        arrival_time TEXT DEFAULT '',
                        departure_time TEXT DEFAULT '',
                        work_steps_json TEXT,
                        total_confirmed_orders INTEGER DEFAULT 0,
                        cancelled_orders INTEGER DEFAULT 0,
                        total_discounts REAL DEFAULT 0,
                        followups_count INTEGER DEFAULT 0,
                        repeat_orders_count INTEGER DEFAULT 0,
                        fb_posts_count INTEGER DEFAULT 0,
                        packaging_pcs INTEGER DEFAULT 0,
                        commission_pcs INTEGER DEFAULT 0,
                        commission_total_amount REAL DEFAULT 0,
                        advance_count INTEGER DEFAULT 0,
                        advance_total_amount REAL DEFAULT 0,
                        eod_status TEXT DEFAULT '',
                        eod_arrival TEXT DEFAULT '',
                        eod_departure TEXT DEFAULT '',
                        eod_tasks_summary TEXT,
                        eod_challenges TEXT,
                        eod_tomorrow_plan TEXT,
                        signature_data TEXT,
                        status TEXT DEFAULT 'Draft',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(date, employee_id)
                    );

                    CREATE TABLE IF NOT EXISTS lfp_attendance (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT NOT NULL,
                        employee_id TEXT NOT NULL,
                        employee_name TEXT NOT NULL,
                        arrival_time TEXT DEFAULT '',
                        departure_time TEXT DEFAULT '',
                        status TEXT DEFAULT 'Present',
                        late_minutes INTEGER DEFAULT 0,
                        overtime_hours REAL DEFAULT 0,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(date, employee_id)
                    );

                    CREATE TABLE IF NOT EXISTS lfp_commissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        commission_id TEXT UNIQUE NOT NULL,
                        date TEXT NOT NULL,
                        employee_id TEXT NOT NULL,
                        employee_name TEXT NOT NULL,
                        sl INTEGER DEFAULT 1,
                        customer_phone TEXT DEFAULT '',
                        product_details TEXT,
                        pieces INTEGER DEFAULT 1,
                        commission_amount REAL DEFAULT 0,
                        delivery_status TEXT DEFAULT 'Processing',
                        partial_amount REAL DEFAULT 0,
                        payout_status TEXT DEFAULT 'Unpaid',
                        payout_date TEXT DEFAULT '',
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS lfp_advances (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        advance_id TEXT UNIQUE NOT NULL,
                        date TEXT NOT NULL,
                        employee_id TEXT NOT NULL,
                        employee_name TEXT NOT NULL,
                        sl INTEGER DEFAULT 1,
                        account_name TEXT DEFAULT '',
                        customer_phone TEXT DEFAULT '',
                        amount REAL DEFAULT 0,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS lfp_schedules (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        employee_id TEXT UNIQUE NOT NULL,
                        schedule_json TEXT NOT NULL,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS lfp_settings (
                        key_name TEXT PRIMARY KEY,
                        value_data TEXT,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS lfp_sync_queue (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        action_name TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        attempts INTEGER DEFAULT 0,
                        error_message TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                ");

                // Seed default admin if empty
                $adminCheck = self::$pdo->query("SELECT COUNT(*) FROM lfp_users WHERE role='admin'")->fetchColumn();
                if (!$adminCheck) {
                    self::$pdo->exec("
                        INSERT INTO lfp_users (employee_id, name, phone, password, role, designation, status)
                        VALUES ('ADM-001', 'সুপার অ্যাডমিন', '01700000000', '123456', 'admin', 'ব্যবস্থাপনা পরিচালক (MD)', 'active')
                    ");
                }
            } catch (Exception $e) {
                error_log("LFP SQLite ensureTables error: " . $e->getMessage());
            }
        }
    }

    /**
     * Add action to non-blocking background Google Sheets Sync Queue
     */
    public static function enqueueSync(string $action, array $data): int {
        if (!self::$pdo) return 0;
        try {
            if (self::$driver === 'mysql') {
                $stmt = self::$pdo->prepare("
                    INSERT INTO lfp_sync_queue (action_name, payload_json, status, created_at, updated_at)
                    VALUES (:action, :payload, 'pending', NOW(), NOW())
                ");
            } else {
                $stmt = self::$pdo->prepare("
                    INSERT INTO lfp_sync_queue (action_name, payload_json, status, created_at, updated_at)
                    VALUES (:action, :payload, 'pending', datetime('now'), datetime('now'))
                ");
            }
            $stmt->execute([
                ':action' => $action,
                ':payload' => json_encode($data, JSON_UNESCAPED_UNICODE)
            ]);
            return (int)self::$pdo->lastInsertId();
        } catch (Exception $e) {
            error_log("LFP enqueueSync error: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Trigger background sync asynchronously (non-blocking, client doesn't wait!)
     */
    public static function triggerBackgroundSyncAsync(): void {
        $syncUrl = '';
        if (!empty($_SERVER['HTTP_HOST'])) {
            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $dir = dirname($_SERVER['SCRIPT_NAME']);
            $syncUrl = $scheme . '://' . $_SERVER['HTTP_HOST'] . rtrim($dir, '/\\') . '/sync.php?key=lfp_instant_sync';
        }

        if ($syncUrl) {
            // Non-blocking cURL with 300ms timeout
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $syncUrl);
            curl_setopt($ch, CURLOPT_TIMEOUT_MS, 300);
            curl_setopt($ch, CURLOPT_NOSIGNAL, 1);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
            @curl_exec($ch);
            @curl_close($ch);
        }
    }
}
