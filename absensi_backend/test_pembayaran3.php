<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$user = App\Models\User::where('role', 'admin')->first();
if (!$user) die("No user");

$request = Illuminate\Http\Request::create('/api/pembayaran', 'POST', [
    'user_id' => $user->id,
    'siswa_id' => App\Models\Siswa::first()->id ?? 1,
    'via' => 'Tunai',
    'tanggal' => date('Y-m-d'),
    'status' => 'Lunas',
    'biometric_verification_method' => 'admin_password',
    'payment_security_password' => 'password', // Assuming default password is password
    'payment_method_id' => App\Models\PaymentMethod::first()->id ?? null,
    'payment_items' => [
        [
            'payment_type_id' => App\Models\PaymentType::first()->id ?? 1,
            'jumlah' => 100000,
            'status' => 'Lunas',
        ]
    ]
]);

// Set password to something known so it passes!
$user->password = Illuminate\Support\Facades\Hash::make('password');
$user->save();

$request->headers->set('Accept', 'application/json');
$request->setUserResolver(fn() => $user);

try {
    $controller = app(App\Http\Controllers\Api\PembayaranController::class);
    $response = $controller->store($request);
    echo $response->getContent();
} catch (\Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
} catch (\Throwable $th) {
    echo "THROWABLE: " . $th->getMessage() . "\n";
    echo $th->getTraceAsString();
}
