<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('leave_types')->updateOrInsert(
            ['code' => 'tugas_luar'],
            [
                'name' => 'Tugas Luar',
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('leave_types')
            ->where('code', 'tugas_luar')
            ->where('name', 'Tugas Luar')
            ->delete();
    }
};
