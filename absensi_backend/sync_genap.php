<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 

$academicYear = \App\Models\AcademicYear::where("is_active", true)->first(); 
$semester = \App\Models\Semester::where("is_active", true)->first(); 

echo "Academic Year: " . $academicYear->name . "\n"; 
echo "Semester: " . $semester->name . "\n"; 

$count = app(\App\Services\PaymentBillService::class)->generateBillsForAcademicPeriod($academicYear, $semester); 
echo "Generated/Touched: " . $count . "\n";
