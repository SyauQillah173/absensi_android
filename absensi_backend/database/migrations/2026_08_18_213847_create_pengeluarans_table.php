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
        Schema::create('pengeluaran', function (Blueprint $table) {
            $table->id();
            $table->string('judul');
            $table->decimal('jumlah', 15, 2);
            $table->date('tanggal');
            $table->string('kategori')->nullable();
            $table->text('keterangan')->nullable();
            $table->unsignedBigInteger('diinput_oleh')->nullable();
            $table->timestamps();

            $table->foreign('diinput_oleh')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pengeluaran');
    }
};
