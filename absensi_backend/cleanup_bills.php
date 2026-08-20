<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\PaymentBill;
use App\Models\PaymentType;
use App\Models\Semester;

$isMonthlyCondition = function ($query) {
    $paymentTypeIds = PaymentType::query()
        ->where(function ($q) {
            $q->where('periode', 'like', '%bulan%')
              ->orWhere('nama', 'like', '%spp%')
              ->orWhere('nama', 'like', '%syahriyah%');
        })
        ->pluck('id');
    
    $query->whereIn('payment_type_id', $paymentTypeIds);
};

$ganjilSemesters = Semester::whereRaw('lower(code) = ? or lower(name) like ?', ['1', '%ganjil%'])->pluck('id');
$genapSemesters = Semester::whereRaw('lower(code) = ? or lower(name) like ?', ['2', '%genap%'])->pluck('id');

$ganjilCount = 0;
if ($ganjilSemesters->isNotEmpty()) {
    $ganjilCount = PaymentBill::query()
        ->whereIn('semester_id', $ganjilSemesters)
        ->whereIn('period_month', [1, 2, 3, 4, 5, 6])
        ->where('status', 'Belum Lunas')
        ->where($isMonthlyCondition)
        ->delete();
}

$genapCount = 0;
if ($genapSemesters->isNotEmpty()) {
    $genapCount = PaymentBill::query()
        ->whereIn('semester_id', $genapSemesters)
        ->whereIn('period_month', [7, 8, 9, 10, 11, 12])
        ->where('status', 'Belum Lunas')
        ->where($isMonthlyCondition)
        ->delete();
}

echo "Deleted {$ganjilCount} invalid Ganjil SPP bills.\n";
echo "Deleted {$genapCount} invalid Genap SPP bills.\n";
