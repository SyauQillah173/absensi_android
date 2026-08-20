<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
var_dump((new \App\Models\PaymentBill)->getConnectionName());
var_dump((new \App\Models\PaymentBillNotification)->getConnectionName());
var_dump(\App\Models\PaymentBill::find(3591)?->toArray());
