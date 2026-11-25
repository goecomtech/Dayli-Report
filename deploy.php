<?php
/**
 * Life Free Pro - GitHub Auto-Deployment & API Updater Engine
 * Supports TWO deployment modes:
 * 1. Git Webhook Mode: Triggered automatically by GitHub on `git push`.
 * 2. WordPress-Style 1-Click Update Mode: Uses GitHub API to download & extract latest files.
 */

header('Content-Type: application/json; charset=UTF-8');

// 1. Read Configuration
$configPath = __DIR__ . '/config.json';
$config = [];
if (file_exists($configPath)) {
    $config = json_decode(file_get_contents($configPath), true) ?: [];
}

$expectedSecret = $config['deploy_secret'] ?? 'lfp_github_deploy_2026';
$githubRepo = $config['github_repo'] ?? 'lifefreepro/lfp-daily-reporting'; // owner/repo
$currentVersion = $config['version'] ?? '3.5.0';

$action = $_GET['action'] ?? ($_POST['action'] ?? 'webhook');

// --------------------------------------------------------------------------
// MODE 1: CHECK FOR UPDATES VIA GITHUB API (WordPress Plugin Style)
// --------------------------------------------------------------------------
if ($action === 'checkUpdate') {
    $url = "https://api.github.com/repos/{$githubRepo}/commits/main";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'LFP-Updater/3.5');
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200 && $resp) {
        $data = json_decode($resp, true);
        $latestSha = substr($data['sha'] ?? '', 0, 7);
        $commitMsg = $data['commit']['message'] ?? '';
        $commitDate = $data['commit']['author']['date'] ?? '';

        $localSha = $config['last_deployed_commit'] ?? '';

        $hasUpdate = (!empty($latestSha) && $latestSha !== $localSha);

        echo json_encode([
            'success' => true,
            'hasUpdate' => $hasUpdate,
            'currentCommit' => $localSha ?: 'Initial (v3.5)',
            'latestCommit' => $latestSha,
            'commitMessage' => $commitMsg,
            'commitDate' => $commitDate,
            'repo' => $githubRepo
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => false,
        'message' => 'গিটহাব থেকে তথ্যের উত্তর পাওয়া যায়নি বা রিপোজিটরি প্রাইভেট/খুঁজে পাওয়া যায়নি।',
        'httpCode' => $httpCode
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// --------------------------------------------------------------------------
// MODE 2: APPLY UPDATE VIA GITHUB API ZIPBALL (1-Click WordPress Style)
// --------------------------------------------------------------------------
if ($action === 'applyUpdateApi') {
    // Check authentication token
    $token = $_GET['token'] ?? ($_POST['token'] ?? '');
    if ($token !== $expectedSecret) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'অননুমোদিত রিকোয়েস্ট (Invalid token)']);
        exit;
    }

    $zipUrl = "https://api.github.com/repos/{$githubRepo}/zipball/main";
    $tempZip = __DIR__ . '/data/update_' . time() . '.zip';
    if (!is_dir(__DIR__ . '/data')) {
        @mkdir(__DIR__ . '/data', 0755, true);
    }

    // Download Zipball from GitHub
    $fp = fopen($tempZip, 'w+');
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $zipUrl);
    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'LFP-Updater/3.5');
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);

    if ($httpCode !== 200 || !file_exists($tempZip) || filesize($tempZip) < 1000) {
        @unlink($tempZip);
        echo json_encode(['success' => false, 'message' => 'গিটহাব থেকে জিপ ফাইল ডাউনলোড ব্যর্থ হয়েছে। HTTP: ' . $httpCode]);
        exit;
    }

    // Extract using PHP ZipArchive
    if (!class_exists('ZipArchive')) {
        @unlink($tempZip);
        echo json_encode(['success' => false, 'message' => 'সার্ভারে PHP ZipArchive এক্সটেনশন সক্রিয় নেই।']);
        exit;
    }

    $zip = new ZipArchive();
    if ($zip->open($tempZip) === TRUE) {
        $extractPath = __DIR__ . '/data/temp_extract_' . time();
        @mkdir($extractPath, 0755, true);
        $zip->extractTo($extractPath);
        $zip->close();
        @unlink($tempZip);

        // Find the root folder inside extractPath (GitHub adds owner-repo-sha folder)
        $subDirs = glob($extractPath . '/*', GLOB_ONLYDIR);
        $sourceDir = (!empty($subDirs)) ? $subDirs[0] : $extractPath;

        // Copy files to root (excluding config.json and data/)
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        $copiedCount = 0;
        foreach ($iterator as $item) {
            $subPath = substr($item->getPathname(), strlen($sourceDir) + 1);
            $targetPath = __DIR__ . '/' . $subPath;

            // Skip protected files and directories
            if ($subPath === 'config.json' || strpos($subPath, 'data') === 0 || $subPath === '.git') {
                continue;
            }

            if ($item->isDir()) {
                if (!is_dir($targetPath)) {
                    @mkdir($targetPath, 0755, true);
                }
            } else {
                @copy($item->getPathname(), $targetPath);
                $copiedCount++;
            }
        }

        // Clean temp extract directory
        $cleanIterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($extractPath, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($cleanIterator as $file) {
            if ($file->isDir()) { @rmdir($file->getPathname()); } else { @unlink($file->getPathname()); }
        }
        @rmdir($extractPath);

        // Update config with last deployed time
        $config['last_deployed_at'] = date('c');
        @file_put_contents($configPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        echo json_encode([
            'success' => true,
            'message' => "অভিনন্দন! গিটহাব থেকে সফলভাবে {$copiedCount}টি ফাইল আপডেট ও প্রতিস্থাপন করা হয়েছে।",
            'filesUpdated' => $copiedCount
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    @unlink($tempZip);
    echo json_encode(['success' => false, 'message' => 'জিপ ফাইল আনজিপ করতে ব্যর্থ হয়েছে।']);
    exit;
}

// --------------------------------------------------------------------------
// MODE 3: GIT PUSH WEBHOOK (Standard Git CLI Pull)
// --------------------------------------------------------------------------
$incomingSecret = $_GET['secret'] ?? ($_GET['token'] ?? '');
$rawPayload = file_get_contents('php://input');
$signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';

$authorized = false;
if (!empty($incomingSecret) && hash_equals($expectedSecret, $incomingSecret)) {
    $authorized = true;
}
if (!$authorized && !empty($signatureHeader) && !empty($rawPayload)) {
    $computedSig = 'sha256=' . hash_hmac('sha256', $rawPayload, $expectedSecret);
    if (hash_equals($computedSig, $signatureHeader)) {
        $authorized = true;
    }
}

if (!$authorized) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'অননুমোদিত রিকোয়েস্ট (Unauthorized). গোপন ডিপ্লয় টোকেন মেলেনি।'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Execute git commands if .git exists
putenv('PATH=' . getenv('PATH') . ':/usr/bin:/usr/local/bin:/bin');
$repoDir = __DIR__;
chdir($repoDir);

if (!is_dir($repoDir . '/.git')) {
    // Fall back to API update if .git is not initialized
    header("Location: deploy.php?action=applyUpdateApi&token=" . urlencode($expectedSecret));
    exit;
}

$commands = [
    'git status -s',
    'git fetch origin main 2>&1',
    'git reset --hard origin/main 2>&1',
    'git pull origin main 2>&1',
    'git log -1 --pretty=format:"সর্বশেষ কমিট: %h - %s (%cr)" 2>&1'
];

$outputLog = [];
foreach ($commands as $cmd) {
    $output = shell_exec($cmd);
    $outputLog[] = "$ " . $cmd . "\n" . trim((string)$output);
}

$fullOutput = implode("\n\n", $outputLog);

// Save Deployment Log
$logDir = __DIR__ . '/data';
if (!is_dir($logDir)) { @mkdir($logDir, 0755, true); }
$logFile = $logDir . '/deploy.log';
$logEntry = "[" . date('Y-m-d H:i:s') . "] Webhook Deployment:\n" . $fullOutput . "\n" . str_repeat('-', 60) . "\n";
@file_put_contents($logFile, $logEntry, FILE_APPEND);

echo json_encode([
    'success' => true,
    'message' => 'গিটহাবে পুশের ফলে সার্ভার সফলভাবে অটো-আপডেট হয়েছে!',
    'timestamp' => date('c'),
    'output' => $fullOutput
], JSON_UNESCAPED_UNICODE);
