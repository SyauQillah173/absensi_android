<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hafalan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('siswa_id')->constrained('siswa')->onDelete('cascade');
            $table->integer('juz')->nullable(); // 1-30
            $table->string('surah')->nullable();
            $table->enum('status', ['Belum', 'Proses', 'Selesai'])->default('Belum');
            $table->date('tanggal_setor')->nullable();
            $table->string('penguji')->nullable(); // nama guru penguji
            $table->integer('nilai_hafalan')->nullable(); // 1-100
            $table->text('keterangan')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hafalan');
    }
};
