<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
foreach(\DB::table('payment_period_types')->get() as $t) { echo $t->code . ' - ' . $t->name . "\n"; }
