<?php

/**
 * One-time script to fix existing payment bills that have null semester_id/semester.
 * Assigns semester based on period_month: Jul-Dec = Ganjil, Jan-Jun = Genap.
 * 
 * Run: php fix_bill_semesters.php
 */

require_once __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== Fix Bill Semesters ===\n\n";

// 1. Find all bills with period_month set but semester_id is null
$bills = DB::table('payment_bills')
    ->whereNotNull('period_month')
    ->whereNull('semester_id')
    ->whereNotNull('academic_year_id')
    ->select('id', 'period_month', 'academic_year_id')
    ->get();

echo "Found {$bills->count()} monthly bills without semester_id\n";

$updated = 0;
$errors = 0;

foreach ($bills as $bill) {
    $month = (int) $bill->period_month;
    $isGanjil = $month >= 7 && $month <= 12;
    $code = $isGanjil ? 'ganjil' : 'genap';

    $semester = DB::table('semesters')
        ->where('academic_year_id', $bill->academic_year_id)
        ->whereRaw('lower(coalesce(code, name)) = ?', [$code])
        ->first();

    if (!$semester) {
        echo "  [SKIP] Bill #{$bill->id} - No semester '{$code}' found for academic_year_id={$bill->academic_year_id}\n";
        $errors++;
        continue;
    }

    DB::table('payment_bills')
        ->where('id', $bill->id)
        ->update([
            'semester_id' => $semester->id,
            'semester' => $semester->name,
            'updated_at' => now(),
        ]);
    $updated++;
}

echo "\nUpdated: {$updated} bills\n";
echo "Skipped: {$errors} bills\n";

// 2. Also fix monthly bills that have semester set but semester_id is wrong
$mismatch = DB::table('payment_bills')
    ->whereNotNull('period_month')
    ->whereNotNull('semester_id')
    ->whereNotNull('academic_year_id')
    ->get();

$fixed = 0;
foreach ($mismatch as $bill) {
    $month = (int) $bill->period_month;
    $isGanjil = $month >= 7 && $month <= 12;
    $code = $isGanjil ? 'ganjil' : 'genap';

    $correctSemester = DB::table('semesters')
        ->where('academic_year_id', $bill->academic_year_id)
        ->whereRaw('lower(coalesce(code, name)) = ?', [$code])
        ->first();

    if ($correctSemester && (int) $correctSemester->id !== (int) $bill->semester_id) {
        DB::table('payment_bills')
            ->where('id', $bill->id)
            ->update([
                'semester_id' => $correctSemester->id,
                'semester' => $correctSemester->name,
                'updated_at' => now(),
            ]);
        $fixed++;
    }
}

echo "Fixed mismatched semester: {$fixed} bills\n";
echo "\n=== Done ===\n";
