<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('payment_verifications')) {
            Schema::create('payment_verifications', function (Blueprint $table) {
                $table->id();
                $table->string('kode_pengajuan', 40)->unique();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('wali_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('academic_year_id')->nullable()->constrained('academic_years')->nullOnDelete();
                $table->string('tahun_ajaran', 20)->nullable();
                $table->unsignedBigInteger('total_nominal');
                $table->string('bank_pengirim', 50)->nullable();
                $table->string('nama_pengirim', 100)->nullable();
                $table->string('nomor_rekening_pengirim', 50)->nullable();
                $table->string('bank_tujuan', 50)->default('BSI Syariah');
                $table->string('nomor_rekening_tujuan', 50)->default('7171 2026 88');
                $table->date('tanggal_transfer');
                $table->text('bukti_foto');
                $table->text('catatan_wali')->nullable();
                $table->json('selected_bills');
                $table->string('status', 30)->default('menunggu')->index(); // menunggu, disetujui, ditolak
                $table->text('catatan_petugas')->nullable();
                $table->foreignId('verified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('verified_at')->nullable();
                $table->foreignId('payment_transaction_id')->nullable()->constrained('payment_transactions')->nullOnDelete();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_verifications');
    }
};
