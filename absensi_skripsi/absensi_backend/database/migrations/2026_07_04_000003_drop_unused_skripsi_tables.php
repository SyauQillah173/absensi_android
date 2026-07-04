<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        foreach ([
            'sync_statuses',
            'offline_conflict_logs',
            'guru_izin',
            'password_reset_tokens',
        ] as $table) {
            DB::statement("drop table if exists {$table} cascade");
        }
    }

    public function down(): void
    {
        // Tabel ini dibuang dari versi skripsi karena kosong dan tidak dipakai fitur aktif.
        // Jika suatu saat diperlukan lagi, buat migration baru sesuai kebutuhan fitur tersebut.
    }
};
