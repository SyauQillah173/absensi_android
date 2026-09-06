<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            if (!Schema::hasColumn('siswa', 'agama')) {
                $table->string('agama', 30)->nullable()->default('Islam')->after('jenis_kelamin');
            }
            if (!Schema::hasColumn('siswa', 'agama_ayah')) {
                $table->string('agama_ayah', 30)->nullable()->default('Islam')->after('tanggal_lahir_ayah');
            }
            if (!Schema::hasColumn('siswa', 'agama_ibu')) {
                $table->string('agama_ibu', 30)->nullable()->default('Islam')->after('tanggal_lahir_ibu');
            }
            if (!Schema::hasColumn('siswa', 'agama_wali')) {
                $table->string('agama_wali', 30)->nullable()->default('Islam')->after('pekerjaan_wali_keluarga');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $columns = ['agama', 'agama_ayah', 'agama_ibu', 'agama_wali'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('siswa', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
