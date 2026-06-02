<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

set_exception_handler(function (Throwable $e): void {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'exception' => get_class($e),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ]);
});

register_shutdown_function(function (): void {
    $error = error_get_last();
    if (!$error || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }

    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }

    echo json_encode([
        'success' => false,
        'message' => $error['message'],
        'exception' => 'FatalError',
        'file' => basename($error['file']),
        'line' => $error['line'],
    ]);
});

putenv('LOG_CHANNEL=stderr');
putenv('CACHE_STORE=array');
putenv('SESSION_DRIVER=array');
putenv('APP_STORAGE_PATH=/tmp/storage');
putenv('VIEW_COMPILED_PATH=/tmp/storage/framework/views');

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../public/index.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api/')) {
    $_SERVER['HTTP_ACCEPT'] = 'application/json';
}

if ($path === '/api/_diag/db') {
    header('Content-Type: application/json');

    $dbHost = getenv('DB_HOST') ?: '';
    $dbPort = getenv('DB_PORT') ?: '5432';
    $dbName = getenv('DB_DATABASE') ?: '';
    $dbUser = getenv('DB_USERNAME') ?: '';
    $dbPassword = getenv('DB_PASSWORD') ?: '';

    $diagnostic = [
        'success' => true,
        'php_version' => PHP_VERSION,
        'extensions' => [
            'pdo' => extension_loaded('pdo'),
            'pdo_pgsql' => extension_loaded('pdo_pgsql'),
            'pgsql' => extension_loaded('pgsql'),
        ],
        'pdo_drivers' => class_exists(PDO::class) ? PDO::getAvailableDrivers() : [],
        'env' => [
            'db_connection' => getenv('DB_CONNECTION') ?: null,
            'db_host_present' => $dbHost !== '',
            'db_database_present' => $dbName !== '',
            'db_username_present' => $dbUser !== '',
            'db_password_present' => $dbPassword !== '',
            'db_sslmode' => getenv('DB_SSLMODE') ?: null,
        ],
        'db' => [
            'connected' => false,
        ],
    ];

    if ($dbHost !== '' && $dbName !== '' && $dbUser !== '' && $dbPassword !== '') {
        try {
            $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode=require";
            $pdo = new PDO($dsn, $dbUser, $dbPassword, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 10,
            ]);
            $diagnostic['db']['connected'] = (bool) $pdo->query('select 1')->fetchColumn();
        } catch (Throwable $e) {
            $diagnostic['db']['error'] = $e->getMessage();
        }
    }

    echo json_encode($diagnostic);
    exit;
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
