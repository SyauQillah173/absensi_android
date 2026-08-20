<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$types = \App\Models\PaymentType::all();
foreach($types as $t) {
    echo $t->id . " - " . $t->nama . "\n";
}
