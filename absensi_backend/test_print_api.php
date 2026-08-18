<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('role', 'admin')->first();
$request = Illuminate\Http\Request::create('/api/document-settings', 'GET');
$request->setUserResolver(fn() => $user);
$controller = app(App\Http\Controllers\Api\DocumentSettingController::class);
$response = $controller->show();
echo "Document Settings:\n" . $response->getContent() . "\n";

$request2 = Illuminate\Http\Request::create('/api/pembayaran/transaksi/4', 'GET');
$request2->setUserResolver(fn() => $user);
$controller2 = app(App\Http\Controllers\Api\PembayaranController::class);
$response2 = $controller2->showTransaction(App\Models\PaymentTransaction::find(4));
echo "Transaction:\n" . $response2->getContent() . "\n";
