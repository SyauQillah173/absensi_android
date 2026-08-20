<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$bills = \App\Models\PaymentBill::whereNull('semester_id')->whereNotNull('period_month')->get();
echo "Total bills with null semester_id and not null period_month: " . $bills->count() . "\n";
foreach ($bills->take(5) as $b) {
    echo "ID: {$b->id}, Type: {$b->payment_type_id}, Month: {$b->period_month}\n";
}
