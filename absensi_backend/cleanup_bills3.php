<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\PaymentBill;

$ganjilCount = PaymentBill::query()
    ->where('semester_id', 1)
    ->whereIn('period_month', [1, 2, 3, 4, 5, 6])
    ->whereIn('status', ['Belum Lunas', 'Terlambat'])
    ->delete();

$genapCount = PaymentBill::query()
    ->where('semester_id', 2)
    ->whereIn('period_month', [7, 8, 9, 10, 11, 12])
    ->whereIn('status', ['Belum Lunas', 'Terlambat'])
    ->delete();

echo "Deleted {$ganjilCount} invalid Ganjil bills.\n";
echo "Deleted {$genapCount} invalid Genap bills.\n";
