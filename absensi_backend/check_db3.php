<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 
try {
    $rule = \App\Models\PaymentBillRule::create(["payment_type_id" => 1, "name" => "Test", "nominal" => 100, "billing_type" => "sekali", "is_active" => true]); 
    var_dump($rule->id); 
    $count = \DB::table("payment_bill_rules")->count(); 
    var_dump($count);
} catch (\Exception $e) {
    echo $e->getMessage() . "\n";
}
