<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$rules = \DB::table("payment_bill_rules")->where("payment_type_id", 1)->get();
foreach($rules as $r) {
    var_dump($r);
}
