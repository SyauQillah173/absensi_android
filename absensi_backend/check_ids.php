<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
var_dump(\App\Models\PaymentBill::where('id', '>', 3500)->pluck('id')->toArray());
