<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pembayaran', function (Blueprint $table) {
            $table->id();
            $table->foreignId('siswa_id')->constrained('siswa')->onDelete('cascade');
            $table->string('atas_nama');
            $table->enum('jenis', ['SPP Bulanan', 'Ujian Semester', 'Buku & Kitab', 'Daftar Ulang', 'Lainnya'])->default('SPP Bulanan');
            $table->enum('via', ['Transfer Dana', 'Bank BRI', 'Bank Mandiri', 'Bank BSI', 'Bank BCA', 'QRIS', 'Tunai'])->default('Tunai');
            $table->integer('jumlah');
            $table->date('tanggal');
            $table->enum('status', ['Lunas', 'Belum Lunas', 'Menunggu'])->default('Lunas');
            $table->string('periode_mulai')->nullable();
            $table->string('periode_selesai')->nullable();
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pembayaran');
    }
};
