<?php
/**
 * Life Free Pro - GitHub Auto-Deployment Webhook Handler
 * Automatically pulls the latest updates from GitHub repository to CloudPanel VPS on `git push`.
 */

header('Content-Type: application/json; charset=UTF-8');

// 1. Read secret token from config or query
$configPath = __DIR__ . '/config.json';
$config = [];
if (file_exists($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
}

$expectedSecret = $config['deploy_secret'] ?? 'lfp_github_deploy_2026';

// 2. Security Validation
$incomingSecret = $_GET['secret'] ?? ($_GET['token'] ?? '');
$rawPayload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

$authorized = false;

// Check A: Token in URL
if (!empty($incomingSecret) && hash_equals($expectedSecret, $incomingSecret)) {
    $authorized = true;
}

// Check B: GitHub Webhook HMAC-SHA256 Signature
if (!$authorized && !empty($signatureHeader) && !empty($rawPayload)) {
    $computedSig = 'sha256=' . hash_hmac('sha256', $rawPayload, $expectedSecret);
    if (hash_equals($computedSig, $signatureHeader)) {
        $authorized = true;
    }
}

if (!$authorized) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'অননুমোদিত রিকোয়েস্ট (Unauthorized). গোপন ডিপ্লয় টোকেন মেলেনি।'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Ensure Git is available in PATH
putenv('PATH=' . getenv('PATH') . ':/usr/bin:/usr/local/bin:/bin');

$repoDir = __DIR__;
chdir($repoDir);

// Check if .git exists
if (!is_dir($repoDir . '/.git')) {
    echo json_encode([
        'success' => false,
        'message' => 'এই ফোল্ডারে গিট রিপোজিটরি ইনিশিয়ালাইজ করা নেই। প্রথমে সার্ভার টার্মিনালে "git init" ও "git remote add origin <repo>" সম্পন্ন করুন।'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. Execute Git Pull
$commands = [
    'git status -s',
    'git fetch origin main 2>&1',
    'git reset --hard origin/main 2>&1',
    'git pull origin main 2>&1',
    'git log -1 --pretty=format:"সর্বশেষ কমিট: %h - %s (%cr) <%an>" 2>&1'
];

$outputLog = [];
foreach ($commands as $cmd) {
    $output = shell_exec($cmd);
    $outputLog[] = "$ " . $cmd . "\n" . trim((string)$output);
}

$fullOutput = implode("\n\n", $outputLog);

// 5. Save Deployment Log
$logDir = __DIR__ . '/data';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
$logFile = $logDir . '/deploy.log';
$logEntry = "[" . date('Y-m-d H:i:s') . "] Auto-Deployment executed:\n" . $fullOutput . "\n" . str_repeat('-', 60) . "\n";
@file_put_contents($logFile, $logEntry, FILE_APPEND);

echo json_encode([
    'success' => true,
    'message' => 'অভিনন্দন! গিটহাব থেকে নতুন আপডেট সফলভাবে সার্ভারে ডিপ্লয় হয়েছে।',
    'timestamp' => date('c'),
    'output' => $fullOutput
], JSON_UNESCAPED_UNICODE);
