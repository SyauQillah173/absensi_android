<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            // Data Santri - field baru
            $table->string('nama_panggilan')->nullable()->after('nama');
            $table->string('nik', 16)->nullable()->after('jenis_kelamin');
            $table->string('no_kk', 16)->nullable()->after('nik');
            $table->string('no_akta')->nullable()->after('no_kk');
            $table->string('dokumen_akta')->nullable()->after('no_akta');
            $table->string('kewarganegaraan')->nullable()->default('Indonesia')->after('alamat');
            $table->string('provinsi')->nullable()->after('kewarganegaraan');
            $table->string('kota')->nullable()->after('provinsi');
            $table->string('kecamatan')->nullable()->after('kota');
            $table->string('kelurahan')->nullable()->after('kecamatan');
            $table->string('kode_pos', 5)->nullable()->after('kelurahan');
            $table->string('no_whatsapp', 20)->nullable()->after('kode_pos');
            $table->string('email_siswa')->nullable()->after('no_whatsapp');
            $table->string('tahun_lulus', 4)->nullable()->after('asal_sekolah');
            $table->string('tahun_akademik_masuk')->nullable()->after('tahun_lulus');
            $table->string('jenis_santri')->nullable()->after('tahun_akademik_masuk');

            // Data Orang Tua - field baru
            $table->string('nik_ayah', 16)->nullable()->after('nama_ayah');
            $table->string('nik_ibu', 16)->nullable()->after('nama_ibu');
            $table->string('tempat_lahir_ayah')->nullable()->after('nik_ayah');
            $table->string('tempat_lahir_ibu')->nullable()->after('nik_ibu');
            $table->date('tanggal_lahir_ayah')->nullable()->after('tempat_lahir_ayah');
            $table->date('tanggal_lahir_ibu')->nullable()->after('tempat_lahir_ibu');
            $table->string('no_whatsapp_ayah', 20)->nullable()->after('no_ayah');
            $table->string('no_whatsapp_ibu', 20)->nullable()->after('no_ibu');
            $table->string('penghasilan_ayah')->nullable()->after('pekerjaan_ayah');
            $table->string('penghasilan_ibu')->nullable()->after('pekerjaan_ibu');
            $table->string('wali_sama_dengan')->nullable()->after('alamat_wali_keluarga');

            // Data Profil
            $table->string('tempat_tinggal')->nullable()->after('wali_sama_dengan');
            $table->string('transportasi')->nullable()->after('tempat_tinggal');
            $table->string('tinggi_badan')->nullable()->after('transportasi');
            $table->string('berat_badan')->nullable()->after('tinggi_badan');
            $table->string('golongan_darah')->nullable()->after('berat_badan');
            $table->string('foto_santri')->nullable()->after('golongan_darah');
            $table->text('catatan_santri')->nullable()->after('foto_santri');
        });
    }

    public function down(): void
    {
        Schema::table('siswa', function (Blueprint $table) {
            $table->dropColumn([
                'nama_panggilan', 'nik', 'no_kk', 'no_akta', 'dokumen_akta',
                'kewarganegaraan', 'provinsi', 'kota', 'kecamatan', 'kelurahan',
                'kode_pos', 'no_whatsapp', 'email_siswa', 'tahun_lulus',
                'tahun_akademik_masuk', 'jenis_santri',
                'nik_ayah', 'nik_ibu', 'tempat_lahir_ayah', 'tempat_lahir_ibu',
                'tanggal_lahir_ayah', 'tanggal_lahir_ibu',
                'no_whatsapp_ayah', 'no_whatsapp_ibu',
                'penghasilan_ayah', 'penghasilan_ibu', 'wali_sama_dengan',
                'tempat_tinggal', 'transportasi', 'tinggi_badan', 'berat_badan',
                'golongan_darah', 'foto_santri', 'catatan_santri',
            ]);
        });
    }
};
