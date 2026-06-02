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
    define('LARAVEL_START', microtime(true));

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
