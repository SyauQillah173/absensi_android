<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (!Schema::hasTable('santri')) {
            return;
        }

        $numbers = ['08155936131', '0881026496046'];

        DB::table('santri')
            ->orderBy('id_santri')
            ->pluck('id_santri')
            ->values()
            ->each(function ($id, $index) use ($numbers): void {
                DB::table('santri')
                    ->where('id_santri', $id)
                    ->update([
                        'nomor_wa_wali' => $numbers[$index % count($numbers)],
                        'updated_at' => now(),
                    ]);
            });
    }

    public function down(): void
    {
        // Nomor demo tidak di-rollback agar data uji sidang tetap konsisten.
    }
};
