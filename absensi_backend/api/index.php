<?php

$_SERVER['SCRIPT_NAME'] = '/api/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__ . '/../public/index.php';

putenv('LOG_CHANNEL=stderr');
putenv('CACHE_STORE=array');
putenv('SESSION_DRIVER=array');
putenv('VIEW_COMPILED_PATH=/tmp/views');

if (!is_dir('/tmp/views')) {
    mkdir('/tmp/views', 0777, true);
}

require __DIR__ . '/../public/index.php';
