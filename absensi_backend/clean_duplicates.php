<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$siswaIds = App\Models\PaymentBill::whereNull('period_month')
    ->groupBy('siswa_id', 'payment_type_id')
    ->havingRaw('count(*) > 1')
    ->get(['siswa_id', 'payment_type_id']);

$deletedCount = 0;
foreach ($siswaIds as $row) {
    $bills = App\Models\PaymentBill::where('siswa_id', $row->siswa_id)
        ->where('payment_type_id', $row->payment_type_id)
        ->whereNull('period_month')
        ->orderBy('id', 'desc')
        ->get();

    $lunas = $bills->where('status', 'Lunas')->first();
    if ($lunas) {
        $toDelete = $bills->where('id', '!=', $lunas->id);
        foreach ($toDelete as $b) {
            $b->delete();
            $deletedCount++;
        }
    } else {
        // keep the first one, delete rest
        $keep = $bills->first();
        $toDelete = $bills->where('id', '!=', $keep->id);
        foreach ($toDelete as $b) {
            $b->delete();
            $deletedCount++;
        }
    }
}
echo "Deleted $deletedCount duplicate bills\n";
