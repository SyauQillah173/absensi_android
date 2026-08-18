<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$request = Illuminate\Http\Request::create('/api/pembayaran', 'POST', [
    'user_id' => 1,
    'siswa_id' => 1,
    'via' => 'Tunai',
    'tanggal' => date('Y-m-d'),
    'status' => 'Lunas',
    'payment_items' => [
        [
            'payment_type_id' => 1,
            'jumlah' => 100000,
        ]
    ]
]);

$request->headers->set('Accept', 'application/json');
$user = App\Models\User::first();
$request->setUserResolver(fn() => $user);

try {
    $controller = app(App\Http\Controllers\Api\PembayaranController::class);
    $response = $controller->store($request);
    echo $response->getContent();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
