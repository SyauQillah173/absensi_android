<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $walis = DB::table('users')
            ->where('role', 'wali')
            ->orderBy('id')
            ->get(['id', 'name']);

        if ($walis->isEmpty()) {
            return;
        }

        $siswaWithoutWali = DB::table('siswa')
            ->whereNull('wali_id')
            ->orderBy('id')
            ->get(['id', 'nama_wali']);

        foreach ($siswaWithoutWali as $index => $siswa) {
            $wali = $walis[$index % $walis->count()];

            DB::table('siswa')
                ->where('id', $siswa->id)
                ->update([
                    'wali_id' => $wali->id,
                    'nama_wali' => filled($siswa->nama_wali)
                        ? $siswa->nama_wali
                        : $wali->name,
                ]);
        }
    }

    public function down(): void
    {
        // Tidak di-rollback agar relasi wali yang sudah terbentuk tetap aman.
    }
};
