<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$u = App\Models\User::where('role', 'admin')->first();
$u->password = Illuminate\Support\Facades\Hash::make('Ganti123');
$u->save();
echo "Password reverted\n";
