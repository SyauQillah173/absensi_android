<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('master_referensi')) {
            Schema::create('master_referensi', function (Blueprint $table) {
                $table->id();
                $table->string('kategori', 100)->index();
                $table->string('nilai');
                $table->boolean('is_active')->default(true);
                $table->timestamps();

                $table->unique(['kategori', 'nilai'], 'master_referensi_kategori_nilai_unique');
            });

            // Insert default data for Negara
            DB::table('master_referensi')->insert([
                ['kategori' => 'negara', 'nilai' => 'Indonesia', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
                ['kategori' => 'negara', 'nilai' => 'Malaysia', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
                ['kategori' => 'negara', 'nilai' => 'Singapura', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('master_referensi');
    }
};
