<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('role', 'admin')->first();
if (!$user) die("No user");

$request = Illuminate\Http\Request::create('/api/pembayaran', 'POST', [
  "user_id" => 1,
  "siswa_id" => 3,
  "atas_nama" => "Wali Ahmad Fauzan",
  "via" => "Tunai",
  "payment_method_id" => 1,
  "academic_year_id" => 1,
  "jumlah" => 1050000,
  "payment_items" => [
    [
      "payment_type_id" => 1,
      "academic_year_id" => 1,
      "period_month" => 7,
      "jumlah" => 350000
    ],
    [
      "payment_type_id" => 1,
      "academic_year_id" => 1,
      "period_month" => 8,
      "jumlah" => 350000
    ],
    [
      "payment_type_id" => 1,
      "academic_year_id" => 1,
      "period_month" => 9,
      "jumlah" => 350000
    ]
  ],
  "payment_security_password" => "Ganti123",
  "status" => "Lunas",
  "tanggal" => "2026-08-18"
]);


$request->headers->set('Accept', 'application/json');
$request->setUserResolver(fn() => $user);

try {
    $controller = app(App\Http\Controllers\Api\PembayaranController::class);
    $response = $controller->store($request);
    echo $response->getContent();
} catch (\Illuminate\Validation\ValidationException $e) {
    echo "VALIDATION ERROR: \n";
    print_r($e->errors());
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
} catch (\Throwable $th) {
    echo "THROWABLE: " . $th->getMessage() . "\n";
    echo $th->getTraceAsString();
}
