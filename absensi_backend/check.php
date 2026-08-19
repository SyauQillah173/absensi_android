<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$bills = App\Models\PaymentBill::where('title', 'ilike', '%kerudung%')->get(['id', 'siswa_id', 'title', 'payment_type_id', 'academic_year_id', 'status', 'period_month', 'period_key'])->toArray();
echo json_encode($bills, JSON_PRETTY_PRINT);
