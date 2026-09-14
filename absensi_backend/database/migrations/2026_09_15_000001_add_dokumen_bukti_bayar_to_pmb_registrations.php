<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pmb_registrations')) {
            Schema::table('pmb_registrations', function (Blueprint $table) {
                if (!Schema::hasColumn('pmb_registrations', 'dokumen_bukti_bayar')) {
                    $table->string('dokumen_bukti_bayar', 255)->nullable()->after('dokumen_ijazah');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('pmb_registrations')) {
            Schema::table('pmb_registrations', function (Blueprint $table) {
                if (Schema::hasColumn('pmb_registrations', 'dokumen_bukti_bayar')) {
                    $table->dropColumn('dokumen_bukti_bayar');
                }
            });
        }
    }
};
