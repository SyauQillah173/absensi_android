<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hafalan')) {
            return;
        }

        Schema::table('hafalan', function (Blueprint $table) {
            if (!Schema::hasColumn('hafalan', 'academic_year_id')) {
                $table->foreignId('academic_year_id')->nullable()->constrained('academic_years')->nullOnDelete();
            }
            if (!Schema::hasColumn('hafalan', 'tahun_ajaran')) {
                $table->string('tahun_ajaran', 30)->nullable()->index();
            }
            if (!Schema::hasColumn('hafalan', 'semester')) {
                $table->string('semester', 30)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('hafalan')) {
            return;
        }

        Schema::table('hafalan', function (Blueprint $table) {
            foreach (['academic_year_id', 'tahun_ajaran', 'semester'] as $column) {
                if (Schema::hasColumn('hafalan', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
