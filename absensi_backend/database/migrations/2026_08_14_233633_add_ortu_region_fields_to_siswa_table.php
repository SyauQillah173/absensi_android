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
            // Kolom relasi wilayah untuk Ayah
            $table->unsignedBigInteger('province_id_ayah')->nullable()->after('alamat_ayah');
            $table->unsignedBigInteger('city_id_ayah')->nullable()->after('province_id_ayah');
            $table->unsignedBigInteger('district_id_ayah')->nullable()->after('city_id_ayah');
            $table->unsignedBigInteger('village_id_ayah')->nullable()->after('district_id_ayah');
            $table->string('kode_pos_ayah')->nullable()->after('village_id_ayah');

            // Kolom relasi wilayah untuk Ibu
            $table->unsignedBigInteger('province_id_ibu')->nullable()->after('alamat_ibu');
            $table->unsignedBigInteger('city_id_ibu')->nullable()->after('province_id_ibu');
            $table->unsignedBigInteger('district_id_ibu')->nullable()->after('city_id_ibu');
            $table->unsignedBigInteger('village_id_ibu')->nullable()->after('district_id_ibu');
            $table->string('kode_pos_ibu')->nullable()->after('village_id_ibu');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $table->dropColumn([
                'province_id_ayah', 'city_id_ayah', 'district_id_ayah', 'village_id_ayah', 'kode_pos_ayah',
                'province_id_ibu', 'city_id_ibu', 'district_id_ibu', 'village_id_ibu', 'kode_pos_ibu'
            ]);
        });
    }
};
