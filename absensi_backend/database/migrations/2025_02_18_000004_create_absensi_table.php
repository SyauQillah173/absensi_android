<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('absensi', function (Blueprint $table) {
            $table->id();
            $table->foreignId('siswa_id')->constrained('siswa')->onDelete('cascade');
            $table->date('tanggal');
            $table->enum('status', ['Hadir', 'Izin', 'Sakit', 'Alfa'])->default('Hadir');
            $table->string('keterangan')->nullable();
            $table->string('kelas')->nullable();
            $table->string('diinput_oleh')->nullable();
            $table->enum('diinput_via', ['online', 'offline_sync'])->default('online');
            $table->string('device_id')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            // Anti-duplikat: 1 siswa hanya boleh 1 absensi per hari per kelas
            $table->unique(['siswa_id', 'tanggal', 'kelas'], 'absensi_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absensi');
    }
};
