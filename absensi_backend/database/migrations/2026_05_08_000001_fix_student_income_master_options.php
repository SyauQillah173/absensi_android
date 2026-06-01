<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('income_ranges')->updateOrInsert(
            ['code' => 'lainnya'],
            ['name' => 'Lainnya', 'created_at' => now(), 'updated_at' => now()]
        );

        foreach ([
            ['code' => 'santri_madin', 'name' => 'Santri Madin'],
            ['code' => 'santri_pondok', 'name' => 'Santri Pondok'],
            ['code' => 'keduanya', 'name' => 'Keduanya'],
        ] as $type) {
            DB::table('student_types')->updateOrInsert(
                ['code' => $type['code']],
                ['name' => $type['name'], 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        // Data master canonical tidak dihapus agar siswa existing tetap aman.
    }
};
