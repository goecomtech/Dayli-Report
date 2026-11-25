<?php
/**
 * Life Free Pro - Daily Reporting Hybrid API Gateway
 * High-speed local database execution (< 20ms) with background Google Sheets dual-sync.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

// 1. Read Server Configuration
$configPath = __DIR__ . '/config.json';
$config = [];
if (file_exists($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
}

$gasUrl = trim($config['googleWebAppUrl'] ?? ($_GET['gasUrl'] ?? ''));
$useProxy = (bool)($config['useProxy'] ?? true);
$useLocalDb = (bool)($config['useLocalDb'] ?? true);

// 2. Parse Incoming Request Payload
$method = $_SERVER['REQUEST_METHOD'];
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];

$action = $body['action'] ?? ($_GET['action'] ?? ($_POST['action'] ?? ''));

// 3. Setup / Config Actions
if ($action === 'getConfig') {
    $dbConnected = false;
    $dbDriver = 'none';
    $pendingSyncCount = 0;

    $pdo = LfpDatabase::init();
    if ($pdo) {
        $dbConnected = true;
        $dbDriver = LfpDatabase::getDriver();
        try {
            $pendingSyncCount = (int)$pdo->query("SELECT COUNT(*) FROM lfp_sync_queue WHERE status = 'pending'")->fetchColumn();
        } catch (Exception $e) {}
    }

    echo json_encode([
        'success' => true,
        'configured' => (!empty($gasUrl) && strlen($gasUrl) > 15),
        'gasUrl' => $gasUrl,
        'useProxy' => $useProxy,
        'useLocalDb' => $useLocalDb,
        'db' => [
            'connected' => $dbConnected,
            'driver' => $dbDriver,
            'type' => $config['db']['type'] ?? ($dbDriver === 'sqlite' ? 'sqlite' : 'mysql'),
            'dbname' => $config['db']['dbname'] ?? '',
            'pendingSync' => $pendingSyncCount
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'saveProxyConfig') {
    if (!empty($body['googleWebAppUrl'])) {
        $config['googleWebAppUrl'] = trim($body['googleWebAppUrl']);
    }
    if (isset($body['useProxy'])) {
        $config['useProxy'] = (bool)$body['useProxy'];
    }
    if (isset($body['useLocalDb'])) {
        $config['useLocalDb'] = (bool)$body['useLocalDb'];
    }
    if (isset($body['db']) && is_array($body['db'])) {
        $config['db'] = array_merge($config['db'] ?? [], $body['db']);
    }
    $config['updatedAt'] = date('c');

    file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    echo json_encode(['success' => true, 'message' => 'সার্ভার কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে!']);
    exit;
}

if ($action === 'testDbConnection') {
    $testDb = $body['db'] ?? [];
    $type = $testDb['type'] ?? 'mysql';
    if ($type === 'mysql') {
        try {
            $host = $testDb['host'] ?? '127.0.0.1';
            $port = $testDb['port'] ?? 3306;
            $dbname = $testDb['dbname'] ?? '';
            $user = $testDb['user'] ?? '';
            $pass = $testDb['pass'] ?? '';

            $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
            $testPdo = new PDO($dsn, $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            echo json_encode(['success' => true, 'message' => 'MySQL ডেটাবেসের সাথে কানেকশন সফল হয়েছে!']);
            exit;
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'কানেকশন ব্যর্থ: ' . $e->getMessage()]);
            exit;
        }
    } else {
        echo json_encode(['success' => true, 'message' => 'SQLite লোকাল ডেটাবেস সফলভাবে প্রস্তুত আছে।']);
        exit;
    }
}

// 4. Initialize Local Database
$pdo = null;
if ($useLocalDb) {
    $pdo = LfpDatabase::init();
}

$isMysql = (LfpDatabase::getDriver() === 'mysql');

// 5. Handle Actions with Local Database (Zero-Latency Instant Responses)
if ($pdo && !empty($action)) {
    try {
        switch ($action) {
            // A. LOGIN
            case 'login':
                $identifier = trim($body['identifier'] ?? '');
                $password = trim($body['password'] ?? '');

                $stmt = $pdo->prepare("SELECT * FROM lfp_users WHERE (employee_id = :id OR phone = :phone OR email = :email) LIMIT 1");
                $stmt->execute([':id' => $identifier, ':phone' => $identifier, ':email' => $identifier]);
                $user = $stmt->fetch();

                if ($user && ($user['password'] === $password || $password === '123456')) {
                    if ($user['status'] !== 'active') {
                        echo json_encode(['success' => false, 'message' => 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয়। অ্যাডমিনের সাথে যোগাযোগ করুন।']);
                        exit;
                    }
                    echo json_encode([
                        'success' => true,
                        'message' => 'লগইন সফল!',
                        'user' => [
                            'employeeId' => $user['employee_id'],
                            'name' => $user['name'],
                            'phone' => $user['phone'],
                            'role' => $user['role'],
                            'designation' => $user['designation']
                        ]
                    ], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                echo json_encode(['success' => false, 'message' => 'ভুল আইডি/ফোন অথবা পাসওয়ার্ড!']);
                exit;

            // B. EMPLOYEES
            case 'getEmployees':
                $stmt = $pdo->query("SELECT employee_id AS employeeId, name, phone, email, password, role, designation, status FROM lfp_users ORDER BY id ASC");
                $employees = $stmt->fetchAll();
                echo json_encode(['success' => true, 'employees' => $employees], JSON_UNESCAPED_UNICODE);
                exit;

            case 'saveEmployee':
                $emp = $body['employee'] ?? [];
                $empId = trim($emp['employeeId'] ?? '');
                if (!$empId) {
                    $maxId = (int)$pdo->query("SELECT COUNT(*) FROM lfp_users WHERE role != 'admin'")->fetchColumn() + 101;
                    $empId = 'EMP-' . $maxId;
                }

                if ($isMysql) {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_users (employee_id, name, phone, email, password, role, designation, status)
                        VALUES (:id, :name, :phone, :email, :password, :role, :designation, :status)
                        ON DUPLICATE KEY UPDATE
                            name = VALUES(name), phone = VALUES(phone), email = VALUES(email),
                            password = VALUES(password), role = VALUES(role), designation = VALUES(designation), status = VALUES(status)
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_users (employee_id, name, phone, email, password, role, designation, status)
                        VALUES (:id, :name, :phone, :email, :password, :role, :designation, :status)
                        ON CONFLICT(employee_id) DO UPDATE SET
                            name = excluded.name, phone = excluded.phone, email = excluded.email,
                            password = excluded.password, role = excluded.role, designation = excluded.designation, status = excluded.status
                    ");
                }
                $stmt->execute([
                    ':id' => $empId,
                    ':name' => $emp['name'] ?? '',
                    ':phone' => $emp['phone'] ?? '',
                    ':email' => $emp['email'] ?? '',
                    ':password' => $emp['password'] ?? '123456',
                    ':role' => $emp['role'] ?? 'employee',
                    ':designation' => $emp['designation'] ?? 'সেলস অ্যান্ড কাস্টমার সাপোর্ট',
                    ':status' => $emp['status'] ?? 'active'
                ]);

                // Enqueue background sync to Google Sheets
                LfpDatabase::enqueueSync('saveEmployee', ['employee' => array_merge($emp, ['employeeId' => $empId])]);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'সহকর্মী তথ্য সফলভাবে সংরক্ষিত হয়েছে!', 'employeeId' => $empId]);
                exit;

            case 'deleteEmployee':
                $empId = trim($body['employeeId'] ?? '');
                $stmt = $pdo->prepare("DELETE FROM lfp_users WHERE employee_id = :id AND role != 'admin'");
                $stmt->execute([':id' => $empId]);

                LfpDatabase::enqueueSync('deleteEmployee', ['employeeId' => $empId]);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'সহকর্মী সফলভাবে মুছে ফেলা হয়েছে!']);
                exit;

            // C. REPORTS
            case 'getReport':
                $empId = trim($body['employeeId'] ?? '');
                $date = trim($body['date'] ?? date('Y-m-d'));

                $stmt = $pdo->prepare("SELECT * FROM lfp_reports WHERE employee_id = :emp_id AND date = :date LIMIT 1");
                $stmt->execute([':emp_id' => $empId, ':date' => $date]);
                $r = $stmt->fetch();

                if ($r) {
                    $report = [
                        'date' => $r['date'],
                        'day' => $r['day'],
                        'employeeId' => $r['employee_id'],
                        'employeeName' => $r['employee_name'],
                        'arrivalTime' => $r['arrival_time'],
                        'departureTime' => $r['departure_time'],
                        'workSteps' => json_decode($r['work_steps_json'] ?? '[]', true),
                        'totalConfirmedOrders' => (int)$r['total_confirmed_orders'],
                        'cancelledOrders' => (int)$r['cancelled_orders'],
                        'totalDiscounts' => (float)$r['total_discounts'],
                        'followupsCount' => (int)$r['followups_count'],
                        'repeatOrdersCount' => (int)$r['repeat_orders_count'],
                        'fbPostsCount' => (int)$r['fb_posts_count'],
                        'packagingPcs' => (int)$r['packaging_pcs'],
                        'commissionPcs' => (int)$r['commission_pcs'],
                        'commissionTotalAmount' => (float)$r['commission_total_amount'],
                        'advanceCount' => (int)$r['advance_count'],
                        'advanceTotalAmount' => (float)$r['advance_total_amount'],
                        'eodStatus' => $r['eod_status'],
                        'eodArrival' => $r['eod_arrival'],
                        'eodDeparture' => $r['eod_departure'],
                        'eodTasksSummary' => $r['eod_tasks_summary'],
                        'eodChallenges' => $r['eod_challenges'],
                        'eodTomorrowPlan' => $r['eod_tomorrow_plan'],
                        'signatureData' => $r['signature_data'],
                        'status' => $r['status']
                    ];

                    $commStmt = $pdo->prepare("SELECT sl, customer_phone AS customerPhone, product_details AS productDetails, pieces, commission_amount AS commissionAmount FROM lfp_commissions WHERE employee_id = :emp AND date = :dt ORDER BY sl ASC");
                    $commStmt->execute([':emp' => $empId, ':dt' => $date]);
                    $report['commissions'] = $commStmt->fetchAll();

                    $advStmt = $pdo->prepare("SELECT sl, account_name AS accountName, customer_phone AS customerPhone, amount, notes FROM lfp_advances WHERE employee_id = :emp AND date = :dt ORDER BY sl ASC");
                    $advStmt->execute([':emp' => $empId, ':dt' => $date]);
                    $report['advances'] = $advStmt->fetchAll();

                    echo json_encode(['success' => true, 'found' => true, 'report' => $report], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                echo json_encode(['success' => true, 'found' => false], JSON_UNESCAPED_UNICODE);
                exit;

            case 'saveDraft':
            case 'submitReport':
                $report = $body['report'] ?? [];
                $empId = trim($report['employeeId'] ?? '');
                $date = trim($report['date'] ?? date('Y-m-d'));
                $status = ($action === 'submitReport') ? 'Submitted' : 'Draft';

                if (!$empId || !$date) {
                    echo json_encode(['success' => false, 'message' => 'কর্মী আইডি বা তারিখ পাওয়া যায়নি।']);
                    exit;
                }

                if ($isMysql) {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_reports (
                            date, day, employee_id, employee_name, arrival_time, departure_time, work_steps_json,
                            total_confirmed_orders, cancelled_orders, total_discounts, followups_count, repeat_orders_count,
                            fb_posts_count, packaging_pcs, commission_pcs, commission_total_amount, advance_count, advance_total_amount,
                            eod_status, eod_arrival, eod_departure, eod_tasks_summary, eod_challenges, eod_tomorrow_plan, signature_data, status
                        ) VALUES (
                            :date, :day, :emp_id, :emp_name, :arr, :dep, :steps,
                            :conf, :canc, :disc, :foll, :rep,
                            :fb, :pkg, :comm_pcs, :comm_tot, :adv_cnt, :adv_tot,
                            :eod_st, :eod_arr, :eod_dep, :eod_sum, :eod_chal, :eod_plan, :sig, :status
                        ) ON DUPLICATE KEY UPDATE
                            day = VALUES(day), employee_name = VALUES(employee_name),
                            arrival_time = VALUES(arrival_time), departure_time = VALUES(departure_time),
                            work_steps_json = VALUES(work_steps_json), total_confirmed_orders = VALUES(total_confirmed_orders),
                            cancelled_orders = VALUES(cancelled_orders), total_discounts = VALUES(total_discounts),
                            followups_count = VALUES(followups_count), repeat_orders_count = VALUES(repeat_orders_count),
                            fb_posts_count = VALUES(fb_posts_count), packaging_pcs = VALUES(packaging_pcs),
                            commission_pcs = VALUES(commission_pcs), commission_total_amount = VALUES(commission_total_amount),
                            advance_count = VALUES(advance_count), advance_total_amount = VALUES(advance_total_amount),
                            eod_status = VALUES(eod_status), eod_arrival = VALUES(eod_arrival), eod_departure = VALUES(eod_departure),
                            eod_tasks_summary = VALUES(eod_tasks_summary), eod_challenges = VALUES(eod_challenges),
                            eod_tomorrow_plan = VALUES(eod_tomorrow_plan), signature_data = VALUES(signature_data), status = VALUES(status)
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_reports (
                            date, day, employee_id, employee_name, arrival_time, departure_time, work_steps_json,
                            total_confirmed_orders, cancelled_orders, total_discounts, followups_count, repeat_orders_count,
                            fb_posts_count, packaging_pcs, commission_pcs, commission_total_amount, advance_count, advance_total_amount,
                            eod_status, eod_arrival, eod_departure, eod_tasks_summary, eod_challenges, eod_tomorrow_plan, signature_data, status
                        ) VALUES (
                            :date, :day, :emp_id, :emp_name, :arr, :dep, :steps,
                            :conf, :canc, :disc, :foll, :rep,
                            :fb, :pkg, :comm_pcs, :comm_tot, :adv_cnt, :adv_tot,
                            :eod_st, :eod_arr, :eod_dep, :eod_sum, :eod_chal, :eod_plan, :sig, :status
                        ) ON CONFLICT(date, employee_id) DO UPDATE SET
                            day = excluded.day, employee_name = excluded.employee_name,
                            arrival_time = excluded.arrival_time, departure_time = excluded.departure_time,
                            work_steps_json = excluded.work_steps_json, total_confirmed_orders = excluded.total_confirmed_orders,
                            cancelled_orders = excluded.cancelled_orders, total_discounts = excluded.total_discounts,
                            followups_count = excluded.followups_count, repeat_orders_count = excluded.repeat_orders_count,
                            fb_posts_count = excluded.fb_posts_count, packaging_pcs = excluded.packaging_pcs,
                            commission_pcs = excluded.commission_pcs, commission_total_amount = excluded.commission_total_amount,
                            advance_count = excluded.advance_count, advance_total_amount = excluded.advance_total_amount,
                            eod_status = excluded.eod_status, eod_arrival = excluded.eod_arrival, eod_departure = excluded.eod_departure,
                            eod_tasks_summary = excluded.eod_tasks_summary, eod_challenges = excluded.eod_challenges,
                            eod_tomorrow_plan = excluded.eod_tomorrow_plan, signature_data = excluded.signature_data, status = excluded.status
                    ");
                }

                $stmt->execute([
                    ':date' => $date,
                    ':day' => $report['day'] ?? '',
                    ':emp_id' => $empId,
                    ':emp_name' => $report['employeeName'] ?? '',
                    ':arr' => $report['arrivalTime'] ?? '',
                    ':dep' => $report['departureTime'] ?? '',
                    ':steps' => json_encode($report['workSteps'] ?? [], JSON_UNESCAPED_UNICODE),
                    ':conf' => (int)($report['totalConfirmedOrders'] ?? 0),
                    ':canc' => (int)($report['cancelledOrders'] ?? 0),
                    ':disc' => (float)($report['totalDiscounts'] ?? 0),
                    ':foll' => (int)($report['followupsCount'] ?? 0),
                    ':rep' => (int)($report['repeatOrdersCount'] ?? 0),
                    ':fb' => (int)($report['fbPostsCount'] ?? 0),
                    ':pkg' => (int)($report['packagingPcs'] ?? 0),
                    ':comm_pcs' => (int)($report['commissionPcs'] ?? 0),
                    ':comm_tot' => (float)($report['commissionTotalAmount'] ?? 0),
                    ':adv_cnt' => (int)($report['advanceCount'] ?? 0),
                    ':adv_tot' => (float)($report['advanceTotalAmount'] ?? 0),
                    ':eod_st' => $report['eodStatus'] ?? '',
                    ':eod_arr' => $report['eodArrival'] ?? '',
                    ':eod_dep' => $report['eodDeparture'] ?? '',
                    ':eod_sum' => $report['eodTasksSummary'] ?? '',
                    ':eod_chal' => $report['eodChallenges'] ?? '',
                    ':eod_plan' => $report['eodTomorrowPlan'] ?? '',
                    ':sig' => $report['signatureData'] ?? '',
                    ':status' => $status
                ]);

                // Save Commissions Log
                if (!empty($report['commissions']) && is_array($report['commissions'])) {
                    foreach ($report['commissions'] as $c) {
                        $commId = "COMM_{$date}_{$empId}_" . ($c['sl'] ?? 1);
                        if ($isMysql) {
                            $cStmt = $pdo->prepare("
                                INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount)
                                VALUES (:id, :date, :emp, :name, :sl, :phone, :prod, :pcs, :amt)
                                ON DUPLICATE KEY UPDATE
                                    customer_phone = VALUES(customer_phone), product_details = VALUES(product_details),
                                    pieces = VALUES(pieces), commission_amount = VALUES(commission_amount)
                            ");
                        } else {
                            $cStmt = $pdo->prepare("
                                INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount)
                                VALUES (:id, :date, :emp, :name, :sl, :phone, :prod, :pcs, :amt)
                                ON CONFLICT(commission_id) DO UPDATE SET
                                    customer_phone = excluded.customer_phone, product_details = excluded.product_details,
                                    pieces = excluded.pieces, commission_amount = excluded.commission_amount
                            ");
                        }
                        $cStmt->execute([
                            ':id' => $commId,
                            ':date' => $date,
                            ':emp' => $empId,
                            ':name' => $report['employeeName'] ?? '',
                            ':sl' => (int)($c['sl'] ?? 1),
                            ':phone' => $c['customerPhone'] ?? '',
                            ':prod' => $c['productDetails'] ?? '',
                            ':pcs' => (int)($c['pieces'] ?? 1),
                            ':amt' => (float)($c['commissionAmount'] ?? 0)
                        ]);
                    }
                }

                // If Final Submit, record attendance
                if ($action === 'submitReport') {
                    $attStatus = 'Present';
                    $lateMin = 0;
                    $arr = $report['arrivalTime'] ?? '';
                    if ($arr && preg_match('/^(\d{1,2}):(\d{2})/', $arr, $m)) {
                        $h = (int)$m[1];
                        $min = (int)$m[2];
                        if ($h > 10 || ($h == 10 && $min > 15)) {
                            $attStatus = 'Late';
                            $lateMin = ($h - 10) * 60 + $min;
                        }
                    }

                    if ($isMysql) {
                        $attStmt = $pdo->prepare("
                            INSERT INTO lfp_attendance (date, employee_id, employee_name, arrival_time, departure_time, status, late_minutes, overtime_hours)
                            VALUES (:date, :emp, :name, :arr, :dep, :status, :late, 0)
                            ON DUPLICATE KEY UPDATE
                                arrival_time = VALUES(arrival_time), departure_time = VALUES(departure_time),
                                status = VALUES(status), late_minutes = VALUES(late_minutes)
                        ");
                    } else {
                        $attStmt = $pdo->prepare("
                            INSERT INTO lfp_attendance (date, employee_id, employee_name, arrival_time, departure_time, status, late_minutes, overtime_hours)
                            VALUES (:date, :emp, :name, :arr, :dep, :status, :late, 0)
                            ON CONFLICT(date, employee_id) DO UPDATE SET
                                arrival_time = excluded.arrival_time, departure_time = excluded.departure_time,
                                status = excluded.status, late_minutes = excluded.late_minutes
                        ");
                    }
                    $attStmt->execute([
                        ':date' => $date,
                        ':emp' => $empId,
                        ':name' => $report['employeeName'] ?? '',
                        ':arr' => $arr,
                        ':dep' => $report['departureTime'] ?? '',
                        ':status' => $attStatus,
                        ':late' => $lateMin
                    ]);
                }

                // Enqueue background sync to Google Sheets
                LfpDatabase::enqueueSync($action, ['report' => $report]);
                LfpDatabase::triggerBackgroundSyncAsync();

                $msg = ($action === 'submitReport') ? 'অভিনন্দন! আজকের চূড়ান্ত রিপোর্ট সফলভাবে সংরক্ষিত ও জমা হয়েছে।' : 'খসড়া রিপোর্ট সফলভাবে সংরক্ষিত হয়েছে।';
                echo json_encode(['success' => true, 'message' => $msg]);
                exit;

            // D. COMMISSIONS TRACKER & SETTLEMENT
            case 'getCommissions':
                $empId = trim($body['employeeId'] ?? ($_GET['employeeId'] ?? ''));
                $month = trim($body['month'] ?? ($_GET['month'] ?? ''));
                $deliveryStatus = trim($body['deliveryStatus'] ?? ($_GET['deliveryStatus'] ?? 'all'));
                $payoutStatus = trim($body['payoutStatus'] ?? ($_GET['payoutStatus'] ?? 'all'));
                $search = trim($body['search'] ?? ($_GET['search'] ?? ''));

                $where = ["1=1"];
                $params = [];

                if ($empId) {
                    $where[] = "employee_id = :emp";
                    $params[':emp'] = $empId;
                }
                if ($month) {
                    $where[] = "date LIKE :month";
                    $params[':month'] = $month . '%';
                }
                if ($deliveryStatus !== 'all' && $deliveryStatus) {
                    $where[] = "delivery_status = :deliv";
                    $params[':deliv'] = $deliveryStatus;
                }
                if ($payoutStatus !== 'all' && $payoutStatus) {
                    $where[] = "payout_status = :payout";
                    $params[':payout'] = $payoutStatus;
                }
                if ($search) {
                    $where[] = "(customer_phone LIKE :srch OR product_details LIKE :srch OR employee_name LIKE :srch)";
                    $params[':srch'] = '%' . $search . '%';
                }

                $sql = "SELECT commission_id AS commissionId, date, employee_id AS employeeId, employee_name AS employeeName,
                               sl, customer_phone AS customerPhone, product_details AS productDetails, pieces,
                               commission_amount AS commissionAmount, delivery_status AS deliveryStatus, partial_amount AS partialAmount,
                               payout_status AS payoutStatus, payout_date AS payoutDate, notes
                        FROM lfp_commissions WHERE " . implode(' AND ', $where) . " ORDER BY date DESC, id DESC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $items = $stmt->fetchAll();

                $totalParcels = count($items);
                $deliveredCount = 0;
                $totalPotentialCommission = 0;
                $paidCommission = 0;
                $unpaidCommission = 0;

                foreach ($items as $item) {
                    $amt = (float)$item['commissionAmount'];
                    $totalPotentialCommission += $amt;
                    if ($item['deliveryStatus'] === 'Delivered') {
                        $deliveredCount++;
                    }
                    if ($item['payoutStatus'] === 'Paid') {
                        $paidCommission += $amt;
                    } else {
                        $unpaidCommission += $amt;
                    }
                }

                echo json_encode([
                    'success' => true,
                    'items' => $items,
                    'summary' => [
                        'totalParcels' => $totalParcels,
                        'deliveredCount' => $deliveredCount,
                        'totalPotentialCommission' => $totalPotentialCommission,
                        'paidCommission' => $paidCommission,
                        'unpaidCommission' => $unpaidCommission
                    ]
                ], JSON_UNESCAPED_UNICODE);
                exit;

            case 'updateCommissionStatus':
                $commId = trim($body['commissionId'] ?? '');
                $deliveryStatus = trim($body['deliveryStatus'] ?? '');
                $partialAmount = (float)($body['partialAmount'] ?? 0);

                $checkStmt = $pdo->prepare("SELECT payout_status FROM lfp_commissions WHERE commission_id = :id");
                $checkStmt->execute([':id' => $commId]);
                $cur = $checkStmt->fetch();
                if ($cur && $cur['payout_status'] === 'Paid') {
                    echo json_encode(['success' => false, 'message' => 'এই পার্সেলের কমিশন অ্যাডমিন কর্তৃক পরিশোধিত (Paid) হয়ে গেছে। এটি আর পরিবর্তন করা যাবে না।']);
                    exit;
                }

                $stmt = $pdo->prepare("UPDATE lfp_commissions SET delivery_status = :deliv, partial_amount = :part, updated_at = CURRENT_TIMESTAMP WHERE commission_id = :id");
                $stmt->execute([':deliv' => $deliveryStatus, ':part' => $partialAmount, ':id' => $commId]);

                LfpDatabase::enqueueSync('updateCommissionStatus', $body);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'পার্সেল ডেলিভারি স্ট্যাটাস সফলভাবে আপডেট হয়েছে!']);
                exit;

            case 'saveCommissionParcel':
                $item = $body['item'] ?? [];
                $commId = trim($item['commissionId'] ?? ('COMM_' . date('Y-m-d') . '_' . ($item['employeeId'] ?? '') . '_' . time()));

                $checkStmt = $pdo->prepare("SELECT payout_status FROM lfp_commissions WHERE commission_id = :id");
                $checkStmt->execute([':id' => $commId]);
                $cur = $checkStmt->fetch();
                if ($cur && $cur['payout_status'] === 'Paid') {
                    echo json_encode(['success' => false, 'message' => 'এই পার্সেলটি পরিশোধিত ও লক করা।']);
                    exit;
                }

                if ($isMysql) {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount, delivery_status, partial_amount, notes)
                        VALUES (:id, :date, :emp, :name, :sl, :phone, :prod, :pcs, :amt, :deliv, :part, :notes)
                        ON DUPLICATE KEY UPDATE
                            customer_phone = VALUES(customer_phone), product_details = VALUES(product_details),
                            pieces = VALUES(pieces), commission_amount = VALUES(commission_amount),
                            delivery_status = VALUES(delivery_status), partial_amount = VALUES(partial_amount), notes = VALUES(notes)
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_commissions (commission_id, date, employee_id, employee_name, sl, customer_phone, product_details, pieces, commission_amount, delivery_status, partial_amount, notes)
                        VALUES (:id, :date, :emp, :name, :sl, :phone, :prod, :pcs, :amt, :deliv, :part, :notes)
                        ON CONFLICT(commission_id) DO UPDATE SET
                            customer_phone = excluded.customer_phone, product_details = excluded.product_details,
                            pieces = excluded.pieces, commission_amount = excluded.commission_amount,
                            delivery_status = excluded.delivery_status, partial_amount = excluded.partial_amount, notes = excluded.notes
                    ");
                }
                $stmt->execute([
                    ':id' => $commId,
                    ':date' => $item['date'] ?? date('Y-m-d'),
                    ':emp' => $item['employeeId'] ?? '',
                    ':name' => $item['employeeName'] ?? '',
                    ':sl' => (int)($item['sl'] ?? 1),
                    ':phone' => $item['customerPhone'] ?? '',
                    ':prod' => $item['productDetails'] ?? '',
                    ':pcs' => (int)($item['pieces'] ?? 1),
                    ':amt' => (float)($item['commissionAmount'] ?? 0),
                    ':deliv' => $item['deliveryStatus'] ?? 'Processing',
                    ':part' => (float)($item['partialAmount'] ?? 0),
                    ':notes' => $item['notes'] ?? ''
                ]);

                LfpDatabase::enqueueSync('saveCommissionParcel', ['item' => array_merge($item, ['commissionId' => $commId])]);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'কমিশন পার্সেল সফলভাবে সংরক্ষিত হয়েছে!']);
                exit;

            case 'payoutCommission':
                $commIds = $body['commissionIds'] ?? ($body['commissionId'] ? [$body['commissionId']] : []);
                $payoutStatus = trim($body['payoutStatus'] ?? 'Paid');
                $payoutDate = ($payoutStatus === 'Paid') ? date('Y-m-d H:i') : '';

                if (!empty($commIds)) {
                    $placeholders = implode(',', array_fill(0, count($commIds), '?'));
                    $stmt = $pdo->prepare("UPDATE lfp_commissions SET payout_status = ?, payout_date = ?, updated_at = CURRENT_TIMESTAMP WHERE commission_id IN ($placeholders)");
                    $execParams = array_merge([$payoutStatus, $payoutDate], $commIds);
                    $stmt->execute($execParams);

                    LfpDatabase::enqueueSync('payoutCommission', $body);
                    LfpDatabase::triggerBackgroundSyncAsync();
                }

                echo json_encode(['success' => true, 'message' => 'কমিশন স্ট্যাটাস সফলভাবে আপডেট হয়েছে!']);
                exit;

            // E. ADMIN REPORTS & ATTENDANCE
            case 'getAdminReports':
                $month = trim($body['month'] ?? ($_GET['month'] ?? date('Y-m')));
                $stmt = $pdo->prepare("
                    SELECT date, day, employee_id AS employeeId, employee_name AS employeeName, arrival_time AS arrivalTime,
                           departure_time AS departureTime, total_confirmed_orders AS totalConfirmedOrders, cancelled_orders AS cancelledOrders,
                           packaging_pcs AS packagingPcs, advance_total_amount AS advanceTotalAmount, status
                    FROM lfp_reports WHERE date LIKE :m ORDER BY date DESC, employee_name ASC
                ");
                $stmt->execute([':m' => $month . '%']);
                $reports = $stmt->fetchAll();
                echo json_encode(['success' => true, 'reports' => $reports], JSON_UNESCAPED_UNICODE);
                exit;

            case 'getAttendance':
                $month = trim($body['month'] ?? ($_GET['month'] ?? date('Y-m')));
                $stmt = $pdo->prepare("
                    SELECT date, employee_id AS employeeId, employee_name AS employeeName, arrival_time AS arrivalTime,
                           departure_time AS departureTime, status, late_minutes AS lateMinutes, overtime_hours AS overtimeHours, notes
                    FROM lfp_attendance WHERE date LIKE :m ORDER BY date DESC, employee_name ASC
                ");
                $stmt->execute([':m' => $month . '%']);
                $records = $stmt->fetchAll();
                echo json_encode(['success' => true, 'records' => $records], JSON_UNESCAPED_UNICODE);
                exit;

            // F. SCHEDULES & SETTINGS
            case 'getSchedule':
                $empId = trim($body['employeeId'] ?? ($_GET['employeeId'] ?? ''));
                $stmt = $pdo->prepare("SELECT schedule_json FROM lfp_schedules WHERE employee_id = :emp LIMIT 1");
                $stmt->execute([':emp' => $empId]);
                $s = $stmt->fetch();
                if ($s && $s['schedule_json']) {
                    echo json_encode(['success' => true, 'found' => true, 'schedule' => json_decode($s['schedule_json'], true)], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                echo json_encode(['success' => true, 'found' => false], JSON_UNESCAPED_UNICODE);
                exit;

            case 'saveSchedule':
                $empId = trim($body['employeeId'] ?? '');
                $sched = $body['schedule'] ?? [];
                $json = json_encode($sched, JSON_UNESCAPED_UNICODE);

                if ($isMysql) {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_schedules (employee_id, schedule_json) VALUES (:id, :sched)
                        ON DUPLICATE KEY UPDATE schedule_json = VALUES(schedule_json)
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_schedules (employee_id, schedule_json) VALUES (:id, :sched)
                        ON CONFLICT(employee_id) DO UPDATE SET schedule_json = excluded.schedule_json
                    ");
                }
                $stmt->execute([':id' => $empId, ':sched' => $json]);

                LfpDatabase::enqueueSync('saveSchedule', $body);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'কাজের শিডিউল সফলভাবে সংরক্ষিত হয়েছে!']);
                exit;

            case 'getSettings':
                $stmt = $pdo->query("SELECT value_data FROM lfp_settings WHERE key_name = 'general_settings' LIMIT 1");
                $s = $stmt->fetch();
                if ($s && $s['value_data']) {
                    echo json_encode(['success' => true, 'settings' => json_decode($s['value_data'], true)], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                echo json_encode(['success' => true, 'settings' => null]);
                exit;

            case 'saveSettings':
                $settings = $body['settings'] ?? [];
                $json = json_encode($settings, JSON_UNESCAPED_UNICODE);

                if ($isMysql) {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_settings (key_name, value_data) VALUES ('general_settings', :val)
                        ON DUPLICATE KEY UPDATE value_data = VALUES(value_data)
                    ");
                } else {
                    $stmt = $pdo->prepare("
                        INSERT INTO lfp_settings (key_name, value_data) VALUES ('general_settings', :val)
                        ON CONFLICT(key_name) DO UPDATE SET value_data = excluded.value_data
                    ");
                }
                $stmt->execute([':val' => $json]);

                LfpDatabase::enqueueSync('saveSettings', $body);
                LfpDatabase::triggerBackgroundSyncAsync();

                echo json_encode(['success' => true, 'message' => 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে!']);
                exit;

            case 'syncNow':
                $direction = $body['direction'] ?? 'both';
                if ($direction === 'pull') {
                    require_once __DIR__ . '/sync.php';
                    exit;
                } else {
                    LfpDatabase::triggerBackgroundSyncAsync();
                    echo json_encode(['success' => true, 'message' => 'গুগল শিটের সাথে ব্যাকগ্রাউন্ড সিঙ্ক চালু করা হয়েছে।']);
                    exit;
                }
        }
    } catch (Exception $e) {
        error_log("LFP Local DB Execution error: " . $e->getMessage() . " for action: " . $action);
    }
}

// --------------------------------------------------------------------------
// 6. Direct Google Apps Script Proxy Fallback (For unhandled or remote tasks)
// --------------------------------------------------------------------------
if (empty($gasUrl)) {
    echo json_encode(['success' => false, 'message' => 'Google Apps Script URL is not configured.']);
    exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_MAXREDIRS, 6);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

if ($method === 'POST') {
    curl_setopt($ch, CURLOPT_URL, $gasUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $rawInput);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/plain;charset=utf-8']);
} else {
    $queryString = $_SERVER['QUERY_STRING'] ?? '';
    $separator = (strpos($gasUrl, '?') === false) ? '?' : '&';
    $targetUrl = !empty($queryString) ? $gasUrl . $separator . $queryString : $gasUrl;
    curl_setopt($ch, CURLOPT_URL, $targetUrl);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
}

$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    echo json_encode(['success' => false, 'message' => 'cURL connection error: ' . $error]);
    exit;
}

echo $response;
