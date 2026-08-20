<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
var_dump(\DB::select("SELECT tgname FROM pg_trigger WHERE tgrelid = 'payment_bills'::regclass"));
