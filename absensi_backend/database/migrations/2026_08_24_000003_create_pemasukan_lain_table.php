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
        Schema::create('pemasukan_lain', function (Blueprint $table) {
            $table->id();
            $table->string('no_transaksi')->unique();
            $table->string('judul');
            $table->string('kategori')->default('Infaq & Shodaqoh');
            $table->string('sumber_dana')->default('Kas Tunai Bendahara');
            $table->decimal('jumlah', 15, 2)->default(0);
            $table->date('tanggal');
            $table->string('diterima_dari')->nullable();
            $table->text('keterangan')->nullable();
            $table->string('bukti_foto')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('academic_year_id')->nullable();
            $table->unsignedBigInteger('semester_id')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('academic_year_id')->references('id')->on('academic_years')->nullOnDelete();
            $table->foreign('semester_id')->references('id')->on('semesters')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pemasukan_lain');
    }
};
