<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        foreach ([
            // Fitur di luar batas Bab 1-3 skripsi presensi Madin.
            'payment_bill_notifications',
            'payment_bills',
            'payment_bill_rule_student',
            'payment_bill_rules',
            'payment_type_method',
            'payment_transactions',
            'pembayaran',
            'payment_types',
            'payment_methods',
            'payment_period_types',
            'payment_statuses',
            'admin_payment_security_settings',
            'nilai',
            'hafalan',
            'penilaian_logs',
            'document_settings',
            'assessment_types',
            'memorization_statuses',
            'surahs',
            'materi',
            'kegiatan_foto',
            'kegiatan_fotos',
            'kegiatan',
            'absensi_ngaji',
            'ngaji_schedules',
            'ngaji_books',
            'ngaji_sessions',
            'absensi_sholat',
            'prayer_attendance_types',
            'guru_absensi_sholat_access',
            'santri_pondok',
            'boarding_rooms',
            'boarding_complexes',
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
