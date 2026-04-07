<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('materi', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('guru_id');
            $table->string('kelas');
            $table->string('mapel');
            $table->string('judul');
            $table->text('deskripsi')->nullable();
            $table->string('file_path');
            $table->enum('file_type', ['foto', 'dokumen'])->default('foto');
            $table->date('tanggal');
            $table->timestamps();

            $table->foreign('guru_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['kelas', 'mapel']);
            $table->index('tanggal');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materi');
    }
};
