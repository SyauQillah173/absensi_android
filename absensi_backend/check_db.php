<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 
$rule = \DB::table("payment_bill_rules")->where("id", 46)->first(); 
var_dump($rule);
