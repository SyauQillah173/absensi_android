<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_types', function (Blueprint $table) {
            $table->id();
            $table->string('nama')->unique();
            $table->text('deskripsi')->nullable();
            $table->integer('nominal_default')->default(0);
            $table->enum('periode', ['sekali', 'bulanan', 'tahunan'])->default('sekali');
            $table->json('metode_pembayaran')->nullable();
            $table->enum('status', ['Aktif', 'Nonaktif'])->default('Aktif');
            $table->timestamps();
        });

        $now = now();
        DB::table('payment_types')->insert([
            [
                'nama' => 'SPP Bulanan',
                'deskripsi' => 'Tagihan bulanan santri',
                'nominal_default' => 250000,
                'periode' => 'bulanan',
                'metode_pembayaran' => json_encode(['Tunai', 'Transfer Dana', 'Bank BRI', 'Bank BSI', 'QRIS']),
                'status' => 'Aktif',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'nama' => 'Ujian Semester',
                'deskripsi' => 'Tagihan ujian semester',
                'nominal_default' => 200000,
                'periode' => 'sekali',
                'metode_pembayaran' => json_encode(['Tunai', 'Transfer Dana', 'Bank BRI', 'Bank Mandiri', 'QRIS']),
                'status' => 'Aktif',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'nama' => 'Buku & Kitab',
                'deskripsi' => 'Tagihan buku dan kitab',
                'nominal_default' => 350000,
                'periode' => 'sekali',
                'metode_pembayaran' => json_encode(['Tunai', 'Transfer Dana', 'Bank BRI', 'Bank BCA', 'QRIS']),
                'status' => 'Aktif',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'nama' => 'Daftar Ulang',
                'deskripsi' => 'Tagihan daftar ulang tahunan',
                'nominal_default' => 500000,
                'periode' => 'tahunan',
                'metode_pembayaran' => json_encode(['Tunai', 'Transfer Dana', 'Bank BSI', 'QRIS']),
                'status' => 'Aktif',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_types');
    }
};
