<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap(); 

try { 
    $academicYear = \App\Models\AcademicYear::where("is_active", true)->first(); 
    $semester = \App\Models\Semester::where("is_active", true)->first(); 
    
    $students = \App\Models\Siswa::query()->whereHas("tahunAjaran", function ($query) use ($academicYear, $semester) { 
        $query->where("academic_year_id", $academicYear->id)->where("is_active", true); 
        if ($semester) { 
            $query->where("semester_id", $semester->id); 
        } 
    })->count(); 
    
    echo "Students matching Genap: " . $students . "\n"; 
} catch (\Exception $e) { 
    echo $e->getMessage() . "\n"; 
}
