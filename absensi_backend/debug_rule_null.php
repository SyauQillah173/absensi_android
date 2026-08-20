<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$rules = \App\Models\PaymentBillRule::whereNull('semester_id')->get();
foreach ($rules as $r) {
    echo "Rule {$r->id}, Name: {$r->name}, Type: {$r->payment_type_id}, Billed Months: " . json_encode($r->billed_months) . "\n";
}
