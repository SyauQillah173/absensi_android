<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$b = \App\Models\PaymentBill::where('siswa_id', 1)->where('payment_type_id', 1)->where('period_month', 8)->first();
var_dump($b?->toArray());
