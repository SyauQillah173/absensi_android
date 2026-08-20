<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$bills = \App\Models\PaymentBill::where('semester_id', 2)->where('period_month', 11)->get();
echo "Bills for Genap Month 11: " . $bills->count() . "\n";
foreach ($bills->take(5) as $b) {
    echo "ID: {$b->id}, Type: {$b->payment_type_id}, Status: {$b->status}, Month: {$b->period_month}\n";
}
