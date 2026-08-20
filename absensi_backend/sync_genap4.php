<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 

try { 
    $academicYear = \App\Models\AcademicYear::where("is_active", true)->first(); 
    $semester = \App\Models\Semester::where("is_active", true)->first(); 
    
    $paymentTypes = \App\Models\PaymentType::query()->where("status", "Aktif")->get();
    
    echo "Found " . count($paymentTypes) . " payment types.\n";
    $service = app(\App\Services\PaymentBillService::class);
    
    foreach ($paymentTypes as $paymentType) {
        if (!$paymentType->is_billed_to_all) continue;
        
        $rule = $service->ensureRuleForPaymentType($paymentType, null, $semester ? ['semester_id' => $semester->id] : []);
        $isMonthly = str_contains(strtolower($paymentType->periode ?? ''), 'bulan') 
            || str_contains(strtolower($paymentType->nama), 'spp') 
            || str_contains(strtolower($paymentType->nama), 'syahriyah');
            
        echo "Type: {$paymentType->nama}, isMonthly: " . ($isMonthly ? "Yes" : "No") . "\n";
    }
} catch (\Exception $e) { 
    echo $e->getMessage() . "\n"; 
}
