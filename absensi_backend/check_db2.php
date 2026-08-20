<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 
$conn = \DB::connection();
echo "Driver: " . $conn->getDriverName() . "\n";
echo "Host: " . $conn->getConfig('host') . "\n";
echo "Database: " . $conn->getConfig('database') . "\n";
$count = \DB::table("payment_bill_rules")->count(); 
echo "Total rules: " . $count . "\n"; 
