<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('role', 'admin')->first();
$request = Illuminate\Http\Request::create('/api/payment-bills/student-summary', 'GET', ['siswa_id' => 3, 'academic_year_id' => 1]);
$request->setUserResolver(fn() => $user);
$controller = app(App\Http\Controllers\Api\PaymentBillController::class);
$response = $controller->studentSummary($request);
echo "Summary:\n" . $response->getContent() . "\n";
