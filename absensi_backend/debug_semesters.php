<?php
require "vendor/autoload.php";
$app = require_once "bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$semesters = \App\Models\Semester::all();
foreach ($semesters as $s) {
    echo "Semester {$s->id}, Code: {$s->code}, Name: {$s->name}\n";
}
