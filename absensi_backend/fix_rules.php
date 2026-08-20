<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

\App\Models\PaymentBillRule::where("billing_type", "bulanan")->update(["billed_months" => null]);
echo "Reset billed_months to null for all bulanan rules.\n";
