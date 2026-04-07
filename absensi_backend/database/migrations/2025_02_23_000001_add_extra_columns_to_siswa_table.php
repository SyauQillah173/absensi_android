<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $table->string('alamat')->nullable()->after('kelas');
            $table->string('asal_sekolah')->nullable()->after('alamat');
            $table->string('anak_ke')->nullable()->after('asal_sekolah');
            $table->string('jml_saudara')->nullable()->after('anak_ke');
            $table->string('nama_ayah')->nullable()->after('jml_saudara');
            $table->string('nama_ibu')->nullable()->after('nama_ayah');
            $table->string('pendidikan_ayah')->nullable()->after('nama_ibu');
            $table->string('pendidikan_ibu')->nullable()->after('pendidikan_ayah');
            $table->string('pekerjaan_ayah')->nullable()->after('pendidikan_ibu');
            $table->string('pekerjaan_ibu')->nullable()->after('pekerjaan_ayah');
            $table->string('alamat_ayah')->nullable()->after('pekerjaan_ibu');
            $table->string('alamat_ibu')->nullable()->after('alamat_ayah');
            $table->string('no_ayah', 20)->nullable()->after('alamat_ibu');
            $table->string('no_ibu', 20)->nullable()->after('no_ayah');
            $table->string('nama_wali_keluarga')->nullable()->after('no_ibu');
            $table->string('pekerjaan_wali_keluarga')->nullable()->after('nama_wali_keluarga');
            $table->string('alamat_wali_keluarga')->nullable()->after('pekerjaan_wali_keluarga');
            $table->date('tanggal_masuk')->nullable()->after('alamat_wali_keluarga');
        });
    }

    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $table->dropColumn([
                'alamat', 'asal_sekolah', 'anak_ke', 'jml_saudara',
                'nama_ayah', 'nama_ibu', 'pendidikan_ayah', 'pendidikan_ibu',
                'pekerjaan_ayah', 'pekerjaan_ibu', 'alamat_ayah', 'alamat_ibu',
                'no_ayah', 'no_ibu', 'nama_wali_keluarga',
                'pekerjaan_wali_keluarga', 'alamat_wali_keluarga', 'tanggal_masuk',
            ]);
        });
    }
};
