<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('kode_guru')->nullable()->after('status');
            $table->text('alamat')->nullable()->after('kode_guru');
            $table->json('unit_kerja')->nullable()->after('alamat');
            $table->json('kategori_guru')->nullable()->after('unit_kerja');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unique('kode_guru');
        });

        DB::table('users')
            ->where('role', 'guru')
            ->whereNull('kode_guru')
            ->update([
                'kode_guru' => DB::raw("NULLIF(nis, '')"),
            ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['kode_guru']);
            $table->dropColumn(['kode_guru', 'alamat', 'unit_kerja', 'kategori_guru']);
        });
    }
};
