<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$pt = \App\Models\PaymentType::find(1);
var_dump($pt->billed_months);
