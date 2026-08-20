<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$bills = \App\Models\PaymentBill::whereIn('period_month', [7,8,9,10,11,12])->where('semester_id', 2)->get();
echo "Total bills for Genap with months 7-12: " . $bills->count() . "\n";
foreach ($bills->take(5) as $b) {
    echo "ID: {$b->id}, Type: {$b->payment_type_id}, Status: {$b->status}\n";
}
