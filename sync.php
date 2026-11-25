<?php
/**
 * Life Free Pro - Background Dual-Sync Engine
 * Synchronizes local database (MySQL / SQLite) with Google Sheets.
 * Can be run via Cron Job, async HTTP trigger, or Admin Manual Sync.
 */

// Allow longer execution for batch sync
set_time_limit(180);
ignore_user_abort(true);

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/db.php';

$pdo = LfpDatabase::init();
if (!$pdo) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit;
}

// Read configuration
$configPath = __DIR__ . '/config.json';
$config = [];
if (file_exists($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
}

$gasUrl = trim($config['googleWebAppUrl'] ?? '');
if (empty($gasUrl)) {
    echo json_encode(['success' => false, 'message' => 'Google Apps Script URL is not configured.']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'processQueue';

/**
 * Helper to call Google Apps Script
 */
function callGoogleAppsScript(string $gasUrl, array $payload): array {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
    curl_setopt($ch, CURLOPT_URL, $gasUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 6);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/plain;charset=utf-8']);
    curl_setopt($ch, CURLOPT_USERAGENT, 'LFP-DualSync-Worker/3.5');

    $resp = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        return ['success' => false, 'message' => 'cURL Error: ' . $err];
    }
    $decoded = json_decode($resp, true);
    return is_array($decoded) ? $decoded : ['success' => true, 'raw' => $resp];
}

// --------------------------------------------------------------------------
// 1. PULL ALL DATA FROM GOOGLE SHEETS INTO LOCAL DATABASE (Full Import/Sync)
// --------------------------------------------------------------------------
if ($action === 'pullFromGoogle') {
    $importStats = [
        'users' => 0,
        'reports' => 0,
        'attendance' => 0,
        'commissions' => 0,
        'schedules' => 0,
        'settings' => 0
    ];

    try {
        // A. Import Users
        $empRes = callGoogleAppsScript($gasUrl, ['action' => 'getEmployees']);
        if (!empty($empRes['employees']) && is_array($empRes['employees'])) {
            $userStmt = $pdo->prepare("
                INSERT INTO lfp_users (employee_id, name, phone, email, password, role, designation, status)
                VALUES (:employee_id, :name, :phone, :email, :password, :role, :designation, :status)
                ON CONFLICT(employee_id) DO UPDATE SET
                    name = excluded.name,
                    phone = excluded.phone,
                    email = excluded.email,
                    password = excluded.password,
                    role = excluded.role,
                    designation = excluded.designation,
                    status = excluded.status
            ");
            if (LfpDatabase::getDriver() === 'mysql') {
                $userStmt = $pdo->prepare("
                    INSERT INTO lfp_users (employee_id, name, phone, email, password, role, designation, status)
                    VALUES (:employee_id, :name, :phone, :email, :password, :role, :designation, :status)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
                        password = VALUES(password), role = VALUES(role), designation = VALUES(designation), status = VALUES(status)
                ");
            }
            foreach ($empRes['employees'] as $u) {
                $userStmt->execute([
                    ':employee_id' => $u['employeeId'] ?? '',
                    ':name' => $u['name'] ?? '',
                    ':phone' => $u['phone'] ?? '',
                    ':email' => $u['email'] ?? '',
                    ':password' => $u['password'] ?? '',
                    ':role' => $u['role'] ?? 'employee',
                    ':designation' => $u['designation'] ?? '',
                    ':status' => $u['status'] ?? 'active'
                ]);
                $importStats['users']++;
            }
        }

        // B. Import Commissions
        $commRes = callGoogleAppsScript($gasUrl, ['action' => 'getCommissions']);
        if (!empty($commRes['items']) && is_array($commRes['items'])) {
            $commStmt = $pdo->prepare("
                INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount, delivery_status, partial_amount, payout_status, payout_date, notes)
                VALUES (:comm_id, :date, :emp_id, :emp_name, :sl, :phone, :prod, :pcs, :amount, :deliv, :part, :payout, :payout_date, :notes)
                ON CONFLICT(commission_id) DO UPDATE SET
                    delivery_status = excluded.delivery_status,
                    partial_amount = excluded.partial_amount,
                    payout_status = excluded.payout_status,
                    payout_date = excluded.payout_date
            ");
            if (LfpDatabase::getDriver() === 'mysql') {
                $commStmt = $pdo->prepare("
                    INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount, delivery_status, partial_amount, payout_status, payout_date, notes)
                    VALUES (:comm_id, :date, :emp_id, :emp_name, :sl, :phone, :prod, :pcs, :amount, :deliv, :part, :payout, :payout_date, :notes)
                    ON DUPLICATE KEY UPDATE
                        delivery_status = VALUES(delivery_status),
                        partial_amount = VALUES(partial_amount),
                        payout_status = VALUES(payout_status),
                        payout_date = VALUES(payout_date)
                ");
            }
            foreach ($commRes['items'] as $item) {
                $commStmt->execute([
                    ':comm_id' => $item['commissionId'] ?? uniqid('comm_'),
                    ':date' => $item['date'] ?? date('Y-m-d'),
                    ':emp_id' => $item['employeeId'] ?? '',
                    ':emp_name' => $item['employeeName'] ?? '',
                    ':sl' => (int)($item['sl'] ?? 1),
                    ':phone' => $item['customerPhone'] ?? '',
                    ':prod' => $item['productDetails'] ?? '',
                    ':pcs' => (int)($item['pieces'] ?? 1),
                    ':amount' => (float)($item['commissionAmount'] ?? 0),
                    ':deliv' => $item['deliveryStatus'] ?? 'Processing',
                    ':part' => (float)($item['partialAmount'] ?? 0),
                    ':payout' => $item['payoutStatus'] ?? 'Unpaid',
                    ':payout_date' => $item['payoutDate'] ?? '',
                    ':notes' => $item['notes'] ?? ''
                ]);
                $importStats['commissions']++;
            }
        }

        // C. Import Attendance
        $attRes = callGoogleAppsScript($gasUrl, ['action' => 'getAttendance', 'month' => date('Y-m')]);
        if (!empty($attRes['records']) && is_array($attRes['records'])) {
            $attStmt = $pdo->prepare("
                INSERT INTO lfp_attendance (date, employee_id, employee_name, arrival_time, departure_time, status, late_minutes, overtime_hours, notes)
                VALUES (:date, :emp_id, :emp_name, :arr, :dep, :status, :late, :ot, :notes)
                ON CONFLICT(date, employee_id) DO UPDATE SET
                    arrival_time = excluded.arrival_time,
                    departure_time = excluded.departure_time,
                    status = excluded.status,
                    late_minutes = excluded.late_minutes,
                    overtime_hours = excluded.overtime_hours
            ");
            if (LfpDatabase::getDriver() === 'mysql') {
                $attStmt = $pdo->prepare("
                    INSERT INTO lfp_attendance (date, employee_id, employee_name, arrival_time, departure_time, status, late_minutes, overtime_hours, notes)
                    VALUES (:date, :emp_id, :emp_name, :arr, :dep, :status, :late, :ot, :notes)
                    ON DUPLICATE KEY UPDATE
                        arrival_time = VALUES(arrival_time),
                        departure_time = VALUES(departure_time),
                        status = VALUES(status),
                        late_minutes = VALUES(late_minutes),
                        overtime_hours = VALUES(overtime_hours)
                ");
            }
            foreach ($attRes['records'] as $r) {
                $attStmt->execute([
                    ':date' => $r['date'] ?? '',
                    ':emp_id' => $r['employeeId'] ?? '',
                    ':emp_name' => $r['employeeName'] ?? '',
                    ':arr' => $r['arrivalTime'] ?? '',
                    ':dep' => $r['departureTime'] ?? '',
                    ':status' => $r['status'] ?? 'Present',
                    ':late' => (int)($r['lateMinutes'] ?? 0),
                    ':ot' => (float)($r['overtimeHours'] ?? 0),
                    ':notes' => $r['notes'] ?? ''
                ]);
                $importStats['attendance']++;
            }
        }

        // D. Import Settings
        $settRes = callGoogleAppsScript($gasUrl, ['action' => 'getSettings']);
        if (!empty($settRes['settings']) && is_array($settRes['settings'])) {
            $settStmt = $pdo->prepare("
                INSERT INTO lfp_settings (key_name, value_data)
                VALUES ('general_settings', :val)
                ON CONFLICT(key_name) DO UPDATE SET value_data = excluded.value_data
            ");
            if (LfpDatabase::getDriver() === 'mysql') {
                $settStmt = $pdo->prepare("
                    INSERT INTO lfp_settings (key_name, value_data)
                    VALUES ('general_settings', :val)
                    ON DUPLICATE KEY UPDATE value_data = VALUES(value_data)
                ");
            }
            $settStmt->execute([':val' => json_encode($settRes['settings'], JSON_UNESCAPED_UNICODE)]);
            $importStats['settings']++;
        }

        echo json_encode([
            'success' => true,
            'message' => 'গুগল শিট থেকে সফলভাবে সকল ডেটা লোকাল ডেটাবেসে ইম্পোর্ট ও সিঙ্ক করা হয়েছে!',
            'stats' => $importStats
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'ইম্পোর্ট ত্রুটি: ' . $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// --------------------------------------------------------------------------
// 2. PROCESS OUTBOUND SYNC QUEUE (Push local pending items to Google Sheets)
// --------------------------------------------------------------------------
$limit = (int)($_GET['limit'] ?? 25);
$stmt = $pdo->prepare("SELECT * FROM lfp_sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT :limit");
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->execute();
$items = $stmt->fetchAll();

if (empty($items)) {
    echo json_encode([
        'success' => true,
        'message' => 'সিঙ্ক কিউ খালি। গুগল শিটের সাথে সকল ডেটা আপ-টু-ডেট আছে।',
        'processed' => 0
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$processed = 0;
$failed = 0;

foreach ($items as $item) {
    $itemId = $item['id'];
    $actionName = $item['action_name'];
    $payload = json_decode($item['payload_json'], true) ?: [];

    // Ensure action is set
    $payload['action'] = $actionName;

    // Send to Google Sheets
    $res = callGoogleAppsScript($gasUrl, $payload);

    if (!empty($res['success'])) {
        // Mark completed
        $upd = $pdo->prepare("UPDATE lfp_sync_queue SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $upd->execute([':id' => $itemId]);
        $processed++;
    } else {
        // Mark failed or retry
        $errMsg = $res['message'] ?? 'Unknown sync failure';
        $attempts = (int)$item['attempts'] + 1;
        $status = ($attempts >= 5) ? 'failed' : 'pending';
        $upd = $pdo->prepare("
            UPDATE lfp_sync_queue
            SET status = :status, attempts = :attempts, error_message = :err, updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
        ");
        $upd->execute([
            ':status' => $status,
            ':attempts' => $attempts,
            ':err' => $errMsg,
            ':id' => $itemId
        ]);
        $failed++;
    }
}

// Auto clean completed items older than 7 days
try {
    $pdo->exec("DELETE FROM lfp_sync_queue WHERE status = 'completed' AND created_at < datetime('now', '-7 days')");
} catch (Exception $e) {}

echo json_encode([
    'success' => true,
    'message' => "সিঙ্ক সম্পন্ন: {$processed} টি সফল, {$failed} টি ব্যর্থ।",
    'processed' => $processed,
    'failed' => $failed
], JSON_UNESCAPED_UNICODE);
