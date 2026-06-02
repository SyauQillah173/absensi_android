<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

putenv('LOG_CHANNEL=stderr');
putenv('CACHE_STORE=array');
putenv('SESSION_DRIVER=array');
putenv('APP_STORAGE_PATH=/tmp/storage');
putenv('VIEW_COMPILED_PATH=/tmp/storage/framework/views');

$_SERVER['SCRIPT_NAME'] = '/api/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../public/index.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api/')) {
    $_SERVER['HTTP_ACCEPT'] = 'application/json';
}

if (in_array($path, ['/', '/api/health', '/health', '/up'], true)) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'message' => $path === '/' ? 'Absensi backend aktif' : 'API aktif',
        'version' => 'vercel-json-api-20260603-1',
        'timestamp' => date(DATE_ATOM),
    ]);
    exit;
}

foreach ([
    '/tmp/storage/framework/cache/data',
    '/tmp/storage/framework/sessions',
    '/tmp/storage/framework/testing',
    '/tmp/storage/framework/views',
    '/tmp/storage/logs',
] as $path) {
    if (!is_dir($path)) {
        mkdir($path, 0777, true);
    }
}

try {
    if (!defined('LARAVEL_START')) {
        define('LARAVEL_START', microtime(true));
    }

    require __DIR__ . '/../vendor/autoload.php';

    /** @var Application $app */
    $app = require_once __DIR__ . '/../bootstrap/app.php';
    $app->useStoragePath('/tmp/storage');

    $app->handleRequest(Request::capture());
} catch (Throwable $e) {
    if (filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOLEAN)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage(),
            'exception' => get_class($e),
            'file' => basename($e->getFile()),
            'line' => $e->getLine(),
        ]);
        exit;
    }

    throw $e;
}
