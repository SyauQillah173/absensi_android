<?php

use Illuminate\Support\Facades\DB;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    // Karena menggunakan PostgreSQL (Neon DB), gunakan CASCADE untuk Truncate yang aman
    DB::statement('TRUNCATE TABLE payment_transactions, pembayaran, payment_bills, payment_bill_rules CASCADE;');

    echo "✅ Berhasil mereset data keuangan (Tagihan, Riwayat Pembayaran, dan Aturan Tagihan)!\n";
    echo "Silahkan setting ulang Tipe Pembayaran (SPP, dll) di Admin Web lalu klik Simpan agar tagihannya di-generate ulang.\n";
} catch (\Exception $e) {
    echo "Gagal: " . $e->getMessage() . "\n";
}
