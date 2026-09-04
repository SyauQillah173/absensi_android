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
        if (!Schema::hasTable('pmb_batches')) {
            Schema::create('pmb_batches', function (Blueprint $table) {
                $table->id();
                $table->string('nama_gelombang', 100); // e.g. "Gelombang 1 - 2026/2027"
                $table->string('tahun_akademik', 30);  // e.g. "2026/2027"
                $table->date('tanggal_mulai');
                $table->date('tanggal_selesai');
                $table->decimal('biaya_pendaftaran', 14, 2)->default(0);
                $table->integer('kuota')->nullable();
                $table->boolean('is_active')->default(true);
                $table->text('keterangan')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('pmb_registrations')) {
            Schema::create('pmb_registrations', function (Blueprint $table) {
                $table->id();
                $table->string('registration_number', 50)->unique(); // e.g. "PMB-2026-0001"
                $table->foreignId('pmb_batch_id')->nullable()->constrained('pmb_batches')->nullOnDelete();
                
                // Data Santri
                $table->string('nama_lengkap', 150);
                $table->string('nama_panggilan', 60)->nullable();
                $table->enum('jenis_kelamin', ['L', 'P'])->default('L');
                $table->string('nik', 30)->nullable();
                $table->string('nisn', 30)->nullable();
                $table->string('tempat_lahir', 80)->nullable();
                $table->date('tanggal_lahir')->nullable();
                $table->text('alamat_lengkap')->nullable();
                $table->string('provinsi', 80)->nullable();
                $table->string('kota', 80)->nullable();
                $table->string('kecamatan', 80)->nullable();
                $table->string('asal_sekolah', 120)->nullable();

                // Pilihan Program & Asrama
                $table->string('pilihan_jenjang', 100)->default('Madrasah Diniyah & Pondok');
                $table->string('pilihan_asrama', 100)->default('Pondok Putra');

                // Data Orang Tua / Wali
                $table->string('nama_ayah', 120)->nullable();
                $table->string('pekerjaan_ayah', 80)->nullable();
                $table->string('nama_ibu', 120)->nullable();
                $table->string('pekerjaan_ibu', 80)->nullable();
                $table->string('nama_wali', 120)->nullable();
                $table->string('no_whatsapp_wali', 30)->index();

                // Berkas & Dokumen
                $table->string('dokumen_foto', 255)->nullable();
                $table->string('dokumen_kk', 255)->nullable();
                $table->string('dokumen_ijazah', 255)->nullable();
                $table->text('catatan_khusus')->nullable(); // riwayat penyakit / prestasi

                // Status & Verifikasi
                $table->enum('status', ['pending', 'reviewed', 'accepted', 'rejected'])->default('pending')->index();
                $table->text('catatan_admin')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();

                // Konversi ke Siswa Resmi
                $table->boolean('is_converted')->default(false)->index();
                $table->unsignedBigInteger('converted_siswa_id')->nullable()->index();

                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pmb_registrations');
        Schema::dropIfExists('pmb_batches');
    }
};
