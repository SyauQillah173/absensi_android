<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$pt = \App\Models\PaymentType::with("periodType")->find(1);
echo "SPP: {$pt->nama}, Periode: {$pt->periode}, Month Mode: {$pt->periodType?->month_mode}\n";
