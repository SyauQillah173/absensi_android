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
        $index = 0;

        foreach (DB::table('santri')->orderBy('id_santri')->pluck('id_santri') as $id) {
            DB::table('santri')
                ->where('id_santri', $id)
                ->update([
                    'nomor_wa_wali' => $numbers[$index % count($numbers)],
                    'updated_at' => now(),
                ]);
            $index++;
        }
    }

    public function down(): void
    {
        // Nomor demo tidak dikembalikan otomatis karena data awal tiap santri bisa berbeda.
    }
};
