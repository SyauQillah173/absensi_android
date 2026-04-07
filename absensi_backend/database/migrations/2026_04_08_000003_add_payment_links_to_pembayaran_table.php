<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pembayaran', function (Blueprint $table) {
            $table->foreignId('payment_type_id')->nullable()->after('siswa_id')->constrained('payment_types')->nullOnDelete();
            $table->foreignId('wali_id')->nullable()->after('payment_type_id')->constrained('users')->nullOnDelete();
        });

        if (Schema::hasTable('payment_types')) {
            $types = DB::table('payment_types')->pluck('id', 'nama');
            foreach ($types as $nama => $id) {
                DB::table('pembayaran')
                    ->where('jenis', $nama)
                    ->whereNull('payment_type_id')
                    ->update(['payment_type_id' => $id]);
            }
        }

        $waliMapping = DB::table('siswa')
            ->whereNotNull('wali_id')
            ->pluck('wali_id', 'id');

        foreach ($waliMapping as $siswaId => $waliId) {
            DB::table('pembayaran')
                ->where('siswa_id', $siswaId)
                ->whereNull('wali_id')
                ->update([
                    'wali_id' => $waliId,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('pembayaran', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_type_id');
            $table->dropConstrainedForeignId('wali_id');
        });
    }
};
